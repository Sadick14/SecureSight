import React, { useRef } from 'react';
import { GitHubRepo } from '../types';
import { FiGithub, FiFolder, FiPaperclip, FiX, FiEdit2, FiCheck } from 'react-icons/fi';
import Spinner from './Spinner';

interface CreateProjectFormProps {
  newProjectName: string;
  setNewProjectName: (name: string) => void;
  newProjectType: 'repo' | 'upload';
  setNewProjectType: (type: 'repo' | 'upload') => void;
  repos: GitHubRepo[];
  isLoadingRepos: boolean;
  selectedRepo: string;
  setSelectedRepo: (repo: string) => void;
  projectFiles: File[];
  handleProjectUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  creatingProject: boolean;
  error: string | null;
  handleCreateProject: (e: React.FormEvent) => Promise<void>;
  onClose: () => void;
}

const CreateProjectForm: React.FC<CreateProjectFormProps> = ({
  newProjectName,
  setNewProjectName,
  newProjectType,
  setNewProjectType,
  repos,
  isLoadingRepos,
  selectedRepo,
  setSelectedRepo,
  projectFiles,
  handleProjectUpload,
  creatingProject,
  error,
  handleCreateProject,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl w-full">
        <div className="p-5">
          {/* Header */}
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center">
              <div className="w-2 h-6 bg-blue-500 rounded-full mr-3"></div>
              <h2 className="text-xl font-semibold text-white">New Project</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-full transition-colors"
              disabled={creatingProject}
            >
              <FiX size={20} />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateProject} className="space-y-4">
            {/* Project Name */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Project Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiEdit2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My awesome project"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition disabled:opacity-50"
                  disabled={creatingProject}
                  required
                />
              </div>
            </div>

            {/* Source Type Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Source Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewProjectType('repo')}
                  disabled={creatingProject}
                  className={`flex items-center justify-center py-2.5 px-4 rounded-lg border transition-colors ${
                    newProjectType === 'repo'
                      ? 'border-blue-500 bg-blue-900/20 text-blue-400'
                      : 'border-gray-600 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <FiGithub className="mr-2" size={18} />
                  GitHub
                </button>
                <button
                  type="button"
                  onClick={() => setNewProjectType('upload')}
                  disabled={creatingProject}
                  className={`flex items-center justify-center py-2.5 px-4 rounded-lg border transition-colors ${
                    newProjectType === 'upload'
                      ? 'border-blue-500 bg-blue-900/20 text-blue-400'
                      : 'border-gray-600 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <FiFolder className="mr-2" size={18} />
                  Local Files
                </button>
              </div>
            </div>

            {/* Dynamic Content Area */}
            <div className="bg-gray-700/30 rounded-lg p-4 transition-all min-h-[200px]">
              {newProjectType === 'repo' ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-300">Select Repository</h3>
                  {isLoadingRepos ? (
                    <div className="flex justify-center py-6">
                      <Spinner size="md" />
                    </div>
                  ) : repos.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {repos.map((repo) => (
                        <div
                          key={repo.id}
                          onClick={() => setSelectedRepo(repo.html_url)}
                          className={`p-3 rounded-md cursor-pointer transition-all flex items-center ${
                            selectedRepo === repo.html_url
                              ? 'bg-blue-900/30 border border-blue-700'
                              : 'bg-gray-700 hover:bg-gray-600 border border-gray-600'
                          }`}
                        >
                          <div className="flex-shrink-0 mr-3">
                            <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center">
                              <FiGithub className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-medium text-white truncate">{repo.name}</h4>
                            {repo.description && (
                              <p className="text-xs text-gray-400 truncate">{repo.description}</p>
                            )}
                          </div>
                          {selectedRepo === repo.html_url && (
                            <div className="ml-2 flex-shrink-0 text-blue-400">
                              <FiCheck size={18} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400 text-sm">
                      No repositories found
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-300">Upload Files</h3>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-md p-5 text-center cursor-pointer transition-colors ${
                      projectFiles.length > 0
                        ? 'border-blue-500 bg-blue-900/10'
                        : 'border-gray-500 hover:border-gray-400 bg-gray-700/20'
                    }`}
                  >
                    <FiPaperclip
                      className={`mx-auto mb-2 ${projectFiles.length > 0 ? 'text-blue-400' : 'text-gray-400'}`}
                      size={24}
                    />
                    <p className="text-sm text-gray-300">
                      {projectFiles.length > 0
                        ? `${projectFiles.length} files selected`
                        : 'Click to browse or drag files'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {projectFiles.length > 0 ? 'Click to change selection' : 'Supports folders'}
                    </p>
                  </div>
                  {projectFiles.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      <ul className="text-xs text-gray-400 space-y-1">
                        {projectFiles.slice(0, 5).map((file, index) => (
                          <li
                            key={index}
                            className="truncate px-2 py-1.5 bg-gray-700/50 rounded flex items-center"
                          >
                            <FiPaperclip className="mr-2 flex-shrink-0" size={14} />
                            <span className="truncate">{file.webkitRelativePath || file.name}</span>
                          </li>
                        ))}
                        {projectFiles.length > 5 && (
                          <li className="text-gray-500 px-2 py-1.5">
                            +{projectFiles.length - 5} more files
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleProjectUpload}
                    className="hidden"
                    webkitdirectory=""
                    mozdirectory=""
                    directory=""
                    multiple
                  />
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                creatingProject ||
                !newProjectName ||
                (newProjectType === 'repo' && !selectedRepo) ||
                (newProjectType === 'upload' && projectFiles.length === 0)
              }
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {creatingProject ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creating Project...
                </>
              ) : (
                'Create Project'
              )}
            </button>
          </form>
        </div>
      </div>
  );
};

export default CreateProjectForm;