import { signal, computed } from '@preact/signals';
import { currentLanguage, selectLanguage } from './language';
const TOKEN_KEY = 'chandil_token';
const USER_KEY = 'chandil_user';
function getInitialToken() {
    try {
        return localStorage.getItem(TOKEN_KEY);
    }
    catch {
        return null;
    }
}
function getInitialUser() {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
export const authToken = signal(getInitialToken());
export const currentUser = signal(getInitialUser());
export const isAuthenticated = computed(() => !!authToken.value && !!currentUser.value);
export const authStep = signal('phone');
export const phoneInput = signal('');
export const otpInput = signal('');
export const authLoading = signal(false);
export const authError = signal(null);
export const mockOtpHint = signal(null);
export const resendCooldown = signal(0);
let cooldownTimer = null;
function startCooldown(seconds) {
    resendCooldown.value = seconds;
    if (cooldownTimer)
        clearInterval(cooldownTimer);
    cooldownTimer = window.setInterval(() => {
        if (resendCooldown.value <= 1) {
            resendCooldown.value = 0;
            if (cooldownTimer)
                clearInterval(cooldownTimer);
        }
        else {
            resendCooldown.value -= 1;
        }
    }, 1000);
}
export async function requestOtp(targetPhone) {
    const phone = (targetPhone || phoneInput.value).trim();
    if (!/^[6-9]\d{9}$/.test(phone)) {
        authError.value = currentLanguage.value === 'hi'
            ? 'कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।'
            : 'Please enter a valid 10-digit mobile number.';
        return false;
    }
    authLoading.value = true;
    authError.value = null;
    try {
        const res = await fetch('/api/auth/request-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
        });
        const body = await res.json();
        if (!res.ok || !body.success) {
            authError.value = currentLanguage.value === 'hi'
                ? (body.error?.messageHi || 'OTP भेजने में विफल। कृपया पुनः प्रयास करें।')
                : (body.error?.messageEn || 'Failed to send OTP. Please try again.');
            return false;
        }
        authStep.value = 'otp';
        otpInput.value = '';
        mockOtpHint.value = body.data?.mockOtp || '1234';
        startCooldown(body.data?.cooldownSeconds || 60);
        return true;
    }
    catch {
        authError.value = currentLanguage.value === 'hi'
            ? 'इंटरनेट धीमा है। कृपया कनेक्शन जांचें।'
            : 'Weak network. Please check your connection.';
        return false;
    }
    finally {
        authLoading.value = false;
    }
}
export async function verifyOtp() {
    const phone = phoneInput.value.trim();
    const otp = otpInput.value.trim();
    if (otp.length !== 4) {
        authError.value = currentLanguage.value === 'hi'
            ? 'कृपया 4 अंकों का OTP डालें।'
            : 'Please enter the 4-digit OTP.';
        return false;
    }
    authLoading.value = true;
    authError.value = null;
    try {
        const res = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone,
                otp,
                preferredLanguage: currentLanguage.value || 'hi',
            }),
        });
        const body = await res.json();
        if (!res.ok || !body.success || !body.data) {
            authError.value = currentLanguage.value === 'hi'
                ? (body.error?.messageHi || 'गलत OTP है। कृपया पुनः प्रयास करें।')
                : (body.error?.messageEn || 'Incorrect OTP. Please try again.');
            return false;
        }
        const { token, user } = body.data;
        authToken.value = token;
        currentUser.value = user;
        try {
            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        }
        catch {
            // Ignore localStorage quotas
        }
        if (user.preferredLanguage && user.preferredLanguage !== currentLanguage.value) {
            selectLanguage(user.preferredLanguage);
        }
        authStep.value = 'phone';
        phoneInput.value = '';
        otpInput.value = '';
        mockOtpHint.value = null;
        return true;
    }
    catch {
        authError.value = currentLanguage.value === 'hi'
            ? 'इंटरनेट धीमा है। कृपया कनेक्शन जांचें।'
            : 'Weak network. Please check your connection.';
        return false;
    }
    finally {
        authLoading.value = false;
    }
}
export async function logout() {
    const token = authToken.value;
    authToken.value = null;
    currentUser.value = null;
    authStep.value = 'phone';
    phoneInput.value = '';
    otpInput.value = '';
    mockOtpHint.value = null;
    authError.value = null;
    try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }
    catch {
        // Ignore localStorage errors
    }
    if (token) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });
        }
        catch {
            // Best-effort logout notification
        }
    }
}
export function handleSessionExpired() {
    authToken.value = null;
    currentUser.value = null;
    try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }
    catch {
        // Ignore localStorage errors
    }
    authStep.value = 'phone';
    authError.value = currentLanguage.value === 'hi'
        ? 'सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।'
        : 'Session expired. Please log in again.';
}
