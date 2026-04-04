import { X, BookOpen, Calculator, FunctionSquare, AlertTriangle, Lightbulb, Sparkles } from 'lucide-react';

interface FormulaGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FormulaGuide({ isOpen, onClose }: FormulaGuideProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Formula Syntax Guide</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Learn how to write dynamic metrics and calculations.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Section 1: Basic Structure */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
              <Calculator size={16} className="text-indigo-500" /> Arithmetic Operators
            </h3>
            <p className="text-[13px] text-slate-600 mb-3 leading-relaxed">
              Standard arithmetic operations are perfectly supported across your formula expressions. Use grouping via parentheses to manage standard order-of-operations logic.
            </p>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="font-mono text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm mr-2">+</span> Addition
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="font-mono text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm mr-2">-</span> Subtraction
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="font-mono text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm mr-2">*</span> Multiplication
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="font-mono text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm mr-2">/</span> Division
              </div>
            </div>
          </section>

          {/* Section 2: Functions */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
              <FunctionSquare size={16} className="text-emerald-500" /> Aggregation Functions
            </h3>
            <p className="text-[13px] text-slate-600 mb-3 leading-relaxed">
              Database-level aggregation commands compile instantaneously into native platform pipelines. Note: <code>COUNT</code> requires purely a collection, whilst math functions require a specific target field.
            </p>
            <ul className="space-y-2">
              <li className="text-[13px] bg-white border border-slate-200 p-3 rounded-lg shadow-sm flex items-center justify-between">
                <code className="text-indigo-700 bg-indigo-50 px-2 py-1 rounded font-bold">COUNT(collection)</code>
                <span className="text-slate-500">Counts all rows matching logic.</span>
              </li>
              <li className="text-[13px] bg-white border border-slate-200 p-3 rounded-lg shadow-sm flex items-center justify-between">
                <code className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-bold">SUM(collection.field)</code>
                <span className="text-slate-500">Sums a specific numeric field.</span>
              </li>
              <li className="text-[13px] bg-white border border-slate-200 p-3 rounded-lg shadow-sm flex items-center justify-between">
                <code className="text-sky-700 bg-sky-50 px-2 py-1 rounded font-bold">AVG(collection.field)</code>
                <span className="text-slate-500">Averages numeric documents.</span>
              </li>
              <li className="text-[13px] bg-white border border-slate-200 p-3 rounded-lg shadow-sm flex items-center justify-between">
                <code className="text-amber-700 bg-amber-50 px-2 py-1 rounded font-bold">MIN / MAX(collection.field)</code>
                <span className="text-slate-500">Outputs highest or lowest mapped limits.</span>
              </li>
            </ul>
          </section>

          {/* Section 3: Advanced Filtering Content */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-amber-500" /> Filtering & Cross-Collection Lookups
            </h3>
            <p className="text-[13px] text-slate-600 mb-3 leading-relaxed">
              Inject SQL-like <code>WHERE</code> clauses natively. The platform executes automatic inner joins dynamically based on validated HR architectural relationship graphs!
            </p>
            <div className="bg-[#1E293B] text-slate-300 p-4 rounded-xl font-mono text-[12px] leading-loose shadow-inner relative">
              <div className="absolute top-2 right-3 text-[10px] uppercase font-bold text-slate-500">Examples</div>
              
              <span className="text-slate-500"># 1. Standard Arithmetic combining definitions</span><br/>
              <span className="text-emerald-400">SUM</span>(payroll.salary) <span className="text-fuchsia-400">+</span> <span className="text-emerald-400">SUM</span>(payroll.hra)<br/><br/>
              
              <span className="text-slate-500"># 2. Applying mathematical scalar ratios</span><br/>
              <span className="text-emerald-400">AVG</span>(employees.salary) <span className="text-fuchsia-400">*</span> <span className="text-amber-300">0.1</span><br/><br/>
              
              <span className="text-slate-500"># 3. Filtering specific internal records securely</span><br/>
              <span className="text-emerald-400">COUNT</span>(employees <span className="text-fuchsia-400">WHERE</span> employment_status = <span className="text-amber-300">"active"</span>)<br/><br/>

              <span className="text-slate-500"># 4. Advanced Graph Mapper (Cross-Collection Lookups)</span><br/>
              <span className="text-emerald-400">AVG</span>(payroll.net_salary <span className="text-fuchsia-400">WHERE</span> employees.department = <span className="text-amber-300">"Engineering"</span>)
            </div>
          </section>

          {/* Section 4: Mistakes to Avoid */}
          <section className="bg-red-50/50 p-5 rounded-xl border border-red-100">
            <h3 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-500" /> Common Mistakes
            </h3>
            <ul className="text-[13px] text-red-700/80 space-y-2 list-disc pl-5 font-medium">
              <li>Forgetting to qualify fields with collection origins inside Aggregations (e.g., using <code className="bg-red-100 px-1 rounded">SUM(salary)</code> rather than <code className="bg-red-100 px-1 rounded">SUM(employees.salary)</code>).</li>
              <li>Attempting to map functions outside aggregate blocks instead of pure arithmetic. Note that standalone commands like <code>IF()</code> are not locally processed yet.</li>
              <li>Referencing collections that haven't been properly joined in the <b>Relationships (Graph Mapper)</b> layer beforehand.</li>
            </ul>
          </section>

          {/* Section 5: Natural Language Prompts */}
          <section className="bg-gradient-to-r from-indigo-50/60 via-violet-50/40 to-purple-50/30 p-5 rounded-xl border border-indigo-200/50">
            <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-indigo-500" /> AI Formula Generator — Natural Language Prompts
            </h3>
            <p className="text-[13px] text-slate-600 mb-4 leading-relaxed">
              Instead of writing formulas manually, you can describe what you want to measure in plain English. The AI generator will convert your description into a valid formula using your actual data schema.
            </p>

            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">How to Write Effective Prompts</h4>
            <ul className="text-[13px] text-slate-600 space-y-1.5 list-disc pl-5 font-medium mb-4">
              <li>Be specific about the <b>action</b>: "count", "sum", "average", "minimum", "maximum"</li>
              <li>Mention the <b>collection</b> name: "employees", "payroll", etc.</li>
              <li>Include <b>field names</b> for numeric aggregations: "salary", "net_salary"</li>
              <li>Add <b>filters</b> naturally: "where status is Active", "in Engineering department"</li>
            </ul>

            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Example Mappings</h4>
            <div className="space-y-2 mb-4">
              <div className="bg-white/80 border border-slate-200/60 p-3 rounded-lg flex items-start gap-3">
                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">PROMPT</span>
                <div className="min-w-0">
                  <p className="text-[13px] text-slate-700 font-medium">"Count all active employees"</p>
                  <code className="text-[12px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-1 inline-block font-bold">→ COUNT(employees WHERE status = "Active")</code>
                </div>
              </div>
              <div className="bg-white/80 border border-slate-200/60 p-3 rounded-lg flex items-start gap-3">
                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">PROMPT</span>
                <div className="min-w-0">
                  <p className="text-[13px] text-slate-700 font-medium">"Average salary of employees in Engineering"</p>
                  <code className="text-[12px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-1 inline-block font-bold">→ AVG(employees.salary WHERE department = "Engineering")</code>
                </div>
              </div>
              <div className="bg-white/80 border border-slate-200/60 p-3 rounded-lg flex items-start gap-3">
                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">PROMPT</span>
                <div className="min-w-0">
                  <p className="text-[13px] text-slate-700 font-medium">"Total payroll net salary"</p>
                  <code className="text-[12px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-1 inline-block font-bold">→ SUM(payroll.net_salary)</code>
                </div>
              </div>
            </div>

            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tips & Limitations</h4>
            <ul className="text-[13px] text-slate-500 space-y-1.5 list-disc pl-5 font-medium">
              <li>The AI uses your actual collection and field names — invalid references are caught automatically.</li>
              <li>Generated formulas are always editable — tweak them in the Formula Directive field after generation.</li>
              <li>For complex multi-aggregate formulas (e.g., ratios), you may need to refine the generated result.</li>
              <li>If the AI is unavailable, a keyword-based heuristic generates a best-effort formula.</li>
            </ul>
          </section>

        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-100 shrink-0 flex justify-end">
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors">
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}

