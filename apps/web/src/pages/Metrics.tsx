import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Plus, Pencil, Trash2, X, CheckCircle, AlertTriangle, Clock, FlaskConical, Search, Calculator, FileText, BookOpen } from 'lucide-react';
import { FormulaGuide } from '../components/FormulaGuide';
import { FormulaAutocomplete } from '../components/FormulaAutocomplete';

export default function Metrics() {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const queryClient = useQueryClient();

  // Selected State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Sandbox state
  const [formulaTest, setFormulaTest] = useState('SUM(employees.salary)');
  const [sandboxResult, setSandboxResult] = useState<number | null>(null);
  const [sandboxError, setSandboxError] = useState('');

  // CRUD form state
  const [showForm, setShowForm] = useState(false);
  const [editingMetric, setEditingMetric] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', formula: '', baseCollection: '', description: '', category: '' });

  // Confirm delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Per-metric preview/validate results
  const [metricResults, setMetricResults] = useState<Record<string, { result?: number; error?: string; validating?: boolean; previewing?: boolean }>>({});

  // Fetch metrics
  const { data } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => fetch('/api/v1/metrics', { headers }).then(res => res.json())
  });

  // Fetch collections for baseCollection dropdown
  const { data: catalogData } = useQuery({
    queryKey: ['catalog-collections'],
    queryFn: () => fetch('/api/v1/catalog/collections', { headers }).then(res => res.json())
  });

  const collectionsObj = catalogData?.data || {};
  const collections = Array.isArray(collectionsObj) 
    ? collectionsObj 
    : Object.values(collectionsObj).flat();
  
  const metricsData: any[] = data?.data || [];

  const filteredMetrics = metricsData.filter((m: any) => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.formula.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group metrics by category
  const grouped = filteredMetrics.reduce((acc: Record<string, any[]>, m: any) => {
    const cat = m.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  const selectedMetric = metricsData.find(m => m._id === selectedMetricId);

  // Sandbox preview
  const sandboxPreview = useMutation({
    mutationFn: () => fetch('/api/v1/metrics/preview', {
      method: 'POST', headers, body: JSON.stringify({ formula: formulaTest })
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Preview failed');
      return data;
    }),
    onSuccess: (data) => { setSandboxResult(data.data.result); setSandboxError(''); },
    onError: (err: any) => { setSandboxResult(null); setSandboxError(err.message); }
  });

  // CRUD mutations
  const createMetric = useMutation({
    mutationFn: (data: any) => fetch('/api/v1/metrics', { method: 'POST', headers, body: JSON.stringify(data) }).then(async res => {
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Create failed');
      return json;
    }),
    onSuccess: (data) => { 
      setShowForm(false); 
      queryClient.invalidateQueries({ queryKey: ['metrics'] }); 
      if (data?.data?._id) setSelectedMetricId(data.data._id);
    }
  });

  const updateMetric = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => fetch(`/api/v1/metrics/${id}`, { method: 'PUT', headers, body: JSON.stringify(payload) }).then(async res => {
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Update failed');
      return json;
    }),
    onSuccess: () => { setShowForm(false); setEditingMetric(null); queryClient.invalidateQueries({ queryKey: ['metrics'] }); }
  });

  const deleteMetric = useMutation({
    mutationFn: (id: string) => fetch(`/api/v1/metrics/${id}`, { method: 'DELETE', headers }).then(async res => {
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Delete failed');
      return json;
    }),
    onSuccess: () => { 
      if (confirmDeleteId === selectedMetricId) setSelectedMetricId(null);
      setConfirmDeleteId(null); 
      queryClient.invalidateQueries({ queryKey: ['metrics'] }); 
    }
  });

  // Per-metric preview
  const handlePreview = async (id: string) => {
    setMetricResults(s => ({ ...s, [id]: { ...s[id], previewing: true, error: undefined } }));
    try {
      const res = await fetch(`/api/v1/metrics/${id}/preview`, { method: 'POST', headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Preview failed');
      setMetricResults(s => ({ ...s, [id]: { result: json.data.result, previewing: false } }));
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    } catch (err: any) {
      setMetricResults(s => ({ ...s, [id]: { error: err.message, previewing: false } }));
    }
  };

  // Per-metric validate
  const handleValidate = async (id: string) => {
    setMetricResults(s => ({ ...s, [id]: { ...s[id], validating: true, error: undefined } }));
    try {
      const res = await fetch(`/api/v1/metrics/${id}/validate`, { method: 'POST', headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Validation failed');
      setMetricResults(s => ({ ...s, [id]: { ...s[id], validating: false, result: undefined, error: undefined } }));
      alert('✅ Formula syntax is valid!');
    } catch (err: any) {
      setMetricResults(s => ({ ...s, [id]: { error: err.message, validating: false } }));
    }
  };

  const openCreateForm = () => {
    setEditingMetric(null);
    setFormData({ name: '', formula: '', baseCollection: '', description: '', category: '' });
    setShowForm(true);
  };

  const openEditForm = (metric: any) => {
    setEditingMetric(metric);
    setFormData({
      name: metric.name,
      formula: metric.formula,
      baseCollection: metric.baseCollection,
      description: metric.description || '',
      category: metric.category || ''
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (editingMetric) {
      updateMetric.mutate({ id: editingMetric._id, payload: formData });
    } else {
      createMetric.mutate(formData);
    }
  };

  const isMutating = createMetric.isPending || updateMetric.isPending;
  const mutationError = createMetric.error?.message || updateMetric.error?.message || '';

  const activeResult = selectedMetric ? metricResults[selectedMetric._id] : null;

  return (
    <div className="flex h-full overflow-hidden bg-slate-50/50">
      {/* Sidebar: Metrics Library */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
            <Calculator size={16} className="text-indigo-500" /> Metrics Library
          </h2>
          <button onClick={openCreateForm} className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-1.5 rounded-md border border-slate-200 transition-colors" title="Create Metric">
            <Plus size={16} />
          </button>
        </div>
        
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search formulas..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredMetrics.length === 0 ? (
            <div className="py-12 text-center px-4">
              <p className="text-slate-400 text-[13px]">No metrics found.</p>
            </div>
          ) : (
             Object.entries(grouped).map(([category, metrics]) => (
              <div key={category}>
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                  {category}
                </div>
                <div>
                  {(metrics as any[]).map((m: any) => {
                    const isSelected = selectedMetricId === m._id;
                    return (
                      <button
                        key={m._id}
                        onClick={() => setSelectedMetricId(m._id)}
                        className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors flex items-center justify-between ${isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : 'hover:bg-slate-50 border-l-2 border-l-transparent'}`}
                      >
                        <div className="min-w-0 pr-2">
                          <h3 className={`font-bold text-[13px] truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>{m.name}</h3>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">{m.formula}</p>
                        </div>
                        {m.lastComputedValue !== undefined && m.lastComputedValue !== null && (
                          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                            {m.lastComputedValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-10 relative">
        {!selectedMetric ? (
          <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-slate-100/50 p-4 rounded-full mb-4">
              <Calculator size={32} className="text-slate-300" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">No Metric Selected</h2>
            <p className="text-sm text-slate-500 max-w-sm">Select a metric from the library on the left to view its formula, modify definitions, or test the calculation engine.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* Header portion */}
            <div className="flex justify-between items-start pb-6 border-b border-slate-200">
               <div>
                  <div className="flex items-center gap-3 mb-2">
                     <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{selectedMetric.name}</h1>
                     <span className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-slate-200">{selectedMetric.category || 'Uncategorized'}</span>
                  </div>
                  {selectedMetric.description ? (
                     <p className="text-sm text-slate-500">{selectedMetric.description}</p>
                  ) : (
                     <p className="text-sm text-slate-400 italic">No description provided.</p>
                  )}
               </div>
               <div className="flex items-center gap-2">
                  <button onClick={() => openEditForm(selectedMetric)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
                    <Pencil size={12} /> Edit Metric
                  </button>
                  <button onClick={() => setConfirmDeleteId(selectedMetric._id)} className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
                    <Trash2 size={12} /> Delete
                  </button>
               </div>
            </div>

            {/* Formula Viewer & Actions */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-5 flex items-start gap-4">
                  <div className="flex-1">
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><FileText size={12} /> Execution Formula</p>
                     <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg font-mono text-sm text-indigo-700 w-full mb-4">
                        {selectedMetric.formula}
                     </div>
                     
                     <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePreview(selectedMetric._id)}
                          disabled={activeResult?.previewing}
                          className="bg-indigo-600 text-white shadow-sm px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
                        >
                          <Play size={12} fill="white" /> {activeResult?.previewing ? 'Computing...' : 'Run Live Preview'}
                        </button>
                        <button
                          onClick={() => handleValidate(selectedMetric._id)}
                          disabled={activeResult?.validating}
                          className="bg-white text-slate-700 border border-slate-200 shadow-sm px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center gap-2 disabled:opacity-50"
                        >
                          <CheckCircle size={12} /> {activeResult?.validating ? 'Validating...' : 'Validate Syntax'}
                        </button>
                     </div>
                  </div>
                  
                  {/* Results Pillar */}
                  <div className="w-64 shrink-0 bg-slate-50 rounded-xl border border-slate-100 p-4 flex flex-col items-center justify-center text-center min-h-[140px]">
                     {activeResult?.error ? (
                        <div className="text-red-600 flex flex-col items-center">
                           <AlertTriangle size={24} className="mb-2 opacity-80" />
                           <span className="text-xs font-bold">Execution Failed</span>
                           <span className="text-[11px] font-medium mt-1 leading-tight">{activeResult.error}</span>
                        </div>
                     ) : activeResult?.result !== undefined ? (
                        <div className="text-emerald-700 flex flex-col items-center">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/70 mb-1">Live Result</span>
                           <span className="text-3xl font-black">{activeResult.result.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                     ) : selectedMetric.lastComputedValue !== undefined && selectedMetric.lastComputedValue !== null ? (
                        <div className="text-slate-700 flex flex-col items-center">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Cached Result</span>
                           <span className="text-3xl font-black">{selectedMetric.lastComputedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                           {selectedMetric.lastComputedAt && <span className="text-[9px] text-slate-400 mt-2 font-medium"><Clock size={10} className="inline mr-1" />{new Date(selectedMetric.lastComputedAt).toLocaleString()}</span>}
                        </div>
                     ) : (
                        <div className="text-slate-400 flex flex-col items-center">
                           <Calculator size={24} className="mb-2 opacity-50" />
                           <span className="text-xs font-medium">Click "Run Live Preview" to evaluate.</span>
                        </div>
                     )}
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
               {/* Sandbox Test Box */}
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><FlaskConical size={14} className="text-indigo-500" /> Formula Sandbox</h3>
                     <button onClick={() => setIsGuideOpen(true)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
                        <BookOpen size={12} /> Syntax Help
                     </button>
                  </div>
                  <div className="space-y-4">
                     <FormulaAutocomplete
                        value={formulaTest}
                        onChange={(val) => setFormulaTest(val)}
                        placeholder="SUM(employees.salary) * 1.5"
                        rows={3}
                        className="w-full text-xs font-mono p-3 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500/50 outline-none resize-none"
                     />
                     <div className="flex justify-between items-center">
                        <div>
                           {sandboxResult !== null && <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs border border-emerald-100">{sandboxResult.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
                           {sandboxError && <span className="font-medium text-[11px] text-red-500 block break-all">{sandboxError}</span>}
                        </div>
                        <button
                           onClick={() => sandboxPreview.mutate()}
                           disabled={sandboxPreview.isPending || !formulaTest.trim()}
                           className="bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md text-xs font-bold text-slate-700 transition flex items-center gap-1.5 shrink-0"
                        >
                           <Play size={10} /> Test
                        </button>
                     </div>
                  </div>
               </div>

               {/* History Panel */}
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 overflow-hidden flex flex-col">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4"><Clock size={14} className="text-indigo-500" /> Computation History</h3>
                  <div className="flex-1 overflow-y-auto -mx-2">
                     {selectedMetric.previews && selectedMetric.previews.length > 0 ? (
                        <table className="w-full text-left text-xs">
                           <thead className="text-[10px] text-slate-400 uppercase tracking-widest sticky top-0 bg-white">
                              <tr>
                                 <th className="font-semibold p-2 pb-3">Time</th>
                                 <th className="font-semibold p-2 pb-3 text-right">Value</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {selectedMetric.previews.map((p: any, idx: number) => (
                                 <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-2 text-slate-500 font-medium">{new Date(p.evaluatedAt).toLocaleString()}</td>
                                    <td className="p-2 text-right font-bold text-slate-800">{p.result.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     ) : (
                        <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic">No historical runs recorded.</div>
                     )}
                  </div>
               </div>
            </div>

          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-7 rounded-2xl w-[480px] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900">{editingMetric ? 'Edit Metric' : 'Create New Metric'}</h2>
              <button onClick={() => { setShowForm(false); setEditingMetric(null); }} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-md transition"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Total Headcount"
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What does this metric measure?"
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. Workforce"
                    className="w-full border border-slate-200 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Base Collection</label>
                  <select
                    value={formData.baseCollection}
                    onChange={(e) => setFormData({ ...formData, baseCollection: e.target.value })}
                    className="w-full border border-slate-200 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  >
                    <option value="" disabled>Select collection</option>
                    {collections.map((c: any) => <option key={c._id} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                   <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Formula Directive</label>
                   <button onClick={() => setIsGuideOpen(true)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
                      <BookOpen size={10} /> Syntax Guide
                   </button>
                </div>
                <FormulaAutocomplete
                  value={formData.formula}
                  onChange={(val) => setFormData({ ...formData, formula: val })}
                  placeholder='e.g. COUNT(employees WHERE status = "Active")'
                  rows={3}
                  className="w-full border border-slate-200 p-3 rounded-lg text-[13px] font-mono text-indigo-700 bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                />
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  Supports: COUNT, SUM, AVG, MIN, MAX (+ cross-collection WHEREs).
                </p>
              </div>
            </div>

            {mutationError && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {mutationError}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-8">
              <button onClick={() => { setShowForm(false); setEditingMetric(null); }} className="px-5 py-2 text-sm text-slate-500 font-bold hover:bg-slate-50 rounded-lg transition">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={isMutating || !formData.name || !formData.formula || !formData.baseCollection}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg shadow-sm border border-indigo-700 hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {isMutating ? 'Saving...' : editingMetric ? 'Save Changes' : 'Create Metric'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl w-96 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold mb-2 text-slate-900 flex items-center gap-2"><AlertTriangle size={18} className="text-red-500"/> Confirm Deletion</h2>
            <p className="text-sm text-slate-500 mb-6 font-medium leading-relaxed">
              Are you sure you want to permanently delete this metric? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} disabled={deleteMetric.isPending} className="px-4 py-2 text-sm text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => deleteMetric.mutate(confirmDeleteId)} disabled={deleteMetric.isPending} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow border border-red-700 disabled:opacity-50">
                {deleteMetric.isPending ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FormulaGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
