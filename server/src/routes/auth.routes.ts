import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthService, AuthError } from '../services/auth.service';
import { PasskeyService } from '../services/passkey.service';
import { authenticate } from '../middleware/auth';
import { ApiResponse, User } from '@shared';


const passkeyRegisterOptionsSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian mobile number'),
  fullName: z.string().min(1).max(100).optional(),
  preferredLanguage: z.enum(['en', 'hi']).optional(),
});

const passkeyRegisterVerifySchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian mobile number'),
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string(),
    }),
    type: z.string(),
  }).passthrough(),
  fullName: z.string().min(1).max(100).optional(),
  preferredLanguage: z.enum(['en', 'hi']).optional(),
  friendlyName: z.string().max(100).optional(),
});

const passkeyLoginOptionsSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian mobile number').optional(),
}).optional();

const passkeyLoginVerifySchema = z.object({
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      authenticatorData: z.string(),
      signature: z.string(),
    }),
    type: z.string(),
  }).passthrough(),
});

const authRateLimits = new Map<string, number[]>();

export function checkAuthOptionsRateLimit(
  ip: string,
  limit: number = process.env.NODE_ENV === 'test' ? 1000 : 30,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const timestamps = (authRateLimits.get(ip) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    return false;
  }
  timestamps.push(now);
  authRateLimits.set(ip, timestamps);
  return true;
}

export function resetAuthRateLimits(): void {
  authRateLimits.clear();
}

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const authService = new AuthService();
  const passkeyService = new PasskeyService();



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

  // 5. Passkey — Registration Options
  app.post('/passkey/register-options', async (request, reply) => {
    try {
      const ip = request.ip || '127.0.0.1';
      if (!checkAuthOptionsRateLimit(ip)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            messageEn: 'Too many registration attempts. Please try again later.',
            messageHi: 'अत्यधिक पंजीकरण प्रयास। कृपया थोड़ी देर बाद पुनः प्रयास करें।',
          },
        };
        return reply.status(429).send(response);
      }

      const parsed = passkeyRegisterOptionsSchema.safeParse(request.body);
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

      const { phone, fullName, preferredLanguage } = parsed.data;
      const options = await passkeyService.generateRegistrationOptions(phone, fullName, preferredLanguage);

      const response: ApiResponse<typeof options> = {
        success: true,
        data: options,
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      if (err instanceof AuthError) {
        const response: ApiResponse = {
          success: false,
          error: { code: err.code, messageEn: err.messageEn, messageHi: err.messageHi },
        };
        return reply.status(err.statusCode).send(response);
      }
      throw err;
    }
  });

  // 6. Passkey — Registration Verify
  app.post('/passkey/register-verify', async (request, reply) => {
    try {
      const parsed = passkeyRegisterVerifySchema.safeParse(request.body);
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

      const { phone, response: webAuthnResponse, fullName, preferredLanguage, friendlyName } = parsed.data;
      const { user, tokenVersion, isNewUser } = await passkeyService.verifyRegistration(
        phone,
        webAuthnResponse as any,
        fullName,
        preferredLanguage,
        friendlyName
      );

      const token = app.jwt.sign(
        { id: user.id, phone: user.phone, role: user.role, tokenVersion },
        { expiresIn: '30d' }
      );

      const response: ApiResponse<{ token: string; user: User; isNewUser: boolean }> = {
        success: true,
        data: { token, user, isNewUser },
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      if (err instanceof AuthError) {
        const response: ApiResponse = {
          success: false,
          error: { code: err.code, messageEn: err.messageEn, messageHi: err.messageHi },
        };
        return reply.status(err.statusCode).send(response);
      }
      throw err;
    }
  });

  // 7. Passkey — Login Options
  app.post('/passkey/login-options', async (request, reply) => {
    try {
      const ip = request.ip || '127.0.0.1';
      if (!checkAuthOptionsRateLimit(ip)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            messageEn: 'Too many login attempts. Please try again later.',
            messageHi: 'अत्यधिक लॉगिन प्रयास। कृपया थोड़ी देर बाद पुनः प्रयास करें।',
          },
        };
        return reply.status(429).send(response);
      }

      // Accept optional body; an absent or non-object body yields undefined phone
      const bodyParsed = passkeyLoginOptionsSchema
        ? passkeyLoginOptionsSchema.safeParse(request.body ?? {})
        : { success: true as const, data: undefined };

      let phone: string | undefined;
      if (bodyParsed.success && bodyParsed.data) {
        phone = (bodyParsed.data as any)?.phone;
      }

      const options = await passkeyService.generateLoginOptions(phone);

      const response: ApiResponse<typeof options> = {
        success: true,
        data: options,
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      if (err instanceof AuthError) {
        const response: ApiResponse = {
          success: false,
          error: { code: err.code, messageEn: err.messageEn, messageHi: err.messageHi },
        };
        return reply.status(err.statusCode).send(response);
      }
      throw err;
    }
  });

  // 8. Passkey — Login Verify
  app.post('/passkey/login-verify', async (request, reply) => {
    try {
      const parsed = passkeyLoginVerifySchema.safeParse(request.body);
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

      const { user, tokenVersion } = await passkeyService.verifyLogin(parsed.data.response as any);

      const token = app.jwt.sign(
        { id: user.id, phone: user.phone, role: user.role, tokenVersion },
        { expiresIn: '30d' }
      );

      const response: ApiResponse<{ token: string; user: User }> = {
        success: true,
        data: { token, user },
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      if (err instanceof AuthError) {
        const response: ApiResponse = {
          success: false,
          error: { code: err.code, messageEn: err.messageEn, messageHi: err.messageHi },
        };
        return reply.status(err.statusCode).send(response);
      }
      throw err;
    }
  });
};
