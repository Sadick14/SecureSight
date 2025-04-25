// components/ScanHistoryChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { date: 'Mon', issues: 12 },
  { date: 'Tue', issues: 19 },
  { date: 'Wed', issues: 3 },
  { date: 'Thu', issues: 15 },
  { date: 'Fri', issues: 8 },
];

export default function ScanHistoryChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="date" stroke="#9CA3AF" />
        <YAxis stroke="#9CA3AF" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
          itemStyle={{ color: '#E5E7EB' }}
        />
        <Line
          type="monotone"
          dataKey="issues"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={{ fill: '#1E40AF' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

