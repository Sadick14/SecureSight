import { ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="group relative inline-flex">
      {children}
      <span className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-48 px-2 py-1 bg-gray-800 text-xs text-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {content}
      </span>
    </div>
  );
}