import { z } from 'zod';

export const createRelationshipSchema = z.object({
  body: z.object({
    sourceCollectionId: z.string().min(1),
    targetCollectionId: z.string().min(1),
    sourceFieldId: z.string().min(1),
    targetFieldId: z.string().min(1),
    label: z.string().optional(),
    relationshipType: z.enum(['one-to-one', 'one-to-many', 'many-to-one']).default('one-to-many')
  })
});

export const updateRelationshipSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    relationshipType: z.enum(['one-to-one', 'one-to-many', 'many-to-one']).optional(),
    sourceFieldId: z.string().optional(),
    targetFieldId: z.string().optional(),
    label: z.string().optional()
  })
});
