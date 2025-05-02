import { InformationCircleIcon } from '@heroicons/react/24/outline';
import Tooltip from './Tooltip';

interface ScanPresetBadgeProps {
  name: string;
  tool: string;
  description: string;
}

export default function ScanPresetBadge({ name, tool, description }: ScanPresetBadgeProps) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-900 text-blue-100 group relative">
      {name} ({tool})
      <Tooltip content={description}>
        <InformationCircleIcon className="h-4 w-4 ml-1 text-blue-200" />
      </Tooltip>
    </span>
  );
}