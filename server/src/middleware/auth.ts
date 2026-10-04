import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole, ApiResponse, User } from '@shared';
import { AuthService } from '../services/auth.service';

export interface JwtPayload {
  id: string;
  phone: string;
  role: UserRole;
  tokenVersion: number;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    userProfile?: User;
  }
}

const authService = new AuthService();

/**
 * Validates JWT Bearer token and verifies active session in database.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          messageEn: 'Authentication required. Missing Bearer token.',
          messageHi: 'लॉगिन आवश्यक है। टोकन अनुपलब्ध है।',
        },
      };
      return reply.status(401).send(response);
    }

    // 1. Verify JWT signature & expiration
    const decoded = await request.jwtVerify<JwtPayload>();

    // 2. Verify active session against DB (token_version revocation check)
    const activeUser = await authService.validateSession(decoded.id, decoded.tokenVersion);
    if (!activeUser) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          messageEn: 'Session expired or invalidated. Please log in again.',
          messageHi: 'सत्र समाप्त या अमान्य हो गया है। कृपया पुनः लॉगिन करें।',
        },
      };
      return reply.status(401).send(response);
    }

    request.user = {
      ...decoded,
      role: activeUser.role,
      phone: activeUser.phone,
    };
    request.userProfile = activeUser;
  } catch (err: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        messageEn: 'Invalid or malformed authentication token.',
        messageHi: 'अमान्य प्रमाणीकरण टोकन।',
      },
    };
    return reply.status(401).send(response);
  }
}

/**
 * Server-side Role-Based Access Control (RBAC) guard.
 * Rejects unauthorized roles with HTTP 403 Forbidden.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Ensure authentication ran first
    if (!request.user) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          messageEn: 'Authentication required.',
          messageHi: 'लॉगिन आवश्यक है।',
        },
      };
      return reply.status(401).send(response);
    }

    if (!allowedRoles.includes(request.user.role)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          messageEn: `Access denied. Your role (${request.user.role}) is not authorized for this resource.`,
          messageHi: 'पहुँच अस्वीकृत। आपकी भूमिका इस संसाधन के लिए अधिकृत नहीं है।',
        },
      };
      return reply.status(403).send(response);
    }
  };
}
