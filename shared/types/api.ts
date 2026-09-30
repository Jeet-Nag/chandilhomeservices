export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    messageEn: string;
    messageHi: string;
    details?: unknown;
  };
}

export type ApiErrorCode =
  | 'INVALID_PHONE'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DUPLICATE_IDEMPOTENCY_KEY'
  | 'INVALID_STATUS_TRANSITION'
  | 'JOB_ALREADY_CLAIMED'
  | 'JOB_NO_LONGER_ASSIGNED'
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR';
