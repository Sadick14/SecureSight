import { useState } from 'react';
import { ScanHistoryItem } from '../types';
import { TrashIcon, EyeIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';

interface ScanHistoryProps {
  scanHistory: ScanHistoryItem[];
  onSelectScan: (scan: ScanHistoryItem) => void;
  onDeleteScan: (scanId: string) => void;
}

export default function ScanHistory({ 
  scanHistory, 
  onSelectScan,
  onDeleteScan 
}: ScanHistoryProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (scanId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(scanId);
    try {
      await onDeleteScan(scanId);
      toast.success('Scan deleted successfully');
    } catch (error) {
      toast.error('Failed to delete scan');
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewDetails = (scan: ScanHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/scans/${scan.id}`);
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h2 className="text-2xl font-bold mb-6">Scan History</h2>
        {scanHistory.length > 0 ? (
          <div className="space-y-4">
            {scanHistory.map((scan) => {
              const totalFindings = Object.values(scan.results).reduce(
                (sum, tool) => sum + (tool.findings?.length || 0),
                0
              );

              return (
                <div
                  key={scan.id}
                  className="p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600 relative group"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">
                          {scan.type === 'url' ? (
                            <span className="text-blue-400">
                              {scan.repo?.split('/').slice(-2).join('/')}
                            </span>
                          ) : (
                            <span className="text-purple-400">Uploaded Project</span>
                          )}
                        </h3>
                        <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleViewDetails(scan, e)}
                            className="text-gray-300 hover:text-blue-400 p-1"
                            title="View details"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(scan.id, e)}
                            className="text-gray-300 hover:text-red-400 p-1"
                            title="Delete scan"
                            disabled={deletingId === scan.id}
                          >
                            {deletingId === scan.id ? (
                              <span className="loading-spinner h-5 w-5" />
                            ) : (
                              <TrashIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">
                        {new Date(scan.created_at).toLocaleString()}
                      </p>
                      <div className="mt-1 flex gap-2 flex-wrap">
                        {Object.keys(scan.results).map((tool) => (
                          <span
                            key={tool}
                            className="text-xs px-2 py-1 rounded-full bg-gray-800 capitalize"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <span
                        className={`text-lg font-bold ${
                          totalFindings > 0 ? 'text-red-400' : 'text-green-400'
                        }`}
                      >
                        {totalFindings} findings
                      </span>
                      <p className="text-xs text-gray-400">
                        {scan.type === 'upload' && `${scan.files?.length} files`}
                      </p>
                    </div>
                  </div>
                  {scan.message && (
                    <div className="mt-2 text-sm text-gray-400">
                      {scan.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            No scan history available
          </div>
        )}
      </div>
    </div>
  );
}