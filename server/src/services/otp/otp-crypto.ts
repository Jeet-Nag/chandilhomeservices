import crypto from 'crypto';
import { env } from '../../config/env';

export interface GeneratedOtp {
  otp: string;
  salt: string;
  hash: string;
}

export class OtpCrypto {
  /**
   * Generates a 4-digit OTP, a cryptographic salt, and the SHA-256 hash.
   */
  public static generate(forceMock?: boolean): GeneratedOtp {
    let otp: string;

    if (env.NODE_ENV !== 'production' && (forceMock || Boolean(env.DEV_MOCK_OTP))) {
      otp = env.DEV_MOCK_OTP;
    } else {
      // Cryptographically secure random 4-digit integer (1000 to 9999)
      otp = crypto.randomInt(1000, 10000).toString();
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashOtp(otp, salt);

    return { otp, salt, hash };
  }

  /**
   * Hashes the OTP combined with salt using SHA-256.
   */
  public static hashOtp(otp: string, salt: string): string {
    return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
  }

  /**
   * Constant-time comparison between entered OTP and stored hash to prevent timing attacks.
   */
  public static verify(enteredOtp: string, salt: string, expectedHash: string): boolean {
    const computedHash = this.hashOtp(enteredOtp, salt);
    const computedBuffer = Buffer.from(computedHash, 'utf-8');
    const expectedBuffer = Buffer.from(expectedHash, 'utf-8');

    if (computedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuffer, expectedBuffer);
  }
}
