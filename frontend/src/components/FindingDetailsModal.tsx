import { XMarkIcon } from '@heroicons/react/24/outline';
import { ToolFinding } from '../types';
import SeverityBadge from './SeverityBadge';

interface FindingDetailsModalProps {
  finding: ToolFinding;
  onClose: () => void;
}

export default function FindingDetailsModal({ finding, onClose }: FindingDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <SeverityBadge severity={finding.severity} />
                <span className="text-lg font-bold capitalize">
                  {finding.tool} Finding
                </span>
              </div>
              <p className="text-gray-400">
                {finding.path && `${finding.path}:`}
                {finding.start?.line || finding.line_number}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-gray-300 mb-4">
                {finding.description || finding.message}
              </p>
              {finding.code && (
                <>
                  <h4 className="font-medium mb-2">Code Context</h4>
                  <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm border border-gray-700">
                    {finding.context_lines?.before?.map((line, i) => (
                      <div key={`before-${i}`} className="text-gray-500">{line}</div>
                    ))}
                    <div className="text-red-400 bg-red-900 bg-opacity-30 px-1">
                      {finding.code}
                      <span className="ml-2 text-xs text-red-300">← Vulnerable line</span>
                    </div>
                    {finding.context_lines?.after?.map((line, i) => (
                      <div key={`after-${i}`} className="text-gray-500">{line}</div>
                    ))}
                  </div>
                </>
              )}
              {finding.tool === 'trivy' && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Dependency Info</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Package: {finding.PkgName}</div>
                    <div>Installed: {finding.InstalledVersion}</div>
                    {finding.FixedVersion && (
                      <div>Fixed Version: {finding.FixedVersion}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div>
              <h4 className="font-medium mb-2">Remediation</h4>
              <div className="bg-gray-700 p-4 rounded-lg mb-4 border border-gray-600">
                {finding.remediation || (
                  <a 
                    href={finding.more_info} 
                    className="text-blue-400 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View recommended fixes
                  </a>
                )}
              </div>

              {finding.tool === 'safety' && (
                <div className="bg-yellow-900 bg-opacity-30 p-4 rounded-lg mb-4">
                  <div className="text-sm">
                    <div>Package: {finding.package}</div>
                    <div>Vulnerable ID: {finding.vulnerability}</div>
                    <div>Versions: {finding.vulnerable_versions}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {finding.path && (
                  <button
                    onClick={() => navigator.clipboard.writeText(finding.path!)}
                    className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded border border-gray-600"
                  >
                    Copy file path
                  </button>
                )}
                {finding.code && (
                  <button
                    onClick={() => navigator.clipboard.writeText(finding.code!)}
                    className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded border border-gray-600"
                  >
                    Copy code
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}