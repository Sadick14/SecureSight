import React, { useState } from 'react';
import {
  ChartPieIcon,
  ShieldCheckIcon,
  SignalIcon,
  UserGroupIcon,
  ArrowPathIcon,
  FolderOpenIcon,
  PlusCircleIcon,
  EllipsisVerticalIcon,
  PencilIcon, // Import PencilIcon
  TrashIcon, // Import TrashIcon
} from '@heroicons/react/24/outline';
import { GitHubUser, Project } from '../types';

interface DashboardSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeSystem: 'scans' | 'projects';
  setActiveSystem: (system: 'scans' | 'projects') => void;
  user?: GitHubUser;
  logout: () => Promise<void>;
  projects: Project[];
  onProjectSelect: (project: Project) => void;
  selectedProject: Project | null;
  onCreateProjectClick: () => void;
  onRenameProject: (projectId: string, newName: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export default function DashboardSidebar({
  activeTab,
  setActiveTab,
  activeSystem,
  setActiveSystem,
  user,
  logout,
  projects,
  onProjectSelect,
  selectedProject,
  onCreateProjectClick,
  onRenameProject,
  onDeleteProject,
}: DashboardSidebarProps) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState<string>('');

  const handleRenameClick = (project: Project) => {
    setRenamingProjectId(project.id);
    setNewProjectName(project.name);
    setOpenDropdownId(null); // Close the dropdown
  };

  const handleRenameSubmit = async (projectId: string) => {
    if (newProjectName.trim() === '') {
      alert('Project name cannot be empty.');
      return;
    }
    try {
      await onRenameProject(projectId, newProjectName);
      setRenamingProjectId(null);
      setNewProjectName('');
    } catch (error) {
      console.error('Error renaming project:', error);
      // You might want to show an error message to the user
    }
  };

  const handleDeleteClick = async (projectId: string, projectName: string) => {
    if (window.confirm(`Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`)) {
      try {
        await onDeleteProject(projectId);
        setOpenDropdownId(null); // Close the dropdown
        if (selectedProject?.id === projectId) {
          onProjectSelect(null as any); // Optionally deselect the project
        }
      } catch (error) {
        console.error('Error deleting project:', error);
        // You might want to show an error message to the user
      }
    }
  };

  return (
    <div className="w-64 bg-gray-800 p-4 flex flex-col border-r border-gray-700">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheckIcon className="h-8 w-8 text-blue-400" />
        <h1 className="text-xl font-bold">SecureSight</h1>
      </div>

      {/* System Switcher */}
      <div className="flex mb-4 rounded-lg overflow-hidden">
        <button
          className={`flex-1 py-2 text-sm font-medium transition-colors ${activeSystem === 'scans' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
          onClick={() => setActiveSystem('scans')}
        >
          Scans
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium transition-colors ${activeSystem === 'projects' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
          onClick={() => setActiveSystem('projects')}
        >
          Projects
        </button>
      </div>

      <nav className="space-y-2 flex-1">
        {activeSystem === 'scans' ? (
          <>
            {/* Scans Navigation */}
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              <ChartPieIcon className="h-5 w-5" />
              Overview
            </button>

            <button
              onClick={() => setActiveTab('repos')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'repos' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              <SignalIcon className="h-5 w-5" />
              Repositories
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              <ArrowPathIcon className="h-5 w-5" />
              Scan History
            </button>
          </>
        ) : (
          <>
            {/* "Projects" Navigation */}
          
          {/* New "Create New Project" Button */}
          <button
            onClick={onCreateProjectClick}
            className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-gray-300 hover:bg-gray-700 hover:text-white mt-2"
          >
            <PlusCircleIcon className="h-5 w-5" />
            Create New Project
          </button>

            <div className="mb-2 flex-1 min-h-0 overflow-y-auto">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-1">Projects</h3>
              {projects.length === 0 ? (
                <p className="text-gray-500 text-sm">No projects yet.</p>
              ) : (
                <ul className="space-y-1">
                  {projects.map((project) => (
                    <li key={project.id} className="relative flex items-center justify-between group">
                      {renamingProjectId === project.id ? (
                        <input
                          type="text"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameSubmit(project.id);
                            }
                          }}
                          onBlur={() => {
                            if (renamingProjectId === project.id) {
                              handleRenameSubmit(project.id);
                            }
                          }}
                          className="w-full p-2 rounded-lg bg-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setActiveTab('project-details');
                            onProjectSelect(project);
                          }}
                          className={`w-full text-left flex items-center gap-2 p-2 rounded-lg transition-colors text-sm ${activeTab === 'project-details' && selectedProject?.id === project.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                        >
                          <FolderOpenIcon className="h-4 w-4" />
                          {project.name}
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === project.id ? null : project.id);
                        }}
                        className="p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Project options"
                      >
                        <EllipsisVerticalIcon className="h-4 w-4" />
                      </button>
                      {openDropdownId === project.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg z-10 text-sm">
                          <button
                            onClick={() => handleRenameClick(project)}
                            className="block w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-600 flex items-center gap-2"
                          >
                            <PencilIcon className="h-4 w-4" />
                            Rename
                          </button>
                          <button
                            onClick={() => handleDeleteClick(project.id, project.name)}
                            className="block w-full text-left px-4 py-2 text-red-400 hover:bg-gray-600 flex items-center gap-2"
                          >
                            <TrashIcon className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* The "Team" tab */}
        <button
          onClick={() => setActiveTab('team')}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'team' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
          <UserGroupIcon className="h-5 w-5" />
          Team
        </button>
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-gray-700 pt-4">
        <div className="flex items-center gap-3">
          <img
            src={user?.avatar_url}
            className="h-10 w-10 rounded-full"
            alt="Profile"
          />
          <div>
            <p className="font-medium">{user?.name || user?.login}</p>
            <button
              onClick={logout}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}