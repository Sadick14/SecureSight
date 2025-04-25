import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { createClient } from '@supabase/supabase-js';
import { 
  GitHubRepo, 
  ScanResult, 
  ScanHistoryItem, 
  ToolFinding, 
  SystemHealth 
} from '../types';
import DashboardSidebar from '../components/DashboardSidebar';
import HealthMetrics from '../components/HealthMetrics';
import ScanResultsPanel from '../components/ScanResultsPanel';
import RepoAnalysis from '../components/RepoAnalysis';
import ScanHistory from '../components/ScanHistory';
import FindingDetailsModal from '../components/FindingDetailsModal';
import AIChatInterface from '../components/AIChatInterface';
import Spinner from '../components/Spinner';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const { user, logout } = useAuth();
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

  // Fetch repositories and scan history on mount
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
              Accept: 'application/vnd.github.v3+json'
            }
          });
          const reposData: GitHubRepo[] = await reposRes.json();
          setRepos(reposData.sort((a, b) => 
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          ));
        }

        // Fetch scan history from Supabase
        setIsLoadingScans(true);
        const { data: scansData, error } = await supabase
          .from('scans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setScanHistory(scansData || []);
        
        // Set the most recent scan results by default
        if (scansData && scansData.length > 0) {
          setScanResults(scansData[0].results);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setScanError('Failed to load data');
      } finally {
        setIsLoadingRepos(false);
        setIsLoadingScans(false);
      }
    };

    fetchData();
  }, [user]);


  const handleDeleteScan = async (scanId: string) => {
    try {
      const { error } = await supabase
        .from('scans')
        .delete()
        .eq('id', scanId)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      setScanHistory(prev => prev.filter(scan => scan.id !== scanId));
      
      // If we're currently viewing the deleted scan, clear it
      if (selectedScan?.id === scanId) {
        setSelectedScan(null);
        setScanResults({});
      }
    } catch (error) {
      console.error('Error deleting scan:', error);
      throw error;
    }
  };

 

  const systemHealth: SystemHealth = {
    totalScans: scanHistory.length,
    vulnerabilitiesFound: Object.values(scanResults).reduce(
      (sum, tool) => sum + (tool.findings?.length || 0), 0),
    reposMonitored: new Set(scanHistory.filter(s => s.repo).map(s => s.repo)).size,
    avgResolutionTime: scanHistory.length > 0 ? 
      `${Math.max(1, Math.min(8, 24 / scanHistory.length)).toFixed(1)}h` : '0h'
  };

  // Save scan to Supabase
  const saveScanToSupabase = async (scanData: Omit<ScanHistoryItem, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('scans')
        .insert({
          ...scanData,
          user_id: user?.id
        })
        .select();
      
      if (error) throw error;
      return data?.[0];
    } catch (error) {
      console.error('Error saving scan:', error);
      throw error;
    }
  };

  //runScan function
const runScan = async () => {
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
        Authorization: `Bearer ${user.accessToken}`
      },
      body: JSON.stringify({
         repo: selectedRepo,
          scan_options: ["trivy-vuln", "snyk-code"], // example scan options
          user_id: user.id,
          branch: "main",
          depth: 100
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || 'Scan failed');
    }

    const data = await res.json();

    // Validate scan results before saving
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid scan results received');
    }

    const newScan = await saveScanToSupabase({
      created_at: new Date().toISOString(),
      repo: selectedRepo,
      type: 'url',
      results: data,
      status: 'completed',
      message: 'Scan completed successfully'
    });

    setScanHistory(prev => [newScan, ...prev]);
    setScanResults(data);
    setScanError(''); // Clear any previous errors

  } catch (err: any) {
    console.error('Scan error:', err);
    setScanError(err.message || 'Scan failed');
    
    // Save failed scan to history
    await saveScanToSupabase({
      created_at: new Date().toISOString(),
      repo: selectedRepo,
      type: 'url',
      results: {},
      status: 'failed',
      message: err.message || 'Scan failed'
    });
  } finally {
    setIsScanning(false);
  }
};
  const scanUploadedProject = async () => {
    if (!projectFiles.length || !user) {
      setScanError('Please upload files to scan');
      return;
    }

    setIsScanning(true);
    setScanError('');

    try {
      const formData = new FormData();
      projectFiles.forEach(file => formData.append('files', file));
      const response = await fetch('http://localhost:8000/scan/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.accessToken}` },
        body: formData
      });
      const data = await response.json();

      const newScan = await saveScanToSupabase({
        created_at: new Date().toISOString(),
        type: 'upload',
        files: projectFiles.map(f => f.name),
        results: data,
        status: 'completed',
        message: 'Upload scan completed'
      });

      if (newScan) {
        setScanHistory(prev => [newScan, ...prev]);
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

  if (isLoadingScans) {
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
        user={user}
        logout={logout}
      />
      
      <div className="flex-1 p-8 overflow-auto">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <HealthMetrics metrics={systemHealth} />
            <ScanResultsPanel 
              scanResults={scanResults}
              onFindingSelect={setSelectedFinding}
            />
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
           // Then pass it to ScanHistory component
            <ScanHistory
              scanHistory={scanHistory}
              onSelectScan={handleHistoryItemClick}
              onDeleteScan={handleDeleteScan}
            />
        )}

        {activeTab === 'team' && (
          <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 text-center">
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
      </div>

      {selectedFinding && (
        <FindingDetailsModal
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
        />
      )}

      <AIChatInterface repositories={repos} scanResults={scanResults} />
    </div>
  );
}