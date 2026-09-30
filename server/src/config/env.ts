import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Search current working dir and repository root for .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().default('chandil-dev-secret-key-change-in-production-min32chars!'),
  AUDIO_UPLOAD_DIR: z.string().default('./uploads'),
  SUPPORT_PHONE: z.string().default('+919876543210'),
  SUPPORT_WHATSAPP: z.string().default('+919876543210'),
  DEV_MOCK_OTP: z.string().default('1234'),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
