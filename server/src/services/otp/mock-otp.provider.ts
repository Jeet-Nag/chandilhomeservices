import { IOtpProvider, OtpSendResult } from './otp-provider.interface';
import { env } from '../../config/env';

export class MockOtpProvider implements IOtpProvider {
  public readonly providerName = 'mock-development-provider';

  public async sendOtp(phone: string, _otp: string): Promise<OtpSendResult> {
    if (env.NODE_ENV === 'production') {
      throw new Error('[SECURITY FATAL] MockOtpProvider cannot be used in production environment.');
    }

    // Mask phone for audit log without logging the secret OTP
    const maskedPhone = phone.slice(0, 2) + '******' + phone.slice(-2);
    if (env.NODE_ENV !== 'test') {
      console.log(`[MockOtpProvider] Mock OTP dispatched successfully to phone: ${maskedPhone}`);
    }

    return {
      success: true,
      messageId: `mock-msg-${Date.now()}`,
      provider: this.providerName,
    };
  }
}
