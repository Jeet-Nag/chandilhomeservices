import Fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { env } from './config/env';
import { db } from './db';
import { authRoutes } from './routes/auth.routes';
import { rbacTestRoutes } from './routes/rbac-test.routes';
import { categoryRoutes } from './routes/category.routes';
import { bookingRoutes } from './routes/booking.routes';
import { audioRoutes } from './routes/audio.routes';
import { providerRoutes } from './routes/provider.routes';
import { adminRoutes } from './routes/admin.routes';
import { configRoutes } from './routes/config.routes';
import { ApiResponse } from '@shared';

export function resolveCorsOrigin(environment: string, corsOrigin?: string): boolean | string[] {
  if (environment !== 'production') {
    return true; // preserve development flexibility
  }

  if (!corsOrigin || corsOrigin.trim().length === 0) {
    // Fail safely in production if CORS_ORIGIN is missing
    return false;
  }

  const allowedOrigins = corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  if (allowedOrigins.length === 0) {
    return false;
  }

  return allowedOrigins;
}

export interface BuildAppOptions {
  customEnv?: {
    NODE_ENV?: 'development' | 'production' | 'test';
    CORS_ORIGIN?: string;
    JWT_SECRET?: string;
  };
}

export async function buildApp(options?: BuildAppOptions): Promise<FastifyInstance> {
  const currentEnv = options?.customEnv?.NODE_ENV || env.NODE_ENV;
  const currentCorsOrigin = options?.customEnv?.CORS_ORIGIN !== undefined
    ? options.customEnv.CORS_ORIGIN
    : env.CORS_ORIGIN;
  const currentJwtSecret = options?.customEnv?.JWT_SECRET || env.JWT_SECRET;

  const app = Fastify({
    logger: currentEnv !== 'test',
  });

  // CORS configuration
  await app.register(cors, {
    origin: resolveCorsOrigin(currentEnv, currentCorsOrigin),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // JWT configuration
  await app.register(fastifyJwt, {
    secret: currentJwtSecret,
  });

  // Register Auth, Category, Booking, Audio, Provider, Admin, Config and RBAC routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(categoryRoutes, { prefix: '/api/categories' });
  await app.register(bookingRoutes, { prefix: '/api/bookings' });
  await app.register(audioRoutes, { prefix: '/api/audio' });
  await app.register(providerRoutes, { prefix: '/api/provider' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(configRoutes, { prefix: '/api/config' });
  await app.register(rbacTestRoutes);

  // Health check endpoint
  app.get('/health', async () => {
    const dbHealth = await db.checkHealth();
    return {
      status: 'ok',
      service: 'chandil-home-services-api',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      database: dbHealth,
    };
  });

  // Base API ping endpoint
  app.get('/api/ping', async () => {
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'Chandil Home Services API Foundation is operational.',
      },
    };
    return response;
  });

  // Standard error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        messageEn: error.message || 'An unexpected internal error occurred.',
        messageHi: 'एक अप्रत्याशित समस्या आई है। कृपया दोबारा प्रयास करें।',
      },
    };
    reply.status(error.statusCode || 500).send(response);
  });

  return app;
}
