import React from 'react';

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Darwinbox AI Data Layer</h1>
        <p className="text-lg text-gray-600">Phase 0 initialized successfully.</p>
        <div className="mt-8 flex gap-4 justify-center">
          <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg shadow-sm border border-blue-200">Frontend: React + Vite + Tailwind</div>
          <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg shadow-sm border border-green-200">Backend: Node + Express</div>
        </div>
      </div>
    </div>
  );
}

export default App;
