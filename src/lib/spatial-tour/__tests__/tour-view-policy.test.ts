/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΠΙΝΑΚΑΣ ΤΗΣ ΠΥΛΗΣ ΘΕΑΣΗΣ** (ADR-884 Κ3β) — άγκυρες, καρτεσιανά.
 *
 * - **Π** — ο πίνακας κύκλος ζωής × ορατότητα × βάση, **ολόκληρος** (3 × 3 × 5 περιπτώσεις).
 * - **Ρ** — οι ρητές άδειες **επιζούν** αλλαγής ορατότητας (Google Drive «specific people»).
 * - **Κ** — η δημόσια κάρτα αυτοενεργοποιείται (χωρίς σημαία).
 */

import {
  SPATIAL_TOUR_LIFECYCLES,
  SPATIAL_TOUR_VISIBILITIES,
  type SpatialTourLifecycle,
  type SpatialTourVisibility,
} from '@/constants/spatial-tour-vocabulary';

import { isTourListed, judgeTourView, type TourViewFacts, type TourViewVerdict } from '../tour-view-policy';

type Viewer = 'manager' | 'link' | 'approved' | 'signed-in' | 'anonymous';
const VIEWERS: readonly Viewer[] = ['manager', 'link', 'approved', 'signed-in', 'anonymous'];

function facts(lifecycle: SpatialTourLifecycle, visibility: SpatialTourVisibility, viewer: Viewer): TourViewFacts {
  return {
    lifecycle,
    visibility,
    isManager: viewer === 'manager',
    viewerUid: viewer === 'anonymous' || viewer === 'link' ? null : `uid-${viewer}`,
    requestStanding: viewer === 'approved' ? 'active' : 'none',
    requestId: viewer === 'approved' ? 'tacr_1' : null,
    linkShareId: viewer === 'link' ? 'share_1' : null,
  };
}

/** Η **προδιαγραφή**, γραμμένη ανεξάρτητα από την υλοποίηση — ό,τι λέει ο πίνακας της κεφαλίδας. */
function expected(lifecycle: SpatialTourLifecycle, visibility: SpatialTourVisibility, viewer: Viewer): string {
  if (viewer === 'manager') return 'granted:manager';
  if (lifecycle === 'withdrawn') return 'refused:not-viewable';
  if (viewer === 'link') return 'granted:link';
  if (viewer === 'approved') return 'granted:request';
  if (lifecycle !== 'published') return 'refused:not-viewable';
  if (visibility === 'public') return 'granted:public';
  if (visibility === 'on-request' && viewer === 'anonymous') return 'refused:sign-in-required';
  return 'refused:not-viewable';
}

const show = (verdict: TourViewVerdict) =>
  verdict.kind === 'granted' ? `granted:${verdict.basis}` : `refused:${verdict.reason}`;

describe('Π — ο πίνακας, ολόκληρος', () => {
  const cases = SPATIAL_TOUR_LIFECYCLES.flatMap((lifecycle) =>
    SPATIAL_TOUR_VISIBILITIES.flatMap((visibility) => VIEWERS.map((viewer) => [lifecycle, visibility, viewer] as const)));

  it('καλύπτει 45 περιπτώσεις (φρουρός κατά κενής άγκυρας)', () => {
    expect(cases).toHaveLength(45);
  });

  it.each(cases)('%s × %s × %s', (lifecycle, visibility, viewer) => {
    expect(show(judgeTourView(facts(lifecycle, visibility, viewer)))).toBe(expected(lifecycle, visibility, viewer));
  });
});

describe('Ρ — οι ρητές άδειες επιζούν αλλαγής ορατότητας', () => {
  it.each(SPATIAL_TOUR_VISIBILITIES)('εγκεκριμένος αιτών βλέπει και σε %s', (visibility) => {
    expect(show(judgeTourView(facts('published', visibility, 'approved')))).toBe('granted:request');
  });

  it('η βάση κουβαλά το id της πηγής (αίτημα / σύνδεσμος) — για ίχνος και αρχεία καταγραφής', () => {
    expect(judgeTourView(facts('published', 'on-request', 'approved'))).toEqual({ kind: 'granted', basis: 'request', basisId: 'tacr_1' });
    expect(judgeTourView(facts('draft', 'link-only', 'link'))).toEqual({ kind: 'granted', basis: 'link', basisId: 'share_1' });
  });

  it('ληγμένο / ανακλημένο αίτημα ΔΕΝ είναι βάση', () => {
    for (const standing of ['expired', 'revoked', 'unreadable', 'pending', 'declined'] as const) {
      const verdict = judgeTourView({ ...facts('published', 'on-request', 'approved'), requestStanding: standing });
      expect(show(verdict)).toBe('refused:not-viewable');
    }
  });

  it('υπεύθυνος χωρίς uid (αδύνατο στη δημόσια πόρτα) δεν παίρνει βάση manager', () => {
    const verdict = judgeTourView({ ...facts('published', 'public', 'anonymous'), isManager: true });
    expect(show(verdict)).toBe('granted:public');
  });
});

describe('Κ — η κάρτα της δημόσιας αγγελίας', () => {
  it('μόνο δημοσιευμένη, όχι link-only, και με έτοιμο tileset', () => {
    expect(isTourListed({ lifecycle: 'published', visibility: 'public' }, true)).toBe(true);
    expect(isTourListed({ lifecycle: 'published', visibility: 'on-request' }, true)).toBe(true);
    expect(isTourListed({ lifecycle: 'published', visibility: 'link-only' }, true)).toBe(false);
    expect(isTourListed({ lifecycle: 'draft', visibility: 'public' }, true)).toBe(false);
    expect(isTourListed({ lifecycle: 'published', visibility: 'public' }, false)).toBe(false);
  });
});
