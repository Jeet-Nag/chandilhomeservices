import { FastifyInstance } from 'fastify';
import { db } from '../../src/db';
import { User } from '@shared';

export interface TestAuthResult {
  id: string;
  phone: string;
  role: 'customer' | 'provider' | 'admin';
  tokenVersion: number;
  token: string;
  headers: { Authorization: string };
  user: User;
}

export interface CreateTestUserOptions {
  phone: string;
  role?: 'customer' | 'provider' | 'admin';
  fullName?: string;
  preferredLanguage?: 'en' | 'hi';
  isActive?: boolean;
  tokenVersion?: number;
}

/**
 * Creates or updates a test user in the database and signs a production-identical JWT.
 * The generated token passes validateSession() and requireRole() middleware.
 */
export async function createTestUserAndToken(
  app: FastifyInstance,
  options: CreateTestUserOptions
): Promise<TestAuthResult> {
  const pool = db.getPool();
  if (!pool) {
    throw new Error('Database pool unavailable in test auth helper');
  }

  const role = options.role || 'customer';
  const fullName = options.fullName || (role === 'admin' ? 'Test Admin' : role === 'provider' ? 'Test Provider' : 'Test Customer');
  const preferredLanguage = options.preferredLanguage || 'hi';
  const isActive = options.isActive ?? true;
  const tokenVersion = options.tokenVersion ?? 1;

  const { rows } = await pool.query<User & { token_version: number; is_active: boolean }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active, token_version)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (phone) DO UPDATE
       SET role = EXCLUDED.role,
           full_name = EXCLUDED.full_name,
           preferred_language = EXCLUDED.preferred_language,
           is_active = EXCLUDED.is_active,
           token_version = EXCLUDED.token_version,
           updated_at = NOW()
     RETURNING id, phone, role, full_name as "fullName", preferred_language as "preferredLanguage",
               is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt", token_version`,
    [options.phone, role, fullName, preferredLanguage, isActive, tokenVersion]
  );

  const user = rows[0];
  const token = app.jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
      tokenVersion: user.token_version,
    },
    { expiresIn: '30d' }
  );

  return {
    id: user.id,
    phone: user.phone,
    role: user.role as 'customer' | 'provider' | 'admin',
    tokenVersion: user.token_version,
    token,
    headers: { Authorization: `Bearer ${token}` },
    user,
  };
}

/**
 * Creates a customer test user and signs a JWT.
 */
export async function createTestCustomer(
  app: FastifyInstance,
  phone: string,
  fullName = 'Test Customer'
): Promise<TestAuthResult> {
  return createTestUserAndToken(app, { phone, role: 'customer', fullName });
}

/**
 * Creates a provider test user and signs a JWT.
 */
export async function createTestProvider(
  app: FastifyInstance,
  phone: string,
  fullName = 'Test Provider'
): Promise<TestAuthResult> {
  return createTestUserAndToken(app, { phone, role: 'provider', fullName });
}

/**
 * Creates an admin test user and signs a JWT.
 */
export async function createTestAdmin(
  app: FastifyInstance,
  phone: string,
  fullName = 'Test Admin'
): Promise<TestAuthResult> {
  return createTestUserAndToken(app, { phone, role: 'admin', fullName });
}

/**
 * Signs a JWT directly from an existing user record.
 */
export function signTestToken(
  app: FastifyInstance,
  payload: { id: string; phone: string; role: string; tokenVersion: number }
): string {
  return app.jwt.sign(payload, { expiresIn: '30d' });
}

/**
 * Returns the Authorization header object for a token.
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
