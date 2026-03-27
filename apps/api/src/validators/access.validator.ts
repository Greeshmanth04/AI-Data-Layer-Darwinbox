import { z } from 'zod';

export const createGroupSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    description: z.string().optional()
  })
});

export const updateGroupSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional()
  })
});

export const updateGroupMembersSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    userIds: z.array(z.string())
  })
});

const rowFilterSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'contains', 'in', 'gt', 'lt']),
  value: z.any()
});

export const updatePermissionSchema = z.object({
  params: z.object({ id: z.string(), collId: z.string() }),
  body: z.object({
    canRead: z.boolean(),
    allowedFields: z.array(z.string()).default([]),
    deniedFields: z.array(z.string()).default([]),
    rowFilters: z.array(rowFilterSchema).default([])
  })
});

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['platform_admin', 'data_steward', 'viewer']).default('viewer')
  })
});

export const updateUserSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    role: z.enum(['platform_admin', 'data_steward', 'viewer'])
  })
});
