import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { ApiResponse, ServiceCategory } from '@shared';

interface CategoryDbRow {
  id: string;
  title_en: string;
  title_hi: string;
  desc_en: string | null;
  desc_hi: string | null;
  icon_name: string;
  base_visit_fee: string | number;
  is_active: boolean;
  sort_order: number;
}

export const categoryRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/categories
   * Retrieves all approved service categories ordered by sort_order.
   * RBAC: Customer and Admin can access.
   */
  app.get<{
    Querystring: { active_only?: string };
  }>('/', {
    preHandler: [authenticate, requireRole(['customer', 'admin'])],
  }, async (request, reply) => {
    try {
      const activeOnly = request.query.active_only === 'true';

      const query = activeOnly
        ? `SELECT id, title_en, title_hi, desc_en, desc_hi, icon_name, base_visit_fee, is_active, sort_order 
           FROM service_categories 
           WHERE is_active = true 
           ORDER BY sort_order ASC`
        : `SELECT id, title_en, title_hi, desc_en, desc_hi, icon_name, base_visit_fee, is_active, sort_order 
           FROM service_categories 
           ORDER BY sort_order ASC`;

      const result = await db.query<CategoryDbRow>(query);

      const categories: ServiceCategory[] = result.rows.map((row) => ({
        id: row.id,
        titleEn: row.title_en,
        titleHi: row.title_hi,
        descEn: row.desc_en,
        descHi: row.desc_hi,
        iconName: row.icon_name,
        baseVisitFee: parseFloat(String(row.base_visit_fee)),
        isActive: row.is_active,
        sortOrder: row.sort_order,
      }));

      const response: ApiResponse<ServiceCategory[]> = {
        success: true,
        data: categories,
      };

      return reply.send(response);
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch service categories');
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CATEGORY_FETCH_FAILED',
          messageEn: 'Unable to load service categories. Please try again.',
          messageHi: 'सेवा श्रेणियां लोड करने में असमर्थ। कृपया पुनः प्रयास करें।',
        },
      };
      return reply.status(500).send(response);
    }
  });
};
