const { fetchLead, normalizeLeadData, GRAPH_API_BASE } = require('../services/graphApi');

describe('Graph API Service', () => {
  const leadgenId = 'leadgen_test_12345';
  const accessToken = 'test_access_token_abc';

  it('normalizes field_data into standard Lead model shape', () => {
    const rawData = {
      id: leadgenId,
      form_id: 'form_999',
      page_id: 'page_888',
      field_data: [
        { name: 'full_name', values: ['Alice Smith'] },
        { name: 'email', values: ['alice@example.com'] },
        { name: 'phone_number', values: ['+15551234567'] },
        { name: 'custom_inquiry', values: ['Interested in product A'] },
      ],
    };

    const normalized = normalizeLeadData(rawData);
    expect(normalized.id).toBe(leadgenId);
    expect(normalized.formId).toBe('form_999');
    expect(normalized.pageId).toBe('page_888');
    expect(normalized.name).toBe('Alice Smith');
    expect(normalized.email).toBe('alice@example.com');
    expect(normalized.phone).toBe('+15551234567');
    expect(normalized.rawFieldData).toEqual({
      full_name: 'Alice Smith',
      email: 'alice@example.com',
      phone_number: '+15551234567',
      custom_inquiry: 'Interested in product A',
    });
    expect(normalized.receivedAt).toBeDefined();
  });

  it('successfully fetches and normalizes a lead on first attempt', async () => {
    const mockAxios = {
      get: jest.fn().mockResolvedValue({
        data: {
          id: leadgenId,
          form_id: 'form_123',
          field_data: [
            { name: 'full_name', values: ['Bob Jones'] },
            { name: 'email', values: ['bob@example.com'] },
          ],
        },
      }),
    };

    const lead = await fetchLead(leadgenId, {
      accessToken,
      axiosClient: mockAxios,
    });

    expect(mockAxios.get).toHaveBeenCalledTimes(1);
    expect(mockAxios.get).toHaveBeenCalledWith(
      `${GRAPH_API_BASE}/${leadgenId}`,
      expect.objectContaining({
        params: { access_token: accessToken },
      })
    );
    expect(lead.id).toBe(leadgenId);
    expect(lead.name).toBe('Bob Jones');
    expect(lead.email).toBe('bob@example.com');
  });

  it('retries with backoff on failure and succeeds if a subsequent retry works', async () => {
    const mockAxios = {
      get: jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error (500 Server Error)'))
        .mockResolvedValueOnce({
          data: {
            id: leadgenId,
            form_id: 'form_123',
            field_data: [{ name: 'name', values: ['Charlie Brown'] }],
          },
        }),
    };

    const lead = await fetchLead(leadgenId, {
      accessToken,
      maxRetries: 2,
      backoffBaseMs: 10,
      axiosClient: mockAxios,
    });

    expect(mockAxios.get).toHaveBeenCalledTimes(2);
    expect(lead.id).toBe(leadgenId);
    expect(lead.name).toBe('Charlie Brown');
  });

  it('throws an error after exhausting all retries on persistent failure', async () => {
    const mockAxios = {
      get: jest.fn().mockRejectedValue(new Error('Meta Graph API 503 Service Unavailable')),
    };

    await expect(
      fetchLead(leadgenId, {
        accessToken,
        maxRetries: 2, // 1 initial + 2 retries = 3 total attempts
        backoffBaseMs: 5,
        axiosClient: mockAxios,
      })
    ).rejects.toThrow(/Failed to fetch lead leadgen_test_12345 from Graph API after 3 attempts/);

    expect(mockAxios.get).toHaveBeenCalledTimes(3);
  });
});
