/**
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΗΣ ΡΟΗΣ ΛΗΨΕΩΝ 360°** — τα σώματα που ανταλλάσσει ένας πελάτης **εκτός** εφαρμογής
 * (η εφαρμογή λήψης κινητού) με τον διακομιστή, ΜΙΑ φορά.
 * @related ADR-904 Ε6 · ADR-884 Φ0.8 · §4.5 (Κ3α) · `capture-api-document.ts` (η σύνθεση OpenAPI) · CHECK 3.98
 * @module contracts/capture-api/capture-api-schemas
 *
 * 🔑 **Ένα σχήμα, δύο χρήσεις** (πρότυπο Stripe/Google: το spec **παράγεται** από τον server, δεν γράφεται δίπλα του):
 * οι διαδρομές `…/uploads` και `…/uploads/finalize` κρίνουν τα σώματά τους με **αυτά** τα σχήματα, και ο γεννήτορας
 * (`npm run generate:capture-api-contract`) τα εξάγει ως OpenAPI 3.1 για τον πελάτη Kotlin. Καμία απόκλιση εκ κατασκευής.
 *
 * 🔑 **Οι τιμές ΔΕΝ γράφονται εδώ**: λεξιλόγια από `spatial-tour-vocabulary.ts` / `media-rights-vocabulary.ts`, όρια
 * από `panorama-policy.ts`, αρνήσεις από `tour-refusal-vocabulary.ts`. Εδώ ζει μόνο το **σχήμα** του σώματος.
 *
 * ⚠️ **Η δήλωση λήψης έχει ΔΥΟ κριτές, επίτηδες**: το σχήμα {@link CaptureDeclarationSchema} είναι το **συμβόλαιο** —
 * ό,τι στέλνει συμμορφούμενος πελάτης. Ο διακομιστής κρίνει με τον αναγνώστη `readCaptureDeclaration` (ADR-884 Φ0.14),
 * που διαβάζει **και** αποθηκευμένα έγγραφα και ξέρει τον δράστη («δημιουργός = εσύ»). Η σχέση τους **αποδεικνύεται**:
 * κάθε σώμα που δέχεται το συμβόλαιο το δέχεται και ο αναγνώστης (`capture-api-parity.test.ts`). Το αντίστροφο δεν
 * ισχύει, και δεν πρέπει: το συμβόλαιο είναι **αυστηρότερο** — ο πελάτης δεν βασίζεται σε ανοχές του διακομιστή.
 *
 * **Layering**: leaf — μόνο zod και καθαρά λεξιλόγια· **κανένα** `server-only` (ο γεννήτορας τρέχει σε σκέτο node).
 */

import { z } from 'zod/v4';

import { MAX_MEDIA_LICENSORS, MEDIA_LICENSE_PURPOSES } from '@/constants/media-rights-vocabulary';
import {
  TOUR_CAPTURE_AUDIENCES,
  TOUR_CAPTURE_SOURCES,
  TOUR_MILESTONES,
  TOUR_TILESET_STATES,
  TOUR_UPLOAD_SOURCES,
} from '@/constants/spatial-tour-vocabulary';
import { TOUR_REFUSALS } from '@/lib/spatial-tour/tour-refusal-vocabulary';
import { CORE_INVITATION_REFUSALS } from '@/types/invitation-core';

// =============================================================================
// 1. ΚΟΙΝΑ ΣΤΟΙΧΕΙΑ
// =============================================================================

/** Κείμενο με τουλάχιστον έναν μη-κενό χαρακτήρα — ο αναγνώστης του διακομιστή κάνει `trim` και απορρίπτει το κενό. */
const NonBlankText = z.string().regex(/\S/);

/** Στιγμή ISO-8601 σε UTC (`…Z`) — όπως τη γράφει ο διακομιστής (`toISOString`). */
const IsoInstant = z.iso.datetime();

/** Ακέραιος 64-bit — αλλιώς ο γεννήτορας Kotlin διαλέγει `Int` και ένα μελλοντικό ταβάνι > 2 GB θα ξεχείλιζε. */
const Int64Positive = z.number().int().positive().meta({ format: 'int64' });

// =============================================================================
// 2. ΤΑ ΔΙΚΑΙΩΜΑΤΑ ΤΟΥ ΜΕΣΟΥ (IPTC — `types/media-rights.ts`)
// =============================================================================

