const { InMemoryLeadStore } = require('../services/leadStore');

describe('Lead Store (InMemoryLeadStore)', () => {
  let store;

  beforeEach(() => {
    store = new InMemoryLeadStore();
  });

  it('reports non-existence for unseen lead IDs', async () => {
    expect(await store.exists('lead_unknown')).toBe(false);
  });

  it('saves a lead and correctly reports existence', async () => {
    const lead = {
      id: 'lead_001',
      formId: 'form_123',
      pageId: 'page_456',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      rawFieldData: { full_name: 'John Doe', email: 'john@example.com' },
      receivedAt: new Date('2024-01-01T10:00:00.000Z').toISOString(),
    };

    const inserted = await store.save(lead);
    expect(inserted).toBe(true);
    expect(await store.exists('lead_001')).toBe(true);

    const leads = await store.listSince();
    expect(leads.length).toBe(1);
    expect(leads[0].id).toBe('lead_001');
    expect(leads[0].name).toBe('John Doe');
  });

  it('handles duplicate save as a silent idempotent no-op without creating a second entry', async () => {
    const lead = {
      id: 'lead_dup',
      formId: 'form_123',
      pageId: 'page_456',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+9876543210',
      rawFieldData: { full_name: 'Jane Doe' },
      receivedAt: new Date('2024-01-01T10:00:00.000Z').toISOString(),
    };

    const firstSave = await store.save(lead);
    expect(firstSave).toBe(true);

    // Duplicate attempt
    const secondSave = await store.save(lead);
    expect(secondSave).toBe(false); // returns false indicating not newly inserted, no exception thrown

    const leads = await store.listSince();
    expect(leads.length).toBe(1);
  });

  it('lists leads ordered newest first', async () => {
    const lead1 = {
      id: 'lead_1',
      formId: 'form_1',
      pageId: 'page_1',
      receivedAt: new Date('2024-01-01T10:00:00.000Z').toISOString(),
    };
    const lead2 = {
      id: 'lead_2',
      formId: 'form_1',
      pageId: 'page_1',
      receivedAt: new Date('2024-01-01T12:00:00.000Z').toISOString(),
    };
    const lead3 = {
      id: 'lead_3',
      formId: 'form_1',
      pageId: 'page_1',
      receivedAt: new Date('2024-01-01T11:00:00.000Z').toISOString(),
    };

    await store.save(lead1);
    await store.save(lead2);
    await store.save(lead3);

    const leads = await store.listSince();
    expect(leads.map((l) => l.id)).toEqual(['lead_2', 'lead_3', 'lead_1']);
  });

  it('filters leads with listSince(timestamp)', async () => {
    const lead1 = {
      id: 'lead_1',
      formId: 'form_1',
      pageId: 'page_1',
      receivedAt: new Date('2024-01-01T10:00:00.000Z').toISOString(),
    };
    const lead2 = {
      id: 'lead_2',
      formId: 'form_1',
      pageId: 'page_1',
      receivedAt: new Date('2024-01-01T12:00:00.000Z').toISOString(),
    };

    await store.save(lead1);
    await store.save(lead2);

    const filtered = await store.listSince('2024-01-01T11:00:00.000Z');
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('lead_2');
  });

  it('rejects saving a lead without an id', async () => {
    await expect(store.save({})).rejects.toThrow('Lead must have a valid id');
  });
});
