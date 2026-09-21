/**
 * @fileoverview **ΜΙΑ ΚΑΝΟΝΙΚΗ ΔΙΕΥΘΥΝΣΗ ΑΝΑ ΒΙΤΡΙΝΑ** — ADR-841 §7 Α22 · ADR-787 §5.3 ζ.
 * @related lib/agency/showcase-canonical-segment.ts · app/(light)/pro/[alias]/page.tsx
 *
 * 🔴 **Τι φυλά**: ένα 308 **αποθηκεύεται** από τον φυλλομετρητή. Ανακατεύθυνση σε ψευδώνυμο
 * που η αυθεντία **δεν** επιβεβαιώνει για το **ίδιο** γραφείο θα κλείδωνε τον επισκέπτη σε
 * ξένη βιτρίνα — γι' αυτό τα «όχι» (Κ4-Κ7) μετρούν όσο και το «ναι» (Κ3).
 */

import { canonicalShowcaseSegment } from '@/lib/agency/showcase-canonical-segment';
import type { AliasResolution } from '@/lib/workspace/alias-registry';
import {
  describeOwnershipCallSites,
  PURE_VERDICT_PROBE,
  withOwner,
  type OwnerFixture,
} from '@/lib/auth/__tests__/_harness/ownership-callsite-contract';

const COMPANY = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';

type Found = Extract<AliasResolution, { readonly outcome: 'found' }>;

function identity(companyId = COMPANY): Found {
  return { outcome: 'found', companyId, form: 'identity', current: true, canonicalAlias: null };
}

function alias(companyId = COMPANY, current = true, canonicalAlias: string | null = null): Found {
  return { outcome: 'found', companyId, form: 'alias', current, canonicalAlias };
}

describe('canonicalShowcaseSegment', () => {
  it('Κ1 — τρέχον ψευδώνυμο ⇒ ήδη κανονικό, καμία ανακατεύθυνση', () => {
    expect(
      canonicalShowcaseSegment({ requested: alias(), publishedAlias: 'pagonis', publishedAliasResolution: null }),
    ).toBeNull();
  });

  it('Κ2 — ΠΑΛΙΟ ψευδώνυμο ⇒ στο κανονικό του', () => {
    expect(
      canonicalShowcaseSegment({
        requested: alias(COMPANY, false, 'pagonis-ae'),
        publishedAlias: null,
        publishedAliasResolution: null,
      }),
    ).toBe('pagonis-ae');
  });

  it('🔴 Κ3 — ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ: `/pro/comp_…` με δημοσιευμένο ψευδώνυμο ΤΟΥ ΙΔΙΟΥ ⇒ `pagonis`', () => {
    expect(
      canonicalShowcaseSegment({
        requested: identity(),
        publishedAlias: 'pagonis',
        publishedAliasResolution: alias(),
      }),
    ).toBe('pagonis');
  });

  it('🔴 Κ4 — ψευδώνυμο που λύνεται σε ΑΛΛΟ γραφείο ⇒ ΠΟΤΕ 308', () => {
    expect(
      canonicalShowcaseSegment({
        requested: identity(),
        publishedAlias: 'pagonis',
        publishedAliasResolution: alias('comp_00000000-0000-4000-8000-000000000000'),
      }),
    ).toBeNull();
  });

  it.each([
    ['ανύπαρκτο', { outcome: 'not-found' } as const],
    ['άγνωστο (βλάβη)', { outcome: 'unknown' } as const],
  ])('🔴 Κ5 — ψευδώνυμο %s ⇒ καμία ανακατεύθυνση: άγνωστο ≠ «στείλε»', (_label, resolution) => {
    expect(
      canonicalShowcaseSegment({ requested: identity(), publishedAlias: 'pagonis', publishedAliasResolution: resolution }),
    ).toBeNull();
  });

  it('🔑 Κ6 — αδημοσίευτη βιτρίνα ⇒ καμία ανακατεύθυνση: η σελίδα δεν γίνεται μαντείο', () => {
    expect(
      canonicalShowcaseSegment({ requested: identity(), publishedAlias: null, publishedAliasResolution: null }),
    ).toBeNull();
  });

  it('🔑 Κ7 — το «ψευδώνυμο» της βιτρίνας είναι η ίδια η ταυτότητα (δοκιμαστικές) ⇒ κανένας βρόχος', () => {
    expect(
      canonicalShowcaseSegment({
        requested: identity(),
        publishedAlias: COMPANY,
        publishedAliasResolution: identity(),
      }),
    ).toBeNull();
  });

  it('Κ8 — το δημοσιευμένο ψευδώνυμο είναι ΠΑΛΙΟ ⇒ κατευθείαν στο τρέχον, όχι σε δύο άλματα', () => {
    expect(
      canonicalShowcaseSegment({
        requested: identity(),
        publishedAlias: 'pagonis',
        publishedAliasResolution: alias(COMPANY, false, 'pagonis-ae'),
      }),
    ).toBe('pagonis-ae');
  });
});

// =============================================================================
// 🔴 ADR-742 §7terdecies — «ίδιο γραφείο;» με ζεύγος κενό/κενό
// =============================================================================
// Το Κ4 δίνει **υπαρκτό** ξένο γραφείο: μένει πράσινο και με σκέτο `===` στη θέση του SSoT.
// Η μόνη είσοδος που διακρίνει τους δύο είναι αίτημα **και** ψευδώνυμο χωρίς `companyId`
// — τότε το `===` θα έστελνε 308 σε ψευδώνυμο που **δεν** αποδείχθηκε δικό μας.

/** Ο ιδιοκτήτης του δημοσιευμένου ψευδωνύμου, όπως τον στήνει το `arrange` του harness. */
let publishedOwner: OwnerFixture = { kind: 'named', companyId: COMPANY };

describeOwnershipCallSites('canonicalShowcaseSegment — ιδιοκτησία ψευδωνύμου (ADR-742)', [
  {
    file: 'lib/agency/showcase-canonical-segment.ts',
    name: 'canonicalShowcaseSegment (ταυτότητα → ψευδώνυμο)',
    arrange: owner => {
      publishedOwner = owner;
      return PURE_VERDICT_PROBE;
    },
    act: async callerCompanyId =>
      canonicalShowcaseSegment({
        requested: identity(callerCompanyId),
        publishedAlias: 'pagonis',
        // `absent` = το πεδίο λείπει εντελώς — ο τύπος το υπόσχεται, η βάση δεν το εγγυάται.
        publishedAliasResolution: withOwner(alias(), publishedOwner) as Found,
      }),
    refused: result => result === null,
  },
]);
