import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Search, Edit3, X, Key, Hash, ChevronDown, ArrowLeft, Sparkles, Tag as TagIcon, Database, Activity, Plus, Trash2, RefreshCw, BookOpen } from 'lucide-react';
import { FormulaGuide } from '../components/FormulaGuide';

export default function Catalog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [collSearch, setCollSearch] = useState('');
  const [selectedCollId, setSelectedCollId] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'collection' | 'field', name: string } | null>(null);
  const [collapsedModules, setCollapsedModules] = useState<string[]>([]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const toggleModule = (mod: string) => setCollapsedModules(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  
  const [editDesc, setEditDesc] = useState('');
  const [tagInput, setTagInput] = useState('');
  
  const [showCollModal, setShowCollModal] = useState(false);
  const [isEditingColl, setIsEditingColl] = useState(false);
  const [collForm, setCollForm] = useState({ name: '', displayName: '', module: '', description: '' });
  
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [fieldForm, setFieldForm] = useState({ name: '', type: 'string', isCustom: true });

  const queryClient = useQueryClient();
  
  const { data: groupedCollections = {} } = useQuery({
    queryKey: ['catalog-group'],
    queryFn: () => apiClient('/catalog/collections')
  });

  const { data: collectionDetail, isLoading } = useQuery({
    queryKey: ['catalog-detail', selectedCollId, debouncedSearchQuery],
    queryFn: () => selectedCollId ? apiClient(`/catalog/collections/${selectedCollId}${debouncedSearchQuery ? `?search=${debouncedSearchQuery}` : ''}`) : null,
    enabled: !!selectedCollId
  });

  const updateFieldMutation = useMutation({
    mutationFn: (data: { id: string, manualDescription: string }) => 
       apiClient(`/catalog/fields/${data.id}`, { method: 'PUT', body: JSON.stringify({ manualDescription: data.manualDescription }) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['catalog-detail', selectedCollId] });
      setSelectedField(data);
    }
  });

  const updateFieldGeneralMutation = useMutation({
    mutationFn: (data: { id: string, tags?: string[], isCustom?: boolean, type?: string }) => 
       apiClient(`/catalog/fields/${data.id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['catalog-detail', selectedCollId] });
      setSelectedField(data);
    }
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/catalog/fields/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-detail', selectedCollId] });
      setSelectedField(null);
    }
  });

  const deleteCollMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/catalog/collections/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-group'] });
      setSelectedCollId(null);
    }
  });

  const createFieldMutation = useMutation({
    mutationFn: (data: any) => apiClient('/catalog/fields', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-detail', selectedCollId] });
      setShowFieldModal(false);
    }
  });

  const createCollMutation = useMutation({
    mutationFn: (data: any) => apiClient('/catalog/collections', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-group'] });
      setShowCollModal(false);
    }
  });

  const updateCollMutation = useMutation({
    mutationFn: (data: { id: string, payload: any }) => apiClient(`/catalog/collections/${data.id}`, { method: 'PUT', body: JSON.stringify(data.payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-group'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-detail', selectedCollId] });
      setShowCollModal(false);
    }
  });

  const generateAIMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/catalog/fields/${id}/generate-description`, { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['catalog-detail', selectedCollId] });
      setSelectedField((prev: any) => ({ ...prev, aiDescription: data.description }));
    }
  });

  const modules = Object.keys(groupedCollections);
  if (modules.length > 0 && !selectedCollId) {
    setSelectedCollId(groupedCollections[modules[0]][0]._id);
  }

  const standardFields = collectionDetail?.fields?.filter((f: any) => !f.isCustom) || [];
  const customFields = collectionDetail?.fields?.filter((f: any) => f.isCustom) || [];

  const handleFieldSelect = (f: any) => {
    setSelectedField(f);
    setEditDesc(f.manualDescription || '');
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim() && selectedField) {
      const newTags = [...(selectedField.tags || []), tagInput.trim()];
      updateFieldGeneralMutation.mutate({ id: selectedField._id, tags: newTags });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (selectedField) {
      const newTags = (selectedField.tags || []).filter((t: string) => t !== tagToRemove);
      updateFieldGeneralMutation.mutate({ id: selectedField._id, tags: newTags });
    }
  };

  const renderTable = (fields: any[], isCustomTable: boolean) => (
    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-8 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500">
          <tr>
            <th className="px-6 py-3.5 font-semibold text-[11px] uppercase tracking-wider">Field Name</th>
            <th className="px-6 py-3.5 font-semibold text-[11px] uppercase tracking-wider">Type</th>
            <th className="px-6 py-3.5 font-semibold text-[11px] uppercase tracking-wider w-1/2">Description</th>
            <th className="px-6 py-3.5 font-semibold text-[11px] uppercase tracking-wider text-center">Status</th>
            {isCustomTable && <th className="px-6 py-3.5 font-semibold text-[11px] uppercase tracking-wider text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {fields.map((f: any) => (
            <tr key={f._id} onClick={() => handleFieldSelect(f)} className="hover:bg-slate-50 transition-colors group cursor-pointer">
              <td className="px-6 py-4 font-mono font-semibold text-slate-800 flex items-center gap-2">
                  {f.name.toLowerCase().includes('id') ? <Key size={14} className="text-amber-500" /> : null}
                  {f.name}
              </td>
              <td className="px-6 py-4"><span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-mono font-semibold text-slate-700">{f.type}</span></td>
              <td className="px-6 py-4 text-slate-500 text-xs">
                 {f.description ? <span className="text-slate-500">{f.description}</span> : <span className="text-slate-300 italic">No description yet</span>}
              </td>
              <td className="px-6 py-4 text-center">
                 <span className="bg-slate-50 border border-slate-200 text-slate-500 px-2 py-1 rounded text-[11px] font-semibold">Draft</span>
              </td>
              {isCustomTable && (
                 <td className="px-6 py-4 text-right">
                    <button onClick={(e) => { e.stopPropagation(); handleFieldSelect(f); }} className="opacity-0 group-hover:opacity-100 text-xs font-bold text-indigo-500 hover:text-indigo-600 transition-opacity flex items-center gap-1 ml-auto">
                      <Edit3 size={12} /> Override
                    </button>
                 </td>
              )}
            </tr>
          ))}
          {fields.length === 0 && (
             <tr><td colSpan={isCustomTable ? 5 : 4} className="px-6 py-8 text-center text-slate-400 text-xs italic">No matching fields found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex bg-white h-full overflow-hidden font-sans relative">
      <div className="w-64 border-r border-slate-200 flex flex-col bg-white shrink-0">
        <div className="p-4 border-b border-slate-100 flex gap-2">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
             <input type="text" value={collSearch} onChange={(e) => setCollSearch(e.target.value)} placeholder="Find collection..." className="w-full pl-9 pr-3 py-2 text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"/>
           </div>
            <button onClick={() => { setIsEditingColl(false); setCollForm({ name: '', displayName: '', module: '', description: '' }); setShowCollModal(true); }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg border border-slate-200 transition-colors" title="Add Collection">
             <Plus size={16} />
            </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 pr-1">
          {modules.map(mod => (
            <div key={mod} className="mb-4">
              <div onClick={() => toggleModule(mod)} className="px-4 flex justify-between items-center py-2 group cursor-pointer hover:bg-slate-50 transition-colors">
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{mod}</div>
                 <ChevronDown size={14} className={`text-slate-300 transition-transform ${collapsedModules.includes(mod) ? '-rotate-90' : ''}`} />
              </div>
              
              <div className={`space-y-0.5 px-2 overflow-hidden transition-all duration-300 ${collapsedModules.includes(mod) ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'}`}>
                {groupedCollections[mod].filter((coll: any) => coll.displayName.toLowerCase().includes(collSearch.toLowerCase()) || coll.name.toLowerCase().includes(collSearch.toLowerCase())).map((coll: any) => {
                  const isSelected = selectedCollId === coll._id && !selectedField;
                  const isChildSelected = selectedCollId === coll._id && selectedField;
                  
                  return (
                    <div key={coll._id}>
                      <div className={`flex items-center transition rounded-md ${isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-50 group/item'}`}>
                        <button 
                          onClick={() => { setSelectedCollId(coll._id); setSelectedField(null); setSearchQuery(''); }}
                          className="flex-1 text-left px-3 py-2 text-sm flex justify-between items-center font-medium"
                        >
                          <span className={`capitalize ${isSelected ? 'text-white' : 'text-slate-600'}`}>{coll.displayName}</span>
                          {isSelected ? (
                            <span className="text-[10px] bg-indigo-500/50 text-white px-2 py-0.5 rounded-full font-bold">{collectionDetail?.fields?.length || 0}</span>
                          ) : (
                             <span className="text-[10px] text-slate-400 font-bold px-1">{coll.fieldCount || 0}</span>
                          )}
                        </button>
                        
                        {!isSelected && (
                           <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: coll._id, type: 'collection', name: coll.displayName }); }} className="px-2 text-red-400 opacity-0 group-hover/item:opacity-100 hover:text-red-600 transition-opacity">
                             <Trash2 size={12} />
                           </button>
                        )}
                      </div>
                      
                      {(isSelected || isChildSelected) && collectionDetail && (
                        <div className="mt-1 mb-2 ml-4 pl-3 border-l-2 border-slate-100 flex flex-col gap-1 py-1">
                           {collectionDetail.fields?.map((f: any) => (
                             <button
                               key={f._id}
                               onClick={() => handleFieldSelect(f)}
                               className={`text-left text-xs font-mono flex flex-1 items-center gap-2 py-1.5 px-2 rounded-md transition-colors ${selectedField?._id === f._id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
                             >
                               {f.name.toLowerCase().includes('id') ? <Key size={12} className={selectedField?._id === f._id ? "text-indigo-500" : "text-amber-500"} /> : <Hash size={12} className={selectedField?._id === f._id ? "text-indigo-400" : "text-slate-300"} />}
                               {f.name}
                             </button>
                           ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {modules.length === 0 && <div className="text-center text-xs text-gray-400 mt-10">No Collections Available</div>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-12 bg-slate-50/30 relative">
         {isLoading && <div className="text-indigo-600 animate-pulse font-medium">Evaluating boundaries...</div>}
         
         {!isLoading && collectionDetail && !selectedField && (
           <div className="max-w-5xl space-y-10 animate-in fade-in zoom-in-95 duration-200">
             <div className="flex justify-between items-start">
               <div>
                 <h1 className="text-3xl font-bold text-slate-900 capitalize tracking-tight">{collectionDetail.displayName}</h1>
                 <p className="text-slate-500 mt-2 text-sm">{collectionDetail.description || 'Core entity profile mapping evaluating globally.'}</p>
               </div>
               <div className="flex flex-col items-end gap-3">
                 <div className="relative w-80">
                   <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                   <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search fields, descriptions, tags..." className="w-full pl-9 pr-3 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all"/>
                 </div>
                  <div className="flex gap-2">
                   <button onClick={() => setShowFieldModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wide px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                     <Plus size={14} /> Add Parameter
                   </button>
                   <button onClick={() => { setIsEditingColl(true); setCollForm({ name: collectionDetail.name, displayName: collectionDetail.displayName, module: collectionDetail.module, description: collectionDetail.description || '' }); setShowCollModal(true); }} className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wide px-4 py-2 rounded-lg flex items-center gap-2 border border-slate-200 transition-colors">
                     <Edit3 size={14} /> Edit
                   </button>
                   <button onClick={() => setDeleteConfirm({ id: collectionDetail._id, type: 'collection', name: collectionDetail.displayName })} className="bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs uppercase tracking-wide px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                     <Trash2 size={14} /> Drop Map
                   </button>
                 </div>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs text-slate-500 font-medium tracking-wide">Permitted Structure Fields</p>
                  <p className="text-4xl font-bold text-indigo-600 mt-2 tracking-tight">{collectionDetail.fields?.length || 0}</p>
                  <p className="text-xs text-slate-400 mt-2 capitalize">{standardFields.length} standard • {customFields.length} custom extension</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs text-slate-500 font-medium tracking-wide">Estimated Record Depth</p>
                  <p className="text-4xl font-bold text-emerald-600 mt-2 tracking-tight">{collectionDetail.estimatedRecords?.toLocaleString() || 0}</p>
                </div>
             </div>

             <div className="pt-2">
               <div className="flex justify-between items-end mb-4">
                 <h2 className="text-lg font-bold text-slate-800">Standard Core Fields</h2>
                 <span className="text-xs text-slate-400 font-medium">{standardFields.length} protected invariants</span>
               </div>
               {renderTable(standardFields, false)}

               {customFields.length > 0 && (
                 <>
                   <div className="flex justify-between items-end mb-4 mt-8">
                     <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div>Custom Extension Fields</h2>
                     <span className="text-xs text-slate-400 font-medium">{customFields.length} flexible mappings</span>
                   </div>
                   {renderTable(customFields, true)}
                 </>
               )}
             </div>
           </div>
         )}

         {!isLoading && selectedField && (
            <div className="max-w-4xl space-y-6 animate-in slide-in-from-right-8 duration-300">
               <div className="flex justify-between items-center mb-6">
                 <button onClick={() => setSelectedField(null)} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors">
                   <ArrowLeft size={16} /> Back to `{collectionDetail?.displayName}`
                 </button>
                 <button onClick={() => setIsGuideOpen(true)} className="flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100 shadow-sm">
                   <BookOpen size={14} /> View Formula Guide
                 </button>
               </div>
               
               <div className="flex justify-between items-start pb-6 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-3xl font-bold text-slate-900 font-mono flex items-center gap-3">
                         {selectedField.name.toLowerCase().includes('id') ? <Key className="text-amber-500" size={28}/> : <Hash className="text-slate-300" size={28}/>}
                         {selectedField.name}
                      </h1>
                      <select 
                        value={selectedField.type} 
                        onChange={(e) => updateFieldGeneralMutation.mutate({ id: selectedField._id, type: e.target.value })}
                        className="bg-slate-100 border border-slate-200 px-2 flex py-1 rounded text-xs font-mono font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:bg-slate-200 transition-colors"
                      >
                         <option value="string">string</option>
                         <option value="number">number</option>
                         <option value="boolean">boolean</option>
                         <option value="date">date</option>
                         <option value="reference">reference</option>
                      </select>
                      {selectedField.isCustom ? (
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs px-2.5 py-0.5 rounded cursor-pointer" onClick={() => updateFieldGeneralMutation.mutate({ id: selectedField._id, isCustom: false })}>Custom (Click to Standardize)</span>
                      ) : (
                        <span className="bg-slate-50 border border-slate-300 text-slate-600 font-bold text-xs px-2.5 py-0.5 rounded cursor-pointer" onClick={() => updateFieldGeneralMutation.mutate({ id: selectedField._id, isCustom: true })}>Standard (Click to Customize)</span>
                      )}
                    </div>
                    <p className="text-slate-500 mt-3 text-sm flex items-center gap-2">
                       <Database size={14} className="text-slate-400"/>
                       Mapped rigidly to <span className="font-semibold text-slate-700 capitalize">{collectionDetail?.displayName}</span>
                    </p>
                  </div>
                  <button onClick={() => setDeleteConfirm({ id: selectedField._id, type: 'field', name: selectedField.name })} className="p-2 text-red-400 border border-red-100 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">
                     <Trash2 size={18} />
                  </button>
               </div>

               <div className="grid grid-cols-2 gap-6 pt-4">
                  {/* AI Description Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                     <div className="bg-gradient-to-r from-indigo-50 to-white px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Sparkles size={16} className="text-indigo-500" /> AI Generator Stub
                        </h3>
                        <button onClick={() => generateAIMutation.mutate(selectedField._id)} disabled={generateAIMutation.isPending} className="text-[10px] font-bold uppercase disabled:opacity-50 text-indigo-700 bg-indigo-100 px-3 py-1.5 rounded-full hover:bg-indigo-200 flex items-center gap-1">
                          <RefreshCw size={12} className={generateAIMutation.isPending ? "animate-spin" : ""} /> {generateAIMutation.isPending ? 'Generating...' : 'Regenerate'}
                        </button>
                     </div>
                     <div className="p-5 flex-1 flex flex-col justify-center">
                        {selectedField.aiDescription ? (
                           <div className="space-y-4">
                             <p className="text-sm text-slate-600 leading-relaxed font-medium">"{selectedField.aiDescription}"</p>
                             {selectedField.isCustom && (
                               <button 
                                 onClick={() => setEditDesc(selectedField.aiDescription)}
                                 className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                               >
                                 <Plus size={14} /> Use as Override
                               </button>
                             )}
                           </div>
                        ) : (
                           <div className="text-center text-slate-400 italic text-sm">No documentation deterministic tree rendered.</div>
                        )}
                     </div>
                  </div>

                  {/* Profile Card / Tag Manager */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                     <div className="bg-[#F8FAFC] px-5 py-4 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Activity size={16} className="text-emerald-500" /> Profiling & Taxonomy
                        </h3>
                     </div>
                     <div className="p-5 flex-1 space-y-5">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Database size={12}/> Example Values (Sampled)</p>
                          <div className="flex flex-wrap gap-2">
                             {['(hidden)', '(derived)', '(random)'].map((v, i) => (
                               <span key={i} className="bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-mono font-semibold px-2 py-0.5 rounded">{selectedField.name}_{i} {v}</span>
                             ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><TagIcon size={12}/> Semantic Tags</p>
                          <div className="flex flex-wrap gap-2 mb-2 border border-slate-100 bg-slate-50 p-2 rounded-lg min-h-[44px]">
                             {selectedField.tags?.length ? selectedField.tags.map((t: string) => (
                                <span key={t} className="bg-white border border-slate-200 shadow-sm text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                  {t} <X size={10} className="hover:text-red-500 cursor-pointer text-slate-400" onClick={() => handleRemoveTag(t)}/>
                                </span>
                             )) : <span className="text-[11px] text-slate-400 italic my-auto">No semantic groupings...</span>}
                          </div>
                          <input 
                            type="text" 
                            value={tagInput} 
                            onChange={e => setTagInput(e.target.value)} 
                            onKeyDown={handleAddTag} 
                            placeholder="Type tag and press Enter" 
                            className="w-full text-xs p-2 border border-slate-200 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                     </div>
                  </div>

                  {selectedField.isCustom && (
                    <div className="col-span-2 bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden flex flex-col relative focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                       <div className="bg-indigo-50/50 px-5 py-4 border-b border-indigo-100/50 flex justify-between items-center">
                          <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                            <Edit3 size={16} className="text-indigo-600" /> Manual Override Constraint
                          </h3>
                       </div>
                       <div className="p-5 relative flex flex-col gap-3">
                          <textarea 
                             value={editDesc}
                             onChange={(e) => setEditDesc(e.target.value)}
                             placeholder="Admin explicitly overriding AI generation fallback globally..."
                             className="w-full bg-slate-50 border border-slate-200 rounded p-4 text-sm min-h-[100px] resize-none focus:outline-none focus:bg-white transition-colors"
                          />
                          <button onClick={() => {
                              updateFieldMutation.mutate({ id: selectedField._id, manualDescription: editDesc });
                              const btn = document.getElementById('save-override-btn');
                              if (btn) {
                                btn.innerText = 'Saved!';
                                setTimeout(() => btn.innerText = 'Save Explicit Override', 2000);
                              }
                            }} 
                            id="save-override-btn"
                            disabled={updateFieldMutation.isPending} 
                            className="self-end bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase px-6 py-2 rounded-lg disabled:opacity-50 transition-all">
                             Save Explicit Override
                          </button>
                       </div>
                    </div>
                  )}
               </div>
            </div>
         )}
      </div>

      {showCollModal && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl w-96 shadow-xl animate-in fade-in zoom-in-95 duration-200">
             <h2 className="text-lg font-bold mb-4">{isEditingColl ? 'Edit Collection Segment' : 'Create Collection Segment'}</h2>
             <div className="space-y-3">
               <input placeholder="DB Name (e.g. employees)" disabled={isEditingColl} value={collForm.name} onChange={e => setCollForm({...collForm, name: e.target.value})} className="w-full border border-slate-200 p-2 rounded text-sm disabled:bg-slate-50 disabled:text-slate-400"/>
               <input placeholder="Display Name (e.g. Employees)" value={collForm.displayName} onChange={e => setCollForm({...collForm, displayName: e.target.value})} className="w-full border border-slate-200 p-2 rounded text-sm"/>
               <input placeholder="Module (e.g. Core)" value={collForm.module} onChange={e => setCollForm({...collForm, module: e.target.value})} className="w-full border border-slate-200 p-2 rounded text-sm"/>
               <textarea placeholder="Description" value={collForm.description} onChange={e => setCollForm({...collForm, description: e.target.value})} className="w-full border border-slate-200 p-2 rounded text-sm h-20 resize-none"/>
             </div>
             <div className="flex justify-end gap-2 mt-6">
               <button onClick={() => setShowCollModal(false)} className="px-4 py-2 text-sm text-slate-500 font-medium">Cancel</button>
               <button onClick={() => isEditingColl ? updateCollMutation.mutate({ id: collectionDetail._id, payload: collForm }) : createCollMutation.mutate(collForm)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg shadow-sm">
                 {isEditingColl ? 'Save Changes' : 'Save Registry'}
               </button>
             </div>
          </div>
        </div>
      )}

      {showFieldModal && collectionDetail && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl w-96 shadow-xl animate-in fade-in zoom-in-95 duration-200">
             <h2 className="text-lg font-bold mb-4 text-slate-800">Map Custom Parameter</h2>
             <p className="text-xs text-slate-500 mb-4">Target: <span className="font-bold">{collectionDetail.displayName}</span></p>
             <div className="space-y-3">
               <input placeholder="Field Code (e.g. internal_id)" value={fieldForm.name} onChange={e => setFieldForm({...fieldForm, name: e.target.value})} className="w-full border border-slate-200 p-2 rounded font-mono text-sm"/>
               <select value={fieldForm.type} onChange={e => setFieldForm({...fieldForm, type: e.target.value})} className="w-full border border-slate-200 p-2 rounded text-sm">
                 <option value="string">String</option>
                 <option value="number">Number</option>
                 <option value="boolean">Boolean</option>
                 <option value="date">Date</option>
                 <option value="reference">Reference Pointer</option>
               </select>
             </div>
             <div className="flex justify-end gap-2 mt-6">
               <button onClick={() => setShowFieldModal(false)} className="px-4 py-2 text-sm text-slate-500 font-medium hover:bg-slate-50 rounded">Cancel</button>
               <button onClick={() => createFieldMutation.mutate({ ...fieldForm, collectionId: collectionDetail._id })} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm border border-indigo-700">Deploy Constraint</button>
             </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl w-96 shadow-xl animate-in fade-in zoom-in-95 duration-200">
             <h2 className="text-lg font-bold mb-2 text-slate-900">Confirm Deletion</h2>
             <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to delete the {deleteConfirm.type} <span className="font-bold text-slate-800">{deleteConfirm.name}</span>? This action is irreversible.
             </p>
             <div className="flex justify-end gap-2">
               <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-slate-500 font-medium hover:bg-slate-50 rounded">Cancel</button>
               <button onClick={() => {
                 if (deleteConfirm.type === 'collection') deleteCollMutation.mutate(deleteConfirm.id);
                 else deleteFieldMutation.mutate(deleteConfirm.id);
                 setDeleteConfirm(null);
               }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-sm border border-red-700">Yes, Delete</button>
             </div>
          </div>
        </div>
      )}

      <FormulaGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  )
}
