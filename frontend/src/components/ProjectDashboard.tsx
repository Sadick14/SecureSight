import React, { useEffect, useState } from 'react';

interface Project {
  id: string;
  name: string;
  type: 'repo' | 'upload';
  description?: string;
  repo_url?: string;
  uploaded_files?: string[];
}

interface ProjectDashboardProps {
  project: Project | null;
  onFileClick: (filePath: string) => void;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ project, onFileClick }) => {
  const [repoFiles, setRepoFiles] = useState<string[] | null>(null);
  const [loadingRepoFiles, setLoadingRepoFiles] = useState<boolean>(false);
  const [repoFilesError, setRepoFilesError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepoFiles = async (projectId: string) => {
      setLoadingRepoFiles(true);
      setRepoFilesError(null);
      try {
        // **★ 1. Verify the API URL is CORRECT here! ★**
        const response = await fetch(`http://localhost:8000/api/projects/${projectId}/repo/files`);

        if (!response.ok) {
          throw new Error(`Failed to fetch repository files: ${response.statusText}`);
        }

        const files: string[] = await response.json();
        setRepoFiles(files);
      } catch (err: any) {
        setRepoFilesError(err.message);
      } finally {
        setLoadingRepoFiles(false);
      }
    };

    // **★ 2. Carefully check these conditions! ★**
    if (project?.type === 'repo' && project.id) {
      console.log("Project type is 'repo' and project.id exists:", project.id); // ★ Add this for debugging!
      fetchRepoFiles(project.id);
    } else if (project?.type === 'upload') {
      console.log("Project type is 'upload'. Not fetching repo files."); // ★ Add this for debugging!
      setRepoFiles(null);
    } else {
      console.log("No project selected or project type is not 'repo' or 'upload'."); // ★ Add this for debugging!
    }
  }, [project]); // Re-run this effect whenever the 'project' prop changes

  if (!project) {
    return <div className="p-8 text-gray-400">Select a project to view details.</div>;
  }

  return (
    <div className="p-8 bg-gray-800 rounded-xl shadow-lg text-white">
      <h2 className="text-3xl font-bold mb-4">{project.name}</h2>
      <p className="mb-2">
        <strong>Type:</strong> {project.type === 'repo' ? 'GitHub Repository' : 'Uploaded Folder'}
      </p>
      {project.description && <p className="mb-2"><strong>Description:</strong> {project.description}</p>}
      {project.type === 'repo' && project.repo_url && (
        <p className="mb-2">
          <strong>Repository URL:</strong>{' '}
          <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            {project.repo_url}
          </a>
        </p>
      )}

      {project.type === 'upload' && project.uploaded_files && (
        <div className="mt-4">
          <h3 className="text-xl font-semibold mb-2">Uploaded Files:</h3>
          <ul className="list-disc list-inside">
            {project.uploaded_files.map((file, index) => (
              <li key={index} className="cursor-pointer text-blue-400 hover:underline" onClick={() => onFileClick(file)}>
                {file}
              </li>
            ))}
          </ul>
        </div>
      )}

      {project.type === 'repo' && (
        <div className="mt-4">
          <h3 className="text-xl font-semibold mb-2">Repository Files:</h3>
          {loadingRepoFiles && <div className="text-gray-400">Loading repository files...</div>}
          {repoFilesError && <div className="text-red-500">Error: {repoFilesError}</div>}
          {repoFiles && repoFiles.length > 0 && (
            <ul className="list-disc list-inside">
              {repoFiles.map((file, index) => (
                <li key={index} className="cursor-pointer text-blue-400 hover:underline" onClick={() => onFileClick(`repo/${file}`)}>
                  {file}
                </li>
              ))}
            </ul>
          )}
          {repoFiles && repoFiles.length === 0 && (
            <div className="text-gray-400">No files found in the repository.</div>
          )}
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-gray-700 text-gray-500 text-sm">
        Created at: {new Date().toLocaleString()}
      </div>
    </div>
  );
};

export default ProjectDashboard;