import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import GraphMapper from './pages/GraphMapper';
import Metrics from './pages/Metrics';
import AccessControl from './pages/AccessControl';
import ComingSoon from './pages/ComingSoon';
import { AuthProvider, useAuth } from './context/AuthContext';

const queryClient = new QueryClient();

const AuthenticatedApp = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
       <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isSidebarOpen={isSidebarOpen} />
       <div className="flex-1 flex flex-col h-full overflow-hidden">
         <Topbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
         <main className="flex-1 overflow-hidden bg-white">
           {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
           {activeTab === 'catalog' && <Catalog onNavigate={setActiveTab} />}
           {activeTab === 'relationships' && <GraphMapper onNavigate={setActiveTab} />}
           {activeTab === 'metrics' && <Metrics />}
           {activeTab === 'access' && <AccessControl />}
           {activeTab === 'chat' && <ComingSoon title="Analytics Chat" />}
         </main>
       </div>
    </div>
  );
};

import Register from './pages/Register';

const RouterConfig = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  
  if (isLoading) {
     return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold text-indigo-500 animate-pulse tracking-widest text-sm uppercase">Securely Loading Enterprise Identity Matrix...</div>;
  }
  
  if (!isAuthenticated) {
     if (authView === 'register') return <Register onNavigateLogin={() => setAuthView('login')} />;
     return <Login onNavigateRegister={() => setAuthView('register')} />;
  }
  
  return <AuthenticatedApp />;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterConfig />
      </AuthProvider>
    </QueryClientProvider>
  );
}
