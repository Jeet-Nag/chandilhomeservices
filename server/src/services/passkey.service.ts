import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { db } from '../db';
import { env, getExpectedOrigins } from '../config/env';
import { AuthError } from './auth.service';
import { User, SupportedLanguage } from '@shared';

export interface PasskeyRegistrationResult {
  user: User;
  tokenVersion: number;
  isNewUser: boolean;
}

export interface PasskeyLoginResult {
  user: User;
  tokenVersion: number;
}

export class PasskeyService {
  /**
   * 1. Generate WebAuthn Registration Options
   */
  public async generateRegistrationOptions(
    phone: string,
    fullName?: string,
    preferredLanguage?: SupportedLanguage
  ): Promise<any> {
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

    // Check if user already exists
    const { rows: existingUsers } = await pool.query<{
      id: string;
      phone: string;
      role: string;
      full_name: string | null;
      is_active: boolean;
    }>('SELECT id, phone, role, full_name, is_active FROM users WHERE phone = $1', [phone]);

    let existingUserId: string | null = null;
    let userDisplayName = fullName || phone;
    let existingCredentials: { credential_id: string; transports: string[] }[] = [];

    if (existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (!existing.is_active) {
        throw new AuthError(
          'ACCOUNT_DEACTIVATED',
          'Your account has been deactivated. Please contact support.',
          'आपका खाता निष्क्रिय कर दिया गया है। कृपया सहायता से संपर्क करें।',
          403
        );
      }
      existingUserId = existing.id;
      userDisplayName = existing.full_name || fullName || phone;

      // Fetch existing credentials to exclude re-registration of the exact same key
      const { rows: credRows } = await pool.query<{ credential_id: string; transports: string[] }>(
        'SELECT credential_id, transports FROM user_credentials WHERE user_id = $1',
        [existing.id]
      );
      existingCredentials = credRows;
    }

    // Generate user ID buffer (random 16 bytes or deterministic from existing user ID)
    const userIdBuffer = existingUserId
      ? Buffer.from(existingUserId.replace(/-/g, ''), 'hex')
      : Buffer.from(phone + '-' + Date.now());

    const options = await generateRegistrationOptions({
      rpName: env.RP_NAME,
      rpID: env.RP_ID,
      userName: phone,
      userID: userIdBuffer,
      userDisplayName,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: existingCredentials.map((c) => ({
        id: c.credential_id,
        transports: c.transports || ['internal'],
      })),
    });

    // Store challenge with 5-minute TTL
    await pool.query(
      `INSERT INTO webauthn_challenges (challenge, user_id, phone, flow_type, expires_at)
       VALUES ($1, $2, $3, 'registration', NOW() + INTERVAL '5 minutes')`,
      [options.challenge, existingUserId, phone]
    );

    // Opportunistically purge expired challenges to prevent table bloat
    pool.query("DELETE FROM webauthn_challenges WHERE expires_at < NOW() - INTERVAL '1 hour'").catch(() => {});

    return options;
  }

  /**
   * 2. Verify WebAuthn Registration Response and provision user / credential
   */
  public async verifyRegistration(
    phone: string,
    response: RegistrationResponseJSON,
    fullName?: string,
    preferredLanguage?: SupportedLanguage,
    friendlyName?: string
  ): Promise<PasskeyRegistrationResult> {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      throw new AuthError(
        'INVALID_PHONE',
        'Please enter a valid 10-digit Indian mobile number.',
        'कृपया 10 अंकों का मान्य भारतीय मोबाइल नंबर दर्ज करें।'
      );
    }

    if (!response || !response.response || !response.response.clientDataJSON) {
      throw new AuthError(
        'MALFORMED_RESPONSE',
        'Missing WebAuthn registration response payload.',
        'अमान्य या अधूरा पंजीकरण डेटा।',
        400
      );
    }

    const pool = db.getPool();
    if (!pool) {
      throw new Error('Database pool is not available.');
    }

    // Parse challenge from clientDataJSON
    let clientChallenge: string;
    try {
      const clientDataRaw = Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8');
      const clientData = JSON.parse(clientDataRaw);
      clientChallenge = clientData.challenge;
    } catch {
      throw new AuthError(
        'MALFORMED_RESPONSE',
        'Invalid clientDataJSON in registration response.',
        'अमान्य पंजीकरण प्रतिक्रिया डेटा।',
        400
      );
    }

