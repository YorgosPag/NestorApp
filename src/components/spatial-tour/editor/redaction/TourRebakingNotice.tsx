'use client';

/**
 * @fileoverview **ΣΗΜΕΙΟ ΠΟΥ ΕΤΟΙΜΑΖΕΤΑΙ ΞΑΝΑ** — ό,τι δείχνει ο επεξεργαστής όσο ψήνεται η λήψη ενός σημείου μετά από θόλωμα
 * (ADR-884 Φ2ζ ζ3 · §4.15 · Δ10.2).
 * @related `lib/spatial-tour/tour-editor-model.ts` (`rebaking` — η κρίση) · `TourEditor.tsx` (polling όσο υπάρχει) ·
 *   `TourEditorRail.tsx` (η ίδια κατάσταση στη στήλη)
 * @module components/spatial-tour/editor/redaction/TourRebakingNotice
 *
 * 🔑 **Καμία φωτογραφία εδώ, επίτηδες**: τα παλιά πλακίδια σβήνονται πριν το ψήσιμο (Φ2ζ απόφαση 4) και το πρωτότυπο δεν σερβίρεται
 *   ποτέ — ό,τι θα έδειχνε η οθόνη θα ήταν είτε ψέμα είτε ξεθωριασμένο πρόσωπο. Η «Αναίρεση» ζει στην ειδοποίηση της εφαρμογής.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourRebakingEntry } from '@/lib/spatial-tour/tour-editor-model';

import { SPATIAL_TOUR_NS } from '../../spatial-tour-namespace';
import { TOUR_REDACTION_KEYS } from '../tour-redaction-labels';

export function TourRebakingNotice({ entry }: { readonly entry: TourRebakingEntry }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const failed = entry.readiness === 'failed';
  return (
    <section className="space-y-1 rounded-lg border p-4" aria-labelledby="tour-rebaking-heading">
      <h3 id="tour-rebaking-heading" className="text-sm font-semibold">{t(TOUR_REDACTION_KEYS.rebaking)}</h3>
      <p role={failed ? 'alert' : 'status'} className={failed ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
        {t(failed ? TOUR_REDACTION_KEYS.rebakeFailed : TOUR_REDACTION_KEYS.rebakingHint)}
      </p>
    </section>
  );
}
