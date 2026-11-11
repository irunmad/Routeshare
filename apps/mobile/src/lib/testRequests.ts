import { getInstallationId } from './installation';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://routeshare-api.onrender.com/v1').replace(/\/$/, '');

export interface TestPassengerRequest {
  id: string;
  origin: string;
  destination: string;
  departureStart: string;
  departureEnd: string;
  offeredRateUahPerKm: number;
  status: 'searching';
  createdAt: string;
  isMine: boolean;
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
