import React from 'react';
import { Columns } from 'lucide-react';

export const Topbar = () => {
  return (
    <header className="h-[64px] bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-10 relative">
      <div className="flex items-center gap-4 text-sm text-gray-500 font-medium">
         <Columns size={18} className="text-gray-400"/>
         <span className="border-l border-gray-200 pl-4">Enterprise Data Platform</span>
      </div>
      <div className="flex items-center gap-4">
         <div className="flex items-center gap-2.5 bg-emerald-50/50 px-3.5 py-1.5 rounded-full border border-emerald-100">
           <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
           <span className="text-[11px] font-bold text-emerald-700 tracking-wide uppercase">System Healthy</span>
         </div>
      </div>
    </header>
  );
};
