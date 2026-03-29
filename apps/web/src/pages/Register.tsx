import { useState } from 'react';
import { Database, Lock, Mail, User } from 'lucide-react';

interface RegisterProps {
  onNavigateLogin: () => void;
}

export default function Register({ onNavigateLogin }: RegisterProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Registration failed');
      setSuccess('Registration successful! Please wait for a platform admin to approve your account.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
      <div className="bg-white p-10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 w-full max-w-[420px]">
        <div className="flex justify-center mb-8">
          <div className="flex flex-col items-center">
             <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
               <Database size={28} />
             </div>
             <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Darwinbox<span className="text-slate-400 font-light ml-0.5">AI</span></h1>
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Request Access</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-center font-medium">{error}</div>}
        {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-100 text-center font-medium leading-relaxed">{success}</div>}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 text-slate-400" size={18} />
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 text-slate-400" size={18} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 text-slate-400" size={18} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" required minLength={6} />
              </div>
            </div>
            <button disabled={loading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors shadow-sm mt-2 disabled:opacity-70 disabled:cursor-not-allowed">
              {loading ? 'Submitting...' : 'Register Securely'}
            </button>
          </form>
        )}
        
        <div className="mt-8 text-center bg-slate-50 rounded-lg p-3 border border-slate-100">
           <p className="text-xs text-slate-500 font-medium tracking-wide">
             Already have an account?{' '}
             <button onClick={onNavigateLogin} type="button" className="text-indigo-600 font-bold hover:text-indigo-800 transition-colors">Sign In</button>
           </p>
        </div>
      </div>
    </div>
  );
}
