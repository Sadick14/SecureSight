import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { createClient } from '@supabase/supabase-js';
import {
  GitHubRepo,
  ScanResult,
  ScanHistoryItem,
  ToolFinding,
  SystemHealth,
  Project,
  GitHubUser
} from '../types';
import DashboardSidebar from '../components/DashboardSidebar';
import HealthMetrics from '../components/HealthMetrics';
import ScanResultsPanel from '../components/ScanResultsPanel';
import RepoAnalysis from '../components/RepoAnalysis';
import ScanHistory from '../components/ScanHistory';
import FindingDetailsModal from '../components/FindingDetailsModal';
import AIChatInterface from '../components/AIChatInterface';
import Spinner from '../components/Spinner';
import ProjectDashboard from '../components/ProjectDashboard';
import CreateProjectForm from '../components/CreateProjectForm';
import CodeEditor from '../components/CodeEditor'; // Import the CodeEditor component

// Initialize Supabase client (ensure this is correctly configured)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null); // ★★ New state for the selected file ★★
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState<'repo' | 'upload'>('repo');
  const [creatingProject, setCreatingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'scan' | 'upload'>('scan');
  const [scanResults, setScanResults] = useState<ScanResult>({});
  const [selectedScan, setSelectedScan] = useState<ScanHistoryItem | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [projectFiles, setProjectFiles] = useState<File[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<ToolFinding | null>(null);
  const [scanError, setScanError] = useState('');
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isLoadingScans, setIsLoadingScans] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSystem, setActiveSystem] = useState<'scans' | 'projects'>('scans');

  // Fetch repositories, scan history, and projects on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        // Fetch GitHub repositories
        if (user.accessToken) {
          setIsLoadingRepos(true);
          const reposRes = await fetch('https://api.github.com/user/repos', {
            headers: {
              Authorization: `Bearer ${user.accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          });
          const reposData: GitHubRepo[] = await reposRes.json();
          setRepos(
            reposData.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          );
        }

        // Fetch scan history from Supabase
        setIsLoadingScans(true);
        const { data: scansData, error: scansError } = await supabase
          .from('scans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (scansError) throw scansError;
        setScanHistory(scansData || []);

        // Set the most recent scan results by default
        if (scansData && scansData.length > 0) {
          setScanResults(scansData[0].results);
        }

        // Fetch projects from Supabase
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (projectsError) throw projectsError;
        setProjects(projectsData || []);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setScanError(`Failed to load data: ${err.message}`);
      } finally {
        setIsLoadingRepos(false);
        setIsLoadingScans(false);
      }
    };

    if (user?.id) {
      fetchData();
    }
  }, [user]);

  const handleDeleteScan = async (scanId: string) => {
    try {
      const { error } = await supabase.from('scans').delete().eq('id', scanId).eq('user_id', user?.id);

      if (error) throw error;

      setScanHistory((prev) => prev.filter((scan) => scan.id !== scanId));

      if (selectedScan?.id === scanId) {
        setSelectedScan(null);
        setScanResults({});
      }
    } catch (error: any) {
      console.error('Error deleting scan:', error);
      setScanError(`Failed to delete scan: ${error.message}`);
    }
  };

  const systemHealth: SystemHealth = {
    totalScans: scanHistory.length,
    vulnerabilitiesFound: Object.values(scanResults).reduce(
      (sum, tool) => sum + (tool.findings?.length || 0),
      0
    ),
    reposMonitored: new Set(scanHistory.filter((s) => s.repo).map((s) => s.repo)).size,
    avgResolutionTime:
      scanHistory.length > 0 ? `${Math.max(1, Math.min(8, 24 / scanHistory.length)).toFixed(1)}h` : '0h',
  };

  // Save scan to Supabase
  const saveScanToSupabase = async (scanData: Omit<ScanHistoryItem, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('scans')
        .insert({
          ...scanData,
          user_id: user?.id,
        })
        .select();

      if (error) throw error;
      return data?.[0];
    } catch (error: any) {
      console.error('Error saving scan:', error);
      throw error;
    }
  };

  // runScan function
  const runScan = async (scanOptions: string[]) => {
    if (!selectedRepo || !user?.accessToken) {
      setScanError('Please select a repository');
      return;
    }

    setIsScanning(true);
    setScanError('');

    try {
      const res = await fetch('http://localhost:8000/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          repo: selectedRepo,
          scan_options: scanOptions,
          user_id: user.id,
          branch: 'main',
          depth: 100,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Scan failed');
      }

      const data = await res.json();

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid scan results received');
      }

      const newScan = await saveScanToSupabase({
        created_at: new Date().toISOString(),
        repo: selectedRepo,
        type: 'url',
        results: data,
        status: 'completed',
        message: 'Scan completed successfully',
      });

      setScanHistory((prev) => [newScan, ...prev]);
      setScanResults(data);
      setScanError('');
    } catch (err: any) {
      console.error('Scan error:', err);
      setScanError(err.message || 'Scan failed');

      await saveScanToSupabase({
        created_at: new Date().toISOString(),
        repo: selectedRepo,
        type: 'url',
        results: {},
        status: 'failed',
        message: err.message || 'Scan failed',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const scanUploadedProject = async (scanOptions: string[]) => {
    if (!projectFiles.length || !user) {
      setScanError('Please upload files to scan');
      return;
    }

    setIsScanning(true);
    setScanError('');

    try {
      const formData = new FormData();
      projectFiles.forEach((file) => formData.append('files', file));
      const response = await fetch('http://localhost:8000/scan/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.accessToken}` },
        body: formData,
      });
      const data = await response.json();

      const newScan = await saveScanToSupabase({
        created_at: new Date().toISOString(),
        type: 'upload',
        files: projectFiles.map((f) => f.name),
        results: data,
        status: 'completed',
        message: 'Upload scan completed',
      });

      if (newScan) {
        setScanHistory((prev) => [newScan, ...prev]);
        setScanResults(data);
      }
    } catch (error: any) {
      setScanError(error.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleProjectUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setProjectFiles(Array.from(e.target.files));
    }
  };

  const handleHistoryItemClick = (scan: ScanHistoryItem) => {
    setSelectedScan(scan);
    setScanResults(scan.results);
    setActiveTab('overview');
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setSelectedFilePath(null); // ★★ Close the editor when a new project is selected ★★
    setActiveTab('project-details');
  };

  const handleFileClick = (filePath: string) => {
    setSelectedFilePath(filePath);
  };

  const handleCloseEditor = () => {
    setSelectedFilePath(null);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setError('Please log in to create a project.');
      return;
    }

    setCreatingProject(true);
    setError(null);

    try {
      if (newProjectType === 'repo') {
        if (!selectedRepo) {
          setError('Please select a repository.');
          setCreatingProject(false);
          return;
        }

        const response = await fetch('http://localhost:8000/projects/create/github/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repo_url: selectedRepo,
            user_id: user.id,
            github_access_token: user.accessToken,
            project_name: newProjectName,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to create project from repository');
        }

        const result = await response.json();
        console.log('GitHub Project Creation Initiated:', result);

        const { data: updatedProjectsData, error: updatedProjectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (updatedProjectsError) throw updatedProjectsError;
        setProjects(updatedProjectsData || []);
      } else if (newProjectType === 'upload') {
        if (projectFiles.length === 0) {
          setError('Please select files to upload.');
          setCreatingProject(false);
          return;
        }

        const formData = new FormData();
        projectFiles.forEach((file) => {
          formData.append('files', file);
        });
        formData.append('project_name', newProjectName);
        formData.append('user_id', user.id);

        const response = await fetch('http://localhost:8000/projects/create/upload/', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to create project from upload');
        }

        const result = await response.json();
        console.log('Upload Project Created:', result);

        if (result.project) {
          setProjects((prevProjects) => [result.project, ...prevProjects]);
          setSelectedProject(result.project);
          setShowCreateProjectForm(false);
          setNewProjectName('');
          setProjectFiles([]);
          setActiveTab('project-details');
        }
      }
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(`Failed to create project: ${err.message}`);
    } finally {
      setCreatingProject(false);
    }
  };

  const handleRenameProject = async (projectId: string, newName: string) => {
    if (!user?.id) {
      throw new Error('User not logged in.');
    }
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${projectId}`, {
        method: 'PATCH', // Using PATCH for partial update (renaming)
        headers: {
          'Content-Type': 'application/json',
          // You might need to include an Authorization header here if your backend requires it
        },
        body: JSON.stringify({ name: newName, user_id: user.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to rename project');
      }

      // Update the projects state in the frontend
      setProjects((prevProjects) =>
        prevProjects.map((project) =>
          project.id === projectId ? { ...project, name: newName } : project
        )
      );
      // If the renamed project is the selected one, update its name in the selectedProject state
      if (selectedProject?.id === projectId) {
        setSelectedProject((prevSelected) => (prevSelected ? { ...prevSelected, name: newName } : null));
      }
    } catch (error) {
      console.error('Error renaming project:', error);
      throw error;
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (window.confirm(`Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`)) {
      try {
        const response = await fetch(`http://localhost:8000/api/projects/${projectId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            // You might need to include an Authorization header here, e.g.:
            // 'Authorization': `Bearer ${user.accessToken}`,
          },
          body: JSON.stringify({ user_id: user.id }), // Ensure 'user' is accessible in this scope
        });

        if (!response.ok) {
          let errorDetail = 'Failed to delete project';
          try {
            const errorData = await response.json();
            if (typeof errorData === 'object' && errorData !== null && 'detail' in errorData) {
              errorDetail = errorData.detail;
            } else if (typeof errorData === 'string') {
              errorDetail = errorData;
            } else {
              errorDetail = JSON.stringify(errorData);
            }
          } catch (e) {
            errorDetail = `Failed to delete project: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorDetail);
        }

        // Update the 'projects' state in the frontend by removing the deleted project
        setProjects(currentProjects => currentProjects.filter(project => project.id !== projectId));

        // Optionally, if the deleted project was the currently selected one, deselect it
        if (selectedProject?.id === projectId) {
          setSelectedProject(null);
          setSelectedFilePath(null); // ★★ Also close the editor if the selected project is deleted ★★
        }

        alert(`Project "${projectName}" deleted successfully!`);

      } catch (error: any) {
        console.error('Error deleting project:', error);
        alert(`Error deleting project: ${error.message}`);
      }
    }
  };


  if (isLoadingScans || (user && isLoadingRepos)) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex">
      <DashboardSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeSystem={activeSystem}
        setActiveSystem={setActiveSystem}
        user={user as GitHubUser}
        logout={logout}
        projects={projects}
        onProjectSelect={handleProjectSelect}
        selectedProject={selectedProject}
        onCreateProjectClick={() => setShowCreateProjectForm(true)}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
      />

      <div className="flex-1 p-8 overflow-auto">
        {activeSystem === 'scans' && (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <HealthMetrics metrics={systemHealth} />
                <ScanResultsPanel scanResults={scanResults} onFindingSelect={setSelectedFinding} />
              </div>
            )}

            {activeTab === 'repos' && (
              <RepoAnalysis
                activeAnalysisTab={activeAnalysisTab}
                setActiveAnalysisTab={setActiveAnalysisTab}
                selectedRepo={selectedRepo}
                setSelectedRepo={setSelectedRepo}
                runScan={runScan}
                isScanning={isScanning}
                projectFiles={projectFiles}
                handleProjectUpload={handleProjectUpload}
                scanUploadedProject={scanUploadedProject}
                scanError={scanError}
                repos={repos}
                isLoadingRepos={isLoadingRepos}
                fileInputRef={fileInputRef}
              />
            )}

            {activeTab === 'history' && (
              <ScanHistory
                scanHistory={scanHistory}
                onSelectScan={handleHistoryItemClick}
                onDeleteScan={handleDeleteScan}
              />
            )}
            {activeTab === 'team' && (
              <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 text-center text-white">
                <h2 className="text-2xl font-bold mb-2">Team Management</h2>
                <p className="text-gray-400 mb-6">Team features coming soon!</p>
                <div className="bg-gray-700 p-4 rounded-lg border border-gray-600 max-w-md mx-auto">
                  <h3 className="font-medium mb-2">Planned Features</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Team member invitations</li>
                    <li>• Role-based access control</li>
                    <li>• Collaborative vulnerability review</li>
                    <li>• Shared scan history</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}

        {activeSystem === 'projects' && (
          <>
            {/* ★★ Conditional Rendering for ProjectDashboard or CodeEditor ★★ */}
            {selectedProject && !selectedFilePath ? (
              <ProjectDashboard
                project={selectedProject}
                onFileClick={handleFileClick} // ★★ Pass the handleFileClick function here ★★
              />
            ) : selectedProject && selectedFilePath ? (
              <CodeEditor
                projectId={selectedProject.id}
                filePath={selectedFilePath}
                onClose={handleCloseEditor}
              />
            ) : (
              <div className="p-8">
                {!selectedProject && !showCreateProjectForm ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-lg">
                    <h3 className="text-xl font-semibold text-gray-300 mb-4">No Project Selected</h3>
                    <button
                      onClick={() => setShowCreateProjectForm(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                    >
                      Create New Project
                    </button>
                  </div>
                ) : (
                  <div className="relative bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <button
                      onClick={() => setShowCreateProjectForm(false)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                      aria-label="Close"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <CreateProjectForm
                      newProjectName={newProjectName}
                      setNewProjectName={setNewProjectName}
                      newProjectType={newProjectType}
                      setNewProjectType={setNewProjectType}
                      repos={repos}
                      isLoadingRepos={isLoadingRepos}
                      selectedRepo={selectedRepo}
                      setSelectedRepo={setSelectedRepo}
                      projectFiles={projectFiles}
                      handleProjectUpload={handleProjectUpload}
                      creatingProject={creatingProject}
                      error={error}
                      handleCreateProject={handleCreateProject}
                    />
                  </div>
                )}
              </div>
            )}
            {activeTab === 'team' && (
              <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 text-center text-white">
                <h2 className="text-2xl font-bold mb-2">Team Management</h2>
                <p className="text-gray-400 mb-6">Team features coming soon!</p>
                <div className="bg-gray-700 p-4 rounded-lg border border-gray-600 max-w-md mx-auto">
                  <h3 className="font-medium mb-2">Planned Features</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Team member invitations</li>
                    <li>• Role-based access control</li>
                    <li>• Collaborative vulnerability review</li>
                    <li>• Shared scan history</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedFinding && (
        <FindingDetailsModal finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
      )}

      <AIChatInterface repositories={repos} scanResults={scanResults} />
    </div>
  );
}