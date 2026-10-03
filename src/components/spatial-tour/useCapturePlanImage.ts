'use client';

/**
 * @fileoverview **Η ΕΙΚΟΝΑ ΜΙΑΣ ΒΑΘΜΟΝΟΜΗΜΕΝΗΣ ΚΑΤΟΨΗΣ ΓΙΑ ΤΑ ΕΙΣΕΡΧΟΜΕΝΑ** — από το `getCapturePlan` (ADR-904 Κ9), την **ίδια** πόρτα
 * με την εφαρμογή κινητού.
 * @related `services/spatial-tour/spatial-tour.client.ts` (`fetchCapturePlanImageFromScreen`) · `TourHintPlanPreview.tsx` ·
 *   `lib/cache/bounded-lru.ts`
 * @module components/spatial-tour/useCapturePlanImage
 *
 * 🔑 **Μία λήψη ανά hash**: η διαδρομή θέλει ταυτότητα (`Authorization`), άρα ένα `<image href>` δεν μπορεί να τη ζητήσει μόνο του·
 *   τα bytes έρχονται με τον πελάτη API. Αμετάβλητα ανά hash ⇒ φραγμένη κρυφή μνήμη: πέντε λήψεις με σημείο στην ίδια κάτοψη = ένα
 *   αίτημα. Το `blob:` URL ανήκει στο component που το έφτιαξε και ανακαλείται όταν φύγει.
 */

import { useEffect, useState } from 'react';

import { createBoundedLru } from '@/lib/cache/bounded-lru';
import { fetchCapturePlanImageFromScreen } from '@/services/spatial-tour/spatial-tour.client';
import type { TourSubject } from '@/types/spatial-tour';

/** Λίγες κατόψεις ανά ακίνητο, λίγα ακίνητα ανά οθόνη — 8 αρκούν· η εξαγωγή είναι μόνο της μνήμης, όχι του αποτελέσματος. */
const PLAN_CACHE_ENTRIES = 8;
const plans = createBoundedLru<Promise<Blob | null>>({ maxWeight: PLAN_CACHE_ENTRIES, weigh: () => 1 });

function planBlob(subject: TourSubject, contentHash: string): Promise<Blob | null> {
  const key = `${subject.kind}/${subject.id}/${contentHash}`;
  const cached = plans.get(key);
  if (cached !== undefined) return cached;
  const pending = fetchCapturePlanImageFromScreen(subject, contentHash).then((result) => (result.kind === 'ok' ? result.value : null));
  plans.set(key, pending);
  // Αποτυχία δεν κρατιέται: η επόμενη προβολή ξαναδοκιμάζει (π.χ. μετά από επανασύνδεση).
  void pending.then((blob) => { if (blob === null) plans.delete(key); });
  return pending;
}

/** `blob:` URL της κάτοψης — `null` όσο φορτώνει, αν απέτυχε, ή αν δεν ζητήθηκε (`contentHash: null`). */
export function useCapturePlanImage(subject: TourSubject, contentHash: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (contentHash === null) return undefined;
    let live = true;
    let created: string | null = null;
    void planBlob(subject, contentHash).then((blob) => {
      if (!live || blob === null) return;
      created = URL.createObjectURL(blob);
      setUrl(created);
    });
    return () => {
      live = false;
      if (created !== null) URL.revokeObjectURL(created);
      setUrl(null);
    };
  }, [subject, contentHash]);
  return url;
}
