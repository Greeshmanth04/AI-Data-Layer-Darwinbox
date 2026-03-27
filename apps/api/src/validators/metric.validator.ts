import { z } from 'zod';

export const metricSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    formula: z.string().min(2),
    baseCollection: z.string().min(1),
    description: z.string().optional()
  })
});

export const metricFormulaSchema = z.object({
  body: z.object({
    formula: z.string().min(2)
  })
});
