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
import { ApiResponse } from '@shared';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  // CORS configuration
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  // JWT configuration
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  });

  // Register Auth, Category, Booking, Audio, Provider and RBAC routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(categoryRoutes, { prefix: '/api/categories' });
  await app.register(bookingRoutes, { prefix: '/api/bookings' });
  await app.register(audioRoutes, { prefix: '/api/audio' });
  await app.register(providerRoutes, { prefix: '/api/provider' });
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