export const MediaPartySchema = z.object({
  name: NonBlankText,
  /** Ο λογαριασμός — `null` για πρόσωπο εκτός πλατφόρμας. Αν δοθεί για τον δημιουργό, **πρέπει** να είναι ο δράστης. */
  userId: NonBlankText.nullable(),
  url: NonBlankText.nullable(),
});

/**
 * Οι τρεις μορφές της διάρκειας — **χωριστά** ονομασμένες, ώστε το OpenAPI να τις δηλώσει ως `oneOf` με
 * `discriminator` και ο γεννήτορας Kotlin να βγάλει `sealed` ιεραρχία αντί για «ένα αντικείμενο με όλα προαιρετικά».
 */
export const MediaLicenseTermPerpetualSchema = z.object({ kind: z.literal('perpetual') });
export const MediaLicenseTermMandateSchema = z.object({ kind: z.literal('mandate'), mandateId: NonBlankText });
export const MediaLicenseTermDateSchema = z.object({ kind: z.literal('date'), until: IsoInstant });

export const MediaLicenseTermSchema = z.discriminatedUnion('kind', [
  MediaLicenseTermPerpetualSchema,
  MediaLicenseTermMandateSchema,
  MediaLicenseTermDateSchema,
]).meta({ discriminator: { propertyName: 'kind' } });

export const MediaLicenseSchema = z.object({ purpose: z.enum(MEDIA_LICENSE_PURPOSES), term: MediaLicenseTermSchema });

export const MediaRightsSchema = z.object({
  creator: MediaPartySchema,
  licensors: z.array(MediaPartySchema).max(MAX_MEDIA_LICENSORS),
  copyrightNotice: NonBlankText,
  webStatementOfRights: NonBlankText.nullable(),
  license: MediaLicenseSchema,
});

// =============================================================================
// 3. ΕΝΑΡΞΗ ΑΝΕΒΑΣΜΑΤΟΣ — POST /api/spatial-tours/{kind}/{subjectId}/uploads
// =============================================================================

export const StartUploadBodySchema = z.object({
  /** Ο δηλωμένος τύπος — η πολιτική πανοράματος τον κρίνει (`not-jpeg`). */
  contentType: z.string().min(3).max(100),
  /** Το δηλωμένο μέγεθος — το ταβάνι το κρίνει η πολιτική (`too-large`), και το GCS δεν δέχεται byte παραπάνω. */
  contentLength: Int64Positive,
});

export const StartUploadResponseSchema = z.object({
  uploadId: NonBlankText,
  /** Υπογεγραμμένο εισιτήριο — ο πελάτης το επιστρέφει **αυτούσιο** στην ολοκλήρωση. */
  ticket: NonBlankText,
  /** ⛔ **Κλειδί εγγραφής** της resumable συνεδρίας GCS — ποτέ σε log, ποτέ σε αναφορά σφάλματος. */
  sessionUri: z.url(),
  /** Μετά από αυτό το εισιτήριο δεν ολοκληρώνεται — «ξεκίνα ξανά το ανέβασμα». */
  expiresAt: IsoInstant,
});

// =============================================================================
// 4. ΟΛΟΚΛΗΡΩΣΗ — POST /api/spatial-tours/{kind}/{subjectId}/uploads/finalize
// =============================================================================

const FinalizeTicket = z.string().min(16).max(4096);

/** Ό,τι δηλώνει ο άνθρωπος για τη λήψη — κατεύθυνση και ημερομηνία τα λένε τα **bytes**. */
export const CaptureDeclarationSchema = z.object({
  source: z.enum(TOUR_UPLOAD_SOURCES),
  audience: z.enum(TOUR_CAPTURE_AUDIENCES),
  milestone: z.enum(TOUR_MILESTONES).nullable(),
  rights: MediaRightsSchema,
  /** Το όνομα του αρχείου στη συσκευή — ο διακομιστής κόβει στα 255. `null` ⇒ κανένα. */
  originalFilename: z.string().nullable(),
});

/**
 * **Ο φάκελος της ολοκλήρωσης, όπως τον κρίνει η διαδρομή**: η δήλωση περνά **ωμή** στον αναγνώστη του διακομιστή,
 * ώστε άκυρη δήλωση να απαντά την **ονομασμένη** άρνηση `declaration-invalid` και όχι γενικό `MALFORMED_BODY`.
 */
export const FinalizeEnvelopeSchema = z.object({
  ticket: FinalizeTicket,
  declaration: z.unknown(),
});

