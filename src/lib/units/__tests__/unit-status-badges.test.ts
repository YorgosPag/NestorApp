/**
 * ⚓ ADR-777 §8.60.20 — τα ΣΗΜΑΤΑ κατάστασης μονάδων: ένα SSoT για ακίνητα, θέσεις, αποθήκες.
 *
 * Ομάδες: Α — το περιστατικό · Β — η λειτουργική εξαίρεση · Γ — εξαντλητικότητα · Δ — η όψη
 * πωλήσεων · Ε — τα ακίνητα (κανονικό πεδίο πάνω από το κάτοπτρο) ·
 * Ζ — το σχήμα, δεύτερο μη χρωματικό κανάλι (ADR-771).
 */

import { COMMERCIAL_STATUSES, resolveCommercialStatus } from '@/constants/commercial-statuses';
import { OPERATIONAL_STATUSES } from '@/constants/operational-statuses';
import { CircleCheck } from 'lucide-react';
import {
  commercialStatusBadge,
  commercialStatusLabelKey,
  operationalExceptionBadge,
  badgeFromSpec,
  propertyStatusBadges,
  statusBadgesText,
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
    expect(badges).toEqual([{ label: `${UNIT_STATUS_NAMESPACE}:commercialStatus.sold`, variant: 'success', icon: CircleCheck }]);
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
    expect(operationalStatusBadge('ready')).toMatchObject({ labelKey: 'operationalStatus.ready', variant: 'success' });
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

describe('Ε. ΤΑ ΑΚΙΝΗΤΑ — ΤΟ ΚΑΝΟΝΙΚΟ ΠΕΔΙΟ ΚΕΡΔΙΖΕΙ ΤΟ ΚΑΤΟΠΤΡΟ', () => {
  it('🔴 Ε1 — `commercialStatus` και `status` αποκλίνουν ⇒ μετρά το κανονικό', () => {
    expect(resolveCommercialStatus({ commercialStatus: 'sold', status: 'for-sale' })).toBe('sold');
    expect(propertyStatusBadges({ commercialStatus: 'sold', status: 'for-sale' }, t)).toEqual([
      { label: `${UNIT_STATUS_NAMESPACE}:commercialStatus.sold`, variant: 'success', icon: CircleCheck },
    ]);
  });

  it('Ε2 — παλιό έγγραφο χωρίς `commercialStatus` ⇒ το κάτοπτρο συμπληρώνει (και κανονικοποιείται)', () => {
    expect(resolveCommercialStatus({ status: 'available' })).toBe('for-sale');
    expect(resolveCommercialStatus({ commercialStatus: 'garbage', status: 'rented' })).toBe('rented');
  });

  it('Ε3 — άγνωστο και στα δύο ⇒ `null`, κανένα σήμα (ποτέ «Διαθέσιμη» από εικασία)', () => {
    expect(resolveCommercialStatus({ status: 'under-negotiation' })).toBeNull();
    expect(propertyStatusBadges({}, t)).toEqual([]);
  });

  it('Ε4 — λειτουργική εξαίρεση ακινήτου ⇒ δεύτερο σήμα, όπως στους χώρους', () => {
    expect(propertyStatusBadges({ commercialStatus: 'for-sale', operationalStatus: 'maintenance' }, t)).toHaveLength(2);
  });

  it('Ε5 — κείμενο εξαγωγής: ετικέτες με « · », `null` όταν δεν υπάρχει σήμα', () => {
    expect(statusBadgesText([{ label: 'A', variant: 'success' }, { label: 'B', variant: 'info' }])).toBe('A · B');
    expect(statusBadgesText([])).toBeNull();
  });

  it.each([...COMMERCIAL_STATUSES])('Ε6 — το κλειδί ετικέτας του «%s» είναι ΕΝΑ για σήμα και φίλτρο', (status) => {
    expect(commercialStatusBadge(status)?.labelKey).toBe(commercialStatusLabelKey(status));
  });
});

describe('Ζ. ΤΟ ΣΧΗΜΑ — ΔΕΥΤΕΡΟ ΜΗ ΧΡΩΜΑΤΙΚΟ ΚΑΝΑΛΙ (ADR-771 · WCAG 1.4.1)', () => {
  it('🔴 Ζ1 — κάθε διάθεση έχει ΔΙΚΟ της σχήμα (καμία σύγχυση χωρίς χρώμα)', () => {
    const icons = COMMERCIAL_STATUSES.map((status) => commercialStatusBadge(status)?.icon);
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(COMMERCIAL_STATUSES.length);
  });

  it('🔴 Ζ2 — ίδια απόχρωση ⇒ ΔΙΑΦΟΡΕΤΙΚΟ σχήμα (πωλήθηκε · ενοικιάστηκε)', () => {
    const sold = commercialStatusBadge('sold');
    const rented = commercialStatusBadge('rented');
    expect(sold?.variant).toBe(rented?.variant);
    expect(sold?.icon).not.toBe(rented?.icon);
  });

  it('Ζ3 — κάθε λειτουργική κατάσταση έχει δικό της σχήμα', () => {
    const icons = OPERATIONAL_STATUSES.map((status) => operationalStatusBadge(status)?.icon);
    expect(new Set(icons).size).toBe(OPERATIONAL_STATUSES.length);
  });

  it('Ζ4 — το `badgeFromSpec` μεταφέρει ετικέτα, απόχρωση ΚΑΙ σχήμα μαζί', () => {
    const spec = commercialStatusBadge('reserved');
    expect(spec && badgeFromSpec(spec, t)).toEqual({
      label: `${UNIT_STATUS_NAMESPACE}:commercialStatus.reserved`,
      variant: 'outline',
      icon: spec?.icon,
    });
  });
});
