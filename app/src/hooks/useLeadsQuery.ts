import { useState, useEffect, useCallback } from 'react';
import { Lead } from '../types/lead';
import { fetchLeads } from '../services/api';

export interface UseLeadsQueryResult {
  leads: Lead[];
  loading: boolean;
  error: Error | null;
  refetch: (since?: string) => Promise<Lead[]>;
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
}

/**
 * Custom hook to hydrate leads list via REST GET /leads on mount,
 * with refetch capability for reconnection resyncs.
 */
export function useLeadsQuery(baseUrl?: string): UseLeadsQueryResult {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(
    async (since?: string): Promise<Lead[]> => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchLeads(since, baseUrl);

        setLeads((prev) => {
          if (!since) {
            // Full refresh
            return data;
          }

          // Incremental update: merge without duplicates, sort newest first
          const map = new Map<string, Lead>();
          for (const lead of data) {
            map.set(lead.id, lead);
          }
          for (const lead of prev) {
            if (!map.has(lead.id)) {
              map.set(lead.id, lead);
            }
          }
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
          );
        });

        return data;
      } catch (err: any) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    leads,
    loading,
    error,
    refetch,
    setLeads,
  };
}
