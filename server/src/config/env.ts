import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Search current working dir and repository root for .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const DEV_DEFAULT_JWT_SECRET = 'chandil-dev-secret-key-change-in-production-min32chars!';

export function createEnvSchema() {
  return z
    .object({
      PORT: z.coerce.number().default(3000),
      HOST: z.string().default('0.0.0.0'),
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      DATABASE_URL: z.string().optional(),
      JWT_SECRET: z.string().optional(),
      CORS_ORIGIN: z.string().optional(),
      AUDIO_UPLOAD_DIR: z.string().default('./uploads'),
      SUPPORT_PHONE: z.string().default('+919876543210'),
      SUPPORT_WHATSAPP: z.string().default('+919876543210'),
      DEV_MOCK_OTP: z.string().default('1234'),
    })
    .superRefine((data, ctx) => {
      if (data.NODE_ENV === 'production') {
        if (!data.JWT_SECRET || data.JWT_SECRET.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_SECRET'],
            message: 'JWT_SECRET must be explicitly provided in production environment.',
          });
        } else if (data.JWT_SECRET.length < 32) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_SECRET'],
            message: 'JWT_SECRET must be at least 32 characters in production environment.',
          });
        } else if (data.JWT_SECRET === DEV_DEFAULT_JWT_SECRET) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_SECRET'],
            message: 'JWT_SECRET cannot use default development secret in production.',
          });
        }
      }
    })
    .transform((data) => ({
      ...data,
      JWT_SECRET: data.JWT_SECRET || DEV_DEFAULT_JWT_SECRET,
    }));
}

export const envSchema = createEnvSchema();

export type Env = z.infer<typeof envSchema>;

export function validateEnvConfig(customEnv: Record<string, string | undefined>): Env {
  return createEnvSchema().parse(customEnv);
}
export const env = envSchema.parse(process.env);
