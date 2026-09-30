import { signal } from '@preact/signals';
import { authToken, handleSessionExpired } from './auth';
export const adminActiveTab = signal('dashboard');
export const isAdminLoading = signal(false);
export const adminError = signal(null);
export function setAdminTab(tab) {
    adminActiveTab.value = tab;
}
/**
 * Validates the admin session against GET /api/admin/me.
 * Enforces server-authoritative role verification.
 */
export async function verifyAdminSession() {
    const token = authToken.value;
    if (!token) {
        return false;
    }
    isAdminLoading.value = true;
    adminError.value = null;
    try {
        const res = await fetch('/api/admin/me', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (res.status === 401) {
            handleSessionExpired();
            return false;
        }
        if (res.status === 403) {
            adminError.value = 'ACCESS_DENIED';
            return false;
        }
        if (!res.ok) {
            adminError.value = 'LOAD_ERROR';
            return false;
        }
        const body = await res.json();
        if (!body.success) {
            adminError.value = 'LOAD_ERROR';
            return false;
        }
        return true;
    }
    catch {
        adminError.value = 'NETWORK_ERROR';
        return false;
    }
    finally {
        isAdminLoading.value = false;
    }
}
