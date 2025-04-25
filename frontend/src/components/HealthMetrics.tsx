import { SystemHealth } from '../types';

interface HealthMetricsProps {
  metrics: SystemHealth;
}

export default function HealthMetrics({ metrics }: HealthMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h3 className="text-gray-400 mb-2">Total Scans</h3>
        <p className="text-3xl font-bold">{metrics.totalScans}</p>
      </div>
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h3 className="text-gray-400 mb-2">Vulnerabilities Found</h3>
        <p className="text-3xl font-bold text-red-400">{metrics.vulnerabilitiesFound}</p>
      </div>
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h3 className="text-gray-400 mb-2">Repos Monitored</h3>
        <p className="text-3xl font-bold">{metrics.reposMonitored}</p>
      </div>
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h3 className="text-gray-400 mb-2">Avg. Fix Time</h3>
        <p className="text-3xl font-bold text-green-400">{metrics.avgResolutionTime}</p>
      </div>
    </div>
  );
}