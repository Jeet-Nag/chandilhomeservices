import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from '../db';
import { env } from '../config/env';
import { ApiResponse, SupportConfig } from '@shared';

export const configRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/config/support
   * Returns operational support phone and WhatsApp contacts.
   * Priority: app_configs table -> environment config -> null.
   * Public endpoint (used for helpline/WhatsApp customer communication).
   */
  app.get('/support', async (request, reply) => {
    let supportPhone: string | null = null;
    let supportWhatsApp: string | null = null;

    const pool = db.getPool();
    if (pool) {
      try {
        const { rows } = await pool.query<{ key: string; value: string }>(
          "SELECT key, value FROM app_configs WHERE key IN ('support_phone', 'support_whatsapp')"
        );
        for (const row of rows) {
          if (row.key === 'support_phone') supportPhone = row.value.trim() || null;
          if (row.key === 'support_whatsapp') supportWhatsApp = row.value.trim() || null;
        }
      } catch (err) {
        request.log.warn(err, 'Failed to query app_configs table, falling back to environment config');
      }
    }

    // Fall back to environment configuration if not populated in DB
    if (!supportPhone && env.SUPPORT_PHONE) {
      supportPhone = env.SUPPORT_PHONE.trim() || null;
    }
    if (!supportWhatsApp && env.SUPPORT_WHATSAPP) {
      supportWhatsApp = env.SUPPORT_WHATSAPP.trim() || null;
    }

    const response: ApiResponse<SupportConfig> = {
      success: true,
      data: {
        supportPhone,
        supportWhatsApp,
      },
    };

    return reply.status(200).send(response);
  });
};
