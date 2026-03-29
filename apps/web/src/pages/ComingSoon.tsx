import { MessageSquare } from 'lucide-react';

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white">
      <div className="w-20 h-20 bg-indigo-50 border border-indigo-100 text-indigo-500 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
        <MessageSquare size={36} />
      </div>
      <h2 className="text-3xl font-bold text-slate-900 mb-3">{title} is Coming Soon</h2>
      <p className="text-slate-500 max-w-md leading-relaxed text-sm">This module is currently in active development. It will provide advanced AI-driven conversational querying respecting the core mathematical and access control structures perfectly safely.</p>
      
      <button className="mt-8 bg-white border border-slate-200 shadow-sm text-slate-600 font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-slate-50 hover:text-slate-900 transition-all">
        Notify when strictly available
      </button>
    </div>
  )
}
