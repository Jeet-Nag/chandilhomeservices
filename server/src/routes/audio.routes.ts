import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import { db } from '../db';
import { authenticate } from '../middleware/auth';
import { audioService } from '../services/audio.service';
import { ApiResponse } from '@shared';

export const audioRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/audio/:filename
   * Securely streams an audio recording.
   * Authorization:
   * 1. Requires valid Bearer JWT authentication.
   * 2. Resolves owning booking from database.
   * 3. Customer: only the customer who owns the booking.
   * 4. Provider: only the provider assigned to that booking.
   * 5. Admin: operational access permitted.
   * 6. Preserves HTTP range requests, MIME types, and streaming.
   */
  app.get<{ Params: { filename: string } }>(
    '/:filename',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { filename } = request.params;

      // 1. Path traversal and filename safety check
      const filePath = audioService.getAudioFilePath(filename);
      if (!filePath) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'AUDIO_NOT_FOUND',
            messageEn: 'Audio file not found.',
            messageHi: 'ऑडियो फ़ाइल नहीं मिली।',
          },
        };
        return reply.status(404).send(response);
      }

      // 2. Resolve owning booking in database
      const pool = db.getPool();
      if (!pool) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'DATABASE_UNAVAILABLE',
            messageEn: 'Database connection is unavailable.',
            messageHi: 'डेटाबेस कनेक्शन अनुपलब्ध है।',
          },
        };
        return reply.status(500).send(response);
      }

      const bookingQuery = `
        SELECT id, customer_id, provider_id, status
        FROM bookings
        WHERE audio_url = $1 OR audio_url = $2 OR audio_url LIKE '%' || $3
        LIMIT 1
      `;
      const { rows: bookings } = await pool.query<{
        id: string;
        customer_id: string;
        provider_id: string | null;
        status: string;
      }>(bookingQuery, [`/api/audio/${filename}`, filename, filename]);

      if (bookings.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'AUDIO_NOT_FOUND',
            messageEn: 'Audio file not found.',
            messageHi: 'ऑडियो फ़ाइल नहीं मिली।',
          },
        };
        return reply.status(404).send(response);
      }

      const booking = bookings[0];
      const user = request.user;

      // 3. Ownership / Role Authorization
      if (user.role === 'admin') {
        // Admin operational access permitted
      } else if (user.role === 'customer') {
        if (booking.customer_id !== user.id) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'FORBIDDEN',
              messageEn: 'Access denied. You do not own this booking audio.',
              messageHi: 'पहुँच अस्वीकृत। आप इस बुकिंग ऑडियो के स्वामी नहीं हैं।',
            },
          };
          return reply.status(403).send(response);
        }
      } else if (user.role === 'provider') {
        if (!booking.provider_id || booking.provider_id !== user.id) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'FORBIDDEN',
              messageEn: 'Access denied. You are not assigned to this booking.',
              messageHi: 'पहुँच अस्वीकृत। आप इस बुकिंग के लिए नियत नहीं हैं।',
            },
          };
          return reply.status(403).send(response);
        }
      } else {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            messageEn: 'Access denied.',
            messageHi: 'पहुँच अस्वीकृत।',
          },
        };
        return reply.status(403).send(response);
      }

      // 4. Content Type & Headers
      let contentType = 'audio/webm';
      if (filename.endsWith('.wav')) contentType = 'audio/wav';
      else if (filename.endsWith('.ogg')) contentType = 'audio/ogg';
      else if (filename.endsWith('.mp4')) contentType = 'audio/mp4';

      const stat = fs.statSync(filePath);
      const range = request.headers.range;

      reply.header('Content-Type', contentType);
      reply.header('Accept-Ranges', 'bytes');

      // 5. HTTP Range Request Handling (206 Partial Content)
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

        if (isNaN(start) || start >= stat.size || end >= stat.size || start > end) {
          reply.header('Content-Range', `bytes */${stat.size}`);
          return reply.status(416).send();
        }

        const chunksize = end - start + 1;
        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        reply.header('Content-Length', chunksize);
        return reply.send(fs.createReadStream(filePath, { start, end }));
      }

      reply.header('Content-Length', stat.size);
      return reply.send(fs.createReadStream(filePath));
    }
  );
};
