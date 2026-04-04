import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Database, Layout, ShieldCheck, Calculator, BookOpen, AlertTriangle, Activity, CheckCircle, Clock } from 'lucide-react';

interface DashboardProps {
  onNavigate?: (tab: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps = {}) {
  const { data: stats, isLoading } = useQuery({ queryKey: ['stats'], queryFn: () => apiClient('/dashboard/stats') });
  const { data: healthAlerts, isLoading: healthLoading } = useQuery({ queryKey: ['health'], queryFn: () => apiClient('/dashboard/health') });
  const { data: activities, isLoading: activityLoading } = useQuery({ queryKey: ['activity'], queryFn: () => apiClient('/dashboard/activity') });

  if (isLoading || healthLoading || activityLoading) {
    return <div className="p-10 text-indigo-600 animate-pulse font-medium">Loading Dashboard Elements...</div>;
  }

  return (
    <div className="h-full overflow-y-auto w-full">
      <div className="p-10 max-w-6xl mx-auto space-y-8 pb-20">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Platform Overview</h1>
        <p className="text-slate-500 mt-2 text-sm">High-level telemetry of the Darwinbox AI Data Layer safely aggregated via your native permissions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Collections', val: stats?.totalCollections || 0, icon: Layout, target: 'catalog' },
          { label: 'Total Fields', val: stats?.totalFields || 0, icon: Database, target: 'catalog' },
          { label: 'Doc Coverage', val: `${stats?.documentationCoverage || 0}%`, icon: BookOpen, target: 'catalog' },
          { label: 'Active Metrics', val: stats?.activeMetrics || 0, icon: Calculator, target: 'metrics' },
          { label: 'User Groups', val: stats?.userGroups || 0, icon: ShieldCheck, target: 'access' },
        ].map((card, idx) => {
           const Icon = card.icon;
           return (
             <div 
               key={idx} 
               onClick={() => onNavigate && onNavigate(card.target)}
               className={`bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between transition-all ${onNavigate ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5' : 'hover:border-indigo-100'}`}
             >
               <div className="flex justify-between items-start mb-6">
                 <span className="text-xs font-semibold text-gray-500 tracking-wide uppercase">{card.label}</span>
                 <Icon size={16} className="text-indigo-500" />
               </div>
               <span className="text-3xl font-bold text-slate-900">{card.val}</span>
             </div>
           );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-bold text-slate-900">Data Collections Breakdown</h2>
          <p className="text-xs text-gray-500 mt-1">Volume and scale across primary datasets natively bounded by your active session scope.</p>
        </div>
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50/50 font-medium text-gray-400 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-wider">Collection Name</th>
              <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-wider text-right">Schema Fields</th>
              <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-wider text-right">Doc Coverage</th>
              <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-wider text-right">Total Records</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {stats?.coverageBreakdown?.map((c: any) => (
              <tr key={c._id} className="hover:bg-indigo-50/30 transition-colors">
                <td className="px-6 py-4 font-semibold text-slate-700 capitalize">{c.collectionName}</td>
                <td className="px-6 py-4 text-right text-indigo-600 font-mono font-medium opacity-90 text-xs">{c.schemaFields}</td>
                <td className="px-6 py-4 text-right text-purple-600 font-mono text-xs font-medium tracking-wide">
                  {c.coveragePercentage}% <span className="text-[10px] text-gray-400 font-sans ml-1">({c.documentedFields}/{c.schemaFields})</span>
                </td>
                <td className="px-6 py-4 text-right text-emerald-600 font-mono text-xs font-medium tracking-wide">{c.totalRecords?.toLocaleString()}</td>
              </tr>
            ))}
            {!stats?.coverageBreakdown?.length && (
               <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">No accessible collections authorized for your identity token natively.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Health Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <div className="p-6 border-b border-gray-100 bg-red-50/30">
            <h2 className="font-bold text-red-900 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" /> Platform Health Alerts
            </h2>
            <p className="text-xs text-red-700/70 mt-1">Issues requiring attention for optimal data governance.</p>
          </div>
          <div className="p-0 overflow-y-auto flex-1">
            {healthAlerts?.undocumentedFields?.map((f: string, i: number) => (
              <div key={`uf-${i}`} className="p-4 border-b border-gray-50 flex items-start gap-3 hover:bg-gray-50">
                <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-700">Undocumented Field</div>
                  <div className="text-xs text-slate-500 mt-1"><span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-mono text-[10px]">{f}</span> lacks description</div>
                </div>
              </div>
            ))}
            {healthAlerts?.metricsNoPreview?.map((m: string, i: number) => (
              <div key={`m-${i}`} className="p-4 border-b border-gray-50 flex items-start gap-3 hover:bg-gray-50">
                <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-700">Metric requires Preview Baseline</div>
                  <div className="text-xs text-slate-500 mt-1"><span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-mono text-[10px]">{m}</span> hasn't been evaluated</div>
                </div>
              </div>
            ))}
            {healthAlerts?.unassignedCollections?.map((c: string, i: number) => (
               <div key={`c-${i}`} className="p-4 border-b border-gray-50 flex items-start gap-3 hover:bg-gray-50">
                <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-700">Unassigned Permissions</div>
                  <div className="text-xs text-slate-500 mt-1"><span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-mono text-[10px]">{c}</span> is isolated from all user groups</div>
                </div>
              </div>
            ))}
            {(!healthAlerts?.undocumentedFields?.length && !healthAlerts?.metricsNoPreview?.length && !healthAlerts?.unassignedCollections?.length) && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                <CheckCircle className="text-emerald-400 mb-3" size={32} />
                No health alerts! System is fully optimized.
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Activity size={18} className="text-indigo-500" /> Recent Activity
            </h2>
            <p className="text-xs text-gray-500 mt-1">Audit log of your last 20 automated or manual actions.</p>
          </div>
          <div className="p-0 overflow-y-auto flex-1 relative">
            {activities?.items?.map((act: any) => (
               <div key={act._id} className="p-4 border-b border-gray-50 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                 <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg mt-0.5 shrink-0">
                   <Clock size={16} />
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-start">
                     <div className="text-sm font-semibold text-slate-700 truncate mr-2">
                       {act.userId?.email || 'System'}
                     </div>
                     <span className="text-[10px] text-gray-400 font-medium tracking-wide whitespace-nowrap mt-1">
                       {new Date(act.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                     </span>
                   </div>
                   <div className="text-xs text-slate-500 mt-1 truncate">
                     <span className="font-medium text-indigo-900 uppercase tracking-wide text-[10px]">{act.action}</span> 
                     <span className="mx-1 text-gray-300">•</span>
                     <span className="font-mono text-[11px] text-slate-600">{act.resource}</span>
                   </div>
                   {act.details && <div className="text-[11px] mt-2 bg-slate-50/80 p-2 rounded-md border border-slate-100/50 text-slate-500 whitespace-pre-wrap">{act.details}</div>}
                 </div>
               </div>
            ))}
            {!activities?.items?.length && (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">No recent activity detected.</div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
