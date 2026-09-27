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
 * 🔌 **Ο θεατής** (ADR-884 Φ2γ): εξ ορισμού ο `TourViewerLoader` — δική μας μηχανή three.js πίσω από `next/dynamic`, με την
 * πηγή πλακιδίων — **εδώ, μία φορά**, ώστε σελίδα αγγελίας και προσωπικός σύνδεσμος να μη μπορούν να αποκλίνουν (η
 * υποδοχή `renderViewer` της Φ1 καταργήθηκε — δεν την γέμισε ποτέ κανείς). Χωρίς έτοιμη στάση (`ready: false`) η οθόνη
 * λέει «ετοιμάζεται», ποτέ μαύρη σφαίρα.
 */

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/auth/hooks/useAuth';
import type { TourViewSessionView } from '@/app/api/spatial-tours/_shared/tour-view-route';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourRefusalName } from '@/lib/spatial-tour/tour-refusal-vocabulary';
import { openTourViewSessionFromScreen } from '@/services/spatial-tour/spatial-tour-viewing.client';
import type { TourSubject } from '@/types/spatial-tour';

import { TOUR_REFUSAL_KEY } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { VIEW_BASIS_KEY, VIEWER_KEYS } from './tour-access-labels';
import { TourViewerLoader } from './viewer/TourViewerLoader';

/** Ανανέωση του κουπονιού — αρκετά πριν τα 15′ του διακομιστή, ώστε μια αργή απάντηση να μη βρει κενό. */
export const TOUR_VIEW_RENEW_EVERY_MS = 10 * 60 * 1000;

type SurfaceState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'granted'; readonly view: TourViewSessionView }
  | { readonly kind: 'refused'; readonly reason: TourRefusalName }
  | { readonly kind: 'failed' };

export interface TourViewSurfaceProps {
  readonly subject: TourSubject;
  /** Μόνο από τον προσωπικό σύνδεσμο (`/shared/[token]`). */
  readonly shareId: string | null;
  /**
   * Η απάντηση σε άρνηση **με δρόμο** (ADR-884 §9.1 Α5) — η σελίδα αγγελίας δίνει την κάρτα αιτήματος («γιατί» + «τι να
   * κάνω»). Χωρίς αυτήν (προσωπικός σύνδεσμος): το ονομασμένο μήνυμα της άρνησης.
   */
  readonly renderRefusal?: (reason: TourRefusalName) => ReactNode;
  /** Πρώτο στοιχείο της επικεφαλίδας — η σελίδα αγγελίας βάζει εδώ το «Πίσω στην αγγελία» (Φ2στ, μία γραμμή όπως η Zillow). */
  readonly lead?: ReactNode;
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
    const timer = setInterval(() => void open(), TOUR_VIEW_RENEW_EVERY_MS);
    return () => { live = false; clearInterval(timer); };
  }, [subject, shareId, signedIn, loading]);
  return state;
}

function SurfaceMessage({ lead, children }: { readonly lead?: ReactNode; readonly children: ReactNode }) {
  return <section className="space-y-3 p-4">{lead}{children}</section>;
}

/**
 * 🏆 **Διάταξη Zillow 3D Home** (Φ2στ · §4.12): **μία** γραμμή επικεφαλίδας (πίσω · τίτλος · βάση), και ο θεατής παίρνει
 * **όλο** το υπόλοιπο ύψος (`flex-1 min-h-0`) — όσο του δίνει ο γονέας: πλήρες παράθυρο στη σελίδα αγγελίας, ροή εγγράφου
 * στον προσωπικό σύνδεσμο (εκεί κρατά ελάχιστο ύψος ο ίδιος ο θεατής).
 */
export function TourViewSurface({ subject, shareId, renderRefusal, lead }: TourViewSurfaceProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const state = useTourViewSession(subject, shareId);
  if (state.kind === 'loading') return <SurfaceMessage lead={lead}><p className="text-sm text-muted-foreground" aria-busy>{t(VIEWER_KEYS.title)}</p></SurfaceMessage>;
  if (state.kind === 'refused' && renderRefusal) return <SurfaceMessage lead={lead}>{renderRefusal(state.reason)}</SurfaceMessage>;
  if (state.kind !== 'granted') {
    return (
      <SurfaceMessage lead={lead}>
        <p className="text-sm text-destructive" role="alert">
          {state.kind === 'refused' ? t(TOUR_REFUSAL_KEY[state.reason]) : t(VIEWER_KEYS.unavailable)}
        </p>
      </SurfaceMessage>
    );
  }
  const { basis, manifest } = state.view;
  return (
    <section aria-labelledby="tour-view-heading" className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2">
        {lead}
        <h1 id="tour-view-heading" className="m-0 text-base font-semibold">{manifest.label ?? t(VIEWER_KEYS.title)}</h1>
        <Badge variant="secondary">{t(VIEW_BASIS_KEY[basis])}</Badge>
        {manifest.ready && <span className="text-sm text-muted-foreground">{t(VIEWER_KEYS.stops, { count: manifest.stops.length })}</span>}
      </header>
      {manifest.ready
        ? <TourViewerLoader subject={subject} manifest={manifest} />
        : <p className="p-4 text-sm text-muted-foreground" role="status">{t(VIEWER_KEYS.preparing)}</p>}
    </section>
  );
}
