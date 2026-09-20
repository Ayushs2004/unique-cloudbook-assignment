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
