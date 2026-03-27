import { z } from 'zod';

export const CommonResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional()
});

export type CommonResponse = z.infer<typeof CommonResponseSchema>;
