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
    isPrimaryKey: z.boolean().optional().default(false),
    isForeignKey: z.boolean().optional().default(false),
    targetCollectionId: z.string().optional(),
    targetFieldId: z.string().optional(),
    relationshipLabel: z.string().optional(),
    relationshipType: z.enum(['one-to-one', 'one-to-many', 'many-to-one']).optional(),
    manualDescription: z.string().optional()
  })
});

export const updateFieldSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    manualDescription: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isCustom: z.boolean().optional(),
    type: z.enum(['string', 'number', 'boolean', 'date', 'reference']).optional(),
    isPrimaryKey: z.boolean().optional(),
    isForeignKey: z.boolean().optional(),
    targetCollectionId: z.string().nullable().optional(),
    targetFieldId: z.string().nullable().optional(),
    relationshipLabel: z.string().nullable().optional(),
    relationshipType: z.enum(['one-to-one', 'one-to-many', 'many-to-one']).nullable().optional(),
  })
});
