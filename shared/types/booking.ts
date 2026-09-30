export type BookingStatus =
  | 'SERVICE_REQUESTED'
  | 'PROVIDER_ASSIGNED'
  | 'PROVIDER_ACCEPTED'
  | 'PROVIDER_ON_THE_WAY'
  | 'SERVICE_STARTED'
  | 'SERVICE_COMPLETED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_COLLECTED'
  | 'BOOKING_COMPLETED'
  | 'CANCELLED_BY_CUSTOMER'
  | 'REJECTED_BY_PROVIDER'
  | 'CANCELLED_BY_ADMIN';

export type PaymentMethod = 'CASH';

export interface Booking {
  id: string;
  idempotencyKey: string;
  customerId: string;
  providerId: string | null;
  categoryId: string;
  
  // Problem description
  audioUrl: string | null;
  audioDurationSeconds: number | null;
  textDescription: string | null;
  
  // Location
  areaLocality: string;
  landmark: string | null;
  
  // Status and Financials
  status: BookingStatus;
  visitingFee: number;
  finalAmount: number | null;
  paymentMethod: PaymentMethod;
  paymentCollected: boolean;
  
  // Timestamps
  createdAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface CreateBookingRequest {
  idempotencyKey: string;
  categoryId: string;
  areaLocality: string;
  landmark?: string;
  textDescription?: string;
  audioBase64?: string;
  audioUrl?: string;
  audioDurationSeconds?: number;
}

export interface UpdateBookingStatusRequest {
  status: BookingStatus;
  finalAmount?: number;
  notes?: string;
}

export interface BookingStatusLog {
  id: string;
  bookingId: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  changedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface BookingDetail extends Booking {
  statusLogs?: BookingStatusLog[];
  provider?: {
    name: string;
  } | null;
}

export interface ProviderJob {
  id: string;
  categoryId: string;
  areaLocality: string;
  landmark: string | null;
  textDescription: string | null;
  audioUrl: string | null;
  audioDurationSeconds: number | null;
  visitingFee: number;
  status: BookingStatus;
  createdAt: string;
}

