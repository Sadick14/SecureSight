from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import List, Optional
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
import os
from dotenv import load_dotenv
import uuid
import asyncio
import git
import shutil
from datetime import datetime
import aiofiles
from urllib.parse import unquote
from github import Github  # Import the PyGithub library

# Load environment variables
load_dotenv()

# Initialize Supabase with the synchronous client
def get_sync_supabase_client() -> Client:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")
    # Create the synchronous Supabase client
    supabase: Client = create_client(supabase_url, supabase_key)
    return supabase

# Dependency to get the synchronous Supabase client
def get_supabase_sync() -> Client:
    return get_sync_supabase_client()

# **WARNING:** Using the synchronous Supabase client in FastAPI will block the event loop
# for I/O operations. It's highly recommended to migrate to the asynchronous client
# for better performance in an asynchronous framework like FastAPI.

router = APIRouter()

# Pydantic models for request bodies
class CreateProjectGitHub(BaseModel):
    repo_url: str
    user_id: str
    github_access_token: Optional[str] = None
    project_name: Optional[str] = None
    project_description: Optional[str] = None
    tech_stack: Optional[str] = None

# Pydantic model for renaming a project
class RenameProject(BaseModel):
    name: str
    user_id: str

# ★★ New Pydantic model for deleting a project ★★
class DeleteProject(BaseModel):
    user_id: str

