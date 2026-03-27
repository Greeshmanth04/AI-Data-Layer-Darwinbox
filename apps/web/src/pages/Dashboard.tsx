import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Database, FileText, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function Dashboard() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const { data: statsData } = useQuery({
    queryKey: ['stats'],
    queryFn: () => fetch('/api/v1/dashboard/stats', { headers }).then(res => res.json())
  });

  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: () => fetch('/api/v1/dashboard/health', { headers }).then(res => res.json())
  });

  const { data: activityData } = useQuery({
    queryKey: ['activity'],
    queryFn: () => fetch('/api/v1/dashboard/activity', { headers }).then(res => res.json())
  });

  const stats = statsData?.data || { totalCollections: 0, totalFields: 0, documentationCoverage: 0 };
  const health = healthData?.data || { undocumentedFields: [], unassignedCollections: [], metricsNoPreview: [] };
  const activities = activityData?.data || [];

  const pieData = [
    { name: 'Documented', value: stats.documentationCoverage },
    { name: 'Undocumented', value: 100 - stats.documentationCoverage }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Platform Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-indigo-50 rounded-lg text-indigo-600"><Database size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Accessible Collections</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalCollections}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-emerald-50 rounded-lg text-emerald-600"><FileText size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Accessible Fields</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalFields}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-blue-50 rounded-lg text-blue-600"><Activity size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Documentation Coverage</p>
            <p className="text-3xl font-bold text-gray-900">{stats.documentationCoverage}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
           <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
             <AlertTriangle className="text-amber-500" size={24} /> Health Alerts
           </h2>
           <div className="space-y-4">
             {health.unassignedCollections.length > 0 && (
               <div className="p-4 bg-red-50 text-red-800 rounded-lg border border-red-100">
                 <p className="font-semibold">Collections Missing Permissions</p>
                 <p className="text-sm mt-1">{health.unassignedCollections.join(', ')}</p>
               </div>
             )}
             {health.metricsNoPreview.length > 0 && (
               <div className="p-4 bg-amber-50 text-amber-800 rounded-lg border border-amber-100">
                 <p className="font-semibold">Metrics Missing Previews</p>
                 <p className="text-sm mt-1">{health.metricsNoPreview.join(', ')}</p>
               </div>
             )}
             {health.undocumentedFields.length > 0 && (
               <div className="p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                 <p className="font-semibold">{health.undocumentedFields.length} Undocumented Fields</p>
               </div>
             )}
             {(health.unassignedCollections.length === 0 && health.metricsNoPreview.length === 0 && health.undocumentedFields.length === 0) && (
               <p className="text-gray-500 text-sm">Perfect health! No issues found in your accessible scope.</p>
             )}
           </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
           <h2 className="text-xl font-bold mb-6 text-gray-800">Coverage Analytics</h2>
           <div className="flex-1 min-h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                   <Cell fill="#4f46e5" />
                   <Cell fill="#e5e7eb" />
                 </Pie>
                 <Tooltip />
               </PieChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Recent Activity</h2>
        <div className="space-y-3">
          {activities.length > 0 ? activities.map((act: any) => (
            <div key={act._id} className="flex gap-4 items-start p-4 hover:bg-gray-50 rounded-lg transition-colors border border-gray-50">
               <div className="w-2.5 h-2.5 mt-2 rounded-full bg-indigo-500 flex-shrink-0"></div>
               <div>
                  <p className="text-gray-900 font-medium">User {(act.userId as any)?.email || act.userId} performed <span className="font-semibold font-mono text-xs bg-gray-100 px-1 rounded">{act.action}</span> on {act.resource}</p>
                  {act.details && <p className="text-sm text-gray-500 mt-1">{act.details}</p>}
                  <p className="text-xs text-gray-400 mt-2">{new Date(act.createdAt).toLocaleString()}</p>
               </div>
            </div>
          )) : <p className="text-gray-500 text-sm">No recent activity detected.</p>}
        </div>
      </div>
    </div>
  );
}
