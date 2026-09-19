/**
 * ⚓ ADR-777 §8.60.20 — τα ΣΗΜΑΤΑ κατάστασης μονάδων: ένα SSoT για ακίνητα, θέσεις, αποθήκες.
 *
 * Ομάδες: Α — το περιστατικό · Β — η λειτουργική εξαίρεση · Γ — εξαντλητικότητα · Δ — η όψη
 * πωλήσεων.
 */

import { COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';
import { OPERATIONAL_STATUSES } from '@/constants/operational-statuses';
import {
  commercialStatusBadge,
  operationalExceptionBadge,
  operationalStatusBadge,
  spaceCommercialStatusView,
  spaceStatusBadges,
  unitStatusBadgeSpecs,
  UNIT_STATUS_NAMESPACE,
} from '../unit-status-badges';

/** Μεταφραστής-καθρέφτης: δείχνει ΠΟΙΟ κλειδί ζητήθηκε και σε ΠΟΙΟ namespace. */
const t = (key: string, options?: Record<string, unknown>) => `${String(options?.ns)}:${key}`;

describe('Α. ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ', () => {
  it('🔴 Α1 — θέση πωλημένη μαζί με ακίνητο (legacy `available`) ⇒ «Πωλήθηκε», ΟΧΙ «Διαθέσιμη»', () => {
    const badges = spaceStatusBadges({ status: 'available', commercialStatus: 'sold' }, t);
    expect(badges).toEqual([{ label: `${UNIT_STATUS_NAMESPACE}:commercialStatus.sold`, variant: 'success' }]);
  });

  it('Α2 — άγνωστη διάθεση ⇒ ΚΑΝΕΝΑ σήμα (ποτέ «Διαθέσιμη» από εικασία)', () => {
    expect(commercialStatusBadge(undefined)).toBeNull();
    expect(commercialStatusBadge('available-ish')).toBeNull();
    expect(spaceStatusBadges({ status: 'available' }, t)).toEqual([]);
  });
});

describe('Β. Η ΛΕΙΤΟΥΡΓΙΚΗ ΚΑΤΑΣΤΑΣΗ — ΜΟΝΟ ΩΣ ΕΞΑΙΡΕΣΗ', () => {
  it('Β1 — «Έτοιμο» ή αδήλωτο ⇒ κανένα δεύτερο σήμα', () => {
    expect(operationalExceptionBadge('ready')).toBeNull();
    expect(operationalExceptionBadge(undefined)).toBeNull();
    expect(unitStatusBadgeSpecs({ commercialStatus: 'for-sale', operationalStatus: 'ready' })).toHaveLength(1);
  });

  it('Β2 — «Υπό συντήρηση» (και από το παλιό πεδίο) ⇒ δεύτερο σήμα, ΜΕΤΑ τη διάθεση', () => {
    const badges = spaceStatusBadges({ status: 'maintenance', commercialStatus: 'for-rent' }, t);
    expect(badges.map((badge) => badge.label)).toEqual([
      `${UNIT_STATUS_NAMESPACE}:commercialStatus.for-rent`,
      `${UNIT_STATUS_NAMESPACE}:operationalStatus.maintenance`,
    ]);
  });

  it('Β3 — η κάρτα ακινήτου δείχνει ΚΑΘΕ δηλωμένη λειτουργική (και το «Έτοιμο»)', () => {
    expect(operationalStatusBadge('ready')).toEqual({ labelKey: 'operationalStatus.ready', variant: 'success' });
  });
});

describe('Γ. ΕΞΑΝΤΛΗΤΙΚΟΤΗΤΑ — ΚΑΘΕ ΤΙΜΗ ΕΧΕΙ ΣΗΜΑ', () => {
  it.each([...COMMERCIAL_STATUSES])('Γ1 — διάθεση «%s» ⇒ σήμα', (status) => {
    expect(commercialStatusBadge(status)?.labelKey).toBe(`commercialStatus.${status}`);
  });

  it.each([...OPERATIONAL_STATUSES])('Γ2 — λειτουργία «%s» ⇒ σήμα', (status) => {
    expect(operationalStatusBadge(status)?.labelKey).toBe(`operationalStatus.${status}`);
  });
});

describe('Δ. Η ΟΨΗ ΤΩΝ ΠΩΛΗΣΕΩΝ', () => {
  it('Δ1 — κλειδί χρώματος + ετικέτα από τη διάθεση· αδήλωτη ⇒ «Μη διαθέσιμο»', () => {
    expect(spaceCommercialStatusView({ status: 'available', commercialStatus: 'reserved' }, t)).toEqual({
      statusKey: 'reserved',
      statusLabel: `${UNIT_STATUS_NAMESPACE}:commercialStatus.reserved`,
    });
    expect(spaceCommercialStatusView({ status: 'available' }, t).statusKey).toBe('unavailable');
  });
});