# Dependency to get the user_id from the project_id
def get_user_id_from_project(project_id: str, db: Client = Depends(get_supabase_sync)) -> str:
    try:
        # WARNING: This is a synchronous database call and will block the event loop
        response = db.table("projects").select("user_id", "type", "repo_url").eq("id", project_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Project not found in database.")
        return response.data['user_id']
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user ID for project: {e}")

# Helper to get project details
def get_project_details(project_id: str, db: Client = Depends(get_supabase_sync)):
    try:
        response = db.table("projects").select("user_id", "type", "repo_url").eq("id", project_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Project not found in database.")
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching project details: {e}")

async def clone_and_upload_repo(repo_url: str, user_id: str, project_id: str, db: Client = Depends(get_supabase_sync)):
    print(f"Type of db in clone_and_upload_repo: {type(db)}")
    temp_dir = f"/tmp/repo_{uuid.uuid4()}"
    bucket_name = "project-files"

    try:
        print(f"Cloning {repo_url} to {temp_dir}")
        await asyncio.to_thread(git.Repo.clone_from, repo_url, temp_dir)
        print("Cloning complete.")

        uploaded_file_paths = []

        for root, dirs, files in os.walk(temp_dir):
            # Create 'dir' entries for the tree
            for dir_name in dirs:
                relative_path = os.path.relpath(os.path.join(root, dir_name), temp_dir)
                uploaded_file_paths.append(f"{user_id}/{project_id}/repo/{relative_path}/") # Add trailing slash for directories

            for file in files:
                local_path = os.path.join(root, file)
                relative_path = os.path.relpath(local_path, temp_dir)
                remote_path = f"{user_id}/{project_id}/repo/{relative_path}"

                try:
                    async with aiofiles.open(local_path, mode="rb") as f:
                        content = await f.read()

                    print(f"Uploading {local_path} to {remote_path} in bucket {bucket_name}")
                    # **********************************************************************
                    # WARNING: This Supabase operation is now SYNC and will BLOCK the event loop.
                    # This is a temporary workaround. The ideal solution is to use the async client.
                    # **********************************************************************
                    db.storage.from_(bucket_name).upload(remote_path, content)
                    uploaded_file_paths.append(remote_path)
                    print(f"Successfully uploaded {remote_path}")

                except Exception as e:
                    print(f"Error uploading {local_path}: {e}")

        # **********************************************************************
        # WARNING: This Supabase operation is now SYNC and will BLOCK the event loop.
        # This is a temporary workaround. The ideal solution is to use the async client.
        # **********************************************************************
        db.table("projects").update({"uploaded_files": uploaded_file_paths, "status": "active"}).eq("id", project_id).execute()
        print(f"Project {project_id} status updated to 'active'.")

    except git.exc.GitCommandError as e:
        print(f"Git cloning error: {e}")
        # **********************************************************************
        # WARNING: This Supabase operation is now SYNC and will BLOCK the event loop.
        # This is a temporary workaround. The ideal solution is to use the async client.
        # **********************************************************************
        db.table("projects").update({"status": "failed", "error_message": str(e)}).eq("id", project_id).execute()
        raise
    except Exception as e:
        print(f"An error occurred during cloning or uploading: {e}")
        # **********************************************************************
        # WARNING: This Supabase operation is now SYNC and will BLOCK the event loop.
        # This is a temporary workaround. The ideal solution is to use the async client.
        # **********************************************************************
        db.table("projects").update({"status": "failed", "error_message": str(e)}).eq("id", project_id).execute()
        raise
    finally:
        if os.path.exists(temp_dir):
            await asyncio.to_thread(shutil.rmtree, temp_dir)
            print(f"Cleaned up temporary directory {temp_dir}")

@router.post("/projects/create/github/")
async def create_project_github(project: CreateProjectGitHub, db: Client = Depends(get_supabase_sync)):
    print(f"Type of db in create_project_github: {type(db)}")
    project_id = str(uuid.uuid4())

    try:
        if not project.project_name:
            parts = project.repo_url.rstrip('/').split('/')
            if len(parts) >= 2:
                project.project_name = parts[-1].replace(".git", "")

        # **********************************************************************
        # WARNING: This Supabase operation is now SYNC and will BLOCK the event loop.
        # This is a temporary workaround. The ideal solution is to use the async client.
        # **********************************************************************
        response, count = db.table("projects").insert({
            "id": project_id,
            "user_id": project.user_id,
            "name": project.project_name,
            "type": "repo",
            "repo_url": project.repo_url,
            "description": project.project_description,
            "tech_stack": project.tech_stack,
            "created_at": datetime.utcnow().isoformat(),
            "status": "pending",
            "uploaded_files": []
        }).execute()

        if not response:
            raise HTTPException(status_code=500, detail="Failed to create project entry in Supabase")

        asyncio.create_task(clone_and_upload_repo(project.repo_url, project.user_id, project_id, db))

        return {"message": "Project creation initiated. Cloning in the background.", "project_id": project_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/create/upload/")
async def create_project_upload(
    files: List[UploadFile] = File(...),
    project_name: str = Form(...),
    user_id: str = Form(...),
    project_description: Optional[str] = Form(None),
    tech_stack: Optional[str] = Form(None),
    db: Client = Depends(get_supabase_sync)
):
    print(f"Type of db in create_project_upload: {type(db)}")
    project_id = str(uuid.uuid4())
    bucket_name = "project-files"

    try:
        # **********************************************************************
        # WARNING: This Supabase operation is now SYNC and will BLOCK the event loop.
        # This is a temporary workaround. The ideal solution is to use the async client.
        # **********************************************************************
        response, count = db.table("projects").insert({
            "id": project_id,
            "user_id": user_id,
            "name": project_name,
            "type": "upload",
            "description": project_description,
            "tech_stack": tech_stack,
            "created_at": datetime.utcnow().isoformat(),
            "status": "pending",
            "uploaded_files": []
        }).execute()

        if not response:
            raise HTTPException(status_code=500, detail="Failed to create project entry in Supabase")

        uploaded_file_paths = []
        upload_tasks = []

        for file in files:
            file_path = f"{user_id}/{project_id}/upload/{file.filename}"
            async with aiofiles.open(f"/tmp/{file.filename}", "wb") as out_file:
                while content := await file.read(1024):
                    await out_file.write(content)
            async with aiofiles.open(f"/tmp/{file.filename}", "rb") as f:
                content = await f.read()

            # **********************************************************************
            # WARNING: This Supabase operation is now SYNC and will BLOCK the event loop.
            # This is a temporary workaround. The ideal solution is to use the async client.
            # **********************************************************************
            upload_tasks.append(
                asyncio.to_thread(db.storage.from_(bucket_name).upload, file_path, content, {"content-type": file.content_type})
            )
            uploaded_file_paths.append(file_path)

        results = await asyncio.gather(*upload_tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                print(f"Upload error: {result}")
                # **********************************************************************
                # WARNING: This Supabase operation is now SYNC and will BLOCK the event loop.
                # This is a temporary workaround. The ideal solution is to use the async client.
                # **********************************************************************
                db.table("projects").update({"status": "failed", "error_message": str(result)}).eq("id", project_id).execute()
                raise HTTPException(status_code=500, detail=f"File upload failed: {result}")

        # **********************************************************************
        # WARNING: This Supabase operation is now SYNC and will BLOCK the event loop.
        # This is a temporary workaround. The ideal solution is to use the async client.
        # **********************************************************************
        updated_response, update_count = db.table("projects").update({
            "uploaded_files": uploaded_file_paths,
            "status": "active"
        }).eq("id", project_id).execute()

        if updated_response:
            return {"message": "Project created and files uploaded successfully", "project": updated_response[0], "uploaded_files": uploaded_file_paths}
        else:
            raise HTTPException(status_code=500, detail="Failed to update project with file info")

    except Exception as e:
        if 'project_id' in locals():
            # **********************************************************************
            # WARNING: This Supabase operation is now SYNC and will BLOCK the event loop.
            # This is a temporary workaround. The ideal solution is to use the async client.
            # **********************************************************************
            db.table("projects").update({"status": "failed", "error_message": str(e)}).eq("id", project_id).execute()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/projects/{project_id}/repo/files")
def list_repo_files(
    project_id: str,
    supabase: Client = Depends(get_supabase_sync),
    user_id: str = Depends(get_user_id_from_project)
):
    """
    Lists all files in the 'repo' directory for a given project in Supabase Storage.
    """
    bucket_name = "project-files"
    base_storage_path = f"{user_id}/{project_id}/repo/"
    print(f"Listing files for project_id: {project_id}, user_id: {user_id}, path: {base_storage_path}")

    try:
        response = supabase.storage.from_(bucket_name).list(path=base_storage_path, options={'recursive': True})
        print(f"Supabase Storage list response: {response}")

        if response:
            file_paths = []
            for item in response:
                print(f"Processing storage item: {item}")
                if 'name' in item and item['name'] and item['id'] != '.emptyFolder':
                    # 'item['name']' is the path relative to the 'path' argument in the list call
                    # In this case, it's the path relative to '{user_id}/{project_id}/repo/'
                    relative_path_from_repo = item['name']
                    file_paths.append(f"repo/{relative_path_from_repo}")
            print(f"Generated file_paths: {file_paths}")
            return file_paths
        else:
            print("Supabase Storage list returned no items.")
            return []
    except Exception as e:
        print(f"Error listing repository files: {e}")
        raise HTTPException(status_code=500, detail=f"Error listing repository files: {e.detail if isinstance(e, HTTPException) else str(e)}")

@router.get("/api/projects/{project_id}/files/{file_path:path}")
def get_project_file_content(
    project_id: str,
    file_path: str,
    supabase: Client = Depends(get_supabase_sync),
    user_id: str = Depends(get_user_id_from_project)
):
    """
    Fetches the content of a specific file from Supabase Storage.
    """
    bucket_name = "project-files"
    decoded_file_path = unquote(file_path)

    # The file_path will now include the 'repo/' or 'upload/' prefix from the frontend
    full_storage_path = f"{user_id}/{project_id}/{decoded_file_path}"
    print(f"Attempting to fetch file from: {full_storage_path} in bucket: {bucket_name}")

    try:
        # WARNING: This is a SYNCHRONOUS Supabase Storage operation
        # and will BLOCK the event loop. Consider migrating to the
        # asynchronous Supabase client for better performance.
        response = supabase.storage.from_(bucket_name).download(full_storage_path)
        if response:
            # Assuming text-based files, decode to a string
            file_content = response.decode('utf-8')
            return PlainTextResponse(file_content)
        else:
            raise HTTPException(status_code=404, detail="File not found in storage.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading file: {e.detail if isinstance(e, HTTPException) else str(e)}")


# ★★ New Endpoint: Get the file tree for a project ★★
@router.get("/api/projects/{project_id}/file-tree")
def get_project_file_tree(
    project_id: str,
    db: Client = Depends(get_supabase_sync)
):
    project = get_project_details(project_id, db)
    user_id = project['user_id']
    project_type = project['type']
    bucket_name = "project-files"

    try:
        if project_type == 'repo':
            # **Fetching file tree for a GitHub repository**
            repo_url = project['repo_url']
            # Extract owner and repo name from the URL
            parts = repo_url.rstrip('/').split('/')
            owner = parts[-2]
            repo_name = parts[-1].replace(".git", "")

            # **WARNING: Using synchronous GitHub API in a FastAPI endpoint. Consider using an async HTTP client like `httpx` instead of `PyGithub` directly here.**
            # For simplicity and to use a familiar library, I'll use a synchronous call with `asyncio.to_thread`.
            def fetch_github_tree():
                try:
                    g = Github(os.getenv("GITHUB_ACCESS_TOKEN"))  # Ensure you have a GitHub token set in your environment
                    repo = g.get_user(owner).get_repo(repo_name)
                    tree = repo.get_git_tree(repo.default_branch, recursive=True)
                    file_tree = []
                    for element in tree.tree:
                        file_tree.append({
                            "path": f"repo/{element.path}",
                            "name": element.path.split('/')[-1],
                            "type": "dir" if element.type == "tree" else "file",
                        })
                    return file_tree
                except Exception as e:
                    raise Exception(f"Error fetching GitHub tree: {e}")

            github_tree = asyncio.run(asyncio.to_thread(fetch_github_tree))

            # Build the hierarchical structure
            tree = []
            paths = {}

            for item in github_tree:
                parts = item['path'].split('/')
                current_level = tree
                current_path = ""
                for i, part in enumerate(parts):
                    if i > 0:
                        current_path += "/" + part
                    else:
                        current_path = part

                    if current_path not in paths:
                        new_item = {
                            "path": current_path,
                            "name": part,
                            "type": "dir" if item['type'] == 'dir' and i < len(parts) - 1 else item['type'],
                            "children": []
                        }
                        current_level.append(new_item)
                        paths[current_path] = new_item
                    
                    if i < len(parts) - 1:
                        current_level = paths[current_path]["children"]

            return tree

        elif project_type == 'upload':
            # **Fetching file tree for an uploaded project**
            base_storage_path = f"{user_id}/{project_id}/upload/"
            # WARNING: This is a SYNCHRONOUS Supabase Storage operation
            response = supabase.storage.from_(bucket_name).list(path=base_storage_path, options={'recursive': True})

            if response:
                file_tree = []
                paths = {}

                # Sort the items to ensure parent directories are processed before their children
                sorted_response = sorted(response, key=lambda x: x['name'])

                for item in sorted_response:
                    if 'name' in item and item['name'] and item['id'] != '.emptyFolder':
                        relative_path = item['name']
                        full_path = f"upload/{relative_path}"
                        parts = full_path.split('/')
                        current_level = file_tree
                        current_path = ""

                        for i, part in enumerate(parts):
                            if i > 0:
                                current_path += "/" + part
                            else:
                                current_path = part

                            if current_path not in paths:
                                new_item = {
                                    "path": current_path,
                                    "name": part,
                                    "type": "dir" if i < len(parts) - 1 else "file",
                                    "children": []
                                }
                                current_level.append(new_item)
                                paths[current_path] = new_item
                            
                            if i < len(parts) - 1:
                                current_level = paths[current_path]["children"]

                return file_tree
            else:
                return []
        else:
            raise HTTPException(status_code=400, detail="Unsupported project type.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching file tree: {str(e)}")


# PATCH endpoint for renaming a project
@router.patch("/api/projects/{project_id}")
async def rename_project(
    project_id: str,
    rename_data: RenameProject,
    db: Client = Depends(get_supabase_sync),
    authorized_user_id: str = Depends(get_user_id_from_project)
):
    if authorized_user_id != rename_data.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to rename this project.")

    try:
        # WARNING: This is a SYNCHRONOUS Supabase operation and will BLOCK the event loop.
        response, count = db.table("projects").update({"name": rename_data.name}).eq("id", project_id).execute()

        if not response:
            raise HTTPException(status_code=404, detail="Project not found or failed to update.")

        return {"message": "Project renamed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error renaming project: {e}")

# DELETE endpoint for deleting a project
@router.delete("/api/projects/{project_id}")
async def delete_project(
    project_id: str,
    delete_data: DeleteProject, # ★★ Using the new DeleteProject Pydantic model ★★
    db: Client = Depends(get_supabase_sync),
    authorized_user_id: str = Depends(get_user_id_from_project)
):
    if authorized_user_id != delete_data.user_id: # ★★ Accessing user_id from delete_data ★★
        raise HTTPException(status_code=403, detail="Not authorized to delete this project.")

    try:
        # WARNING: This is a SYNCHRONOUS Supabase operation and will BLOCK the event loop.
        response, count = db.table("projects").delete().eq("id", project_id).execute()

        if not response:
            raise HTTPException(status_code=404, detail="Project not found or failed to delete.")

        # ★★ Optional: You might want to delete the project's files from storage here as well ★★
        # You'd need to list and then delete files under the user_id/project_id/ path in the bucket.
        # This can be done asynchronously.
        # Example (you'd need to implement `delete_project_files`):
        # asyncio.create_task(delete_project_files(delete_data.user_id, project_id, db))

        return {"message": "Project deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting project: {e}")