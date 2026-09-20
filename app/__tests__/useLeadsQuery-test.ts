import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useLeadsQuery } from '../src/hooks/useLeadsQuery';
import { Lead } from '../src/types/lead';

describe('useLeadsQuery Hook', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('hydrates leads list successfully on mount', async () => {
    const mockLeads: Lead[] = [
      {
        id: 'lead_1',
        formId: 'form_1',
        pageId: 'page_1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        phone: '+1234567890',
        receivedAt: '2024-03-20T10:00:00.000Z',
      },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockLeads,
    } as Response);

    const { result } = renderHook(() => useLeadsQuery('http://test-server:3000'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.leads).toEqual(mockLeads);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('http://test-server:3000/leads', expect.any(Object));
  });

  it('handles fetch failure and sets error state', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const { result } = renderHook(() => useLeadsQuery('http://test-server:3000'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.leads).toEqual([]);
    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toContain('Failed to fetch leads: 500');
  });

  it('refetches with ?since= and merges deduplicated results newest first', async () => {
    const initialLeads: Lead[] = [
      {
        id: 'lead_old',
        formId: 'form_1',
        pageId: 'page_1',
        name: 'Old Lead',
        receivedAt: '2024-03-20T08:00:00.000Z',
      },
    ];

    const newLeads: Lead[] = [
      {
        id: 'lead_newer',
        formId: 'form_1',
        pageId: 'page_1',
        name: 'Newer Lead',
        receivedAt: '2024-03-20T12:00:00.000Z',
      },
    ];

    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes('since=')) {
        return {
          ok: true,
          json: async () => newLeads,
        };
      }
      return {
        ok: true,
        json: async () => initialLeads,
      };
    });

    const { result } = renderHook(() => useLeadsQuery('http://test-server:3000'));

    await waitFor(() => {
      expect(result.current.leads.length).toBe(1);
    });

    await act(async () => {
      await result.current.refetch('2024-03-20T08:00:00.000Z');
    });

    expect(result.current.leads.length).toBe(2);
    expect(result.current.leads[0].id).toBe('lead_newer');
    expect(result.current.leads[1].id).toBe('lead_old');
  });
});
