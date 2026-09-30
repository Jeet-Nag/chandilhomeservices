import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth';
import { ApiResponse } from '@shared';

export const rbacTestRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Customer-only test endpoint
  app.get(
    '/api/customer/me',
    { preHandler: [authenticate, requireRole(['customer'])] },
    async (request) => {
      const response: ApiResponse<{ message: string; customerId: string }> = {
        success: true,
        data: {
          message: 'Customer access granted.',
          customerId: request.user.id,
        },
      };
      return response;
    }
  );

  // Provider-only test endpoint
  app.get(
    '/api/provider/dashboard',
    { preHandler: [authenticate, requireRole(['provider'])] },
    async (request) => {
      const response: ApiResponse<{ message: string; providerId: string }> = {
        success: true,
        data: {
          message: 'Provider access granted.',
          providerId: request.user.id,
        },
      };
      return response;
    }
  );

  // Admin-only test endpoint
  app.get(
    '/api/admin/overview',
    { preHandler: [authenticate, requireRole(['admin'])] },
    async (request) => {
      const response: ApiResponse<{ message: string; adminId: string }> = {
        success: true,
        data: {
          message: 'Admin access granted.',
          adminId: request.user.id,
        },
      };
      return response;
    }
  );
};
