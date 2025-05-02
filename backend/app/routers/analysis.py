from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import httpx
from supabase import create_client, Client
from git import Repo
import tempfile
import shutil
import uuid
from datetime import datetime
import json
from github import Github
import aiofiles
from urllib.parse import unquote

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

router = APIRouter()


# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# Models
class FileTreeItem(BaseModel):
    path: str
    name: str
    type: str  # 'file' or 'dir'
    children: Optional[List['FileTreeItem']] = None

class Vulnerability(BaseModel):
    filePath: str
    lineNumber: int
    severity: str  # 'High', 'Medium', 'Low'
    description: str
    suggestion: str

class CodeSuggestion(BaseModel):
    lineNumber: int
    suggestion: str
    replacement: Optional[str] = None

class FileContent(BaseModel):
    filePath: str
    content: str

class CodeAnalysisRequest(BaseModel):
    code: str
    filePath: str
    language: str

class CodeAnalysisResponse(BaseModel):
    vulnerabilities: List[Vulnerability]
    suggestions: List[CodeSuggestion]

class GitHubSyncRequest(BaseModel):
    projectId: str
    repoUrl: str
    branch: str = "main"
    commitMessage: str = "Auto-sync from code editor"

class FileSaveRequest(BaseModel):
    projectId: str
    filePath: str
    content: str
    commitMessage: Optional[str] = None

# Utility Functions
async def analyze_code_with_gemini(code: str, file_path: str, language: str) -> Dict:
    """Analyze code using Gemini API with fallback to local analysis"""
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        return simulate_code_analysis(code, file_path, language)
    
    try:
        prompt = f"""
        Analyze this {language} code for security vulnerabilities and provide suggestions:
        
        Code from {file_path}:
        {code}
        
        Return a JSON response with:
        - vulnerabilities: array of objects with filePath, lineNumber, severity, description, suggestion
        - suggestions: array of objects with lineNumber, suggestion, and optional replacement
        """
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={GEMINI_API_KEY}",
                json={
                    "contents": [{
                        "parts": [{"text": prompt}]
                    }]
                },
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            try:
                text_response = data['candidates'][0]['content']['parts'][0]['text']
                return json.loads(text_response)
            except (KeyError, json.JSONDecodeError):
                return simulate_code_analysis(code, file_path, language)
                
    except Exception as e:
        print(f"Gemini API error: {e}")
        return simulate_code_analysis(code, file_path, language)

def simulate_code_analysis(code: str, file_path: str, language: str) -> Dict:
    """Simulate code analysis when Gemini isn't available"""
    vulnerabilities = []
    suggestions = []
    
    lines = code.split('\n')
    for i, line in enumerate(lines):
        line_num = i + 1
        
        # Simulate finding hardcoded credentials
        if any(term in line.lower() for term in ['password', 'secret', 'api_key']):
            vulnerabilities.append({
                "filePath": file_path,
                "lineNumber": line_num,
                "severity": "High",
                "description": "Hardcoded sensitive information",
                "suggestion": "Use environment variables or secure storage"
            })
        
        # Simulate finding potential SQL injection
        if 'sql' in line.lower() and '+' in line and any(term in line.lower() for term in ['select', 'insert', 'update']):
            vulnerabilities.append({
                "filePath": file_path,
                "lineNumber": line_num,
                "severity": "High",
                "description": "Potential SQL injection vulnerability",
                "suggestion": "Use parameterized queries or ORM"
            })
        
        # Simulate code suggestions
        if 'for (' in line or 'for(' in line:
            suggestions.append({
                "lineNumber": line_num,
                "suggestion": "Consider using for-of or for-in loop for better readability",
                "replacement": None
            })
    
    return {
        "vulnerabilities": vulnerabilities,
        "suggestions": suggestions
    }

