// components/SeverityBadge.tsx
export default function SeverityBadge({ severity }: { severity: string }) {
  const colorMap = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-orange-500/20 text-orange-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-green-500/20 text-green-400'
  };

  return (
    <span className={`${colorMap[severity]} px-3 py-1 rounded-full text-sm capitalize`}>
      {severity}
    </span>
  );
}

