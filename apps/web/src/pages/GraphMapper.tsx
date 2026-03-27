import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactFlow, { Background, Controls, Node, Edge, MarkerType } from 'react-flow-renderer';
import { Trash2, Zap } from 'lucide-react';

export default function GraphMapper() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const queryClient = useQueryClient();

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['relationships'],
    queryFn: () => fetch('/api/v1/relationships', { headers }).then(res => res.json())
  });

  const autoDetect = useMutation({
    mutationFn: () => fetch('/api/v1/relationships/auto-detect', { method: 'POST', headers }).then(res => res.json()),
    onSuccess: (data) => {
      alert(`Auto-detected ${data.data?.detectedEdges} new edges.`);
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    }
  });

  const deleteEdge = useMutation({
    mutationFn: (id: string) => fetch(`/api/v1/relationships/${id}`, { method: 'DELETE', headers }),
    onSuccess: () => {
      setSelectedEdge(null);
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    }
  });

  const { collections = [], relationships = [] } = data?.data || {};

  const nodes: Node[] = useMemo(() => {
    return collections.map((coll: any, index: number) => ({
      id: coll.name,
      position: { x: (index % 3) * 280 + 100, y: Math.floor(index / 3) * 180 + 100 },
      data: { 
        label: (
          <div className="p-3 bg-white w-48 border border-indigo-200 rounded-lg shadow-sm">
            <h3 className="font-bold text-gray-800 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{coll.displayName}</h3>
            <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block mt-1">{coll.module}</p>
          </div>
        )
      },
      style: {
        background: 'transparent',
        border: 'none',
        opacity: selectedNode && selectedNode !== coll.name ? 0.4 : 1
      }
    }));
  }, [collections, selectedNode]);

  const edges: Edge[] = useMemo(() => {
    return relationships.map((rel: any) => ({
      id: rel._id,
      source: rel.sourceCollection,
      target: rel.targetCollection,
      label: `${rel.sourceField} → ${rel.targetField}`,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      style: {
        stroke: selectedEdge === rel._id ? '#4f46e5' : '#a5b4fc',
        strokeWidth: selectedEdge === rel._id ? 3 : 1.5,
        opacity: (selectedNode && selectedNode !== rel.sourceCollection && selectedNode !== rel.targetCollection) ? 0.2 : 1
      },
      animated: rel.isAutoDetected,
      data: rel
    }));
  }, [relationships, selectedEdge, selectedNode]);

  return (
    <div className="flex h-[calc(100vh-73px)] overflow-hidden">
      <div className="flex-1 relative bg-white border-r border-gray-200">
        <ReactFlow 
          nodes={nodes} 
          edges={edges}
          onNodeClick={(_, node) => { setSelectedNode(node.id); setSelectedEdge(null); }}
          onEdgeClick={(_, edge) => { setSelectedEdge(edge.id); setSelectedNode(null); }}
          onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
          fitView
        >
          <Background color="#f3f4f6" gap={16} />
          <Controls />
        </ReactFlow>

        <div className="absolute top-4 left-4 z-10">
           <button onClick={() => autoDetect.mutate()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium transition-colors">
             <Zap size={16} /> Auto-Detect Edges
           </button>
        </div>
      </div>
      
      <div className="w-80 bg-gray-50 p-6 flex flex-col gap-6 overflow-y-auto">
         <h2 className="text-xl font-bold text-gray-800">Inspector</h2>
         
         {selectedEdge && (
           <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
             <h3 className="font-semibold text-gray-800 border-b border-gray-100 pb-3 mb-3">Edge Details</h3>
             {edges.find(e => e.id === selectedEdge)?.data && (() => {
               const rel = edges.find(e => e.id === selectedEdge)!.data;
               return (
                 <div className="space-y-3 text-sm">
                   <div className="flex justify-between">
                     <span className="text-gray-500 font-medium">Type:</span> 
                     <span className="font-semibold bg-gray-100 px-2 py-0.5 rounded">{rel.relationshipType}</span>
                   </div>
                   <div>
                     <span className="text-gray-500 font-medium block mb-1">Source:</span> 
                     <span className="bg-indigo-50 text-indigo-700 font-mono px-2 py-1 rounded block">{rel.sourceCollection}.{rel.sourceField}</span>
                   </div>
                   <div>
                     <span className="text-gray-500 font-medium block mb-1">Target:</span> 
                     <span className="bg-emerald-50 text-emerald-700 font-mono px-2 py-1 rounded block">{rel.targetCollection}.{rel.targetField}</span>
                   </div>
                   <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                     <span className="text-gray-500 font-medium">Method:</span> 
                     <span className={`${rel.isAutoDetected ? 'text-amber-600 bg-amber-50' : 'text-indigo-600 bg-indigo-50'} font-medium px-2 py-0.5 rounded text-xs uppercase tracking-wider`}>
                       {rel.isAutoDetected ? 'Auto' : 'Manual'}
                     </span>
                   </div>
                   <div className="pt-4 mt-4">
                     <button onClick={() => deleteEdge.mutate(rel._id)} className="w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 hover:border-red-300 py-2 rounded-lg transition-colors border border-red-100 shadow-sm font-medium text-sm">
                       <Trash2 size={16} /> Remove Edge 
                     </button>
                   </div>
                 </div>
               )
             })()}
           </div>
         )}
         
         {!selectedEdge && !selectedNode && (
           <p className="text-sm text-gray-500 text-center mt-10">Select a node or edge to inspect properties.</p>
         )}

         {selectedNode && (
           <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
             <h3 className="font-semibold text-gray-800 border-b border-gray-100 pb-3 mb-3">Node Details</h3>
             <p className="text-sm text-gray-600 mb-2">Collection: <span className="font-semibold px-2 py-1 bg-gray-100 rounded text-gray-900">{selectedNode}</span></p>
             <p className="text-xs text-gray-400 mt-4 leading-relaxed">Displaying universally permitted edges associated sequentially with this collection dynamically mapped securely through the backend RBAC payload.</p>
           </div>
         )}
      </div>
    </div>
  );
}
