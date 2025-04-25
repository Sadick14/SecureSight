import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ScanHistoryItem } from '../../types';
import { ArrowLeftIcon, ChartBarIcon, ShieldCheckIcon, CubeIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts';
import SeverityBadge from '../../components/SeverityBadge';

export default function ScanDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [scan, setScan] = useState<ScanHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScan = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('scans')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setScan(data);
      } catch (error) {
        console.error('Error fetching scan:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchScan();
  }, [id]);

  const getSeverityStats = () => {
    if (!scan?.summary) {
      return [
        { name: 'Critical', count: 0 },
        { name: 'High', count: 0 },
        { name: 'Medium', count: 0 },
        { name: 'Low', count: 0 },
        { name: 'Info', count: 0 }
      ];
    }

    const summary = typeof scan.summary === 'string' 
      ? JSON.parse(scan.summary)
      : scan.summary;

    return [
      { name: 'Critical', count: summary.severity_counts?.Critical || 0 },
      { name: 'High', count: summary.severity_counts?.High || 0 },
      { name: 'Medium', count: summary.severity_counts?.Medium || 0 },
      { name: 'Low', count: summary.severity_counts?.Low || 0 },
      { name: 'Info', count: summary.severity_counts?.Info || 0 }
    ];
  };

  const getTimelineData = () => {
    // Mock timeline data - replace with actual data if available
    return [
      { day: 'Day 1', findings: 5 },
      { day: 'Day 2', findings: 8 },
      { day: 'Day 3', findings: 12 },
      { day: 'Day 4', findings: 7 },
      { day: 'Day 5', findings: 3 },
      { day: 'Day 6', findings: 9 },
      { day: 'Day 7', findings: 4 }
    ];
  };

  const getToolResults = () => {
    if (!scan?.results) return [];

    return Object.entries(scan.results)
      .filter(([key]) => !key.startsWith('_'))
      .map(([tool, data]: [string, any]) => ({
        tool,
        status: data?.metadata?.status || 'unknown',
        message: data?.metadata?.message || '',
        findings: data?.findings || [],
        error: data?.error || (data?.metadata?.status === 'error' ? data?.metadata?.message : null)
      }));
  };

  const renderFinding = (finding: any) => {
    return (
      <div key={finding.id || finding.title} className="p-4 rounded-lg bg-gray-700/50 border border-gray-600 mb-4 hover:bg-gray-700 transition-colors">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {finding.title || finding.test_id || 'Security Finding'}
            </h3>
            {finding.path && (
              <p className="text-sm text-gray-400 mt-1">
                {finding.path}:{finding.start?.line || finding.line_number || 'N/A'}
              </p>
            )}
          </div>
          <SeverityBadge severity={finding.severity} />
        </div>
        
        <p className="text-gray-300 mt-2">
          {finding.description || finding.message || 'No description available'}
        </p>
        
        {finding.package && (
          <div className="mt-2">
            <span className="text-sm text-gray-400">Package: </span>
            <span className="text-sm text-white">
              {finding.package}
              {finding.installed_version && `@${finding.installed_version}`}
              {finding.fixed_version && ` (fixed in ${finding.fixed_version})`}
            </span>
          </div>
        )}
      </div>
    );
  };

  const pieColors = ['#EF4444', '#F97316', '#EAB308', '#10B981', '#3B82F6'];
  const lineColors = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-gray-400">
        <p>Scan not found</p>
        <Link href="/dashboard" className="mt-4 text-blue-400 hover:underline">
          Go back to dashboard
        </Link>
      </div>
    );
  }

  const severityStats = getSeverityStats();
  const timelineData = getTimelineData();
  const toolResults = getToolResults();
  const summary = typeof scan.summary === 'string' ? JSON.parse(scan.summary) : scan.summary;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-blue-400 hover:text-blue-300"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to dashboard
          </Link>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            scan.status === 'completed' 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            {scan.status}
          </span>
        </div>

        {/* Scan Info Card */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
          <div className="flex flex-col md:flex-row justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {scan.type === 'repository' ? (
                  <span className="text-blue-400">
                     {scan.repo?.split('/').slice(-2).join('/')}
                  </span>
                ) : (
                  <span className="text-purple-400">Uploaded Project</span>
                )}
              </h1>
              <p className="text-gray-400 mt-1">
                Scanned on {new Date(scan.created_at).toLocaleString()}
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="flex flex-wrap gap-2">
                {scan.scan_options?.map((option) => (
                  <span key={option} className="px-2 py-1 bg-gray-700 rounded-md text-xs">
                    {option.replace('-', ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {scan.message && (
            <div className="bg-gray-700 p-4 rounded-lg mt-4 border border-gray-600">
              <p className="text-gray-300">{scan.message}</p>
            </div>
          )}
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center">
            <div className="p-3 rounded-full bg-blue-500/20 mr-4">
              <ShieldCheckIcon className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Findings</p>
              <p className="text-2xl font-bold">
                {summary?.total_findings || 0}
              </p>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center">
            <div className="p-3 rounded-full bg-purple-500/20 mr-4">
              <ChartBarIcon className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Risk Score</p>
              <p className="text-2xl font-bold">
                {summary?.risk_score || 0}
              </p>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center">
            <div className="p-3 rounded-full bg-green-500/20 mr-4">
              <CubeIcon className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Dependencies</p>
              <p className="text-2xl font-bold">
                {summary?.dependencies_scanned || 0}
              </p>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center">
            <div className="p-3 rounded-full bg-yellow-500/20 mr-4">
              <CubeIcon className="h-6 w-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Files Scanned</p>
              <p className="text-2xl font-bold">
                {summary?.files_scanned || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Line Chart */}
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Findings Over Time</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="day" 
                    stroke="#9CA3AF" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#9CA3AF" 
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      borderColor: '#4B5563',
                      borderRadius: '0.5rem'
                    }}
                    itemStyle={{ color: '#E5E7EB' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="findings"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Severity Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityStats}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {severityStats.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={pieColors[index % pieColors.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      borderColor: '#4B5563',
                      borderRadius: '0.5rem'
                    }}
                    formatter={(value) => [value, 'Findings']}
                  />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    wrapperStyle={{
                      paddingLeft: '20px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tool Results Section */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">Tool Scan Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {toolResults.map((toolResult) => (
              <div key={toolResult.tool} className="p-5 rounded-xl bg-gray-700/50 border border-gray-600">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold capitalize">
                    {toolResult.tool.replace('-', ' ')}
                  </h3>
                  <span className={`px-2 py-1 rounded text-xs ${
                    toolResult.status === 'completed' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {toolResult.status}
                  </span>
                </div>

                {toolResult.error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 mb-4">
                    <p className="text-red-400">{toolResult.error}</p>
                  </div>
                )}

                {toolResult.findings.length > 0 ? (
                  <div className="space-y-3">
                    {toolResult.findings.slice(0, 3).map(renderFinding)}
                    {toolResult.findings.length > 3 && (
                      <div className="text-center text-sm text-gray-400">
                        Showing 3 of {toolResult.findings.length} findings
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">
                    {toolResult.status === 'completed' 
                      ? 'No findings detected' 
                      : 'Scan failed or was not completed'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}