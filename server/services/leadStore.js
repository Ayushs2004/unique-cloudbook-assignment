/**
 * @typedef {Object} Lead
 * @property {string} id - leadgen_id from Meta
 * @property {string} formId
 * @property {string} pageId
 * @property {string} [name]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {Record<string, string>} rawFieldData
 * @property {string} receivedAt - ISO timestamp of server receipt
 */

/**
 * LeadStore interface implementation using an in-memory Map.
 * Decoupled from routes so it can be swapped for SQLite/Postgres.
 */
class InMemoryLeadStore {
  constructor() {
    /** @type {Map<string, Lead>} */
    this.leads = new Map();
  }

  /**
   * Checks whether a lead with the given ID exists.
   * @param {string} id - leadgen_id
   * @returns {Promise<boolean>}
   */
  async exists(id) {
    if (!id) return false;
    return this.leads.has(id);
  }

  /**
   * Saves a lead. Duplicate save calls are idempotent silent no-ops.
   * @param {Lead} lead
   * @returns {Promise<boolean>} returns true if newly inserted, false if already existed
   */
  async save(lead) {
    if (!lead || !lead.id) {
      throw new Error('Lead must have a valid id (leadgen_id).');
    }

    if (this.leads.has(lead.id)) {
      // Idempotency: duplicate save is a silent no-op
      return false;
    }

    // Ensure receivedAt is always an ISO timestamp
    const normalizedLead = {
      ...lead,
      receivedAt: lead.receivedAt || new Date().toISOString(),
      rawFieldData: lead.rawFieldData || {},
    };

    this.leads.set(lead.id, normalizedLead);
    return true;
  }

  /**
   * Lists leads, optionally filtered to those received since a given timestamp.
   * Returns items ordered newest first.
   * @param {string} [timestamp] - ISO timestamp string
   * @returns {Promise<Lead[]>}
   */
  async listSince(timestamp) {
    const allLeads = Array.from(this.leads.values());

    let filtered = allLeads;
    if (timestamp) {
      const sinceTime = new Date(timestamp).getTime();
      if (!isNaN(sinceTime)) {
        filtered = allLeads.filter((lead) => new Date(lead.receivedAt).getTime() > sinceTime);
      }
    }

    // Sort newest first (descending by receivedAt)
    return filtered.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }

  /**
   * Clears the store (used for test isolation).
   */
  async clear() {
    this.leads.clear();
  }
}

// Singleton instance for the application runtime
const defaultLeadStore = new InMemoryLeadStore();

module.exports = {
  InMemoryLeadStore,
  leadStore: defaultLeadStore,
};
