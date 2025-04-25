import { ChartPieIcon, ShieldCheckIcon, SignalIcon, UserGroupIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { GitHubUser } from '../types';

interface DashboardSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user?: GitHubUser;
  logout: () => Promise<void>;
}

export default function DashboardSidebar({ 
  activeTab, 
  setActiveTab,
  user,
  logout
}: DashboardSidebarProps) {
  return (
    <div className="w-64 bg-gray-800 p-4 flex flex-col border-r border-gray-700">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheckIcon className="h-8 w-8 text-blue-400" />
        <h1 className="text-xl font-bold">SecureSight</h1>
      </div>

      <nav className="space-y-2 flex-1">
        <button 
          onClick={() => setActiveTab('overview')} 
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
          <ChartPieIcon className="h-5 w-5" />
          Overview
        </button>
        
        <button 
          onClick={() => setActiveTab('repos')} 
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'repos' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
          <SignalIcon className="h-5 w-5" />
          Repositories
        </button>

        <button 
          onClick={() => setActiveTab('history')} 
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
          <ArrowPathIcon className="h-5 w-5" />
          Scan History
        </button>

        <button 
          onClick={() => setActiveTab('team')} 
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'team' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
          <UserGroupIcon className="h-5 w-5" />
          Team
        </button>
      </nav>

      <div className="border-t border-gray-700 pt-4">
        <div className="flex items-center gap-3">
          <img 
            src={user?.avatar_url} 
            className="h-10 w-10 rounded-full" 
            alt="Profile" 
          />
          <div>
            <p className="font-medium">{user?.name || user?.login}</p>
            <button 
              onClick={logout}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}