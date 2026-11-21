import { getInstallationId } from './installation';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://routeshare-api.onrender.com/v1').replace(/\/$/, '');

export interface TestPassengerRequest {
  id: string;
  origin: string;
  destination: string;
  originPoint?: { lat: number; lon: number } | null;
  destinationPoint?: { lat: number; lon: number } | null;
  departureStart: string;
  departureEnd: string;
  offeredRateUahPerKm: number;
  status: 'searching' | 'accepted' | 'in_trip' | 'completed';
  driverUserId?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  isMine: boolean;
  acceptedByMe?: boolean;
  userId?: string | null;
}

async function request<T>(path: string, init: RequestInit = {}, profileId?: string): Promise<T> {
  const installationId = profileId || await getInstallationId();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Test-Installation-Id': installationId,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `API error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function listTestPassengerRequests(profileId?: string): Promise<TestPassengerRequest[]> {
  return request<TestPassengerRequest[]>('/test/passenger-requests', {}, profileId);
}

export async function createTestPassengerRequest(input: {
  origin: string;
  destination: string;
  originPoint?: { lat: number; lon: number };
  destinationPoint?: { lat: number; lon: number };
  departureStart: string;
  departureEnd: string;
  offeredRateUahPerKm: number;
}, profileId?: string): Promise<TestPassengerRequest> {
  return request<TestPassengerRequest>('/test/passenger-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  }, profileId);
}

export async function cancelTestPassengerRequest(id: string, profileId?: string): Promise<void> {
  await request<{ id: string; status: string }>(`/test/passenger-requests/${id}`, {
    method: 'DELETE',
  }, profileId);
}

export function registerTestProfile(profile: { id: string; name: string; phone: string }): Promise<{ profileId: string; userId: string }> {
  return request('/test/passenger-requests/profiles', {
    method: 'POST',
    body: JSON.stringify({ name: profile.name, phone: profile.phone }),
  }, profile.id);
}

export function acceptTestPassengerRequest(id: string, driverProfileId: string): Promise<{ id: string; status: string; driverUserId: string }> {
  return request(`/test/passenger-requests/${id}/accept`, { method: 'POST' }, driverProfileId);
}

export function releaseTestPassengerRequest(id: string, driverProfileId: string): Promise<{ id: string; status: string }> {
  return request(`/test/passenger-requests/${id}/release`, { method: 'POST' }, driverProfileId);
}

export interface TestWallet {
  userId: string;
  accounts: { kind: string; balance: string }[];
  transactions: { id: string; kind: string; requestId?: string; amountMinor: string; platformFeeMinor: string; createdAt: string }[];
}
export function getTestWallet(profileId: string): Promise<TestWallet> {
  return request<TestWallet>('/test/passenger-requests/wallet', {}, profileId);
}
export function topupTestWallet(profileId: string, amountUah: number): Promise<{ transactionId: string }> {
  return request('/test/passenger-requests/wallet/topup', { method: 'POST', body: JSON.stringify({ amountUah }) }, profileId);
}
export function startTestTrip(profileId: string, id: string): Promise<{ id: string; status: string }> {
  return request(`/test/passenger-requests/${id}/start`, { method: 'POST' }, profileId);
}
export function completeTestTrip(profileId: string, id: string, fareUah: number): Promise<{ id: string; fareMinor: number; driverNetMinor: number; platformFeeMinor: number }> {
  return request(`/test/passenger-requests/${id}/complete`, { method: 'POST', body: JSON.stringify({ fareUah }) }, profileId);
}

export interface TestFinanceJournal {
  virtual: boolean;
  feePercent: number;
  balances: { kind: string; balance: string }[];
  transactions: {
    id: string; kind: string; requestId: string | null; amountMinor: string;
    platformFeeMinor: string; createdAt: string; journalNetMinor: string;
    passengerDeltaMinor: string; driverDeltaMinor: string;
    platformDeltaMinor: string; sourceDeltaMinor: string; entryCount: number;
  }[];
}
export function getTestFinanceJournal(): Promise<TestFinanceJournal> {
  return request<TestFinanceJournal>('/test/passenger-requests/finance-journal');
}

export interface TestReadiness {
  ready: boolean;
  applied: string[];
  missing: string[];
  testMode: boolean;
  realPayments: boolean;
}
export function getTestReadiness(): Promise<TestReadiness> {
  return request<TestReadiness>('/test/passenger-requests/readiness');
}
