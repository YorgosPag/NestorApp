/**
 * @fileoverview Tests for the pending-registration admin notification email
 * template (ADR-660). Pure builder — asserts subject/body reflect the pending
 * user's details, provider label mapping, name-optional rows, and the review URL.
 */

import { buildPendingRegistrationAdminEmail } from '../pending-registration-admin';

const FIXED_DATE = new Date('2026-07-15T10:05:13Z');

describe('buildPendingRegistrationAdminEmail', () => {
  it('includes the pending user email, name and Google provider label', () => {
    const { subject, html, text } = buildPendingRegistrationAdminEmail({
      pendingEmail: 'newuser@example.com',
      pendingName: 'Γιώργος Νέος',
      authProvider: 'google.com',
      requestedAt: FIXED_DATE,
      reviewUrl: 'https://app.example.com/admin/role-management',
    });

    expect(subject).toContain('Γιώργος Νέος');
    expect(html).toContain('newuser@example.com');
    expect(html).toContain('Γιώργος Νέος');
    expect(html).toContain('Google');
    expect(html).toContain('/admin/role-management');
    expect(text).toContain('newuser@example.com');
    expect(text).toContain('Google');
  });

  it('falls back to email in the subject when name is missing and omits the name row', () => {
    const { subject, html } = buildPendingRegistrationAdminEmail({
      pendingEmail: 'anon@example.com',
      pendingName: null,
      authProvider: 'password',
      requestedAt: FIXED_DATE,
      reviewUrl: '',
    });

    expect(subject).toContain('anon@example.com');
    expect(html).toContain('anon@example.com');
    expect(html).toContain('Email / Κωδικός');
    expect(html).not.toContain('Ονοματεπώνυμο');
  });

  it('maps unknown provider verbatim and shows console fallback without a URL', () => {
    const { html, text } = buildPendingRegistrationAdminEmail({
      pendingEmail: 'x@example.com',
      pendingName: null,
      authProvider: null,
      requestedAt: FIXED_DATE,
      reviewUrl: '',
    });

    expect(html).toContain('Άγνωστος');
    expect(html).not.toContain('href="http');
    expect(text).toContain('Διαχείριση Ρόλων');
  });
});
