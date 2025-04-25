export interface ToolFinding {
  tool: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'WARNING' | 'INFO';
  title?: string;
  description?: string;
  path?: string;
  line_number?: number;
  code?: string;
  start?: { line: number };
  message?: string;
  more_info?: string;
  remediation?: string;
  context_lines?: {
    before: string[];
    after: string[];
  };
  PkgName?: string;
  InstalledVersion?: string;
  FixedVersion?: string;
  vulnerability?: string;
  package?: string;
  vulnerable_versions?: string;
}

export interface ScanResult {
  [tool: string]: {
    findings: ToolFinding[];
    metadata?: {
      scanned_files?: number;
      dependencies_scanned?: number;
      message?: string;
    };
  };
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  private: boolean;
  updated_at: string;
}

export interface ScanHistoryItem {
  id: string;
  date: string;
  repo?: string;
  type: 'url' | 'upload';
  files?: string[];
  results: ScanResult;
  status: 'completed' | 'failed';
  message?: string;
}

export interface SystemHealth {
  totalScans: number;
  vulnerabilitiesFound: number;
  reposMonitored: number;
  avgResolutionTime: string;
}