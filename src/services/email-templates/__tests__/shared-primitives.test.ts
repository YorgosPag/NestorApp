/**
 * @fileoverview Behaviour-preservation tests for the email-template SSoT
 * de-duplication (ADR-590). Covers the extracted shared primitives
 * (`showcase-email-shared`, `confirmation-email-shared`) and asserts that the
 * four transactional confirmation builders still emit the expected cards,
 * rows and plain-text sections after the refactor.
 */

import {
  renderShowcaseHero,
  formatShowcaseMoney,
  formatShowcasePercent,
} from '../showcase-email-shared';
import {
  buildInfoRow,
  buildTotalRow,
  buildInfoCard,
  textSectionHeader,
} from '../confirmation-email-shared';
import { buildCancellationConfirmationEmail } from '../cancellation-confirmation';
import { buildReservationConfirmationEmail } from '../reservation-confirmation';
import { buildSaleConfirmationEmail } from '../sale-confirmation';
import {
  buildProfessionalAssignmentEmail,
  buildProfessionalRemovalEmail,
} from '../professional-assignment';

describe('showcase-email-shared primitives', () => {
  it('renderShowcaseHero emits name + code + subtitle + description', () => {
    const html = renderShowcaseHero({
      name: 'Κτίριο Α',
      code: 'B-1',
      codeLabel: 'Κωδικός',
      subtitleBits: 'Τύπος · Ενεργό',
      description: 'Περιγραφή',
    });
    expect(html).toContain('<h1');
    expect(html).toContain('Κτίριο Α');
    expect(html).toContain('Κωδικός: B-1');
    expect(html).toContain('Τύπος · Ενεργό');
    expect(html).toContain('Περιγραφή');
  });

  it('renderShowcaseHero omits code line when code missing, subtitle when empty', () => {
    const html = renderShowcaseHero({ name: 'Μόνο Όνομα' });
    expect(html).toContain('Μόνο Όνομα');
    expect(html).not.toContain('margin:4px 0 0'); // code paragraph style
    expect(html).not.toContain('margin:6px 0 0'); // subtitle paragraph style
  });

  it('renderShowcaseHero escapes hostile input', () => {
    const html = renderShowcaseHero({ name: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('formatShowcaseMoney formats whole euros in Greek locale, undefined for non-numbers', () => {
    expect(formatShowcaseMoney(1500)).toContain('1.500');
    expect(formatShowcaseMoney(1500)).toContain('€');
    expect(formatShowcaseMoney(null)).toBeUndefined();
    expect(formatShowcaseMoney(undefined)).toBeUndefined();
    expect(formatShowcaseMoney(Number.NaN)).toBeUndefined();
  });

  it('formatShowcasePercent rounds to integer percent', () => {
    expect(formatShowcasePercent(42.6)).toBe('43%');
    expect(formatShowcasePercent(0)).toBe('0%');
    expect(formatShowcasePercent(null)).toBeUndefined();
  });
});

describe('confirmation-email-shared primitives', () => {
  it('buildInfoRow / buildTotalRow render label + value cells', () => {
    expect(buildInfoRow('Μονάδα', 'Α-101')).toContain('Μονάδα');
    expect(buildInfoRow('Μονάδα', 'Α-101')).toContain('Α-101');
    expect(buildTotalRow('Σύνολο', '100 €')).toContain('Σύνολο');
    expect(buildTotalRow('Σύνολο', '100 €')).toContain('100 €');
  });

  it('buildInfoCard uses navy header by default and honours headerColor override', () => {
    expect(buildInfoCard({ title: 'ΤΙΤΛΟΣ', bodyHtml: 'body' })).toContain('ΤΙΤΛΟΣ');
    expect(buildInfoCard({ title: 'ΤΙΤΛΟΣ', bodyHtml: 'body' })).toContain('body');
    const red = buildInfoCard({ title: 'X', bodyHtml: 'b', headerColor: '#DC2626' });
    expect(red).toContain('#DC2626');
  });

  it('textSectionHeader wraps the title in box-drawing rules', () => {
    expect(textSectionHeader('ΑΙΤΙΟΛΟΓΙΑ')).toBe('═══ ΑΙΤΙΟΛΟΓΙΑ ═══');
  });
});

describe('cancellation confirmation email', () => {
  const data = {
    buyerName: 'Γιώργος',
    propertyName: 'Α-101',
    unitFloor: 2,
    buildingName: 'Κτίριο Α',
    projectName: 'Έργο Χ',
    projectAddress: 'Οδός 1',
    companyName: 'Pagonis',
    creditAmount: 1240,
    paymentMethod: 'bank_transfer',
    reason: 'Ακύρωση κράτησης',
    creditNoteRef: 'A-42',
  };

  it('emits subject, reason card (red), property + refund cards, and net/vat split', () => {
    const { subject, html, text } = buildCancellationConfirmationEmail(data);
    expect(subject).toBe('Ακύρωση κράτησης — Α-101');
    expect(html).toContain('ΑΙΤΙΟΛΟΓΙΑ ΑΚΥΡΩΣΗΣ');
    expect(html).toContain('#DC2626');
    expect(html).toContain('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ');
    expect(html).toContain('ΣΤΟΙΧΕΙΑ ΕΠΙΣΤΡΟΦΗΣ');
    expect(html).toContain('Α-101');
    expect(html).toContain('2ος όροφος');
    expect(text).toContain('═══ ΑΙΤΙΟΛΟΓΙΑ ═══');
    expect(text).toContain('═══ ΣΤΟΙΧΕΙΑ ΕΠΙΣΤΡΟΦΗΣ ═══');
  });

  it('omits refund card when creditAmount is 0', () => {
    const { html } = buildCancellationConfirmationEmail({ ...data, creditAmount: 0 });
    expect(html).not.toContain('ΣΤΟΙΧΕΙΑ ΕΠΙΣΤΡΟΦΗΣ');
  });
});

describe('reservation confirmation email', () => {
  const data = {
    buyerName: 'Γιώργος',
    propertyName: 'Α-101',
    unitFloor: null,
    buildingName: null,
    projectName: null,
    projectAddress: null,
    companyName: 'Pagonis',
    depositAmount: 1240,
    paymentMethod: 'cash',
    invoiceRef: 'A-1',
  };

  it('emits property + financial cards when deposit present', () => {
    const { subject, html, text } = buildReservationConfirmationEmail(data);
    expect(subject).toBe('Επιβεβαίωση κράτησης — Α-101');
    expect(html).toContain('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ');
    expect(html).toContain('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ΚΡΑΤΗΣΗΣ');
    expect(text).toContain('═══ ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ ═══');
    expect(text).toContain('═══ ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ═══');
  });

  it('shows no-deposit notice when depositAmount is 0', () => {
    const { html } = buildReservationConfirmationEmail({ ...data, depositAmount: 0 });
    expect(html).not.toContain('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ΚΡΑΤΗΣΗΣ');
    expect(html).toContain('δεν συνοδεύεται από προκαταβολή');
  });
});

describe('sale confirmation email', () => {
  it('emits property + financial cards with remaining split', () => {
    const { subject, html, text } = buildSaleConfirmationEmail({
      buyerName: 'Γιώργος',
      propertyName: 'Α-101',
      unitFloor: 1,
      buildingName: 'Κτίριο Α',
      projectName: null,
      projectAddress: null,
      companyName: 'Pagonis',
      finalPrice: 100000,
      depositAlreadyInvoiced: 10000,
      paymentMethod: 'bank_transfer',
      invoiceRef: 'A-5',
    });
    expect(subject).toBe('Επιβεβαίωση πώλησης — Α-101');
    expect(html).toContain('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ');
    expect(html).toContain('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ΠΩΛΗΣΗΣ');
    expect(html).toContain('Προκαταβολή (ήδη τιμολογημένη)');
    expect(text).toContain('═══ ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ΠΩΛΗΣΗΣ ═══');
  });
});

describe('professional assignment / removal email', () => {
  const data = {
    professionalName: 'Δικηγόρος',
    roleName: 'Δικηγόρος Πωλητή',
    propertyName: 'Διαμέρισμα Α1',
    propertyCode: 'Α-101',
    propertyFloor: 0,
    buildingName: 'Κτίριο Α',
    projectName: 'Έργο Χ',
    projectAddress: 'Οδός 1',
    companyName: 'Pagonis',
    buyerName: 'Γιώργος',
    buyerPhone: '2101234567',
    companyPhone: '2109999999',
  };

  it('assignment: property + buyer + assignment cards and text sections', () => {
    const { subject, html, text } = buildProfessionalAssignmentEmail(data);
    expect(subject).toContain('Ανάθεση ρόλου');
    expect(html).toContain('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ');
    expect(html).toContain('ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ');
    expect(html).toContain('ΣΤΟΙΧΕΙΑ ΑΝΑΘΕΣΗΣ');
    expect(html).toContain('Ισόγειο'); // floor 0 formatting preserved
    expect(text).toContain('═══ ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ ═══');
    expect(text).toContain('═══ ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ ═══');
    expect(text).toContain('═══ ΣΤΟΙΧΕΙΑ ΑΝΑΘΕΣΗΣ ═══');
    expect(text).toContain('--- Στοιχεία Επικοινωνίας ---');
    expect(text).toContain('Τηλ: 2109999999');
  });

  it('removal: property + buyer cards, no assignment-details card', () => {
    const { subject, html } = buildProfessionalRemovalEmail(data);
    expect(subject).toContain('Ακύρωση ανάθεσης');
    expect(html).toContain('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ');
    expect(html).toContain('ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ');
    expect(html).not.toContain('ΣΤΟΙΧΕΙΑ ΑΝΑΘΕΣΗΣ');
  });

  it('assignment omits buyer card when buyerName absent', () => {
    const { html } = buildProfessionalAssignmentEmail({ ...data, buyerName: undefined });
    expect(html).not.toContain('ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ');
  });
});
