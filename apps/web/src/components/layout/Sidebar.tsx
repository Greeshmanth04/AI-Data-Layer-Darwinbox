import { LayoutDashboard, Database, Share2, Calculator, ShieldCheck, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ activeTab, setActiveTab, isSidebarOpen }: any) => {
  const { logout, user } = useAuth();

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'catalog', label: 'Data Catalog', icon: Database },
    { id: 'relationships', label: 'Relationships', icon: Share2 },
    { id: 'metrics', label: 'Metrics & Formulas', icon: Calculator },
    { id: 'access', label: 'Access Control', icon: ShieldCheck, adminOnly: true },
    { id: 'chat', label: 'Analytics Chat', icon: MessageSquare }
  ];

  const navItems = allNavItems.filter(item => !item.adminOnly || user?.role === 'platform_admin');

  return (
    <div className={`${isSidebarOpen ? 'w-[260px]' : 'w-0'} bg-[#0F172A] text-slate-300 flex flex-col h-full border-r border-slate-800 shrink-0 transition-all duration-300 ease-in-out overflow-hidden`}>
      <div className="p-6 border-b border-slate-800 mb-4 min-w-[260px]">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
          <div className="bg-indigo-500/20 p-2 rounded-lg">
            <Database className="text-indigo-400" size={20} />
          </div>
          Darwinbox<span className="text-indigo-400 text-sm mt-1 -ml-1">AI</span>
        </h1>
        <p className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase mt-4">AI Data Layer</p>
      </div>

      <div className="px-5 text-xs font-semibold text-slate-500 mb-3 mt-2 uppercase tracking-wider">Platform Modules</div>

      <nav className="flex-1 px-3 space-y-1 min-w-[260px]">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-start gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-800/50 hover:text-white'
                }`}
            >
              <Icon size={18} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="p-6 border-t border-slate-800 min-w-[260px]">
        <button onClick={logout} className="text-xs font-medium text-slate-500 hover:text-white transition w-full text-left">
          Logout Session
        </button>
      </div>
    </div>
  );
};
