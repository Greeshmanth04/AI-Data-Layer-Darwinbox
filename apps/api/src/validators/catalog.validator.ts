import { z } from 'zod';

export const createCollectionSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    displayName: z.string().min(2),
    module: z.string().min(2),
    description: z.string().optional()
  })
});

export const updateCollectionSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    displayName: z.string().min(2).optional(),
    module: z.string().min(2).optional(),
    description: z.string().optional()
  })
});

export const createFieldSchema = z.object({
  body: z.object({
    collectionId: z.string(),
    name: z.string().min(1),
    type: z.enum(['string', 'number', 'boolean', 'date', 'reference']),
    isCustom: z.boolean().default(true),
    manualDescription: z.string().optional()
  })
});

export const updateFieldSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    description: z.string().optional(),
    manualDescription: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isCustom: z.boolean().optional(),
    type: z.enum(['string', 'number', 'boolean', 'date', 'reference']).optional()
  })
});
