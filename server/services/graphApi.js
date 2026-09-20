const axios = require('axios');
const { validateEnv } = require('../config/env');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

/**
 * Normalizes Meta Graph API leadgen field_data into the standard Lead shape.
 * @param {Object} rawData - Graph API response
 * @param {string} [pageId=''] - Optional fallback pageId
 * @param {string} [formId=''] - Optional fallback formId
 * @returns {import('./leadStore').Lead}
 */
function normalizeLeadData(rawData, pageId = '', formId = '') {
  const rawFieldData = {};
  let name;
  let email;
  let phone;

  if (Array.isArray(rawData.field_data)) {
    for (const field of rawData.field_data) {
      const fieldName = field.name;
      const val = Array.isArray(field.values) && field.values.length > 0 ? field.values[0] : field.value || '';
      rawFieldData[fieldName] = val;

      const lowerName = fieldName.toLowerCase();
      if (!name && (lowerName === 'full_name' || lowerName === 'name')) {
        name = val;
      } else if (!name && lowerName === 'first_name') {
        name = val;
      }
      if (!email && lowerName.includes('email')) {
        email = val;
      }
      if (!phone && (lowerName.includes('phone') || lowerName.includes('mobile'))) {
        phone = val;
      }
    }

    // Combine first_name + last_name if full_name wasn't present
    if (!name && rawFieldData.first_name) {
      name = [rawFieldData.first_name, rawFieldData.last_name].filter(Boolean).join(' ');
    }
  }

  return {
    id: String(rawData.id),
    formId: String(rawData.form_id || formId || 'unknown_form'),
    pageId: String(rawData.page_id || pageId || 'unknown_page'),
    name: name || undefined,
    email: email || undefined,
    phone: phone || undefined,
    rawFieldData,
    receivedAt: new Date().toISOString(),
  };
}

/**
 * Fetches lead details from Meta Graph API with retry backoff.
 *
 * @param {string} leadgenId - Meta lead ID
 * @param {Object} [options]
 * @param {string} [options.accessToken]
 * @param {string} [options.pageId]
 * @param {string} [options.formId]
 * @param {number} [options.maxRetries=2]
 * @param {number} [options.backoffBaseMs=100]
 * @param {import('axios').AxiosStatic} [options.axiosClient=axios]
 * @returns {Promise<import('./leadStore').Lead>}
 */
async function fetchLead(leadgenId, options = {}) {
  const {
    pageId = '',
    formId = '',
    maxRetries = 2,
    backoffBaseMs = 100,
    axiosClient = axios,
  } = options;

  let accessToken = options.accessToken;
  if (!accessToken) {
    try {
      const env = validateEnv();
      accessToken = env.PAGE_ACCESS_TOKEN;
    } catch {
      accessToken = process.env.PAGE_ACCESS_TOKEN || '';
    }
  }

  const url = `${GRAPH_API_BASE}/${encodeURIComponent(leadgenId)}`;

  let lastError;
  const totalAttempts = 1 + maxRetries;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      const response = await axiosClient.get(url, {
        params: { access_token: accessToken },
        timeout: 5000,
      });

      if (response.data && response.data.id) {
        return normalizeLeadData(response.data, pageId, formId);
      } else {
        throw new Error(`Graph API returned unexpected data structure for lead ${leadgenId}`);
      }
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === totalAttempts;
      if (isLastAttempt) {
        break;
      }
      // Exponential backoff
      const delayMs = backoffBaseMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Failed after retries: throw error with context
  const message = lastError?.response?.data?.error?.message || lastError?.message || 'Unknown error';
  const error = new Error(`Failed to fetch lead ${leadgenId} from Graph API after ${totalAttempts} attempts: ${message}`);
  error.cause = lastError;
  error.leadgenId = leadgenId;
  throw error;
}

module.exports = {
  GRAPH_API_BASE,
  normalizeLeadData,
  fetchLead,
};
