/**
 * Tests for invoice send-email cascade logic (ADR-326 Phase 6.3)
 * Tests the decision tree: recipientEmail → customerContactId → 422
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/** Mirrors the cascade resolution logic from the route handler. */
function resolveRecipient(body: {
  recipientEmail?: string;
  customerContactId?: string;
}): 'manual' | 'contact_fallback' | 'missing' {
  if (body.recipientEmail && isValidEmail(body.recipientEmail)) return 'manual';
  if (body.customerContactId) return 'contact_fallback';
  return 'missing';
}

describe('invoice send-email cascade', () => {
  it('uses recipientEmail when valid', () => {
    expect(resolveRecipient({ recipientEmail: 'test@example.com' })).toBe('manual');
  });

  it('falls back to customerContactId when recipientEmail invalid', () => {
    expect(resolveRecipient({ recipientEmail: 'not-an-email', customerContactId: 'contact_123' })).toBe('contact_fallback');
  });

  it('falls back to customerContactId when recipientEmail absent', () => {
    expect(resolveRecipient({ customerContactId: 'contact_456' })).toBe('contact_fallback');
  });

  it('returns missing when both absent', () => {
    expect(resolveRecipient({})).toBe('missing');
  });

  it('returns missing when recipientEmail invalid and no customerContactId', () => {
    expect(resolveRecipient({ recipientEmail: 'bad-email' })).toBe('missing');
  });
});
