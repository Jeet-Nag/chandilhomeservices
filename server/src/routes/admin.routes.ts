import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { ApiResponse, User, AdminProviderView, AdminBookingListItem, AdminBookingDetail } from '@shared';
import { AdminProviderService, AdminProviderError } from '../services/admin-provider.service';
import { AdminBookingService, AdminBookingError } from '../services/admin-booking.service';

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

const cancelBookingSchema = z
  .object({
    reason: z
      .string({ required_error: 'Cancellation reason is required' })
      .trim()
      .min(3, 'Cancellation reason must be at least 3 characters')
      .max(255, 'Cancellation reason must not exceed 255 characters'),
  })
  .strict();

const assignProviderSchema = z
  .object({
    providerId: z
      .string({ required_error: 'providerId is required' })
      .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'providerId must be a valid UUID'),
  })
  .strict();

export const adminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const adminProviderService = new AdminProviderService();
  const adminBookingService = new AdminBookingService();

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

  /**
   * GET /api/admin/bookings
   * Returns paginated list of bookings with customer, provider, and category summaries.
   * Query parameters: status, category_id, provider_id, area_locality, search, limit, offset.
   * RBAC: Strictly restricted to 'admin' role.
   */
  app.get(
    '/bookings',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      try {
        const query = request.query as {
          status?: string;
          category_id?: string;
          provider_id?: string;
          area_locality?: string;
          search?: string;
          limit?: string;
          offset?: string;
        };

        const result = await adminBookingService.listBookings({
          status: query.status,
          categoryId: query.category_id,
          providerId: query.provider_id,
          areaLocality: query.area_locality,
          search: query.search,
          limit: query.limit !== undefined ? Number(query.limit) : undefined,
          offset: query.offset !== undefined ? Number(query.offset) : undefined,
        });

        const response: ApiResponse<{
          bookings: AdminBookingListItem[];
          total: number;
          limit: number;
          offset: number;
        }> = {
          success: true,
          data: result,
        };
        return reply.status(200).send(response);
      } catch (err: any) {
        if (err instanceof AdminBookingError) {
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
   * GET /api/admin/bookings/:id
   * Returns full operational detail for a single booking with customer, provider,
   * category, and complete status timeline.
   * RBAC: Strictly restricted to 'admin' role.
   */
  app.get(
    '/bookings/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const detail = await adminBookingService.getBookingById(id);
        const response: ApiResponse<AdminBookingDetail> = {
          success: true,
          data: detail,
        };
        return reply.status(200).send(response);
      } catch (err: any) {
        if (err instanceof AdminBookingError) {
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
   * POST /api/admin/bookings/:id/cancel
   * Administratively cancels an active booking with mandatory reason note.
   * RBAC: Strictly restricted to 'admin' role.
   */
  app.post(
    '/bookings/:id/cancel',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const parsed = cancelBookingSchema.safeParse(request.body);
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

        const updated = await adminBookingService.cancelBooking(id, parsed.data.reason, request.user.id);
        const response: ApiResponse<{ booking: AdminBookingDetail['booking'] }> = {
          success: true,
          data: {
            booking: updated.booking,
          },
        };
        return reply.status(200).send(response);
      } catch (err: any) {
        if (err instanceof AdminBookingError) {
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
   * POST /api/admin/bookings/:id/assign
   * Administratively assigns an eligible provider to a requested booking.
   * RBAC: Strictly restricted to 'admin' role.
   */
  app.post(
    '/bookings/:id/assign',
    {
      preHandler: [authenticate, requireRole(['admin'])],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const parsed = assignProviderSchema.safeParse(request.body);
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

        const updated = await adminBookingService.assignProvider(id, parsed.data.providerId, request.user.id);
        const response: ApiResponse<{
          booking: AdminBookingDetail['booking'];
          provider: AdminBookingDetail['provider'];
        }> = {
          success: true,
          data: {
            booking: updated.booking,
            provider: updated.provider,
          },
        };
        return reply.status(200).send(response);
      } catch (err: any) {
        if (err instanceof AdminBookingError) {
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
