import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth';
import { ApiResponse, User } from '@shared';

export const adminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/admin/me
   * Validates admin session and returns current admin profile.
   * RBAC: Strictly restricted to 'admin' role.
   * Reject unauthenticated: 401 Unauthorized (via authenticate)
   * Reject customer/provider: 403 Forbidden (via requireRole(['admin']))
   */
  app.get(
    '/me',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      const response: ApiResponse<{ user: User }> = {
        success: true,
        data: {
          user: request.userProfile!,
        },
      };
      return reply.status(200).send(response);
    }
  );
};