    if (!clientChallenge) {
      throw new AuthError(
        'MALFORMED_RESPONSE',
        'Challenge missing in clientDataJSON.',
        'पंजीकरण डेटा में चुनौती अनुपलब्ध है।',
        400
      );
    }

    // Look up challenge
    const { rows: chalRows } = await pool.query<{
      id: string;
      challenge: string;
      user_id: string | null;
      phone: string | null;
      flow_type: string;
      expires_at: Date;
      consumed_at: Date | null;
    }>('SELECT id, challenge, user_id, phone, flow_type, expires_at, consumed_at FROM webauthn_challenges WHERE challenge = $1', [
      clientChallenge,
    ]);

    if (chalRows.length === 0) {
      throw new AuthError(
        'CHALLENGE_NOT_FOUND',
        'Registration challenge not found or invalid.',
        'पंजीकरण चुनौती नहीं मिली या अमान्य है।',
        400
      );
    }

    const chal = chalRows[0];

    if (chal.flow_type !== 'registration') {
      throw new AuthError(
        'INVALID_CHALLENGE_FLOW',
        'Challenge was not issued for registration.',
        'यह चुनौती पंजीकरण के लिए जारी नहीं की गई थी।',
        400
      );
    }

    if (chal.consumed_at !== null) {
      throw new AuthError(
        'CHALLENGE_REUSED',
        'Registration challenge has already been used.',
        'यह पंजीकरण चुनौती पहले ही उपयोग की जा चुकी है।',
        400
      );
    }

    if (new Date() > new Date(chal.expires_at)) {
      throw new AuthError(
        'CHALLENGE_EXPIRED',
        'Registration challenge has expired. Please try again.',
        'पंजीकरण चुनौती समाप्त हो चुकी है। कृपया पुनः प्रयास करें।',
        400
      );
    }

    if (chal.phone && chal.phone !== phone) {
      throw new AuthError(
        'PHONE_MISMATCH',
        'Phone number does not match registration session.',
        'फोन नंबर पंजीकरण सत्र से मेल नहीं खाता।',
        400
      );
    }

    // Atomically consume challenge
    const { rowCount } = await pool.query(
      'UPDATE webauthn_challenges SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL',
      [chal.id]
    );

    if (rowCount === 0) {
      throw new AuthError(
        'CHALLENGE_REUSED',
        'Registration challenge has already been used.',
        'यह पंजीकरण चुनौती पहले ही उपयोग की जा चुकी है।',
        400
      );
    }

