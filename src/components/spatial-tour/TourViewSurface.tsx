'use client';

/**
 * @fileoverview **Η ΕΠΙΦΑΝΕΙΑ ΘΕΑΣΗΣ** — κρίση → κουπόνι → μανιφέστο → θεατής (ADR-884 Κ3β · Φ0.4).
 * @related `services/spatial-tour/spatial-tour-viewing.client.ts` (`openTourViewSessionFromScreen`) ·
 *   `TourViewPageContent.tsx` (σελίδα αγγελίας) · `shared/pages/SharedFilePageContent.tsx` (προσωπικός σύνδεσμος)
 * @module components/spatial-tour/TourViewSurface
 *
 * 🔑 **ΜΙΑ επιφάνεια, όλες οι βάσεις**: η σελίδα αγγελίας (δημόσια · εγκεκριμένος · υπεύθυνος) και ο προσωπικός
 * σύνδεσμος (`shareId`) ανοίγουν την **ίδια** συνεδρία — η πύλη του διακομιστή λέει τι βλέπει ο καθένας.
 * 🔑 **Το κουπόνι ανανεώνεται πριν λήξει** (κάθε 10′ < 15′): μια μακριά επίσκεψη δεν «σπάει» στη μέση· η ανανέωση
 * **δεν** ξαναμετρά (ίδια βάση ⇒ ίδια επίσκεψη) — και μια ανάκληση στο μεταξύ κόβει στην επόμενη ανανέωση.
 * 🔌 **Ο θεατής είναι υποδοχή** (`renderViewer`) — τον φέρνει η Φ1 (δική μας μηχανή three.js). Μέχρι να υπάρξουν
 * πλακίδια (Φ2) το μανιφέστο λέει `ready: false` και η οθόνη λέει «ετοιμάζεται», ποτέ μαύρη σφαίρα.
 */

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/auth/hooks/useAuth';
import type { TourViewSessionView } from '@/app/api/spatial-tours/_shared/tour-view-route';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourRefusalName } from '@/lib/spatial-tour/tour-refusal-vocabulary';
import type { TourManifest } from '@/server/spatial-tour/tour-view-session';
import { openTourViewSessionFromScreen } from '@/services/spatial-tour/spatial-tour-viewing.client';
import type { TourSubject } from '@/types/spatial-tour';

import { TOUR_REFUSAL_KEY } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { VIEW_BASIS_KEY, VIEWER_KEYS } from './tour-access-labels';

/** Ανανέωση του κουπονιού — αρκετά πριν τα 15′ του διακομιστή, ώστε μια αργή απάντηση να μη βρει κενό. */
const RENEW_EVERY_MS = 10 * 60 * 1000;

type SurfaceState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'granted'; readonly view: TourViewSessionView }
  | { readonly kind: 'refused'; readonly reason: TourRefusalName }
  | { readonly kind: 'failed' };

export interface TourViewSurfaceProps {
  readonly subject: TourSubject;
  /** Μόνο από τον προσωπικό σύνδεσμο (`/shared/[token]`). */
  readonly shareId: string | null;
  /** Η υποδοχή του θεατή (Φ1) — παίρνει το μανιφέστο μόνο όταν `ready`. */
  readonly renderViewer?: (manifest: TourManifest) => ReactNode;
}

function useTourViewSession(subject: TourSubject, shareId: string | null): SurfaceState {
  const { user, loading } = useAuth();
  const [state, setState] = useState<SurfaceState>({ kind: 'loading' });
  const signedIn = user !== null;
  useEffect(() => {
    if (loading) return;
    let live = true;
    const open = async () => {
      const result = await openTourViewSessionFromScreen(subject, { signedIn, shareId });
      if (!live) return;
      if (result.kind === 'ok') setState({ kind: 'granted', view: result.value });
      else setState(result.kind === 'refused' ? { kind: 'refused', reason: result.reason } : { kind: 'failed' });
    };
    void open();
    const timer = setInterval(() => void open(), RENEW_EVERY_MS);
    return () => { live = false; clearInterval(timer); };
  }, [subject, shareId, signedIn, loading]);
  return state;
}

export function TourViewSurface({ subject, shareId, renderViewer }: TourViewSurfaceProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const state = useTourViewSession(subject, shareId);
  if (state.kind === 'loading') return <p className="text-sm text-muted-foreground" aria-busy>{t(VIEWER_KEYS.title)}</p>;
  if (state.kind !== 'granted') {
    return (
      <p className="text-sm text-destructive" role="alert">
        {state.kind === 'refused' ? t(TOUR_REFUSAL_KEY[state.reason]) : t(VIEWER_KEYS.unavailable)}
      </p>
    );
  }
  const { basis, manifest } = state.view;
  return (
    <section aria-labelledby="tour-view-heading" className="space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <h1 id="tour-view-heading" className="text-xl font-semibold">{manifest.label ?? t(VIEWER_KEYS.title)}</h1>
        <Badge variant="secondary">{t(VIEW_BASIS_KEY[basis])}</Badge>
        {manifest.ready && <span className="text-sm text-muted-foreground">{t(VIEWER_KEYS.stops, { count: manifest.stops.length })}</span>}
      </header>
      {manifest.ready && renderViewer
        ? renderViewer(manifest)
        : <p className="text-sm text-muted-foreground" role="status">{t(VIEWER_KEYS.preparing)}</p>}
    </section>
  );
}
