export type UserRole = 'customer' | 'provider' | 'admin';

export type SupportedLanguage = 'en' | 'hi';

export interface User {
  id: string;
  phone: string;
  role: UserRole;
  fullName: string | null;
  preferredLanguage: SupportedLanguage;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderProfile {
  userId: string;
  categoryId: string;
  serviceArea: string;
  isAvailable: boolean;
  rating: number;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: {
    id: string;
    phone: string;
    role: UserRole;
    preferredLanguage: SupportedLanguage;
    fullName: string | null;
  };
}

export interface AdminProviderView {
  id: string;
  phone: string;
  fullName: string | null;
  role: 'provider';
  preferredLanguage: SupportedLanguage;
  isActive: boolean;
  categoryId: string;
  categoryTitleEn: string;
  categoryTitleHi: string;
  serviceArea: string;
  isAvailable: boolean;
  rating: number;
  createdAt: string;
}
