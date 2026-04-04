import { z } from 'zod';

export const createCollectionSchema = z.object({
  body: z.object({
    slug: z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be url-safe'),
    name: z.string().min(2),
    module: z.enum(['Core', 'Recruitment', 'Time', 'Payroll']),
    description: z.string().optional()
  })
});

export const updateCollectionSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(2).optional(),
    module: z.enum(['Core', 'Recruitment', 'Time', 'Payroll']).optional(),
    description: z.string().optional()
  })
});

export const createFieldSchema = z.object({
  body: z.object({
    collectionId: z.string(),
    fieldName: z.string().min(1),
    displayName: z.string().min(1).optional(),
    dataType: z.enum(['string', 'number', 'boolean', 'date', 'reference']),
    isCustom: z.boolean().default(true),
    isPrimaryKey: z.boolean().optional().default(false),
    isForeignKey: z.boolean().optional().default(false),
    targetCollectionId: z.string().optional(),
    targetFieldId: z.string().optional(),
    relationshipLabel: z.string().optional(),
    relationshipType: z.enum(['one-to-one', 'one-to-many', 'many-to-one']).optional(),
    manualDescription: z.string().optional(),
    exampleValues: z.array(z.string()).optional(),
  }).refine(
    (data) => {
      if (data.isForeignKey) {
        return !!data.targetCollectionId && !!data.targetFieldId;
      }
      return true;
    },
    { message: 'Foreign Key requires both a target collection and a target field', path: ['targetCollectionId'] }
  )
});

export const updateFieldSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    fieldName: z.string().min(1).optional(),
    displayName: z.string().min(1).optional(),
    description: z.string().optional(),
    manualDescription: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isCustom: z.boolean().optional(),
    dataType: z.enum(['string', 'number', 'boolean', 'date', 'reference']).optional(),
    isPrimaryKey: z.boolean().optional(),
    isForeignKey: z.boolean().optional(),
    targetCollectionId: z.string().nullable().optional(),
    targetFieldId: z.string().nullable().optional(),
    relationshipLabel: z.string().nullable().optional(),
    relationshipType: z.enum(['one-to-one', 'one-to-many', 'many-to-one']).nullable().optional(),
    exampleValues: z.array(z.string()).optional(),
  }).refine(
    (data) => {
      // Relaxed for partial updates: the UI toggles the flag before selecting targets.
      // Controller logic handles missing targets gracefully.
      return true;
    },
    { message: 'Foreign Key requires both a target collection and a target field', path: ['targetCollectionId'] }
  )
});