async def sync_with_github(repo_url: str, local_path: str, branch: str, commit_message: str):
    """Sync local changes with GitHub repository"""
    try:
        if not os.path.exists(local_path):
            Repo.clone_from(repo_url, local_path, branch=branch)
        
        repo = Repo(local_path)
        repo.git.add(A=True)
        
        if repo.is_dirty():
            repo.git.commit(m=commit_message)
            origin = repo.remote(name='origin')
            origin.push()
            
        return {"status": "success", "message": "Synced with GitHub"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def save_file_to_supabase(project_id: str, file_path: str, content: str):
    """Save file content to Supabase storage"""
    try:
        # Get user_id from project
        project_data = supabase.table("projects").select("user_id").eq("id", project_id).single().execute()
        user_id = project_data.data['user_id']
        
        # Save to Supabase Storage
        bucket_name = "project-files"
        storage_path = f"{user_id}/{project_id}/repo/{file_path}"
        
        # Upload the file
        supabase.storage.from_(bucket_name).upload(storage_path, content)
        
        # Update the project's file list
        supabase.table("projects").update({
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", project_id).execute()
        
        return {"status": "success", "path": storage_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# API Endpoints
@router.post("/api/projects/{project_id}/analyze")
async def analyze_code(project_id: str, request: CodeAnalysisRequest):
    """Analyze code for vulnerabilities and suggestions"""
    try:
        analysis = await analyze_code_with_gemini(
            request.code, 
            request.filePath, 
            request.language
        )
        
        return CodeAnalysisResponse(**analysis)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/projects/{project_id}/files/save")
async def save_file(project_id: str, request: FileSaveRequest):
    """Save file content with optional GitHub sync"""
    try:
        # Save to Supabase
        supabase_result = await save_file_to_supabase(
            project_id,
            request.filePath,
            request.content
        )
        
        # Sync with GitHub if commit message provided
        github_result = None
        if request.commitMessage:
            project_data = supabase.table("projects").select("repo_url").eq("id", project_id).single().execute()
            if project_data.data.get('repo_url'):
                local_path = f"/tmp/project_{project_id}"
                github_result = await sync_with_github(
                    project_data.data['repo_url'],
                    local_path,
                    "main",
                    request.commitMessage
                )
        
        return {
            "status": "success",
            "supabase": supabase_result,
            "github": github_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/projects/{project_id}/sync-github")
async def sync_github(project_id: str, request: GitHubSyncRequest):
    """Sync project with GitHub repository"""
    try:
        project_data = supabase.table("projects").select("repo_url").eq("id", project_id).single().execute()
        if not project_data.data.get('repo_url'):
            raise HTTPException(status_code=400, detail="Project not linked to GitHub")
        
        local_path = f"/tmp/project_{project_id}"
        result = await sync_with_github(
            project_data.data['repo_url'],
            local_path,
            request.branch,
            request.commitMessage
        )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/projects/{project_id}/scan")
async def scan_project(project_id: str):
    """Scan entire project for vulnerabilities"""
    try:
        # Get project details
        project_data = supabase.table("projects").select("user_id, type, repo_url").eq("id", project_id).single().execute()
        user_id = project_data.data['user_id']
        project_type = project_data.data['type']
        
        # Get all files from Supabase Storage
        bucket_name = "project-files"
        base_path = f"{user_id}/{project_id}/"
        files = supabase.storage.from_(bucket_name).list(base_path, {"recursive": True})
        
        vulnerabilities = []
        
        # Analyze each file
        for file in files:
            if file['name'].endswith(('.py', '.js', '.ts', '.java', '.go', '.rb', '.php', '.html', '.css')):
                file_path = file['name']
                content = supabase.storage.from_(bucket_name).download(file_path).decode('utf-8')
                
                # Get language from file extension
                extension = file_path.split('.')[-1]
                language = {
                    'py': 'python',
                    'js': 'javascript',
                    'ts': 'typescript',
                    'java': 'java',
                    'go': 'go',
                    'rb': 'ruby',
                    'php': 'php',
                    'html': 'html',
                    'css': 'css'
                }.get(extension, 'plaintext')
                
                # Analyze the file
                analysis = await analyze_code_with_gemini(content, file_path, language)
                vulnerabilities.extend(analysis.get('vulnerabilities', []))
        
        return {
            "projectId": project_id,
            "vulnerabilities": vulnerabilities,
            "total": len(vulnerabilities),
            "filesScanned": len(files)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

