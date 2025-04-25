import React from 'react';
import { ScanResult, ToolFinding } from '../types';
import SeverityBadge from './SeverityBadge';
import { ChevronRightIcon, ChartBarIcon, DocumentTextIcon, CodeBracketIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Tooltip } from 'react-tooltip';

interface ScanResultsPanelProps {
  scanResults: ScanResult;
  onFindingSelect: (finding: ToolFinding) => void;
  scanError?: string;
}

const ScanResultsPanel: React.FC<ScanResultsPanelProps> = ({ 
  scanResults, 
  onFindingSelect,
  scanError 
}) => {
  if (Object.keys(scanResults).length === 0) {
    return (
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <div className="text-center py-8 text-gray-400">
          {scanError ? (
            <>
              <h3 className="text-xl font-semibold mb-2 text-red-400">Scan Failed</h3>
              <p>{scanError}</p>
            </>
          ) : (
            <p>No scan results available</p>
          )}
        </div>
      </div>
    );
  }

  const renderToolVisualizations = (tool: string, metadata: any) => {
    if (!metadata?.visualizations) return null;
    
    return (
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metadata.visualizations.severity_distribution && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex items-center mb-2">
              <ChartBarIcon className="h-5 w-5 mr-2 text-blue-400" />
              <h4 className="font-medium">Severity Distribution</h4>
            </div>
            <img 
              src={`data:image/png;base64,${metadata.visualizations.severity_distribution}`} 
              alt="Severity distribution"
              className="w-full h-auto"
            />
          </div>
        )}
        
        {metadata.visualizations.file_type_distribution && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex items-center mb-2">
              <DocumentTextIcon className="h-5 w-5 mr-2 text-green-400" />
              <h4 className="font-medium">File Types</h4>
            </div>
            <img 
              src={`data:image/png;base64,${metadata.visualizations.file_type_distribution}`} 
              alt="File type distribution"
              className="w-full h-auto"
            />
          </div>
        )}
        
        {metadata.visualizations.timeline && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex items-center mb-2">
              <CodeIcon className="h-5 w-5 mr-2 text-purple-400" />
              <h4 className="font-medium">Findings Timeline</h4>
            </div>
            <img 
              src={`data:image/png;base64,${metadata.visualizations.timeline}`} 
              alt="Findings timeline"
              className="w-full h-auto"
            />
          </div>
        )}
      </div>
    );
  };

  const renderToolStats = (metadata: any) => {
    if (!metadata) return null;
    
    return (
      <div className="flex flex-wrap gap-3 mb-3 text-sm">
        {metadata.total_findings !== undefined && (
          <span 
            className="px-2 py-1 bg-gray-600 rounded-md flex items-center"
            data-tooltip-id="stats-tooltip"
            data-tooltip-content="Total findings in this scan"
          >
            <ShieldCheckIcon className="h-4 w-4 mr-1" />
            Findings: {metadata.total_findings}
          </span>
        )}
        
        {metadata.severity_distribution && Object.entries(metadata.severity_distribution).map(([severity, count]) => (
          <span 
            key={severity}
            className="px-2 py-1 bg-gray-600 rounded-md"
            data-tooltip-id="stats-tooltip"
            data-tooltip-content={`${severity} severity findings`}
          >
            <SeverityBadge severity={severity} small />
            {count}
          </span>
        ))}
        
        {metadata.scanned_files && (
          <span 
            className="px-2 py-1 bg-gray-600 rounded-md"
            data-tooltip-id="stats-tooltip"
            data-tooltip-content="Files scanned"
          >
            📄 {metadata.scanned_files}
          </span>
        )}
        
        {metadata.dependencies_scanned && (
          <span 
            className="px-2 py-1 bg-gray-600 rounded-md"
            data-tooltip-id="stats-tooltip"
            data-tooltip-content="Dependencies scanned"
          >
            📦 {metadata.dependencies_scanned}
          </span>
        )}
        
        <Tooltip id="stats-tooltip" />
      </div>
    );
  };

  return (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Scan Results</h3>
        {scanResults._summary && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {scanResults._summary.tools_executed?.length || 0} tools
            </span>
            <span className="text-sm bg-red-500/20 text-red-400 px-2 py-1 rounded">
              {scanResults._summary.total_findings} findings
            </span>
          </div>
        )}
      </div>
      
      <div className="space-y-6">
        {Object.entries(scanResults).map(([tool, result]) => {
          if (tool.startsWith('_')) return null;
          
          return (
            <div key={tool} className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-medium text-lg capitalize flex items-center">
                  {tool.replace('-', ' ')}
                  {result.metadata?.status === 'error' && (
                    <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                      Error
                    </span>
                  )}
                </h4>
                {result.metadata?.timestamp && (
                  <span className="text-xs text-gray-400">
                    {new Date(result.metadata.timestamp).toLocaleString()}
                  </span>
                )}
              </div>
              
              {renderToolStats(result.metadata)}
              
              {result.metadata?.message && !result.findings && (
                <div className="text-gray-400 text-sm p-3 bg-gray-800 rounded-md">
                  {result.metadata.message}
                </div>
              )}
              
              {renderToolVisualizations(tool, result.metadata)}
              
              {result.findings?.length > 0 ? (
                <div className="space-y-3 mt-4">
                  {result.findings.slice(0, 10).map((finding, index) => (
                    <div
                      key={`${tool}-${index}`}
                      className="p-3 bg-gray-800 rounded-md cursor-pointer hover:bg-gray-600 transition-colors group"
                      onClick={() => onFindingSelect({ tool, ...finding })}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <SeverityBadge severity={finding.severity} />
                            {finding.path && (
                              <span className="text-sm text-gray-400">
                                {finding.path}:{finding.start?.line || finding.line_number || 'N/A'}
                              </span>
                            )}
                          </div>
                          <h4 className="font-medium">{finding.title || finding.test_id}</h4>
                          <p className="text-gray-300 text-sm line-clamp-2">
                            {finding.description || finding.message}
                          </p>
                        </div>
                        <ChevronRightIcon className="h-5 w-5 text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                  
                  {result.findings.length > 10 && (
                    <div className="text-center text-sm text-gray-400 mt-2">
                      + {result.findings.length - 10} more findings...
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScanResultsPanel;