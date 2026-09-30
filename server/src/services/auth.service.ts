import { db } from '../db';
import { IOtpProvider } from './otp/otp-provider.interface';
import { MockOtpProvider } from './otp/mock-otp.provider';
import { OtpCrypto } from './otp/otp-crypto';
import { User, UserRole, SupportedLanguage } from '@shared';

export interface RequestOtpResult {
  success: boolean;
  cooldownSeconds: number;
  messageEn: string;
  messageHi: string;
}

export interface VerifyOtpResult {
  user: User;
  tokenVersion: number;
  isNewUser: boolean;
}

export class AuthService {
  private otpProvider: IOtpProvider;

  constructor(otpProvider?: IOtpProvider) {
    this.otpProvider = otpProvider || new MockOtpProvider();
  }

  /**
   * Request a new OTP with rate limiting and cooldown checks.
   */
  public async requestOtp(phone: string, forceMock?: boolean): Promise<RequestOtpResult> {
    // 1. Phone number validation (Indian 10-digit mobile)
    if (!/^[6-9]\d{9}$/.test(phone)) {
      throw new AuthError(
        'INVALID_PHONE',
        'Please enter a valid 10-digit Indian mobile number.',
        'कृपया 10 अंकों का मान्य भारतीय मोबाइल नंबर दर्ज करें।'
      );
    }

    const pool = db.getPool();
    if (!pool) {
      throw new Error('Database pool is not available.');
    }

    // 2. Cooldown check: Has an OTP been requested in the last 60 seconds?
    const { rows: recentRequests } = await pool.query<{ created_at: Date }>(
      `SELECT created_at FROM otp_requests 
       WHERE phone = $1 AND created_at > NOW() - INTERVAL '60 seconds' 
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (recentRequests.length > 0) {
      throw new AuthError(
        'RATE_LIMIT_EXCEEDED',
        'Please wait 60 seconds before requesting another OTP.',
        'कृपया नया OTP माँगने से पहले 60 सेकंड प्रतीक्षा करें।'
      );
    }

    // 3. Flood protection: Max 5 OTP requests per hour per phone
    const { rows: hourlyCount } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM otp_requests 
       WHERE phone = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [phone]
    );

    if (parseInt(hourlyCount[0].count, 10) >= 5) {
      throw new AuthError(
        'RATE_LIMIT_EXCEEDED',
        'Too many OTP requests for this number. Please try again after 1 hour.',
        'इस नंबर के लिए बहुत अधिक OTP अनुरोध। कृपया 1 घंटे बाद पुनः प्रयास करें।'
      );
    }

    // 4. Generate cryptographically secure OTP and hash
    const generated = OtpCrypto.generate(forceMock);

    // 5. Store hashed OTP in database with 5-minute expiry (NEVER store plaintext)
    await pool.query(
      `INSERT INTO otp_requests (phone, otp_hash, salt, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')`,
      [phone, generated.hash, generated.salt]
    );

    // 6. Dispatch OTP through provider abstraction
    await this.otpProvider.sendOtp(phone, generated.otp);

    return {
      success: true,
      cooldownSeconds: 60,
      messageEn: 'OTP sent successfully.',
      messageHi: 'OTP सफलतापूर्वक भेजा गया।',
    };
  }

  /**
   * Verify an OTP and retrieve or create the user account.
   */
  public async verifyOtp(
    phone: string,
    enteredOtp: string,
    preferredLanguage?: SupportedLanguage
  ): Promise<VerifyOtpResult> {
    const pool = db.getPool();
    if (!pool) {
      throw new Error('Database pool is not available.');
    }

    // 1. Fetch latest non-consumed OTP request for this phone
    const { rows: requests } = await pool.query<{
      id: string;
      otp_hash: string;
      salt: string;
      attempts: number;
      max_attempts: number;
      expires_at: Date;
    }>(
      `SELECT id, otp_hash, salt, attempts, max_attempts, expires_at 
       FROM otp_requests 
       WHERE phone = $1 AND consumed_at IS NULL 
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (requests.length === 0) {
      throw new AuthError(
        'INVALID_OTP',
        'No active OTP found. Please request a new OTP.',
        'कोई सक्रिय OTP नहीं मिला। कृपया नया OTP प्राप्त करें।'
      );
    }

    const currentReq = requests[0];

    // 2. Check expiration
    if (new Date() > new Date(currentReq.expires_at)) {
      throw new AuthError(
        'OTP_EXPIRED',
        'This OTP has expired. Please request a new code.',
        'यह OTP समाप्त (expire) हो चुका है। कृपया नया कोड प्राप्त करें।'
      );
    }

    // 3. Check attempt limit lockout
    if (currentReq.attempts >= currentReq.max_attempts) {
      throw new AuthError(
        'MAX_ATTEMPTS_EXCEEDED',
        'Maximum verification attempts exceeded. Please request a new OTP.',
        'अधिकतम सत्यापन प्रयास पार हो गए। कृपया नया OTP प्राप्त करें।'
      );
    }

    // 4. Constant-time cryptographic verification
    const isValid = OtpCrypto.verify(enteredOtp, currentReq.salt, currentReq.otp_hash);

    if (!isValid) {
      const newAttempts = currentReq.attempts + 1;
      await pool.query('UPDATE otp_requests SET attempts = $1 WHERE id = $2', [newAttempts, currentReq.id]);

      const remaining = currentReq.max_attempts - newAttempts;
      if (remaining <= 0) {
        throw new AuthError(
          'MAX_ATTEMPTS_EXCEEDED',
          'Maximum verification attempts exceeded. This OTP is now invalid.',
          'अधिकतम सत्यापन प्रयास पार हो गए। यह OTP अब अमान्य है।'
        );
      }

      throw new AuthError(
        'INVALID_OTP',
        `Incorrect OTP. ${remaining} attempt(s) remaining.`,
        `गलत OTP है। ${remaining} प्रयास शेष हैं।`
      );
    }

    // 5. Mark OTP as consumed
    await pool.query('UPDATE otp_requests SET consumed_at = NOW() WHERE id = $1', [currentReq.id]);

    // 6. User Lookup or Account Provisioning
    const { rows: existingUsers } = await pool.query<User & { token_version: number; is_active: boolean }>(
      `SELECT id, phone, role, full_name as "fullName", preferred_language as "preferredLanguage", 
              is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt", token_version
       FROM users WHERE phone = $1`,
      [phone]
    );

    let user: User;
    let tokenVersion: number;
    let isNewUser = false;

    if (existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (!existing.isActive) {
        throw new AuthError(
          'ACCOUNT_DEACTIVATED',
          'Your account has been deactivated. Please contact support.',
          'आपका खाता निष्क्रिय कर दिया गया है। कृपया सहायता से संपर्क करें।'
        );
      }

      // Update preferred language if provided and changed
      if (preferredLanguage && preferredLanguage !== existing.preferredLanguage) {
        await pool.query('UPDATE users SET preferred_language = $1, updated_at = NOW() WHERE id = $2', [
          preferredLanguage,
          existing.id,
        ]);
        existing.preferredLanguage = preferredLanguage;
      }

      user = existing;
      tokenVersion = existing.token_version;
    } else {
      // 7. Security Guarantee: New public users are strictly created with role 'customer'
      const lang = preferredLanguage || 'hi';
      const { rows: newUsers } = await pool.query<User & { token_version: number }>(
        `INSERT INTO users (phone, role, preferred_language)
         VALUES ($1, 'customer', $2)
         RETURNING id, phone, role, full_name as "fullName", preferred_language as "preferredLanguage", 
                   is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt", token_version`,
        [phone, lang]
      );
      user = newUsers[0];
      tokenVersion = newUsers[0].token_version;
      isNewUser = true;
    }

    return { user, tokenVersion, isNewUser };
  }

  /**
   * Log out a user by incrementing their token_version in the database,
   * immediately invalidating all active sessions.
   */
  public async logout(userId: string): Promise<void> {
    const pool = db.getPool();
    if (!pool) return;

    await pool.query('UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1', [userId]);
  }

  /**
   * Validates a session from a decoded JWT payload against live DB record.
   */
  public async validateSession(userId: string, tokenVersion: number): Promise<User | null> {
    const pool = db.getPool();
    if (!pool) return null;

    const { rows } = await pool.query<User & { token_version: number; is_active: boolean }>(
      `SELECT id, phone, role, full_name as "fullName", preferred_language as "preferredLanguage", 
              is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt", token_version
       FROM users WHERE id = $1`,
      [userId]
    );

    if (rows.length === 0) return null;

    const user = rows[0];
    if (!user.isActive || user.token_version !== tokenVersion) {
      return null;
    }

    return user;
  }
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageEn: string,
    public readonly messageHi: string,
    public readonly statusCode: number = 400
  ) {
    super(messageEn);
    this.name = 'AuthError';
  }
}