    // Verify registration response with @simplewebauthn/server
    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: chal.challenge,
        expectedOrigin: getExpectedOrigins(),
        expectedRPID: env.RP_ID,
        requireUserVerification: false,
      });
    } catch (err: any) {
      throw new AuthError(
        'REGISTRATION_VERIFICATION_FAILED',
        err?.message || 'Passkey registration verification failed.',
        'पासकी पंजीकरण सत्यापन विफल रहा।',
        400
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new AuthError(
        'REGISTRATION_VERIFICATION_FAILED',
        'Passkey registration could not be verified.',
        'पासकी पंजीकरण सत्यापित नहीं हो सका।',
        400
      );
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // Check duplicate credential ID
    const { rows: dupCreds } = await pool.query<{ id: string }>(
      'SELECT id FROM user_credentials WHERE credential_id = $1',
      [credential.id]
    );

    if (dupCreds.length > 0) {
      throw new AuthError(
        'DUPLICATE_CREDENTIAL',
        'This passkey credential is already registered.',
        'यह पासकी पहले से पंजीकृत है।',
        409
      );
    }

    // Resolve or provision user
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
          'आपका खाता निष्क्रिय कर दिया गया है। कृपया सहायता से संपर्क करें।',
          403
        );
      }

      // Update full name or preferred language if provided
      if (fullName && !existing.fullName) {
        await pool.query('UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2', [fullName, existing.id]);
        existing.fullName = fullName;
      }
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
      // SECURITY INVARIANT: Public registration strictly assigns role 'customer'
      const lang = preferredLanguage || 'hi';
      const name = fullName || null;
      const { rows: newUsers } = await pool.query<User & { token_version: number }>(
        `INSERT INTO users (phone, role, preferred_language, full_name, token_version)
         VALUES ($1, 'customer', $2, $3, 1)
         RETURNING id, phone, role, full_name as "fullName", preferred_language as "preferredLanguage", 
                   is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt", token_version`,
        [phone, lang, name]
      );
      user = newUsers[0];
      tokenVersion = newUsers[0].token_version;
      isNewUser = true;
    }

    // Insert public key credential
    await pool.query(
      `INSERT INTO user_credentials (
        user_id, credential_id, public_key, counter, device_type, backed_up, transports, friendly_name
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user.id,
        credential.id,
        Buffer.from(credential.publicKey),
        credential.counter,
        credentialDeviceType,
        credentialBackedUp,
        credential.transports || ['internal'],
        friendlyName || null,
      ]
    );

    return { user, tokenVersion, isNewUser };
  }

  /**
   * 3. Generate WebAuthn Login Options (supports discoverable passkeys)
   */
  public async generateLoginOptions(phone?: string): Promise<any> {
    const pool = db.getPool();
    if (!pool) {
      throw new Error('Database pool is not available.');
    }

    let allowCredentials: { id: string; transports: string[] }[] | undefined = undefined;
    let matchedUserId: string | null = null;
    const cleanPhone = phone?.trim();

    if (cleanPhone && /^[6-9]\d{9}$/.test(cleanPhone)) {
      const { rows: users } = await pool.query<{ id: string; is_active: boolean }>(
        'SELECT id, is_active FROM users WHERE phone = $1',
        [cleanPhone]
      );

      if (users.length > 0 && users[0].is_active) {
        matchedUserId = users[0].id;
        const { rows: credRows } = await pool.query<{ credential_id: string; transports: string[] }>(
          'SELECT credential_id, transports FROM user_credentials WHERE user_id = $1',
          [matchedUserId]
        );
        if (credRows.length > 0) {
          allowCredentials = credRows.map((c) => ({
            id: c.credential_id,
            transports: c.transports || ['internal'],
          }));
        }
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: env.RP_ID,
      allowCredentials,
      userVerification: 'preferred',
    });

    // Store challenge with 5-minute TTL
    await pool.query(
      `INSERT INTO webauthn_challenges (challenge, user_id, phone, flow_type, expires_at)
       VALUES ($1, $2, $3, 'login', NOW() + INTERVAL '5 minutes')`,
      [options.challenge, matchedUserId, cleanPhone || null]
    );

    // Opportunistically purge expired challenges to prevent table bloat
    pool.query("DELETE FROM webauthn_challenges WHERE expires_at < NOW() - INTERVAL '1 hour'").catch(() => {});

    return options;
  }

  /**
   * 4. Verify WebAuthn Login Assertion Response
   */
  public async verifyLogin(response: AuthenticationResponseJSON): Promise<PasskeyLoginResult> {
    if (!response || !response.response || !response.response.clientDataJSON) {
      throw new AuthError(
        'MALFORMED_RESPONSE',
        'Missing WebAuthn authentication response payload.',
        'अमान्य या अधूरा प्रमाणीकरण डेटा।',
        400
      );
    }

    const pool = db.getPool();
    if (!pool) {
      throw new Error('Database pool is not available.');
    }

    // Parse challenge from clientDataJSON
    let clientChallenge: string;
    try {
      const clientDataRaw = Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8');
      const clientData = JSON.parse(clientDataRaw);
      clientChallenge = clientData.challenge;
    } catch {
      throw new AuthError(
        'MALFORMED_RESPONSE',
        'Invalid clientDataJSON in authentication response.',
        'अमान्य प्रमाणीकरण प्रतिक्रिया डेटा।',
        400
      );
    }

    if (!clientChallenge) {
      throw new AuthError(
        'MALFORMED_RESPONSE',
        'Challenge missing in clientDataJSON.',
        'प्रमाणीकरण डेटा में चुनौती अनुपलब्ध है।',
        400
      );
    }

    // Look up challenge
    const { rows: chalRows } = await pool.query<{
      id: string;
      challenge: string;
      flow_type: string;
      expires_at: Date;
      consumed_at: Date | null;
    }>('SELECT id, challenge, flow_type, expires_at, consumed_at FROM webauthn_challenges WHERE challenge = $1', [
      clientChallenge,
    ]);

    if (chalRows.length === 0) {
      throw new AuthError(
        'CHALLENGE_NOT_FOUND',
        'Authentication challenge not found or invalid.',
        'प्रमाणीकरण चुनौती नहीं मिली या अमान्य है।',
        400
      );
    }

    const chal = chalRows[0];

    if (chal.flow_type !== 'login') {
      throw new AuthError(
        'INVALID_CHALLENGE_FLOW',
        'Challenge was not issued for authentication.',
        'यह चुनौती प्रमाणीकरण के लिए जारी नहीं की गई थी।',
        400
      );
    }

    if (chal.consumed_at !== null) {
      throw new AuthError(
        'CHALLENGE_REUSED',
        'Authentication challenge has already been used.',
        'यह प्रमाणीकरण चुनौती पहले ही उपयोग की जा चुकी है।',
        400
      );
    }

    if (new Date() > new Date(chal.expires_at)) {
      throw new AuthError(
        'CHALLENGE_EXPIRED',
        'Authentication challenge has expired. Please try again.',
        'प्रमाणीकरण चुनौती समाप्त हो चुकी है। कृपया पुनः प्रयास करें।',
        400
      );
    }

    // Atomically consume challenge
    const { rowCount } = await pool.query(
      'UPDATE webauthn_challenges SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL',
      [chal.id]
    );

    if (rowCount === 0) {
      throw new AuthError(
        'CHALLENGE_REUSED',
        'Authentication challenge has already been used.',
        'यह प्रमाणीकरण चुनौती पहले ही उपयोग की जा चुकी है।',
        400
      );
    }

    // Look up credential by credential ID
    const { rows: credRows } = await pool.query<{
      id: string;
      user_id: string;
      credential_id: string;
      public_key: Buffer;
      counter: string;
      transports: string[];
    }>('SELECT id, user_id, credential_id, public_key, counter, transports FROM user_credentials WHERE credential_id = $1', [
      response.id,
    ]);

    if (credRows.length === 0) {
      throw new AuthError(
        'CREDENTIAL_NOT_FOUND',
        'Passkey credential is not registered.',
        'यह पासकी पंजीकृत नहीं है।',
        404
      );
    }

    const cred = credRows[0];

    // Look up associated user
    const { rows: userRows } = await pool.query<User & { token_version: number; is_active: boolean }>(
      `SELECT id, phone, role, full_name as "fullName", preferred_language as "preferredLanguage", 
              is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt", token_version
       FROM users WHERE id = $1`,
      [cred.user_id]
    );

    if (userRows.length === 0) {
      throw new AuthError('USER_NOT_FOUND', 'User account not found.', 'उपयोगकर्ता खाता नहीं मिला।', 404);
    }

    const user = userRows[0];

    if (!user.isActive) {
      throw new AuthError(
        'ACCOUNT_DEACTIVATED',
        'Your account has been deactivated. Please contact support.',
        'आपका खाता निष्क्रिय कर दिया गया है। कृपया सहायता से संपर्क करें।',
        403
      );
    }

    // Verify assertion signature with @simplewebauthn/server
    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: chal.challenge,
        expectedOrigin: getExpectedOrigins(),
        expectedRPID: env.RP_ID,
        credential: {
          id: cred.credential_id,
          publicKey: new Uint8Array(cred.public_key),
          counter: Number(cred.counter),
          transports: cred.transports as any,
        },
        requireUserVerification: false,
      });
    } catch (err: any) {
      throw new AuthError(
        'AUTHENTICATION_VERIFICATION_FAILED',
        err?.message || 'Passkey signature verification failed.',
        'पासकी हस्ताक्षर सत्यापन विफल रहा।',
        400
      );
    }

    if (!verification.verified) {
      throw new AuthError(
        'AUTHENTICATION_VERIFICATION_FAILED',
        'Passkey assertion could not be verified.',
        'पासकी सत्यापन विफल रहा।',
        400
      );
    }

    // Update signature counter and last_used_at
    const newCounter = verification.authenticationInfo.newCounter;
    await pool.query('UPDATE user_credentials SET counter = $1, last_used_at = NOW() WHERE id = $2', [
      newCounter,
      cred.id,
    ]);

    return {
      user,
      tokenVersion: user.token_version,
    };
  }
}
