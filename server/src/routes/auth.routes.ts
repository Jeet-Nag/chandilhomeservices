import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthService, AuthError } from '../services/auth.service';
import { authenticate } from '../middleware/auth';
import { ApiResponse, User } from '@shared';

const requestOtpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian mobile number'),
});

const verifyOtpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian mobile number'),
  otp: z.string().length(4, 'OTP must be exactly 4 digits'),
  preferredLanguage: z.enum(['en', 'hi']).optional(),
});

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const authService = new AuthService();

  // 1. Request OTP
  app.post('/request-otp', async (request, reply) => {
    try {
      const parsed = requestOtpSchema.safeParse(request.body);
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

      const result = await authService.requestOtp(parsed.data.phone);

      const response: ApiResponse<{ cooldownSeconds: number }> = {
        success: true,
        data: {
          cooldownSeconds: result.cooldownSeconds,
        },
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      if (err instanceof AuthError) {
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
  });

  // 2. Verify OTP & Generate Session
  app.post('/verify-otp', async (request, reply) => {
    try {
      const parsed = verifyOtpSchema.safeParse(request.body);
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

      const { phone, otp, preferredLanguage } = parsed.data;
      const { user, tokenVersion, isNewUser } = await authService.verifyOtp(phone, otp, preferredLanguage);

      // Sign JWT with 30-day lifetime for mobile users
      const token = app.jwt.sign(
        {
          id: user.id,
          phone: user.phone,
          role: user.role,
          tokenVersion,
        },
        { expiresIn: '30d' }
      );

      const response: ApiResponse<{ token: string; user: User; isNewUser: boolean }> = {
        success: true,
        data: {
          token,
          user,
          isNewUser,
        },
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      if (err instanceof AuthError) {
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
  });

  // 3. Current Authenticated User Session
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const response: ApiResponse<{ user: User }> = {
      success: true,
      data: {
        user: request.userProfile!,
      },
    };
    return reply.status(200).send(response);
  });

  // 4. Logout (Server-side Session Revocation)
  app.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    await authService.logout(request.user.id);
    const response: ApiResponse<{ messageEn: string; messageHi: string }> = {
      success: true,
      data: {
        messageEn: 'Logged out successfully. Session invalidated.',
        messageHi: 'सफलतापूर्वक लॉगआउट किया गया। सत्र समाप्त हुआ।',
      },
    };
    return reply.status(200).send(response);
  });
};
