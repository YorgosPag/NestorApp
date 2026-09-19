/**
 * ⚓ ADR-777 §8.60.20 — η ΚΑΤΑΣΤΑΣΗ ενός χώρου: τρία ερωτήματα, τρία πεδία, ΕΝΑΣ αναγνώστης.
 *
 * Το περιστατικό: θέση πωλημένη μαζί με ακίνητο (`appurtenance-sync` γράφει ΜΟΝΟ `commercialStatus`)
 * έμενε «Διαθέσιμη» στη λίστα, γιατί ~40 αρχεία διάβαζαν το παλιό ανάμεικτο `status`.
 *
 * Ομάδες: Α — τα νέα πεδία κερδίζουν · Β — ο πίνακας του παλιού πεδίου (καμία μαντεψιά) ·
 * Γ — ο κάδος · Δ — η συμπλήρωση (backfill) · Ε — η νέα εγγραφή.
 */

import { COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';
import { DEFAULT_OPERATIONAL_STATUS } from '@/constants/operational-statuses';
import {
  LEGACY_SPACE_STATUSES,
  LEGACY_SPACE_STATUS_SPLIT,
  NEW_SPACE_STATUSES,
  hasLegacySpaceStatus,
  planSpaceStatusBackfill,
  resolveSpaceStatuses,
} from '../space-status-split';

describe('Α. ΤΑ ΝΕΑ ΠΕΔΙΑ ΚΕΡΔΙΖΟΥΝ ΠΑΝΤΑ', () => {
  it('🔴 Α1 — το περιστατικό: legacy `available` + `commercialStatus: sold` ⇒ «sold», ΟΧΙ διαθέσιμη', () => {
    expect(resolveSpaceStatuses({ status: 'available', commercialStatus: 'sold' })).toEqual({
      status: 'active',
      commercialStatus: 'sold',
    });
  });

  it('Α2 — νέο έγγραφο: τα τρία πεδία περνούν αυτούσια', () => {
    expect(resolveSpaceStatuses({ status: 'active', commercialStatus: 'for-rent', operationalStatus: 'ready' }))
      .toEqual({ status: 'active', commercialStatus: 'for-rent', operationalStatus: 'ready' });
  });

  it('Α3 — το νέο `operationalStatus` κερδίζει το legacy `maintenance`', () => {
    expect(resolveSpaceStatuses({ status: 'maintenance', operationalStatus: 'ready' }).operationalStatus).toBe('ready');
  });

  it('🔴 Α3β — και στο ΕΜΠΟΡΙΚΟ: ο παλιός ισχυρισμός ΔΕΝ υπερισχύει μιας νέας διάθεσης', () => {
    // Παλιό `sold` + νέο `for-rent` ⇒ `for-rent`. (Με παλιό `available` η σειρά δεν φαίνεται —
    // εκείνο δεν ισχυρίζεται τίποτα· γι' αυτό η μετάλλαξη M1 επέζησε πριν από αυτή την άγκυρα.)
    expect(resolveSpaceStatuses({ status: 'sold', commercialStatus: 'for-rent' }).commercialStatus).toBe('for-rent');
  });

  it('Α4 — άγνωστη τιμή σε νέο πεδίο ⇒ απουσία, όχι ψέμα τύπου', () => {
    expect(resolveSpaceStatuses({ status: 'active', commercialStatus: 'κάτι', operationalStatus: 'κάτι' }))
      .toEqual({ status: 'active' });
  });
});

describe('Β. ΤΟ ΠΑΛΙΟ ΑΝΑΜΕΙΚΤΟ ΠΕΔΙΟ — ΜΟΝΟ ΟΣΑ ΙΣΧΥΡΙΖΟΤΑΝ ΡΗΤΑ', () => {
  it('Β1 — `sold`/`reserved`/`unavailable` ⇒ εμπορικά· `maintenance` ⇒ λειτουργικό', () => {
    expect(resolveSpaceStatuses({ status: 'sold' }).commercialStatus).toBe('sold');
    expect(resolveSpaceStatuses({ status: 'reserved' }).commercialStatus).toBe('reserved');
    expect(resolveSpaceStatuses({ status: 'unavailable' }).commercialStatus).toBe('unavailable');
    expect(resolveSpaceStatuses({ status: 'maintenance' }).operationalStatus).toBe('maintenance');
  });

  it('🔴 Β2 — ΚΑΜΙΑ ΜΑΝΤΕΨΙΑ: `available` δεν γίνεται «προς πώληση» ούτε «Έτοιμο»', () => {
    // Το `COMMERCIAL_STATUS_ALIASES` διαβάζει `available` ως `for-sale` για ΑΚΙΝΗΤΑ — για χώρο
    // σήμαινε «ελεύθερη», άρα εδώ ΔΕΝ πρέπει να περάσει από εκείνο τον κανονικοποιητή.
    expect(resolveSpaceStatuses({ status: 'available' })).toEqual({ status: 'active' });
  });

  it('Β3 — `occupied`/`owner` έλεγαν «έχει χρήστη» χωρίς το πώς ⇒ τίποτα', () => {
    expect(resolveSpaceStatuses({ status: 'occupied' })).toEqual({ status: 'active' });
    expect(resolveSpaceStatuses({ status: 'owner' })).toEqual({ status: 'active' });
  });

  it('Β4 — ο πίνακας είναι εξαντλητικός και δεν ισχυρίζεται ποτέ συναλλαγή που δεν έλεγε', () => {
    expect(Object.keys(LEGACY_SPACE_STATUS_SPLIT).sort()).toEqual([...LEGACY_SPACE_STATUSES].sort());
    for (const claim of Object.values(LEGACY_SPACE_STATUS_SPLIT)) {
      if (claim.commercialStatus) expect(COMMERCIAL_STATUSES).toContain(claim.commercialStatus);
      expect(claim.commercialStatus).not.toBe('for-sale');
    }
  });

  it('Β5 — `hasLegacySpaceStatus` ξεχωρίζει το παλιό πεδίο από τον κύκλο ζωής', () => {
    expect(hasLegacySpaceStatus({ status: 'available' })).toBe(true);
    expect(hasLegacySpaceStatus({ status: 'active' })).toBe(false);
    expect(hasLegacySpaceStatus({ status: 'deleted' })).toBe(false);
  });
});

describe('Γ. Ο ΚΑΔΟΣ (ADR-281)', () => {
  it('Γ1 — `deleted` μένει `deleted`· οτιδήποτε άλλο είναι ζωντανή εγγραφή', () => {
    expect(resolveSpaceStatuses({ status: 'deleted' }).status).toBe('deleted');
    expect(resolveSpaceStatuses({}).status).toBe('active');
    expect(resolveSpaceStatuses({ status: 'sold' }).status).toBe('active');
  });
});

describe('Δ. Η ΣΥΜΠΛΗΡΩΣΗ (backfill) — Ο ΙΔΙΟΣ ΠΙΝΑΚΑΣ, ΙΔΕΜΠΟΤΗΤΙΚΗ', () => {
  it('Δ1 — ΔΟΚΙΜΗ Θ/Ι (legacy `available`, νέα διάθεση) ⇒ ΜΟΝΟ `status: active`', () => {
    expect(planSpaceStatusBackfill({ status: 'available', commercialStatus: 'for-rent' }))
      .toEqual({ kind: 'write', updates: { status: 'active' } });
  });

  it('Δ2 — ό,τι ισχυριζόταν και ΛΕΙΠΕΙ γράφεται· ό,τι υπάρχει ΔΕΝ ξαναγράφεται', () => {
    expect(planSpaceStatusBackfill({ status: 'maintenance' }))
      .toEqual({ kind: 'write', updates: { status: 'active', operationalStatus: 'maintenance' } });
    expect(planSpaceStatusBackfill({ status: 'sold', commercialStatus: 'reserved' }))
      .toEqual({ kind: 'write', updates: { status: 'active' } });
  });

  it('Δ3 — ιδεμπότητα: μετά τη γραφή, δεύτερη εκτέλεση ⇒ noop', () => {
    const before = { status: 'reserved' };
    const plan = planSpaceStatusBackfill(before);
    const after = { ...before, ...(plan.kind === 'write' ? plan.updates : {}) };
    expect(planSpaceStatusBackfill(after)).toEqual({ kind: 'noop' });
  });

  it('Δ4 — στον κάδο με παλιό `previousStatus`: η επαναφορά ΔΕΝ θα ξαναγράψει το ανάμεικτο πεδίο', () => {
    expect(planSpaceStatusBackfill({ status: 'deleted', previousStatus: 'sold' }))
      .toEqual({ kind: 'write', updates: { previousStatus: 'active', commercialStatus: 'sold' } });
    expect(planSpaceStatusBackfill({ status: 'deleted', previousStatus: 'active' })).toEqual({ kind: 'noop' });
  });
});

describe('Ε. Η ΝΕΑ ΕΓΓΡΑΦΗ', () => {
  it('Ε1 — ζωντανή, λειτουργικά ο ίδιος κανόνας με τη γέννηση ακινήτου, χωρίς διάθεση', () => {
    expect(NEW_SPACE_STATUSES).toEqual({ status: 'active', operationalStatus: DEFAULT_OPERATIONAL_STATUS });
    expect(NEW_SPACE_STATUSES).not.toHaveProperty('commercialStatus');
  });
});
