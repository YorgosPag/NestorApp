'use client';

/**
 * ADR-929 Δ21 (δ) βήμα 1 — οι **μικρογραφίες** της λίστας «Τι διάβασα»: για κάθε κείμενο, το απόσπασμα της εικόνας από το
 * οποίο διαβάστηκε (η τιμή δίπλα στο τεκμήριό της — πρακτική Microsoft Content Understanding, «grounding»).
 *
 * 🔑 **Κάτοχος του κύκλου ζωής των object URL**: κάθε URL που δημιουργείται εδώ ανακαλείται εδώ — σε νέα ανάγνωση, νέα
 *   αναγνώριση ή κλείσιμο (cleanup του effect). Καμία διαρροή, κανένα URL σε store.
 * 🔑 Από την ανάγνωση της **μηχανής**: τα πλαίσια δεν αλλάζουν με τις διορθώσεις, άρα μια διόρθωση δεν ξαναφτιάχνει
 *   μικρογραφίες. Ο provider διαβάζεται τη στιγμή της δουλειάς (getter, ADR-040).
 * 🔑 Ακύρωση: αν αλλάξει η ανάγνωση στο μεταξύ, ό,τι έχει ήδη φτιαχτεί ανακαλείται και τίποτα δεν γράφεται.
 * 🔑 ADR-929 §6.16 #8 — **καμία δουλειά μέσα στο commit της παραλαβής**: το κόψιμο + κωδικοποίηση της πρώτης μικρογραφίας
 *   μετρήθηκε 342 ms **μέσα** στο ίδιο long task με τη σύντηξη (το passive effect αδειάζει συγχρονικά στο τέλος του).
 *   Κάθε μικρογραφία ξεκινά πλέον **μετά από ζωγραφική** (`UnifiedFrameScheduler.scheduleOnceDelayed`, ADR-040), μία ανά
 *   βήμα, ώστε η λίστα να φανεί πρώτα και κανένα βήμα να μην κρατά όλη τη σειρά.
 *
 * @see ../floorplan-background/providers/provider-plan-raster.ts (`cropPlanRegion`)
 */

import * as React from 'react';
import { getFloorProvider } from '../floorplan-background/stores/floorplanBackgroundStore';
import type { IFloorplanBackgroundProvider } from '../floorplan-background/providers/IFloorplanBackgroundProvider';
import type { PlanReadingOutcome } from '../bim/plan-recognition/plan-recognition-types';
import { PLAN_READ_THUMB_MAX_EDGE_PX, planReadThumbRect } from '../systems/plan-recognition/plan-read-values';
import { UnifiedFrameScheduler } from '../rendering/core/UnifiedFrameScheduler';

/** Ανώτατο πλήθος μικρογραφιών ανά ανάγνωση (μια σελίδα με εκατοντάδες κείμενα δεν παράγει εκατοντάδες εικόνες). */
const MAX_THUMBNAILS = 150;

const NO_THUMBNAILS: ReadonlyMap<string, string> = new Map();

const SCHEDULE_ID = 'plan-read-value-thumbnail';

type ReadText = Extract<PlanReadingOutcome, { status: 'read' }>['reading']['texts'][number];

/** Μία δουλειά παραγωγής: κάθε βήμα περιμένει ζωγραφική, φτιάχνει ΜΙΑ μικρογραφία και προγραμματίζει το επόμενο. */
interface ThumbnailJob {
  readonly provider: IFloorplanBackgroundProvider;
  readonly texts: readonly ReadText[];
  readonly onDone: (thumbnails: ReadonlyMap<string, string>) => void;
}

/** Ξεκινά τη δουλειά· επιστρέφει ακύρωση που σταματά το επόμενο βήμα και ανακαλεί ό,τι φτιάχτηκε. */
function startThumbnailJob(job: ThumbnailJob): () => void {
  const created: string[] = [];
  const next = new Map<string, string>();
  let cancelled = false;
  let cancelPending: () => void = () => undefined;

  const makeOne = async (text: ReadText): Promise<void> => {
    const blob = await job.provider
      .getRegionImage(planReadThumbRect(text.rect), PLAN_READ_THUMB_MAX_EDGE_PX)
      .catch(() => null); // μια μικρογραφία που αποτυγχάνει απλώς λείπει· η λίστα δουλεύει χωρίς αυτήν
    if (cancelled || blob === null) return;
    const url = URL.createObjectURL(blob);
    created.push(url);
    next.set(text.id, url);
  };

  const step = (index: number): void => {
    if (cancelled) return;
    if (index >= job.texts.length) {
      job.onDone(next);
      return;
    }
    cancelPending = UnifiedFrameScheduler.scheduleOnceDelayed(SCHEDULE_ID, () => {
      void makeOne(job.texts[index]).then(() => step(index + 1));
    }, 0);
  };

  step(0);
  return () => {
    cancelled = true;
    cancelPending();
    for (const url of created) URL.revokeObjectURL(url);
  };
}

/** `textId → object URL`. Άδειο χωρίς ανάγνωση ή υπόβαθρο. */
export function usePlanReadValueThumbnails(floorId: string | null, reading: PlanReadingOutcome | null): ReadonlyMap<string, string> {
  const [thumbnails, setThumbnails] = React.useState<ReadonlyMap<string, string>>(NO_THUMBNAILS);
  React.useEffect(() => {
    setThumbnails(NO_THUMBNAILS);
    const provider = floorId ? getFloorProvider(floorId) : null;
    if (!provider || reading?.status !== 'read') return undefined;
    return startThumbnailJob({ provider, texts: reading.reading.texts.slice(0, MAX_THUMBNAILS), onDone: setThumbnails });
  }, [floorId, reading]);
  return thumbnails;
}
