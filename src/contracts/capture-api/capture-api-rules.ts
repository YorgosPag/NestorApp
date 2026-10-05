/**
 * @fileoverview **ΟΙ ΚΑΝΟΝΕΣ ΠΟΥ Ο ΠΕΛΑΤΗΣ ΕΦΑΡΜΟΖΕΙ ΠΡΙΝ ΡΩΤΗΣΕΙ** — η επέκταση `x-nestor-rules` του συμβολαίου.
 * @related ADR-904 Ε6 · Α6 (έλεγχος πριν το ανέβασμα) · Α8 (όροφος + τύπος χώρου) · Α9 (ιδεμποτία) · ADR-872
 * @module contracts/capture-api/capture-api-rules
 *
 * 🔑 **Γιατί επέκταση και όχι σχήμα**: τα σχήματα λένε **τι σχήμα** έχει ένα σώμα· εδώ ζουν **τιμές** που κανένα σώμα
 * δεν κουβαλά — το ταβάνι των 40 MB, η ανοχή 2:1, οι τύποι χώρου του επιλογέα, οι κωδικοί που αξίζει να ξαναδοκιμαστούν.
 * Ο πελάτης Kotlin τις παίρνει **παραγόμενες** (`object CaptureRules`), όχι αντιγραμμένες (ADR-904 §5 ΜΗΝ).
 *
 * ⚠️ **Ο διακομιστής ΠΑΡΑΜΕΝΕΙ η αυθεντία** (Α2): ο πελάτης διαβάζει αυτές τις τιμές μόνο για να **προειδοποιήσει**
 * νωρίς και να εξηγήσει· τίποτα στον διακομιστή δεν εμπιστεύεται ότι «το έλεγξε η εφαρμογή».
 *
 * **Layering**: leaf — μόνο καθαρά λεξιλόγια, **καμία** τιμή γραμμένη εδώ.
 */

import { INVITATION_REDEEM_ACTIONS, INVITATION_REDEEM_REFUSED_STATUS } from '@/contracts/invitation-redeem-body';
import { MAX_MEDIA_LICENSORS, MEDIA_LICENSE_PURPOSES, MEDIA_LICENSE_TERM_KINDS } from '@/constants/media-rights-vocabulary';
import { PLACE_SOURCES } from '@/constants/place-sources';
import { PRODUCT_NAME } from '@/constants/product-identity';
import {
  TOUR_CAPTURE_AUDIENCES,
  TOUR_HEADING_SOURCES,
  TOUR_HINT_POINT_MAX_PX,
  TOUR_HINT_RADIUS_MAX_PX,
  TOUR_MILESTONES,
  TOUR_ROOM_LABEL_MAX,
  TOUR_ROOM_MAX_TYPES,
  TOUR_ROOM_TYPES,
  TOUR_UPLOAD_SOURCES,
} from '@/constants/spatial-tour-vocabulary';
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_RETRYABLE_CODES,
  IDEMPOTENCY_TTL_MS,
  IDEMPOTENT_REPLAYED_HEADER,
} from '@/lib/api/idempotency/idempotency-contract';
import {
  PANORAMA_ASPECT_TOLERANCE_PX,
  PANORAMA_CONTENT_TYPE,
  PANORAMA_MAX_BYTES,
  PANORAMA_MIN_WIDTH_PX,
  PANORAMA_PROJECTION,
} from '@/lib/spatial-tour/panorama-policy';
import {
  RESUMABLE_BACKOFF_BASE_MS,
  RESUMABLE_BACKOFF_MAX_MS,
  RESUMABLE_CHUNK_BYTES,
  RESUMABLE_CHUNK_QUANTUM_BYTES,
  RESUMABLE_MAX_CONSECUTIVE_FAILURES,
} from '@/lib/storage/resumable-upload-policy';
import { STATUS_BY_TOUR_REFUSAL } from '@/lib/spatial-tour/tour-refusal-status';
import { TOUR_REFUSALS } from '@/lib/spatial-tour/tour-refusal-vocabulary';
import { CORE_INVITATION_REFUSALS } from '@/types/invitation-core';

/**
 * **Επαναλήψιμη = «δεν μπόρεσα», όχι «όχι»** (5xx): ίδιο κριτήριο με το `TOUR_UNAVAILABLE`. Κάθε 4xx είναι
 * απόφαση για **αυτό** το αίτημα — η επανάληψη του ίδιου αιτήματος δίνει την ίδια απάντηση.
 */
