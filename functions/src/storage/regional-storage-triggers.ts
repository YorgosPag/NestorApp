/**
 * =============================================================================
 * REGIONAL STORAGE TRIGGERS — gen2 bindings ανά περιφερειακό κάδο (ADR-895 Α7 · Ε5 · Φ2)
 * =============================================================================
 *
 * Ο κανονικός κάδος ακούγεται από τα **gen1** bindings (`onStorageFinalize`, `onDxfProcessedFinalize`)
 * όπως πάντα. Κάθε **άλλος** κάδος πρωτοτύπων χρειάζεται δικό του trigger, και ο Eventarc απαιτεί ο
 * trigger να είναι στην **ίδια** περιοχή με τον κάδο
 * (https://docs.cloud.google.com/eventarc/docs/run/create-trigger-storage-gcloud). Πέρα από το τυπικό:
 * function στις ΗΠΑ που **κατεβάζει** bytes ΕΕ (ραστεροποίηση DXF) = επεξεργασία στις ΗΠΑ ⇒ θα ακύρωνε
 * την τοποθεσία (ADR-895 §3.5). Άρα gen2 στην περιοχή του κάδου.
 *
 * **Εδώ ζουν ΜΟΝΟ λεπτά bindings** — κανένα σώμα. Τα σώματα (`markOrphanCandidateOnFinalize`,
 * `generateDxfThumbnailOnFinalize`) και οι επιλογές runtime (`FINALIZE_RUNTIME`) είναι τα ΙΔΙΑ με του gen1.
 *
 * 🔑 **Όνομα κάδου χωρίς χειρόγραφο string**: `expr` + το ενσωματωμένο `projectID` — το CLI το επιλύει στο
 * deploy (`eventFilters` → `resolveString`), με την ΙΔΙΑ σύνθεση `{project}{FILES_EU_BUCKET_SUFFIX}` που
 * δίνει το `fileStorageBucketNames()` στο runtime. Η περιοχή έρχεται από την προβολή (`FILES_EU_BUCKET_LOCATION`),
 * την ίδια σταθερά που διαβάζει η δήλωση του κάδου. 🏆 Δίχτυ: το CLI **αρνείται** το deploy αν η περιοχή της
 * function διαφέρει από του κάδου (`ensureStorageTriggerRegion`).
 *
 * 🔒 **Πληρότητα από τον τύπο**: `REGIONAL_FINALIZE_TRIGGERS` είναι `Record<κάδος, Record<handler, …>>` ⇒ νέος
 * handler ή νέος κάδος χωρίς binding **δεν μεταγλωττίζεται**. Τα ονομαστικά exports υπάρχουν μόνο επειδή το
 * Firebase ανακαλύπτει functions από **στατικά** ονόματα του `index.ts`.
 *
 * ⚠️ Τα ονόματα είναι **νέα** (όχι μετακίνηση των gen1): αλλαγή γενιάς με ίδιο όνομα είναι αδύνατη στο deploy
 * (https://firebase.google.com/docs/functions/2nd-gen-upgrade).
 *
 * @module functions/storage/regional-storage-triggers
 * @see ./finalize-runtime.ts · ./finalized-object.ts · ./orphan-cleanup.ts · ./dxf-thumbnail-onfinalize.ts
 */

import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { expr, projectID } from 'firebase-functions/params';
import type { Expression } from 'firebase-functions/params';

import {
  FILES_EU_BUCKET_LOCATION,
  FILES_EU_BUCKET_SUFFIX,
  type FileStoragePlacement,
} from '../generated/lib/files/file-storage-placement';
import { fileStorageBucketNames } from './file-record-bucket';
import { finalizedObjectOf, type FinalizedObject } from './finalized-object';
import { FINALIZE_RUNTIME, gen2Memory, type FinalizeHandlerId } from './finalize-runtime';
import { markOrphanCandidateOnFinalize } from './orphan-cleanup';
import { generateDxfThumbnailOnFinalize } from './dxf-thumbnail-onfinalize';

/** Ένας περιφερειακός κάδος πρωτοτύπων που ακούμε με gen2. */
export interface RegionalTriggerBucket {
  readonly placement: Exclude<FileStoragePlacement, 'legacy-default'>;
  readonly bucket: Expression<string>;
  /** Περιοχή Cloud Functions (πεζά) — ίδια με του κάδου. */
  readonly region: string;
}

/** Ο δηλωτικός κατάλογος — νέος περιφερειακός κάδος = **μία** γραμμή (και ο τύπος απαιτεί τα bindings του). */
export const REGIONAL_TRIGGER_BUCKETS = {
  'files-eu': {
    placement: 'eu-originals',
    bucket: expr`${projectID}${FILES_EU_BUCKET_SUFFIX}`,
    region: FILES_EU_BUCKET_LOCATION.toLowerCase(),
  },
} as const satisfies Readonly<Record<string, RegionalTriggerBucket>>;

export type RegionalTriggerBucketId = keyof typeof REGIONAL_TRIGGER_BUCKETS;

/** Τα σώματα — τα ΙΔΙΑ που καλούν τα gen1 bindings. */
const FINALIZE_BODIES: Readonly<Record<FinalizeHandlerId, (object: FinalizedObject) => Promise<void>>> = {
  orphanMarker: markOrphanCandidateOnFinalize,
  dxfThumbnail: generateDxfThumbnailOnFinalize,
};

/** Ένα λεπτό gen2 binding: επιλογές από το `FINALIZE_RUNTIME`, κάδος/περιοχή από τον κατάλογο. */
export function gen2FinalizeBinding(handlerId: FinalizeHandlerId, target: RegionalTriggerBucket) {
  const runtime = FINALIZE_RUNTIME[handlerId];
  return onObjectFinalized(
    {
      bucket: target.bucket,
      region: target.region,
      timeoutSeconds: runtime.timeoutSeconds,
      memory: gen2Memory(runtime),
      ...(runtime.concurrency === undefined ? {} : { concurrency: runtime.concurrency }),
    },
    async (event) => {
      const object = finalizedObjectOf(event.data, fileStorageBucketNames());
      if (object) await FINALIZE_BODIES[handlerId](object);
    },
  );
}

type Gen2FinalizeTrigger = ReturnType<typeof gen2FinalizeBinding>;

export const REGIONAL_FINALIZE_TRIGGERS: Readonly<
  Record<RegionalTriggerBucketId, Readonly<Record<FinalizeHandlerId, Gen2FinalizeTrigger>>>
> = {
  'files-eu': {
    orphanMarker: gen2FinalizeBinding('orphanMarker', REGIONAL_TRIGGER_BUCKETS['files-eu']),
    dxfThumbnail: gen2FinalizeBinding('dxfThumbnail', REGIONAL_TRIGGER_BUCKETS['files-eu']),
  },
};

export const onStorageFinalizeFilesEu = REGIONAL_FINALIZE_TRIGGERS['files-eu'].orphanMarker;
export const onDxfProcessedFinalizeFilesEu = REGIONAL_FINALIZE_TRIGGERS['files-eu'].dxfThumbnail;