/** **Το συμβόλαιο** της ολοκλήρωσης — ό,τι στέλνει ο συμμορφούμενος πελάτης. */
export const FinalizeBodySchema = z.object({
  ticket: FinalizeTicket,
  declaration: CaptureDeclarationSchema,
});

/** `pending` ⇒ τα πλακίδια ψήνονται **μετά** την απάντηση· ο πελάτης δεν περιμένει. */
export const CaptureTilesetSchema = z.object({ state: z.enum(TOUR_TILESET_STATES) });

/**
 * **Η απόδειξη της λήψης** — το υποσύνολο του `TourCapture` στο οποίο **δεσμεύεται** ο διακομιστής απέναντι σε πελάτη
 * εκτός εφαρμογής. Ο διακομιστής στέλνει περισσότερα πεδία· ο πελάτης τα **αγνοεί** (ανοιχτό σχήμα), ώστε η
 * εξέλιξη του μοντέλου να μη σπάει ποτέ εφαρμογή που ήδη βρίσκεται στο κατάστημα.
 */
export const CaptureReceiptSchema = z.object({
  id: NonBlankText,
  tourId: NonBlankText,
  /** `null` ⇒ στα **εισερχόμενα** — η τοποθέτηση στην κάτοψη είναι πράξη του υπευθύνου. */
  nodeId: NonBlankText.nullable(),
  capturedAt: IsoInstant,
  source: z.enum(TOUR_CAPTURE_SOURCES),
  audience: z.enum(TOUR_CAPTURE_AUDIENCES),
  milestone: z.enum(TOUR_MILESTONES).nullable(),
  tileset: CaptureTilesetSchema,
  createdAt: IsoInstant,
});

export const FinalizeResponseSchema = z.object({
  capture: CaptureReceiptSchema,
  /** `true` ⇒ η ίδια λήψη υπήρχε ήδη (ίδιο εισιτήριο) — **επιτυχία**, όχι σφάλμα. 201 πρώτη φορά, 200 μετά. */
  replayed: z.boolean(),
});

// =============================================================================
// 5. ΕΞΑΡΓΥΡΩΣΗ ΠΡΟΣΚΛΗΣΗΣ ΦΩΤΟΓΡΑΦΟΥ — POST /api/spatial-tours/capture-invitations/redeem
// =============================================================================

export const RedeemInvitationResponseSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});

// =============================================================================
// 6. ΟΙ ΑΡΝΗΣΕΙΣ — κάθε λόγος στέλνει τον άνθρωπο σε ΑΛΛΗ ενέργεια (ADR-853 §5 #7)
// =============================================================================

export const TourRefusedBodySchema = z.object({
  error: z.literal('TOUR_REFUSED'),
  reason: z.enum(TOUR_REFUSALS),
});

export const TourUnavailableBodySchema = z.object({ error: z.literal('TOUR_UNAVAILABLE') });

export const TourSubjectInvalidBodySchema = z.object({ error: z.literal('TOUR_SUBJECT_INVALID') });

/** Το σώμα δεν ήταν σχήμα — τα **ονόματα** των πεδίων, ποτέ το μήνυμα της βιβλιοθήκης (`lib/api/json-body.ts`). */
export const MalformedBodySchema = z.object({
  error: z.literal('MALFORMED_BODY'),
  malformed: z.array(z.string()),
});

export const InvitationLinkRefusedBodySchema = z.object({
  error: z.literal('LINK_REFUSED'),
  reason: z.enum(CORE_INVITATION_REFUSALS),
});

export const InvitationRedeemUnavailableBodySchema = z.object({ error: z.literal('REDEEM_UNAVAILABLE') });

/**
 * **Οι αρνήσεις του ΣΥΝΟΡΟΥ** (πιστοποίηση `401/403` · όριο ρυθμού `429` · ιδεμποτία `409/422`) — κοινές σε κάθε
 * διαδρομή, με σώματα που ορίζουν **άλλα** σύνορα (`api-denial.ts` · `rate-limiter.ts` · `with-idempotency.ts`).
 * Δηλώνονται ως ελάχιστο κοινό σχήμα: ο πελάτης κρίνει από το **status** και το `Retry-After`, όχι από το κείμενο.
 */
export const BoundaryErrorBodySchema = z.object({
  error: z.string(),
  /** Μηχανικός κωδικός πιστοποίησης (π.χ. `UNAUTHORIZED`). */
  code: z.string().optional(),
  /** Μηχανικός κωδικός ιδεμποτίας (π.χ. `IDEMPOTENCY_IN_FLIGHT`). */
  errorCode: z.string().optional(),
});