function isRetryableStatus(status: number): boolean {
  return status >= 500;
}

/** Κάθε άρνηση της περιήγησης με το status της και αν αξίζει επανάληψη — στη **σειρά του λεξιλογίου**. */
function tourRefusalRules(): ReadonlyArray<{ readonly code: string; readonly status: number; readonly retryable: boolean }> {
  return TOUR_REFUSALS.map((code) => {
    const status = STATUS_BY_TOUR_REFUSAL[code];
    return { code, status, retryable: isRetryableStatus(status) };
  });
}

/** **Η επέκταση `x-nestor-rules`** — δομή σταθερή (το διαβάζει γεννήτορας Kotlin), τιμές από τα SSoT. */
export function captureApiRules() {
  return {
    product: { name: PRODUCT_NAME },
    panorama: {
      contentType: PANORAMA_CONTENT_TYPE,
      maxBytes: PANORAMA_MAX_BYTES,
      minWidthPx: PANORAMA_MIN_WIDTH_PX,
      /** Πλάτος : ύψος — η ισοδύναμη προβολή (equirectangular). */
      aspectRatio: 2,
      aspectTolerancePx: PANORAMA_ASPECT_TOLERANCE_PX,
      /** Αν το αρχείο δηλώνει προβολή (XMP `GPano:ProjectionType`), πρέπει να είναι αυτή. */
      projection: PANORAMA_PROJECTION,
    },
    /** ADR-904 §10.9 (1.4.0) — το βήμα 2 της ροής (PUT στο `sessionUri`): ίδιοι αριθμοί με τον web πελάτη. */
    upload: {
      chunkBytes: RESUMABLE_CHUNK_BYTES,
      /** Κάθε τμήμα εκτός του τελευταίου = πολλαπλάσιο αυτού (απαίτηση του GCS). */
      chunkQuantumBytes: RESUMABLE_CHUNK_QUANTUM_BYTES,
      maxConsecutiveFailures: RESUMABLE_MAX_CONSECUTIVE_FAILURES,
      backoffBaseMs: RESUMABLE_BACKOFF_BASE_MS,
      backoffMaxMs: RESUMABLE_BACKOFF_MAX_MS,
    },
    /** ADR-904 §10.9 (1.4.0) — τα όρια του σημείου της πρότασης θέσης: ο πελάτης τα σέβεται **πριν** στείλει. */
    placement: {
      pointMaxPx: TOUR_HINT_POINT_MAX_PX,
      radiusMaxPx: TOUR_HINT_RADIUS_MAX_PX,
    },
    idempotency: {
      header: IDEMPOTENCY_KEY_HEADER,
      replayedHeader: IDEMPOTENT_REPLAYED_HEADER,
      maxKeyLength: IDEMPOTENCY_KEY_MAX_LENGTH,
      ttlMs: IDEMPOTENCY_TTL_MS,
      retryableCodes: [...IDEMPOTENCY_RETRYABLE_CODES].sort(),
    },
    vocabularies: {
      placeSources: PLACE_SOURCES,
      uploadSources: TOUR_UPLOAD_SOURCES,
      captureAudiences: TOUR_CAPTURE_AUDIENCES,
      milestones: TOUR_MILESTONES,
      roomTypes: TOUR_ROOM_TYPES,
      roomMaxTypes: TOUR_ROOM_MAX_TYPES,
      roomLabelMax: TOUR_ROOM_LABEL_MAX,
      headingSources: TOUR_HEADING_SOURCES,
      mediaLicensePurposes: MEDIA_LICENSE_PURPOSES,
      mediaLicenseTermKinds: MEDIA_LICENSE_TERM_KINDS,
      maxMediaLicensors: MAX_MEDIA_LICENSORS,
      invitationRedeemActions: INVITATION_REDEEM_ACTIONS,
    },
    refusals: {
      tour: tourRefusalRules(),
      invitation: CORE_INVITATION_REFUSALS.map((code) => ({
        code, status: INVITATION_REDEEM_REFUSED_STATUS, retryable: isRetryableStatus(INVITATION_REDEEM_REFUSED_STATUS),
      })),
    },
  } as const;
}

export type CaptureApiRules = ReturnType<typeof captureApiRules>;
