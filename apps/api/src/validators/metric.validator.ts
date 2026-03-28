import { z } from 'zod';

export const metricSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    formula: z.string().min(2),
    baseCollection: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional()
  })
});

export const metricUpdateSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(2).optional(),
    formula: z.string().min(2).optional(),
    baseCollection: z.string().min(1).optional(),
    description: z.string().optional(),
    category: z.string().optional()
  })
});

export const metricFormulaSchema = z.object({
  body: z.object({
    formula: z.string().min(2)
  })
});
