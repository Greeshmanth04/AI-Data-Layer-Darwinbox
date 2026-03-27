import React from 'react';
import { ShieldCheck, Search } from 'lucide-react';

export default function AccessControl() {
  return (
    <div className="flex bg-white h-full overflow-hidden">
      <div className="w-72 border-r border-slate-200 flex flex-col bg-[#F8FAFC]">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
           <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm"><ShieldCheck size={18} className="text-indigo-500"/> Security Policies</h3>
           <button className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition px-2.5 py-1.5 rounded-lg shadow-sm">New Group</button>
        </div>
        <div className="p-4 border-b border-slate-200 bg-white">
           <div className="relative">
             <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
             <input type="text" placeholder="Search roles natively..." className="w-full pl-9 pr-3 py-2 text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"/>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
           <div className="text-sm font-medium text-slate-400 text-center mt-10">No custom mapping policies explicit globally.</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-10 bg-white text-center">
         <div className="w-20 h-20 bg-slate-50 border border-slate-100 text-slate-300 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
           <ShieldCheck size={40} />
         </div>
         <h2 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">Select a Security Group</h2>
         <p className="text-sm text-slate-500 max-w-sm leading-relaxed">Configure robust table, column, and row-level access matrices securely via the unified Access Control boundary perfectly cleanly safely.</p>
      </div>
    </div>
  )
}
