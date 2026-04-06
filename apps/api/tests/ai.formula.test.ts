import { LLMService } from '../src/services/llm.service';

describe('AI Formula Generator Logic Tests', () => {
  const mockSchema = [
    {
      slug: 'employees',
      name: 'Employees',
      fields: [
        { name: 'id', type: 'string', description: 'Unique identifier' },
        { name: 'status', type: 'string', description: 'Employment status (Active, Inactive)' },
        { name: 'salary', type: 'number', description: 'Monthly base pay' },
        { name: 'department_id', type: 'string', description: 'Dept reference' }
      ]
    },
    {
      slug: 'payroll',
      name: 'Payroll',
      fields: [
        { name: 'net_salary', type: 'number', description: 'Net amount paid' },
        { name: 'month', type: 'string', description: 'Pay month' }
      ]
    }
  ];

  test('formatSchemaForPrompt includes types and descriptions', () => {
    const text = LLMService.formatSchemaForPrompt(mockSchema);
    expect(text).toContain('[string]');
    expect(text).toContain('[number]');
    expect(text).toContain('Monthly base pay');
    expect(text).toContain('Net amount paid');
  });

  test('heuristicFormulaParser resolves COUNT with WHERE', () => {
    const result = LLMService.heuristicFormulaParser('Count active employees', mockSchema);
    expect(result.formula).toBe('COUNT(employees WHERE status = "Active")');
    expect(result.source).toBe('heuristic');
  });

  test('heuristicFormulaParser resolves SUM with numeric guessing', () => {
    const result = LLMService.heuristicFormulaParser('Total salary', mockSchema);
    expect(result.formula).toBe('SUM(employees.salary)');
  });

  test('heuristicFormulaParser resolves AVG with numeric guessing', () => {
    const result = LLMService.heuristicFormulaParser('Average net salary', mockSchema);
    // It should find 'payroll' collection because of 'net_salary' hint or 'payroll' name
    expect(result.formula).toBe('AVG(payroll.net_salary)');
  });

  test('heuristicFormulaParser handles explicit WHERE field', () => {
    const result = LLMService.heuristicFormulaParser('Count employees where status = Inactive', mockSchema);
    expect(result.formula).toBe('COUNT(employees WHERE status = "Inactive")');
  });
});
