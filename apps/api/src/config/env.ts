import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from api directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().url(),
  JWT_SECRET: z.string().min(10)
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error("❌ Invalid environment variables:", parseResult.error.format());
  process.exit(1);
}

export const env = parseResult.data;
