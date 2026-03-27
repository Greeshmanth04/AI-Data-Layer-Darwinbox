import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard';
import GraphMapper from './pages/GraphMapper';

const queryClient = new QueryClient();

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'graph'>('dashboard');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex gap-4 items-center shadow-sm z-10 relative">
          <div className="font-bold text-xl text-indigo-900 mr-8">Darwinbox<span className="text-gray-400 font-light ml-1">AI</span></div>
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
          >Dashboard</button>
          <button 
            onClick={() => setActiveTab('graph')} 
            className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'graph' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
          >Relationship Mapper</button>
        </header>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'graph' && <GraphMapper />}
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;
