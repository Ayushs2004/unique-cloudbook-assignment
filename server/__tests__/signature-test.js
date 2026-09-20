const { calculateSignature, verifySignature } = require('../services/signature');

describe('Signature Verification Service', () => {
  const secret = 'super_secret_app_key_12345';
  const validPayload = JSON.stringify({
    entry: [
      {
        id: '1234567890',
        changes: [
          {
            field: 'leadgen',
            value: {
              leadgen_id: 'lead_99999',
              form_id: 'form_123',
              page_id: 'page_456',
              created_time: 1710928392,
            },
          },
        ],
      },
    ],
  });

  it('verifies a valid signature successfully', () => {
    const rawBody = Buffer.from(validPayload, 'utf-8');
    const signature = calculateSignature(rawBody, secret);
    const signatureHeader = `sha256=${signature}`;

    const isValid = verifySignature(rawBody, secret, signatureHeader);
    expect(isValid).toBe(true);
  });

  it('rejects an invalid signature with incorrect secret or wrong hash', () => {
    const rawBody = Buffer.from(validPayload, 'utf-8');
    const wrongSignature = calculateSignature(rawBody, 'different_secret');
    const signatureHeader = `sha256=${wrongSignature}`;

    const isValid = verifySignature(rawBody, secret, signatureHeader);
    expect(isValid).toBe(false);
  });

  it('rejects a signature when body has been tampered with', () => {
    const originalBody = Buffer.from(validPayload, 'utf-8');
    const signature = calculateSignature(originalBody, secret);
    const signatureHeader = `sha256=${signature}`;

    const tamperedPayload = validPayload.replace('lead_99999', 'lead_tampered_66666');
    const tamperedBody = Buffer.from(tamperedPayload, 'utf-8');

    const isValid = verifySignature(tamperedBody, secret, signatureHeader);
    expect(isValid).toBe(false);
  });

  it('rejects when signature header is missing or malformed', () => {
    const rawBody = Buffer.from(validPayload, 'utf-8');

    expect(verifySignature(rawBody, secret, null)).toBe(false);
    expect(verifySignature(rawBody, secret, '')).toBe(false);
    expect(verifySignature(rawBody, secret, 'invalid_no_sha_prefix')).toBe(false);
    expect(verifySignature(rawBody, secret, 'sha256=not_a_hex_string_length_mismatch')).toBe(false);
  });

  it('rejects when secret is missing or empty', () => {
    const rawBody = Buffer.from(validPayload, 'utf-8');
    expect(verifySignature(rawBody, '', 'sha256=12345')).toBe(false);
    expect(verifySignature(rawBody, null, 'sha256=12345')).toBe(false);
  });
});
