export interface OtpSendResult {
  success: boolean;
  messageId?: string;
  provider: string;
}

export interface IOtpProvider {
  readonly providerName: string;
  sendOtp(phone: string, otp: string): Promise<OtpSendResult>;
}
