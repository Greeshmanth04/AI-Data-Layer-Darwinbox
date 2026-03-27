import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Database, Layout, Share2, Calculator, ShieldCheck } from 'lucide-react';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({ queryKey: ['stats'], queryFn: () => apiClient('/dashboard/stats') });
  const { data: collections, isLoading: collLoading } = useQuery({ queryKey: ['collections'], queryFn: () => apiClient('/catalog/collections').then(res => Object.values(res).flat() as any[]) });

  if (isLoading || collLoading) return <div className="p-10 text-indigo-600 animate-pulse font-medium">Loading Dashboard Elements...</div>;

  return (
    <div className="p-10 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Platform Overview</h1>
        <p className="text-slate-500 mt-2 text-sm">High-level telemetry of the Darwinbox AI Data Layer safely aggregated via your native permissions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Collections', val: stats?.totalCollections || 0, icon: Layout },
          { label: 'Total Fields', val: stats?.totalFields || 0, icon: Database },
          { label: 'Relationships', val: 7, icon: Share2 },
          { label: 'Metrics', val: 0, icon: Calculator },
          { label: 'Access Groups', val: 0, icon: ShieldCheck },
        ].map((card, idx) => {
           const Icon = card.icon;
           return (
             <div key={idx} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-colors">
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
              <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-wider text-right">Records Engine</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {collections?.map((c) => (
              <tr key={c._id} className="hover:bg-indigo-50/30 transition-colors">
                <td className="px-6 py-4 font-semibold text-slate-700 capitalize">{c.displayName}</td>
                <td className="px-6 py-4 text-right text-indigo-600 font-mono font-medium opacity-90 text-xs">8</td>
                <td className="px-6 py-4 text-right text-emerald-600 font-mono text-xs font-medium tracking-wide">1,250</td>
              </tr>
            ))}
            {collections?.length === 0 && (
               <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-400 text-sm">No accessible collections authorized for your identity token natively.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
