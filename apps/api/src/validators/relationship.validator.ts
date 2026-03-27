import { z } from 'zod';

export const createRelationshipSchema = z.object({
  body: z.object({
    sourceCollection: z.string().min(1),
    targetCollection: z.string().min(1),
    sourceField: z.string().min(1),
    targetField: z.string().min(1),
    relationshipType: z.enum(['1:1', '1:N', 'M:N']).default('1:N')
  })
});

export const updateRelationshipSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    relationshipType: z.enum(['1:1', '1:N', 'M:N']).optional(),
    sourceField: z.string().optional(),
    targetField: z.string().optional()
  })
});
