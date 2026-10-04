import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Search current working dir and repository root for .env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

export const DEV_DEFAULT_JWT_SECRET = 'chandil-dev-secret-key-change-in-production-min32chars!';

export function createEnvSchema() {
  return z
    .object({
      PORT: z.coerce.number().default(3000),
      HOST: z.string().default('0.0.0.0'),
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      DATABASE_URL: z.string().optional(),
      DATABASE_SSL: z
        .union([z.boolean(), z.string()])
        .optional()
        .refine(
          (val) => {
            if (val === undefined || typeof val === 'boolean') return true;
            const trimmed = val.trim().toLowerCase();
            return trimmed === '' || trimmed === 'true' || trimmed === 'false';
          },
          {
            message: 'Invalid DATABASE_SSL value. Must be "true" or "false".',
          }
        )
        .transform((val) => {
          if (val === undefined) return false;
          if (typeof val === 'boolean') return val;
          const trimmed = val.trim().toLowerCase();
          if (trimmed === '') return false;
          return trimmed === 'true';
        }),
      JWT_SECRET: z.string().optional(),
      CORS_ORIGIN: z.string().optional(),
      AUDIO_UPLOAD_DIR: z.string().default('./uploads'),
      SUPPORT_PHONE: z.string().default('+919876543210'),
      SUPPORT_WHATSAPP: z.string().default('+919876543210'),
      RP_ID: z.string().default('localhost'),
      RP_NAME: z.string().default('Chandil Home Services'),
      EXPECTED_ORIGIN: z.string().default('http://localhost:3000'),
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

export function resolveDatabaseSsl(
  sslOption?: boolean | string
): { rejectUnauthorized: false } | undefined {
  if (sslOption === undefined) {
    return env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined;
  }
  if (typeof sslOption === 'boolean') {
    return sslOption ? { rejectUnauthorized: false } : undefined;
  }
  const trimmed = sslOption.trim().toLowerCase();
  if (trimmed === 'true') {
    return { rejectUnauthorized: false };
  }
  if (trimmed === 'false' || trimmed === '') {
    return undefined;
  }
  throw new Error(`Invalid DATABASE_SSL value: "${sslOption}". Expected "true" or "false".`);
}

export function getExpectedOrigins(): string[] {
  return env.EXPECTED_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
}
