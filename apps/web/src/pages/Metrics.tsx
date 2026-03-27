import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Play } from 'lucide-react';

export default function Metrics() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [formulaTest, setFormulaTest] = useState("SUM(employees.salary)");
  const [previewResult, setPreviewResult] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { data } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => fetch('/api/v1/metrics', { headers }).then(res => res.json())
  });

  const previewFormulaMutation = useMutation({
    mutationFn: () => fetch('/api/v1/metrics/preview', { 
      method: 'POST', headers, body: JSON.stringify({ formula: formulaTest }) 
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Preview Failed');
      return data;
    }),
    onSuccess: (data) => {
      setPreviewResult(data.data.result);
      setErrorMsg("");
    },
    onError: (err: any) => {
      setPreviewResult(null);
      setErrorMsg(err.message);
    }
  });

  const metricsData = data?.data || [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Metric Engine</h1>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Sandbox Preview</h2>
        <p className="text-sm text-gray-500 mb-4">Draft your multi-collection metric logic securely. Try <code className="bg-gray-100 px-1 rounded font-mono text-xs">SUM(employees.salary) * 1.5</code> or <code className="bg-gray-100 px-1 rounded font-mono text-xs">COUNT(employees WHERE status='Active')</code></p>
        
        <div className="flex gap-4">
          <input 
            type="text" 
            value={formulaTest}
            onChange={(e) => setFormulaTest(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 font-mono text-indigo-700 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <button 
            onClick={() => previewFormulaMutation.mutate()}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <Play size={16}/> Calculate
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium">
            Error: {errorMsg}
          </div>
        )}

        {previewResult !== null && (
          <div className="mt-4 p-6 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col items-center justify-center">
            <span className="text-emerald-800 font-medium text-xs mb-1 uppercase tracking-wider">Secure Output Match</span>
            <span className="text-4xl font-bold text-emerald-900 border-b-2 border-emerald-200 pb-2">{previewResult.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Metric Registry</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {metricsData.map((m: any) => (
            <div key={m._id} className="p-6 hover:bg-gray-50 transition flex justify-between items-center group">
              <div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">{m.name}</h3>
                <p className="text-gray-500 text-sm mb-3 font-mono">{m.description || 'No description assigned.'}</p>
                <div className="font-mono bg-indigo-50 text-indigo-700 inline-block px-3 py-1.5 rounded-md text-sm mb-4 border border-indigo-100 shadow-sm">
                  {m.formula}
                </div>
                
                {m.previews && m.previews.length > 0 && (
                  <div className="flex gap-2 items-center text-xs text-gray-500">
                    <span className="font-semibold bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-200">Last Output: {m.previews[0].result.toLocaleString()}</span>
                    <span>on {new Date(m.previews[0].evaluatedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {metricsData.length === 0 && (
             <div className="p-10 text-center text-gray-500 font-medium">No core metrics defined natively in the underlying store.</div>
          )}
        </div>
      </div>
    </div>
  );
}
