import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactFlow, { Background, Controls, Node, Edge, MarkerType, Handle, Position, applyNodeChanges, NodeChange, Connection } from 'react-flow-renderer';
import { Database, Zap, Plus, Trash2, X, RefreshCw, Undo, Redo, ShieldAlert } from 'lucide-react';

const EntityNode = ({ data, selected }: any) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border ${selected ? 'border-indigo-500 ring-2 ring-indigo-50' : 'border-gray-200'} w-[220px] transition-all`}>
      <Handle type="target" position={Position.Left} style={{ background: '#c7d2fe', width: 8, height: 8, border: 'none', left: -4 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#818cf8', width: 8, height: 8, border: 'none', right: -4 }} />
      
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 text-[15px]">{data.label}</h3>
        <Database size={16} className="text-gray-400" />
      </div>
      
      <div className="bg-gray-50/80 p-3 rounded-b-xl flex justify-between items-center text-[11px] font-mono text-gray-500 uppercase tracking-wider font-semibold">
        <span>{data.fieldCount || 0} fields</span>
        <span>{data.rowCount || 0} rows</span>
      </div>
    </div>
  );
};

const nodeTypes = { entity: EntityNode };

export default function GraphMapper() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const queryClient = useQueryClient();

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [edgeForm, setEdgeForm] = useState({ sourceCollection: '', targetCollection: '', sourceField: '', targetField: '', relationshipType: '1:N' });

  const [isLocked, setIsLocked] = useState(false);
  const [preDragPositions, setPreDragPositions] = useState<any>({});

  const { data } = useQuery({
    queryKey: ['relationships'],
    queryFn: () => fetch('/api/v1/relationships', { headers }).then(res => res.json())
  });

  const autoDetect = useMutation({
    mutationFn: () => fetch('/api/v1/relationships/auto-detect', { method: 'POST', headers }).then(res => res.json()),
    onSuccess: (data) => {
      const added = data.data.detectedEdges || [];
      if (added.length > 0) {
        setHistory(h => ({ past: [...h.past, { type: 'ADD_EDGES', edges: added }], future: [] }));
      }
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    }
  });

  const [history, setHistory] = useState<{ past: any[], future: any[] }>({ past: [], future: [] });

  const deleteEdge = useMutation({
    mutationFn: (id: string) => fetch(`/api/v1/relationships/${id}`, { method: 'DELETE', headers }),
    onSuccess: (_, deletedId) => {
      const deletedRel = relationships.find((r: any) => r._id === deletedId);
      if (deletedRel) {
        setHistory(h => ({ past: [...h.past, { type: 'DELETE_EDGE', edge: deletedRel }], future: [] }));
      }
      setSelectedEdge(null);
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    }
  });

  const createEdgeMutation = useMutation({
    mutationFn: (data: any) => fetch('/api/v1/relationships', { method: 'POST', headers, body: JSON.stringify(data) }).then(res => res.json()),
    onSuccess: (data) => {
      setHistory(h => ({ past: [...h.past, { type: 'ADD_EDGE', edge: data.data }], future: [] }));
      setShowCreateForm(false);
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    }
  });

  const updateEdgeMutation = useMutation({
    mutationFn: (data: { id: string, payload: any }) => fetch(`/api/v1/relationships/${data.id}`, { method: 'PUT', headers, body: JSON.stringify(data.payload) }),
    onSuccess: () => {
      setShowEditForm(false);
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    }
  });
  
  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    setEdgeForm({
      sourceCollection: params.source,
      targetCollection: params.target,
      sourceField: '',
      targetField: '',
      relationshipType: '1:N'
    });
    setShowCreateForm(true);
  }, []);

  const { collections = [], relationships = [] } = data?.data || {};

  const sourceCollectionId = collections.find((c: any) => c.name === edgeForm.sourceCollection)?._id;
  const targetCollectionId = collections.find((c: any) => c.name === edgeForm.targetCollection)?._id;

  const { data: sourceCollData } = useQuery({
    queryKey: ['collection', sourceCollectionId],
    queryFn: () => fetch(`/api/v1/catalog/collections/${sourceCollectionId}`, { headers }).then(res => res.json()),
    enabled: !!sourceCollectionId && (showCreateForm || showEditForm)
  });

  const { data: targetCollData } = useQuery({
    queryKey: ['collection', targetCollectionId],
    queryFn: () => fetch(`/api/v1/catalog/collections/${targetCollectionId}`, { headers }).then(res => res.json()),
    enabled: !!targetCollectionId && (showCreateForm || showEditForm)
  });

  const sourceFields = sourceCollData?.data?.fields || [];
  const targetFields = targetCollData?.data?.fields || [];

  const [nodes, setNodes] = useState<Node[]>([]);
  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);

  useEffect(() => {
    if (collections.length > 0) {
      setNodes((currentNodes) => {
        const savedPositionsStr = localStorage.getItem('graphLayoutPositions');
        const savedPositions = savedPositionsStr ? JSON.parse(savedPositionsStr) : {};

        return collections.map((coll: any, index: number) => {
          const existing = currentNodes.find(n => n.id === coll.name);
          let position = { x: (index % 3) * 320 + 80, y: Math.floor(index / 3) * 200 + 80 };
          
          if (existing) {
            position = existing.position;
          } else if (savedPositions[coll.name]) {
            position = savedPositions[coll.name];
          }

          return {
            id: coll.name,
            type: 'entity',
            position,
            data: { 
              label: coll.displayName,
              fieldCount: coll.fieldCount,
              rowCount: coll.estimatedRecords
            }
          };
        });
      });
    }
  }, [collections.length]); // Intentionally binding only to collection.length to preserve XY positions

  const pushLayoutState = () => {
    const currentPos = nodes.reduce((acc: any, n) => { acc[n.id] = n.position; return acc; }, {});
    setHistory(h => ({
      past: [...h.past, { type: 'LAYOUT', pastPosition: currentPos }],
      future: []
    }));
  };

  const undoAction = async () => {
    if (history.past.length === 0) return;
    
    let targetIdx = history.past.length - 1;
    if (isLocked) {
      while (targetIdx >= 0 && history.past[targetIdx].type === 'LAYOUT') {
        targetIdx--;
      }
    }
    
    if (targetIdx < 0) return;

    const action = history.past[targetIdx];
    const newPast = [...history.past.slice(0, targetIdx), ...history.past.slice(targetIdx + 1)];

    if (action.type === 'LAYOUT') {
      const currentPos = nodes.reduce((acc: any, n) => { acc[n.id] = n.position; return acc; }, {});
      localStorage.setItem('graphLayoutPositions', JSON.stringify(action.pastPosition));
      setNodes(nds => nds.map(n => ({ ...n, position: action.pastPosition[n.id] || n.position })));
      setHistory(h => ({ past: newPast, future: [{ ...action, futurePosition: currentPos }, ...h.future] }));
    } else if (action.type === 'ADD_EDGE') {
      await fetch(`/api/v1/relationships/${action.edge._id}`, { method: 'DELETE', headers });
      setHistory(h => ({ past: newPast, future: [action, ...h.future] }));
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    } else if (action.type === 'DELETE_EDGE') {
      const { _id, ...payload } = action.edge;
      const res = await fetch('/api/v1/relationships', { method: 'POST', headers, body: JSON.stringify(payload) });
      const created = await res.json();
      setHistory(h => ({ past: newPast, future: [{ ...action, edge: created.data }, ...h.future] }));
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    } else if (action.type === 'ADD_EDGES') {
      await Promise.all(action.edges.map((e: any) => fetch(`/api/v1/relationships/${e._id}`, { method: 'DELETE', headers })));
      setHistory(h => ({ past: newPast, future: [action, ...h.future] }));
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    } else if (action.type === 'DELETE_EDGES') {
      const newEdges: any[] = [];
      for (const edge of action.edges) {
        const { _id, ...payload } = edge;
        const res = await fetch('/api/v1/relationships', { method: 'POST', headers, body: JSON.stringify(payload) });
        const created = await res.json();
        if (created?.data) newEdges.push(created.data);
      }
      setHistory(h => ({ past: newPast, future: [{ ...action, edges: newEdges }, ...h.future] }));
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    }
  };

  const redoAction = async () => {
    if (history.future.length === 0) return;
    
    let targetIdx = 0;
    if (isLocked) {
      while (targetIdx < history.future.length && history.future[targetIdx].type === 'LAYOUT') {
        targetIdx++;
      }
    }
    
    if (targetIdx >= history.future.length) return;

    const action = history.future[targetIdx];
    const newFuture = [...history.future.slice(0, targetIdx), ...history.future.slice(targetIdx + 1)];

    if (action.type === 'LAYOUT') {
      const currentPos = nodes.reduce((acc: any, n) => { acc[n.id] = n.position; return acc; }, {});
      localStorage.setItem('graphLayoutPositions', JSON.stringify(action.futurePosition));
      setNodes(nds => nds.map(n => ({ ...n, position: action.futurePosition[n.id] || n.position })));
      setHistory(h => ({ past: [...h.past, { ...action, pastPosition: currentPos }], future: newFuture }));
    } else if (action.type === 'ADD_EDGE') {
      const { _id, ...payload } = action.edge;
      const res = await fetch('/api/v1/relationships', { method: 'POST', headers, body: JSON.stringify(payload) });
      const created = await res.json();
      setHistory(h => ({ past: [...h.past, { ...action, edge: created.data }], future: newFuture }));
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    } else if (action.type === 'DELETE_EDGE') {
      await fetch(`/api/v1/relationships/${action.edge._id}`, { method: 'DELETE', headers });
      setHistory(h => ({ past: [...h.past, action], future: newFuture }));
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    } else if (action.type === 'ADD_EDGES') {
      const newEdges: any[] = [];
      for (const edge of action.edges) {
        const { _id, ...payload } = edge;
        const res = await fetch('/api/v1/relationships', { method: 'POST', headers, body: JSON.stringify(payload) });
        const created = await res.json();
        if (created?.data) newEdges.push(created.data);
      }
      setHistory(h => ({ past: [...h.past, { ...action, edges: newEdges }], future: newFuture }));
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    } else if (action.type === 'DELETE_EDGES') {
      await Promise.all(action.edges.map((e: any) => fetch(`/api/v1/relationships/${e._id}`, { method: 'DELETE', headers })));
      setHistory(h => ({ past: [...h.past, action], future: newFuture }));
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    }
  };

  const handleResetLayout = () => {
    pushLayoutState();
    localStorage.removeItem('graphLayoutPositions');
    setNodes(collections.map((coll: any, index: number) => {
      return {
          id: coll.name,
          type: 'entity',
          position: { x: (index % 3) * 320 + 80, y: Math.floor(index / 3) * 200 + 80 },
          data: { 
            label: coll.displayName,
            fieldCount: coll.fieldCount,
            rowCount: coll.estimatedRecords
          }
        };
    }));
  };

  const clearAllEdges = useMutation({
    mutationFn: async () => {
      const promises = relationships.map((rel: any) => fetch(`/api/v1/relationships/${rel._id}`, { method: 'DELETE', headers }));
      return Promise.all(promises);
    },
    onSuccess: () => {
      if (relationships.length > 0) {
        setHistory(h => ({ past: [...h.past, { type: 'DELETE_EDGES', edges: [...relationships] }], future: [] }));
      }
      setSelectedEdge(null);
      setShowConfirmDeleteAll(false);
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    }
  });

  const finalEdges: Edge[] = useMemo(() => {
    return relationships.map((rel: any) => ({
      id: rel._id,
      source: rel.sourceCollection,
      target: rel.targetCollection,
      label: rel.relationshipType,
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 12,
      labelBgStyle: { fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 },
      labelStyle: { fill: '#475569', fontWeight: 600, fontSize: 10, fontFamily: 'monospace' },
      markerEnd: { type: MarkerType.ArrowClosed, color: selectedEdge === rel._id ? '#4f46e5' : '#cbd5e1' },
      style: {
        stroke: selectedEdge === rel._id ? '#4f46e5' : '#cbd5e1',
        strokeWidth: selectedEdge === rel._id ? 2.5 : 1.5,
        opacity: (selectedNode && selectedNode !== rel.sourceCollection && selectedNode !== rel.targetCollection) ? 0.2 : 1,
        transition: 'all 0.2s'
      },
      animated: rel.isAutoDetected,
      data: rel
    }));
  }, [relationships, selectedEdge, selectedNode]);

  return (
    <div className="flex flex-col h-[calc(100vh-73px)] w-full overflow-hidden bg-slate-50/30">
      
      {/* Header */}
      <div className="bg-white px-8 py-5 flex justify-between items-center border-b border-gray-200 z-10 shrink-0">
         <div>
           <h1 className="text-[19px] font-bold text-gray-900">Entity Graph</h1>
           <p className="text-sm text-gray-500 mt-1">Map and manage relationships across your entire HR data schema.</p>
         </div>
          <div className="flex gap-2">
           <button disabled={history.past.length === 0} onClick={undoAction} className="bg-white text-gray-600 px-3.5 py-2 border border-gray-200 rounded-lg shadow-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 transition-colors" title="Undo Last Action">
             <Undo size={15} />
           </button>
           <button disabled={history.future.length === 0} onClick={redoAction} className="bg-white text-gray-600 px-3.5 py-2 border border-gray-200 rounded-lg shadow-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 transition-colors mr-2 flex items-center gap-1.5" title="Redo Last Action">
             <Redo size={15} /> <span className="text-[12px] font-semibold">Redo</span>
           </button>

           <button disabled={isLocked} onClick={handleResetLayout} className="bg-white text-gray-600 px-4 py-2 border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 hover:text-gray-900 flex items-center gap-2 text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
             <RefreshCw size={14} /> Reset Layout
           </button>
           <button onClick={() => autoDetect.mutate()} disabled={autoDetect.isPending} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-indigo-700 flex items-center gap-2 text-[13px] font-semibold transition-colors disabled:opacity-50">
             <Zap size={15} /> {autoDetect.isPending ? 'Detecting...' : 'Auto-Detect'}
           </button>
           <button onClick={() => { setEdgeForm({ sourceCollection: '', targetCollection: '', sourceField: '', targetField: '', relationshipType: '1:N' }); setShowCreateForm(true); }} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2 text-[13px] font-semibold transition-colors disabled:opacity-50">
             <Plus size={16} /> Add
           </button>
           <button disabled={relationships.length === 0 || clearAllEdges.isPending} onClick={() => setShowConfirmDeleteAll(true)} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg shadow-sm hover:bg-red-100 flex items-center gap-2 text-[13px] font-semibold transition-colors disabled:opacity-50">
             <ShieldAlert size={15} /> {clearAllEdges.isPending ? 'Clearing...' : 'Clear All'}
           </button>
         </div>
      </div>

      <div className="flex-1 relative w-full h-full">
        <ReactFlow 
          nodeTypes={nodeTypes}
          nodes={nodes.map(n => ({
            ...n, style: { opacity: (selectedNode && selectedNode !== n.id && selectedEdge === null) ? 0.3 : 1, transition: 'opacity 0.2s' }
          }))} 
          edges={finalEdges}
          nodesDraggable={!isLocked}
          nodesConnectable={true}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => { setSelectedNode(node.id); setSelectedEdge(null); }}
          onEdgeClick={(_, edge) => { setSelectedEdge(edge.id); setSelectedNode(null); }}
          onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
          onNodeDragStart={() => {
             const currentPos = nodes.reduce((acc: any, n) => { acc[n.id] = n.position; return acc; }, {});
             setPreDragPositions(currentPos);
          }}
          onNodeDragStop={(_, node) => {
             setHistory(h => ({
               past: [...h.past, { type: 'LAYOUT', pastPosition: preDragPositions }],
               future: []
             }));
             
             const savedPositionsStr = localStorage.getItem('graphLayoutPositions');
             const savedPositions = savedPositionsStr ? JSON.parse(savedPositionsStr) : {};
             savedPositions[node.id] = node.position;
             localStorage.setItem('graphLayoutPositions', JSON.stringify(savedPositions));
          }}
          connectionLineStyle={{ stroke: '#818cf8', strokeWidth: 2 }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background color="#cbd5e1" gap={16} size={1.5} />
          <Controls 
            className="!mb-6 !ml-6 shadow-sm border border-gray-200 bg-white/50 backdrop-blur-sm"
            onInteractiveChange={(isInteractive) => setIsLocked(!isInteractive)}
          />
        </ReactFlow>

        {/* Sliding Edge Detail Drawer */}
        <div className={`absolute right-0 top-0 bottom-0 w-80 bg-white shadow-[0_0_40px_rgba(0,0,0,0.1)] border-l border-gray-200 z-40 transform transition-transform duration-300 ease-in-out ${selectedEdge ? 'translate-x-0' : 'translate-x-full'}`}>
          {selectedEdge && finalEdges.find((e: any) => e.id === selectedEdge)?.data && (() => {
            const rel = finalEdges.find((e: any) => e.id === selectedEdge)!.data;
            return (
              <div className="flex flex-col h-full h-full overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                   <h3 className="font-bold text-gray-800">Edge Properties</h3>
                   <button onClick={() => setSelectedEdge(null)} className="text-gray-400 hover:bg-gray-200 p-1.5 rounded-md transition-colors"><X size={16}/></button>
                </div>
                <div className="p-6 space-y-5 text-[13px] flex-1">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-gray-500 font-medium">Relationship Mode</span> 
                    <span className="font-semibold text-gray-800 bg-gray-100 px-3 py-1.5 rounded w-max inline-block shadow-sm border border-gray-200">{rel.relationshipType}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100">
                    <span className="text-gray-500 font-medium tracking-wide">Source Node</span> 
                    <span className="bg-indigo-50 text-indigo-700 font-mono px-3 py-2 rounded font-semibold border border-indigo-100">{rel.sourceCollection}.{rel.sourceField}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100">
                    <span className="text-gray-500 font-medium tracking-wide">Target Node</span> 
                    <span className="bg-emerald-50 text-emerald-700 font-mono px-3 py-2 rounded font-semibold border border-emerald-100">{rel.targetCollection}.{rel.targetField}</span>
                  </div>
                  <div className="flex justify-between items-center pt-5 border-t border-gray-100">
                    <span className="text-gray-500 font-medium">Provisioning</span> 
                    <span className={`${rel.isAutoDetected ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-indigo-700 bg-indigo-50 border border-indigo-200'} font-bold px-2.5 py-1 rounded text-[11px] uppercase tracking-wider`}>
                      {rel.isAutoDetected ? 'Auto-Detected' : 'Manual Entry'}
                    </span>
                  </div>
                </div>
                <div className="p-6 flex gap-2 border-t border-gray-100 bg-gray-50/50">
                  <button onClick={() => { setEdgeForm({ sourceCollection: rel.sourceCollection, targetCollection: rel.targetCollection, sourceField: rel.sourceField, targetField: rel.targetField, relationshipType: rel.relationshipType }); setShowEditForm(true); }} className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-700 hover:bg-gray-50 py-2.5 rounded-lg transition-colors border border-gray-200 shadow-sm font-semibold text-[13px]">
                    Edit Connection
                  </button>
                  <button onClick={() => deleteEdge.mutate(rel._id)} className="flex items-center justify-center gap-2 bg-white text-red-600 hover:bg-red-50 py-2.5 px-4 rounded-lg transition-colors border border-gray-200 shadow-sm font-semibold text-[13px]">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })()}
        </div>

      </div>

      {(showCreateForm || showEditForm) && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-7 rounded-2xl w-[420px] shadow-2xl animate-in zoom-in-95 duration-200">
             <h2 className="text-lg font-bold mb-5 text-gray-900">{showEditForm ? 'Edit Relationship Edge' : 'Create Relationship Edge'}</h2>
             
             <div className="space-y-4">
               <div className="flex gap-3">
                 <select disabled={showEditForm} value={edgeForm.sourceCollection} onChange={e => setEdgeForm({...edgeForm, sourceCollection: e.target.value, sourceField: ''})} className="w-full border border-gray-200 p-2.5 rounded-lg text-[13px] disabled:bg-gray-50 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-800">
                   <option value="" disabled>Source Collection</option>
                   {collections.map((c: any) => <option key={c._id} value={c.name}>{c.displayName}</option>)}
                 </select>
                 <select disabled={showEditForm} value={edgeForm.targetCollection} onChange={e => setEdgeForm({...edgeForm, targetCollection: e.target.value, targetField: ''})} className="w-full border border-gray-200 p-2.5 rounded-lg text-[13px] disabled:bg-gray-50 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-800">
                   <option value="" disabled>Target Collection</option>
                   {collections.map((c: any) => <option key={c._id} value={c.name}>{c.displayName}</option>)}
                 </select>
               </div>
               
               <div className="flex gap-3">
                 <select disabled={!edgeForm.sourceCollection} value={edgeForm.sourceField} onChange={e => setEdgeForm({...edgeForm, sourceField: e.target.value})} className="w-full border border-gray-200 p-2.5 rounded-lg text-[13px] font-mono focus:ring-2 disabled:bg-gray-50 bg-white text-gray-800 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                   <option value="" disabled>Source Field</option>
                   <option value="_id">_id</option>
                   {sourceFields.map((f: any) => <option key={f._id} value={f.name}>{f.name}</option>)}
                 </select>
                 <select disabled={!edgeForm.targetCollection} value={edgeForm.targetField} onChange={e => setEdgeForm({...edgeForm, targetField: e.target.value})} className="w-full border border-gray-200 p-2.5 rounded-lg text-[13px] font-mono focus:ring-2 disabled:bg-gray-50 bg-white text-gray-800 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                   <option value="" disabled>Target Field</option>
                   <option value="_id">_id</option>
                   {targetFields.map((f: any) => <option key={f._id} value={f.name}>{f.name}</option>)}
                 </select>
               </div>
               
               <select value={edgeForm.relationshipType} onChange={e => setEdgeForm({...edgeForm, relationshipType: e.target.value})} className="w-full border border-gray-200 p-2.5 rounded-lg text-[13px] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-800 bg-white">
                 <option value="1:1">1:1 (One to One)</option>
                 <option value="1:N">1:N (One to Many)</option>
                 <option value="M:N">M:N (Many to Many)</option>
               </select>
             </div>
             
             <div className="flex justify-end gap-3 mt-8">
               <button onClick={() => { setShowCreateForm(false); setShowEditForm(false); }} className="px-5 py-2.5 text-[13px] text-gray-600 font-semibold hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
               <button onClick={() => {
                 if (showEditForm && selectedEdge) {
                   updateEdgeMutation.mutate({ id: selectedEdge, payload: edgeForm });
                 } else {
                   createEdgeMutation.mutate(edgeForm);
                 }
               }} disabled={createEdgeMutation.isPending || updateEdgeMutation.isPending} className="px-6 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                 {showEditForm ? 'Save Changes' : 'Create Edge'}
               </button>
             </div>
          </div>
        </div>
      )}

      {showConfirmDeleteAll && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-7 rounded-2xl w-[420px] shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex items-center gap-3 text-red-600 mb-5">
               <ShieldAlert size={28} />
               <h2 className="text-xl font-bold">Clear All Edges</h2>
             </div>
             <p className="text-gray-600 text-[14px] leading-relaxed mb-8">
               Are you sure you want to delete <strong>all</strong> {relationships.length} relationships? This API action is permanent and cannot be undone via layout history.
             </p>
             <div className="flex justify-end gap-3">
               <button disabled={clearAllEdges.isPending} onClick={() => setShowConfirmDeleteAll(false)} className="px-5 py-2.5 text-[13px] text-gray-600 font-semibold hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
               <button disabled={clearAllEdges.isPending} onClick={() => clearAllEdges.mutate()} className="px-6 py-2.5 bg-red-600 text-white text-[13px] font-bold rounded-lg shadow hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                 {clearAllEdges.isPending ? 'Clearing...' : 'Yes, Delete All'}
               </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
