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

export const updateFieldSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    description: z.string().optional(),
    tags: z.array(z.string()).optional()
  })
});
