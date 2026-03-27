import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Search } from 'lucide-react';

export default function Catalog() {
  const [selectedCollId, setSelectedCollId] = useState<string | null>(null);
  
  const { data: groupedCollections = {} } = useQuery({
    queryKey: ['catalog-group'],
    queryFn: () => apiClient('/catalog/collections')
  });

  const { data: collectionDetail, isLoading } = useQuery({
    queryKey: ['catalog-detail', selectedCollId],
    queryFn: () => selectedCollId ? apiClient(`/catalog/collections/${selectedCollId}`) : null,
    enabled: !!selectedCollId
  });

  const modules = Object.keys(groupedCollections);
  if (modules.length > 0 && !selectedCollId) {
    setSelectedCollId(groupedCollections[modules[0]][0]._id);
  }

  return (
    <div className="flex bg-white h-full overflow-hidden">
      <div className="w-64 border-r border-gray-200 flex flex-col bg-slate-50/50 shrink-0">
        <div className="p-4 border-b border-gray-200">
           <div className="relative">
             <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
             <input type="text" placeholder="Search collections..." className="w-full pl-9 pr-3 py-2 text-sm font-medium bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"/>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2 pr-1">
          {modules.map(mod => (
            <div key={mod} className="mb-4">
              <div className="px-5 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{mod}</div>
              {groupedCollections[mod].map((coll: any) => (
                <button 
                  key={coll._id} 
                  onClick={() => setSelectedCollId(coll._id)}
                  className={`w-full text-left px-5 py-2.5 text-sm flex justify-between items-center transition ${selectedCollId === coll._id ? 'bg-indigo-600 text-white font-medium border-l-2 border-indigo-300' : 'text-slate-600 hover:bg-slate-100 font-medium'}`}
                >
                  <span className="capitalize">{coll.displayName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold tracking-wider font-mono ${selectedCollId === coll._id ? 'bg-indigo-500/50 text-white' : 'text-slate-400'}`}>
                    8
                  </span>
                </button>
              ))}
            </div>
          ))}
          {modules.length === 0 && <div className="text-center text-xs text-gray-400 mt-10">No Collections Available</div>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-12 bg-white">
         {isLoading && <div className="text-indigo-600 animate-pulse font-medium">Extracting securely encrypted collection maps natively...</div>}
         
         {!isLoading && collectionDetail && (
           <div className="max-w-4xl space-y-10">
             <div className="border-b border-gray-100 pb-6">
               <h1 className="text-3xl font-bold text-slate-900 capitalize tracking-tight">{collectionDetail.displayName}</h1>
               <p className="text-slate-500 mt-2 text-sm">{collectionDetail.description || 'Core entity profile mapping strictly evaluating boundaries successfully natively.'}</p>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#F8FAFC] p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Total Fields</p>
                  <p className="text-4xl font-bold text-indigo-700 mt-2">{collectionDetail.fields?.length || 0}</p>
                  <p className="text-[11px] text-slate-400 mt-2 capitalize font-medium">{collectionDetail.fields?.length} standard • 0 custom mapping</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Estimated Records</p>
                  <p className="text-4xl font-bold text-emerald-600 mt-2">1,250</p>
                </div>
             </div>

             <div className="pt-2">
               <div className="flex justify-between items-end mb-4">
                 <h2 className="text-lg font-bold text-slate-800">Standard Fields</h2>
                 <span className="text-xs text-gray-500 font-medium">{collectionDetail.fields?.length || 0} fields extracted securely</span>
               </div>
               
               <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500">
                     <tr>
                       <th className="px-6 py-3.5 font-semibold text-[11px] uppercase tracking-wider">Field Name</th>
                       <th className="px-6 py-3.5 font-semibold text-[11px] uppercase tracking-wider">Type Map</th>
                       <th className="px-6 py-3.5 font-semibold text-[11px] uppercase tracking-wider">Description Native</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {collectionDetail.fields?.map((f: any) => (
                       <tr key={f._id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-6 py-4 font-mono font-semibold text-slate-700 flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                             {f.name}
                         </td>
                         <td className="px-6 py-4"><span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-mono font-semibold text-slate-600">{f.type}</span></td>
                         <td className="px-6 py-4 text-slate-400 italic text-xs">{f.description || 'No definition explicitly declared'}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           </div>
         )}
      </div>
    </div>
  )
}
