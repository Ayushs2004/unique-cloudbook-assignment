import { Lead } from '../types/lead';

let currentServerUrl = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';

/**
 * Updates the active server URL for API requests.
 */
export function setServerUrl(url: string) {
  currentServerUrl = url.replace(/\/+$/, '');
}

/**
 * Returns the currently configured server URL.
 */
export function getServerUrl(): string {
  return currentServerUrl;
}

/**
 * Fetches leads from GET /leads, optionally passing ?since= for incremental hydration.
 *
 * @param since - Optional ISO timestamp string
 * @param baseUrl - Optional override URL
 * @returns Promise resolving to Lead array
 */
export async function fetchLeads(since?: string, baseUrl?: string): Promise<Lead[]> {
  const urlBase = (baseUrl || currentServerUrl).replace(/\/+$/, '');
  const url = since ? `${urlBase}/leads?since=${encodeURIComponent(since)}` : `${urlBase}/leads`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leads: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data as Lead[];
}

/**
 * Triggers the server to simulate a new incoming Meta lead in real time.
 */
export async function simulateLead(customLead?: Partial<Lead>, baseUrl?: string): Promise<Lead> {
  const urlBase = (baseUrl || currentServerUrl).replace(/\/+$/, '');
  const url = `${urlBase}/leads/simulate`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(customLead || {}),
  });

  if (!response.ok) {
    throw new Error(`Failed to simulate lead: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return result.lead as Lead;
}

