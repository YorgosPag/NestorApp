'use client';

/**
 * @fileoverview **Η προεπισκόπηση εδάφους του ιδιοκτήτη, εκτός κύριου νήματος** (ADR-920 Β4.8 5γ) — ετυμηγορία της πόρτας +
 * χάρτης, από τον Web Worker, με «δείχνω το προηγούμενο όσο έρχεται το νέο».
 * @related lib/terrain/survey-import/survey-preview-client (Worker + δίχτυ) · lib/terrain/survey-import/survey-preview-host
 *   (η λογική) · hooks/listings/useTerrainSurveyImport (ο καλών) · components/listing-detail/terrain/TerrainPreview (η όψη)
 * @module hooks/listings/useSurveyPreview
 *
 * 🔑 **Δύο αλήθειες, χωριστά** (πέρα από το «Out of date» του Civil 3D, που ή παγώνει ή δείχνει παλιό χωρίς να το λέει):
 *   - ο **χάρτης** μένει ο τελευταίος που ήρθε, με `updating` όσο ο νεότερος είναι καθ' οδόν — ποτέ κενό, ποτέ πάγωμα·
 *   - η **ετυμηγορία** (`preparation`) δίνεται **μόνο** για τα ΤΡΕΧΟΝΤΑ σημεία — `null` όσο υπολογίζεται. Η δημοσίευση
 *     διαβάζει αυτήν ⇒ **δομικά αδύνατο** να σταλούν bytes παλιών σημείων.
 * 🔑 **Ταυτότητα σημείων = ταυτότητα πίνακα** (`WeakMap`): ίδια σημεία ⇒ ίδιο κλειδί ⇒ ο Worker ξαναζωγραφίζει μόνο τον χάρτη
 *   (αλλαγή πλάτους) χωρίς νέο τριγωνισμό. Καθαρό στο StrictMode — κανένας μετρητής μέσα σε render.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { TerrainMapModel } from '@/lib/terrain/publication/terrain-map-model';
import type { TopoPoint } from '@/lib/terrain/terrain-types';
import { createSurveyPreviewer, type SurveyPreviewer } from '@/lib/terrain/survey-import/survey-preview-client';
import type { SurveyPreviewReply } from '@/lib/terrain/survey-import/survey-preview-host';
import type { SurveyUploadPreparation } from '@/lib/terrain/survey-import/survey-upload-preparation';
import { WORKER_RPC_DISPOSED } from '@/lib/workers/worker-rpc-client';

export interface SurveyPreviewState {
  /** Η ετυμηγορία της πόρτας για τα **τρέχοντα** σημεία· `null` χωρίς σημεία ή όσο υπολογίζεται. */
  readonly preparation: SurveyUploadPreparation | null;
  /** Ο τελευταίος χάρτης που ήρθε — ίσως για προηγούμενη ερώτηση (δες `updating`)· `null` χωρίς επιφάνεια. */
  readonly model: TerrainMapModel | null;
  /** Νεότερη απάντηση είναι καθ' οδόν — ό,τι φαίνεται μπορεί να είναι παλιό. */
  readonly updating: boolean;
  /** Η τρέχουσα ερώτηση απέτυχε (Worker **και** δίχτυ) — ποτέ σιωπηλά «ενημερώνεται» για πάντα. */
  readonly failed: boolean;
}

export interface SurveyPreviewApi extends SurveyPreviewState {
  /** Γεννά τον Worker από νωρίς (π.χ. μόλις διαβαστεί το αρχείο). */
  readonly warm: () => void;
}

const keys = new WeakMap<readonly TopoPoint[], number>();
let lastKey = 0;

/** Το κλειδί ενός συνόλου σημείων — από 1 (το 0 είναι της προθέρμανσης). */
function keyOf(points: readonly TopoPoint[]): number {
  let key = keys.get(points);
  if (key === undefined) {
    key = (lastKey += 1);
    keys.set(points, key);
  }
  return key;
}

interface Answer {
  readonly reply: SurveyPreviewReply | null;
  /** Η ερώτηση που απέτυχε τελευταία, `key:width`. */
  readonly failedFor: string | null;
}

const NO_ANSWER: Answer = { reply: null, failedFor: null };
const questionId = (key: number, widthPx: number | null): string => `${key}:${widthPx ?? '-'}`;

/** Ένας previewer ανά οθόνη — ο Worker τερματίζεται στο unmount (ξαναγεννιέται αν το StrictMode ξαναπροσαρτήσει). */
function usePreviewer(): SurveyPreviewer {
  const [previewer] = useState(createSurveyPreviewer);
  useEffect(() => previewer.dispose, [previewer]);
  return previewer;
}

export function useSurveyPreview(points: readonly TopoPoint[], widthPx: number | null): SurveyPreviewApi {
  const previewer = usePreviewer();
  const [answer, setAnswer] = useState<Answer>(NO_ANSWER);
  const empty = points.length === 0;
  const key = empty ? 0 : keyOf(points);

  // Μόνο το unmount σβήνει απαντήσεις — ΟΧΙ η αλλαγή ερώτησης: μια παλιότερη που φτάνει μετά δείχνεται ως «παλιά»
  // (`updating`). Η σειρά άφιξης είναι η σειρά ερώτησης (`latestOnly`), άρα μια παλιά δεν σκεπάζει ποτέ νεότερη.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (empty) return;
    void previewer.preview({ key, points, widthPx }).then((result) => {
      if (!mounted.current) return;
      if (result.kind === 'ok') setAnswer({ reply: result.value, failedFor: null });
      // `disposed` = η οθόνη έφυγε (ή το StrictMode ξαναπροσάρτησε) — όχι αποτυχία της ερώτησης.
      else if (result.kind === 'failed' && result.error !== WORKER_RPC_DISPOSED) {
        setAnswer((previous) => ({ ...previous, failedFor: questionId(key, widthPx) }));
      }
    });
  }, [previewer, empty, key, points, widthPx]);

  const warm = useCallback(() => previewer.warm(), [previewer]);
  const { reply } = answer;
  const current = !empty && reply !== null && reply.key === key;
  const failed = !empty && answer.failedFor === questionId(key, widthPx);
  return {
    preparation: current ? reply.preparation : null,
    model: empty ? null : reply?.model ?? null,
    updating: !empty && !failed && !(current && reply.widthPx === widthPx),
    failed,
    warm,
  };
}
