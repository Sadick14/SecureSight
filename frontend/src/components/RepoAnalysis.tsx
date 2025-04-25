import { useState, ChangeEvent } from 'react';
import { GitHubRepo, ScanHistoryItem } from '../types';
import { PaperClipIcon, InformationCircleIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface RepoAnalysisProps {
  activeAnalysisTab: 'scan' | 'upload';
  setActiveAnalysisTab: (tab: 'scan' | 'upload') => void;
  selectedRepo: string;
  setSelectedRepo: (repo: string) => void;
  runScan: (scanOptions: string[]) => Promise<void>;
  isScanning: boolean;
  projectFiles: File[];
  handleProjectUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  scanUploadedProject: (scanOptions: string[]) => Promise<void>;
  scanError: string;
  repos: GitHubRepo[];
  isLoadingRepos: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  repoError?: string;
}

const SCAN_OPTIONS = [
  { id: 'trivy-vuln', name: 'Vulnerabilities', tool: 'Trivy', description: 'Scan for software vulnerabilities' },
  { id: 'trivy-config', name: 'Misconfigurations', tool: 'Trivy', description: 'Scan for infrastructure misconfigurations' },
  { id: 'trivy-secrets', name: 'Secrets', tool: 'Trivy', description: 'Scan for exposed secrets' },
  { id: 'snyk-oss', name: 'Open Source', tool: 'Snyk', description: 'Dependency vulnerability scanning' },
  { id: 'snyk-code', name: 'Code Analysis', tool: 'Snyk', description: 'Static application security testing' },
  { id: 'snyk-container', name: 'Container', tool: 'Snyk', description: 'Container image scanning' },
  { id: 'gitleaks', name: 'Secrets Detection', tool: 'Gitleaks', description: 'Find hardcoded secrets' },
  { id: 'bandit', name: 'Python Security', tool: 'Bandit', description: 'Python security scanner' },
  { id: 'pylint', name: 'Python Linter', tool: 'Pylint', description: 'Python code quality checker' },
  { id: 'safety', name: 'Dependency Check', tool: 'Safety', description: 'Python dependency vulnerabilities' },
];

const PRESET_SCANS = {
  'Full Scan': ['trivy-vuln', 'trivy-config', 'trivy-secrets', 'snyk-oss', 'snyk-code', 'gitleaks', 'bandit', 'safety'],
  'Quick Scan': ['trivy-vuln', 'snyk-oss', 'gitleaks'],
  'Security Audit': ['trivy-vuln', 'trivy-secrets', 'snyk-code', 'gitleaks'],
  'Custom': [],
};

export default function RepoAnalysis({
  activeAnalysisTab,
  setActiveAnalysisTab,
  selectedRepo,
  setSelectedRepo,
  runScan,
  isScanning,
  projectFiles,
  handleProjectUpload,
  scanUploadedProject,
  scanError,
  repos,
  isLoadingRepos,
  fileInputRef,
  repoError,
}: RepoAnalysisProps) {
  const [selectedScanOptions, setSelectedScanOptions] = useState<string[]>(PRESET_SCANS['Quick Scan']);
  const [selectedPreset, setSelectedPreset] = useState<string>('Quick Scan');
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  const [scanProgress, setScanProgress] = useState<Record<string, number>>({});

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (preset !== 'Custom') {
      setSelectedScanOptions(PRESET_SCANS[preset]);
      setShowCustomOptions(false);
    } else {
      setShowCustomOptions(true);
    }
  };

  const toggleOption = (optionId: string) => {
    if (selectedScanOptions.includes(optionId)) {
      setSelectedScanOptions(selectedScanOptions.filter(id => id !== optionId));
    } else {
      setSelectedScanOptions([...selectedScanOptions, optionId]);
    }
    setSelectedPreset('Custom');
  };

  const handleRunScan = async () => {
    const initialProgress: Record<string, number> = {};
    selectedScanOptions.forEach(option => {
      initialProgress[option] = 0;
    });
    setScanProgress(initialProgress);
    
    await runScan(selectedScanOptions);
  };

  const handleUploadAndScan = async () => {
    const initialProgress: Record<string, number> = {};
    selectedScanOptions.forEach(option => {
      initialProgress[option] = 0;
    });
    setScanProgress(initialProgress);
    
    await scanUploadedProject(selectedScanOptions);
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h2 className="text-2xl font-bold mb-6">Security Analysis</h2>
        
        {repoError && (
          <div className="text-red-400 p-3 bg-gray-700 rounded-lg mb-6 border border-red-900">
            Error loading repositories: {repoError}
          </div>
        )}

        <div className="flex border-b border-gray-700 mb-6">
          <button
            className={`pb-2 px-4 ${activeAnalysisTab === 'scan' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'} transition-colors`}
            onClick={() => setActiveAnalysisTab('scan')}
          >
            Scan Repository
          </button>
          <button
            className={`pb-2 px-4 ${activeAnalysisTab === 'upload' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'} transition-colors`}
            onClick={() => setActiveAnalysisTab('upload')}
          >
            Upload Project
          </button>
        </div>

        <div className="mb-6">
          <label htmlFor="scan-preset" className="block text-sm font-medium mb-2">
            Scan Configuration
          </label>
          <div className="relative">
            <button
              id="scan-preset"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-left flex justify-between items-center"
              onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
            >
              <span>{selectedPreset}</span>
              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
            </button>
            
            {showOptionsDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg shadow-lg">
                {Object.keys(PRESET_SCANS).map((preset) => (
                  <button
                    key={preset}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-600 ${
                      selectedPreset === preset ? 'bg-blue-600 text-white' : ''
                    }`}
                    onClick={() => {
                      handlePresetChange(preset);
                      setShowOptionsDropdown(false);
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {selectedScanOptions.map((optionId) => {
              const option = SCAN_OPTIONS.find(o => o.id === optionId);
              return (
                <span
                  key={optionId}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-900 text-blue-100"
                >
                  {option?.name} ({option?.tool})
                </span>
              );
            })}
          </div>

          {(selectedPreset === 'Custom' || showCustomOptions) && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
              {SCAN_OPTIONS.map((option) => (
                <div key={option.id} className="flex items-center">
                  <input
                    id={`scan-option-${option.id}`}
                    type="checkbox"
                    checked={selectedScanOptions.includes(option.id)}
                    onChange={() => toggleOption(option.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isScanning}
                  />
                  <label htmlFor={`scan-option-${option.id}`} className="ml-3">
                    <div className="flex items-center">
                      <span className="block text-sm font-medium">
                        {option.name} ({option.tool})
                      </span>
                      <div className="ml-2 group relative">
                        <InformationCircleIcon className="h-4 w-4 text-gray-400" />
                        <span className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-48 px-2 py-1 bg-gray-800 text-xs text-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          {option.description}
                        </span>
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {Object.keys(scanProgress).length > 0 && (
          <div className="mb-6 space-y-3">
            <h4 className="text-sm font-medium">Scan Progress</h4>
            {selectedScanOptions.map(optionId => {
              const option = SCAN_OPTIONS.find(o => o.id === optionId);
              return (
                <div key={optionId} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{option?.name} ({option?.tool})</span>
                    <span>{scanProgress[optionId] || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${scanProgress[optionId] || 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeAnalysisTab === 'scan' ? (
          <div className="flex gap-4 mb-6">
            <input
              type="text"
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              placeholder="https://github.com/username/repository"
              className="flex-1 bg-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
            />
            <button 
              onClick={handleRunScan}
              disabled={isScanning || !selectedRepo || selectedScanOptions.length === 0}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isScanning ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning...
                </>
              ) : 'Run Scan'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-gray-700 hover:bg-gray-600 px-6 py-12 rounded-lg border-2 border-dashed border-gray-600 flex flex-col items-center transition-colors"
              >
                <PaperClipIcon className="h-10 w-10 mb-2 text-gray-400" />
                <span>Click to upload project files</span>
                <span className="text-sm text-gray-400 mt-1">(or drag and drop)</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleProjectUpload}
                  className="hidden"
                  multiple
                  webkitdirectory="true"
                />
              </button>
            </div>
            
            {projectFiles.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-2">Selected files ({projectFiles.length}):</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-700 rounded-lg border border-gray-600">
                  {projectFiles.map((file, index) => (
                    <div key={index} className="text-sm bg-gray-800 p-2 rounded flex items-center border border-gray-700">
                      <PaperClipIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleUploadAndScan}
                  disabled={isScanning || selectedScanOptions.length === 0}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium disabled:opacity-50 w-full transition-colors flex items-center justify-center gap-2"
                >
                  {isScanning ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing...
                    </>
                  ) : 'Analyze Project'}
                </button>
              </div>
            )}
          </>
        )}

        {scanError && (
          <div className="text-red-400 p-3 bg-gray-700 rounded-lg mb-6 border border-red-900">
            {scanError}
          </div>
        )}

        <h3 className="text-xl font-semibold mb-4">Your Repositories</h3>
        {isLoadingRepos ? (
          <div className="flex justify-center py-8">
            <svg className="animate-spin h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : repos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {repos.map((repo) => (
              <div 
                key={repo.id} 
                className="bg-gray-700 p-4 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer border border-gray-600"
                onClick={() => setSelectedRepo(repo.html_url)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{repo.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded ${repo.private ? 'bg-purple-900 text-purple-300' : 'bg-blue-900 text-blue-300'}`}>
                    {repo.private ? 'Private' : 'Public'}
                  </span>
                </div>
                {repo.description && (
                  <p className="text-sm text-gray-300 mb-3 line-clamp-2">{repo.description}</p>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">
                    Updated {new Date(repo.updated_at).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    <a 
                      href={repo.html_url} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 text-xs hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRepo(repo.html_url);
                        handleRunScan();
                      }}
                      disabled={isScanning}
                      className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded disabled:opacity-50"
                    >
                      Scan
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            No repositories found. Please check your GitHub connection.
          </div>
        )}
      </div>
    </div>
  );
}