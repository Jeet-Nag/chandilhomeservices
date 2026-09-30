import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { ApiResponse, User, AdminProviderView } from '@shared';
import { AdminProviderService, AdminProviderError } from '../services/admin-provider.service';

const createProviderSchema = z
  .object({
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian mobile number'),
    fullName: z.string().trim().min(1, 'Full name is required').max(100, 'Full name cannot exceed 100 characters'),
    categoryId: z.string().trim().min(1, 'Category ID is required'),
    preferredLanguage: z.enum(['en', 'hi']).optional(),
    serviceArea: z.string().trim().max(100, 'Service area cannot exceed 100 characters').optional(),
  })
  .strict();

const updateProviderSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Full name cannot be empty').max(100).optional(),
    categoryId: z.string().trim().min(1, 'Category ID cannot be empty').optional(),
    preferredLanguage: z.enum(['en', 'hi']).optional(),
    serviceArea: z.string().trim().min(1, 'Service area cannot be empty').max(100).optional(),
  })
  .strict();

const statusSchema = z
  .object({
    isActive: z.boolean({ required_error: 'isActive boolean is required' }),
  })
  .strict();

export const adminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const adminProviderService = new AdminProviderService();

  /**
   * GET /api/admin/me
   * Validates admin session and returns current admin profile.
   * RBAC: Strictly restricted to 'admin' role.
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

  /**
   * GET /api/admin/providers
   * Returns list of all registered providers with profile and category info.
   * Supports optional query filters: category_id, is_active.
   */
  app.get(
    '/providers',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      try {
        const query = request.query as { category_id?: string; is_active?: string };
        const categoryId = query.category_id ? String(query.category_id).trim() : undefined;
        let isActive: boolean | undefined = undefined;

        if (query.is_active !== undefined) {
          if (query.is_active === 'true') isActive = true;
          else if (query.is_active === 'false') isActive = false;
        }

        const providers = await adminProviderService.listProviders({ categoryId, isActive });
        const response: ApiResponse<{ providers: AdminProviderView[] }> = {
          success: true,
          data: { providers },
        };
        return reply.status(200).send(response);
      } catch (err: any) {
        if (err instanceof AdminProviderError) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: err.code,
              messageEn: err.messageEn,
              messageHi: err.messageHi,
            },
          };
          return reply.status(err.statusCode).send(response);
        }
        throw err;
      }
    }
  );

  /**
   * GET /api/admin/providers/:id
   * Returns specific provider by ID.
   */
  app.get(
    '/providers/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const provider = await adminProviderService.getProviderById(id);
        const response: ApiResponse<{ provider: AdminProviderView }> = {
          success: true,
          data: { provider },
        };
        return reply.status(200).send(response);
      } catch (err: any) {
        if (err instanceof AdminProviderError) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: err.code,
              messageEn: err.messageEn,
              messageHi: err.messageHi,
            },
          };
          return reply.status(err.statusCode).send(response);
        }
        throw err;
      }
    }
  );

  /**
   * POST /api/admin/providers
   * Atomically provisions a new provider.
   */
  app.post(
    '/providers',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      try {
        const parsed = createProviderSchema.safeParse(request.body);
        if (!parsed.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              messageEn: parsed.error.errors[0]?.message || 'Invalid request body',
              messageHi: 'अमान्य अनुरोध विवरण।',
            },
          };
          return reply.status(400).send(response);
        }

        const provider = await adminProviderService.createProvider(parsed.data);
        const response: ApiResponse<{ provider: AdminProviderView }> = {
          success: true,
          data: { provider },
        };
        return reply.status(201).send(response);
      } catch (err: any) {
        if (err instanceof AdminProviderError) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: err.code,
              messageEn: err.messageEn,
              messageHi: err.messageHi,
            },
          };
          return reply.status(err.statusCode).send(response);
        }
        throw err;
      }
    }
  );

  /**
   * PATCH /api/admin/providers/:id
   * Updates provider profile details.
   */
  app.patch(
    '/providers/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const parsed = updateProviderSchema.safeParse(request.body);
        if (!parsed.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              messageEn: parsed.error.errors[0]?.message || 'Invalid request body',
              messageHi: 'अमान्य अनुरोध विवरण।',
            },
          };
          return reply.status(400).send(response);
        }

        const provider = await adminProviderService.updateProvider(id, parsed.data);
        const response: ApiResponse<{ provider: AdminProviderView }> = {
          success: true,
          data: { provider },
        };
        return reply.status(200).send(response);
      } catch (err: any) {
        if (err instanceof AdminProviderError) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: err.code,
              messageEn: err.messageEn,
              messageHi: err.messageHi,
            },
          };
          return reply.status(err.statusCode).send(response);
        }
        throw err;
      }
    }
  );

  /**
   * POST /api/admin/providers/:id/status
   * Activates or deactivates a provider.
   * Deactivation checks for active in-progress bookings and revokes sessions.
   */
  app.post(
    '/providers/:id/status',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const parsed = statusSchema.safeParse(request.body);
        if (!parsed.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              messageEn: parsed.error.errors[0]?.message || 'Invalid request body',
              messageHi: 'अमान्य अनुरोध विवरण।',
            },
          };
          return reply.status(400).send(response);
        }

        const provider = await adminProviderService.setProviderStatus(id, parsed.data.isActive);
        const response: ApiResponse<{ provider: AdminProviderView }> = {
          success: true,
          data: { provider },
        };
        return reply.status(200).send(response);
      } catch (err: any) {
        if (err instanceof AdminProviderError) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: err.code,
              messageEn: err.messageEn,
              messageHi: err.messageHi,
            },
          };
          return reply.status(err.statusCode).send(response);
        }
        throw err;
      }
    }
  );
};
