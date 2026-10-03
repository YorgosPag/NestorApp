/**
 * @fileoverview **ΤΟ ΕΓΓΡΑΦΟ OpenAPI 3.1 ΤΗΣ ΡΟΗΣ ΛΗΨΕΩΝ** — ό,τι δημοσιεύεται στην εφαρμογή κινητού (ADR-904 Ε6).
 * @related ADR-904 Ε6 · `capture-api-schemas.ts` · `capture-api-rules.ts` · `scripts/generate-capture-api-contract.js` · CHECK 3.98
 * @module contracts/capture-api/capture-api-document
 *
 * 🔑 **Ροή που περιγράφει** (ADR-904 Α2 — η ίδια με τον web πελάτη, καμία διακλάδωση):
 *  1. `startUpload` → εισιτήριο + resumable συνεδρία GCS·
 *  2. **PUT των bytes απευθείας στο `sessionUri`** — πρωτόκολλο της Google (Cloud Storage resumable uploads), **όχι**
 *     δικό μας endpoint· γι' αυτό περιγράφεται στο `x-nestor-upload-protocol` και όχι στα `paths`·
 *  3. `finalizeUpload` → η λήψη (ιδεμπότητη από κατασκευή: ίδιο εισιτήριο ⇒ ίδια λήψη, `replayed: true`).
 *  0. `listCaptureTargets` (1.1.0, ADR-904 Κ7) → **σε ποια ακίνητα** μπορεί να ανεβάσει ο συνδεδεμένος — το σημείο εκκίνησης.
 *
 * 🔑 **Έκδοση συμβολαίου** ({@link CAPTURE_API_VERSION}, semver): εφαρμογή στο κατάστημα **δεν** ενημερώνεται μαζί με
 * τον διακομιστή. **Major** = σπάσιμο (το πιάνει το `oasdiff` στο CI) · **minor** = προσθήκη (νέο endpoint, νέο
 * προαιρετικό πεδίο, νέα τιμή λεξιλογίου στην **απόκριση**) · **patch** = μόνο κείμενο.
 *
 * **Layering**: leaf.
 */

import type { z } from 'zod/v4';

import { InvitationRedeemBodySchema } from '@/contracts/invitation-redeem-body';
import { PLACE_SOURCES } from '@/constants/place-sources';
import { CAPTURE_TARGETS_PAGE_SIZE } from '@/constants/spatial-tour-vocabulary';
import { PRODUCT_NAME } from '@/constants/product-identity';
import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_KEY_MAX_LENGTH } from '@/lib/api/idempotency/idempotency-contract';

import { componentSchemasOf, type JsonSchemaNode } from './capture-api-json-schema';
import { captureApiRules } from './capture-api-rules';
import * as S from './capture-api-schemas';

/** Η έκδοση του συμβολαίου — δες τους κανόνες semver στην κεφαλίδα. */
export const CAPTURE_API_VERSION = '1.1.0';

/** Τα ονομασμένα σχήματα — το όνομα είναι **δημόσιο API** (γίνεται όνομα κλάσης Kotlin): μετονομασία = major. */
export const CAPTURE_API_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  MediaParty: S.MediaPartySchema,
  MediaLicenseTermPerpetual: S.MediaLicenseTermPerpetualSchema,
  MediaLicenseTermMandate: S.MediaLicenseTermMandateSchema,
  MediaLicenseTermDate: S.MediaLicenseTermDateSchema,
  MediaLicenseTerm: S.MediaLicenseTermSchema,
  MediaLicense: S.MediaLicenseSchema,
  MediaRights: S.MediaRightsSchema,
  StartUploadBody: S.StartUploadBodySchema,
  StartUploadResponse: S.StartUploadResponseSchema,
  CaptureDeclaration: S.CaptureDeclarationSchema,
  FinalizeBody: S.FinalizeBodySchema,
  CaptureTileset: S.CaptureTilesetSchema,
  CaptureReceipt: S.CaptureReceiptSchema,
  FinalizeResponse: S.FinalizeResponseSchema,
  CaptureSubject: S.CaptureSubjectSchema,
  CaptureAccessManager: S.CaptureAccessManagerSchema,
  CaptureAccessGrant: S.CaptureAccessGrantSchema,
  CaptureAccess: S.CaptureAccessSchema,
  CaptureTarget: S.CaptureTargetSchema,
  CaptureTargetsResponse: S.CaptureTargetsResponseSchema,
  InvitationRedeemBody: InvitationRedeemBodySchema,
  InvitationRedeemResponse: S.RedeemInvitationResponseSchema,
  TourRefusedBody: S.TourRefusedBodySchema,
  TourUnavailableBody: S.TourUnavailableBodySchema,
  TourSubjectInvalidBody: S.TourSubjectInvalidBodySchema,
  MalformedBody: S.MalformedBodySchema,
  MalformedQueryBody: S.MalformedQueryBodySchema,
  InvitationLinkRefusedBody: S.InvitationLinkRefusedBodySchema,
  InvitationRedeemUnavailableBody: S.InvitationRedeemUnavailableBodySchema,
  BoundaryErrorBody: S.BoundaryErrorBodySchema,
};

const ref = (name: string): JsonSchemaNode => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: JsonSchemaNode) => ({ 'application/json': { schema } });
const anyOfRefs = (...names: string[]): JsonSchemaNode => ({ anyOf: names.map(ref) });

/** Οι αρνήσεις του συνόρου (πιστοποίηση · ρυθμός · ιδεμποτία) — ίδιες σε κάθε διαδρομή. */
const BOUNDARY_RESPONSES = {
  '401': { description: 'Λείπει ή έληξε το Firebase ID token — ανανέωση token και επανάληψη.', content: json(ref('BoundaryErrorBody')) },
  '429': { description: 'Όριο ρυθμού — επανάληψη μετά το `Retry-After`.', content: json(ref('BoundaryErrorBody')) },
} as const;

const SUBJECT_PARAMETERS = [
  { name: 'kind', in: 'path', required: true, description: 'Το είδος του ακινήτου.', schema: { type: 'string', enum: [...PLACE_SOURCES] } },
  { name: 'subjectId', in: 'path', required: true, schema: { type: 'string', minLength: 1 } },
] as const;

const IDEMPOTENCY_PARAMETER = {
  name: IDEMPOTENCY_KEY_HEADER,
  in: 'header',
  required: false,
  description: 'ADR-872 — **ίδιο** κλειδί σε κάθε επανάληψη της ίδιας πράξης (αποθηκεύεται μαζί με την εγγραφή της ουράς).',
  schema: { type: 'string', minLength: 1, maxLength: IDEMPOTENCY_KEY_MAX_LENGTH },
} as const;

/** Η απόκριση άρνησης μιας διαδρομής περιήγησης — ο λόγος ταξιδεύει στο σώμα, το status τον συνοδεύει. */
function tourErrorResponses() {
  return {
    ...BOUNDARY_RESPONSES,
    '4XX': {
      description: 'Ονομασμένη άρνηση (`TOUR_REFUSED` + `reason`, status ανά λόγο στο `x-nestor-rules.refusals.tour`) ή κακό σώμα/ρίζα.',
      content: json(anyOfRefs('TourRefusedBody', 'MalformedBody', 'TourSubjectInvalidBody', 'BoundaryErrorBody')),
    },
    '5XX': {
      description: '«Δεν μπόρεσα» — επαναλήψιμο με το ίδιο `Idempotency-Key`.',
      content: json(anyOfRefs('TourUnavailableBody', 'TourRefusedBody', 'BoundaryErrorBody')),
    },
  };
}

function uploadPaths() {
  return {
    '/api/spatial-tours/{kind}/{subjectId}/uploads': {
      parameters: SUBJECT_PARAMETERS,
      post: {
        operationId: 'startUpload',
        summary: 'Έναρξη ανεβάσματος πανοράματος — εισιτήριο + resumable συνεδρία GCS.',
        parameters: [IDEMPOTENCY_PARAMETER],
        requestBody: { required: true, content: json(ref('StartUploadBody')) },
        responses: {
          '201': { description: 'Η συνεδρία άνοιξε.', content: json(ref('StartUploadResponse')) },
          ...tourErrorResponses(),
        },
      },
    },
    '/api/spatial-tours/{kind}/{subjectId}/uploads/finalize': {
      parameters: SUBJECT_PARAMETERS,
      post: {
        operationId: 'finalizeUpload',
        summary: 'Ολοκλήρωση ανεβάσματος — ο διακομιστής ξανακρίνει τα bytes και γράφει τη λήψη.',
        parameters: [IDEMPOTENCY_PARAMETER],
        requestBody: { required: true, content: json(ref('FinalizeBody')) },
        responses: {
          '201': { description: 'Η λήψη γράφτηκε.', content: json(ref('FinalizeResponse')) },
          '200': { description: 'Η λήψη υπήρχε ήδη (ίδιο εισιτήριο) — επιτυχία.', content: json(ref('FinalizeResponse')) },
          ...tourErrorResponses(),
        },
      },
    },
  };
}

/** Οι παράμετροι σελίδας (AIP-158) — όρια από το λεξιλόγιο, **όχι** γραμμένα εδώ. */
const PAGE_PARAMETERS = [
  {
    name: 'pageSize', in: 'query', required: false,
    description: `Απών ή 0 ⇒ ${CAPTURE_TARGETS_PAGE_SIZE.default}· πάνω από ${CAPTURE_TARGETS_PAGE_SIZE.max} ⇒ μειώνεται στο ${CAPTURE_TARGETS_PAGE_SIZE.max}· αρνητικό ⇒ 400.`,
    schema: { type: 'integer', minimum: 0, default: CAPTURE_TARGETS_PAGE_SIZE.default },
  },
  {
    name: 'pageToken', in: 'query', required: false,
    description: 'Το `nextPageToken` της προηγούμενης σελίδας, **αυτούσιο** (αδιαφανές). Απών ⇒ πρώτη σελίδα.',
    schema: { type: 'string', minLength: 1 },
  },
] as const;

function targetPaths() {
  return {
    '/api/spatial-tours/capture-targets': {
      get: {
        operationId: 'listCaptureTargets',
        summary: 'Τα ακίνητα όπου ο συνδεδεμένος μπορεί να ανεβάσει λήψεις — ως υπεύθυνος ή με άδεια φωτογράφου.',
        parameters: PAGE_PARAMETERS,
        responses: {
          '200': { description: 'Μία σελίδα. Κενό `nextPageToken` ⇒ τέλος.', content: json(ref('CaptureTargetsResponse')) },
          ...BOUNDARY_RESPONSES,
          '4XX': { description: 'Κακό query ή χαλασμένο `pageToken` (ξεκίνα από την αρχή).', content: json(anyOfRefs('MalformedQueryBody', 'BoundaryErrorBody')) },
          '5XX': { description: '«Δεν μπόρεσα» — επαναλήψιμο.', content: json(anyOfRefs('TourUnavailableBody', 'BoundaryErrorBody')) },
        },
      },
    },
  };
}

function invitationPaths() {
  return {
    '/api/spatial-tours/capture-invitations/redeem': {
      post: {
        operationId: 'redeemCaptureInvitation',
        summary: 'Αποδοχή ή άρνηση πρόσκλησης φωτογράφου (σύνδεσμος `/tour-invite/{token}`).',
        parameters: [IDEMPOTENCY_PARAMETER],
        requestBody: { required: true, content: json(ref('InvitationRedeemBody')) },
        responses: {
          '200': { description: 'Η πράξη έγινε.', content: json(ref('InvitationRedeemResponse')) },
          ...BOUNDARY_RESPONSES,
          '4XX': { description: 'Ονομασμένη άρνηση συνδέσμου ή κακό σώμα.', content: json(anyOfRefs('InvitationLinkRefusedBody', 'MalformedBody', 'BoundaryErrorBody')) },
          '5XX': { description: '«Δεν μπόρεσα» — επαναλήψιμο.', content: json(anyOfRefs('InvitationRedeemUnavailableBody', 'BoundaryErrorBody')) },
        },
      },
    },
  };
}

/** **Το έγγραφο** — ντετερμινιστικό: ίδια SSoT ⇒ ίδια bytes (το ζητά η πύλη φρεσκάδας). */
export function buildCaptureApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: `${PRODUCT_NAME} — Capture API`,
      version: CAPTURE_API_VERSION,
      description: 'Παράγεται από τον κώδικα (ADR-904 Ε6) — **ποτέ** επεξεργασία με το χέρι: `npm run generate:capture-api-contract`.',
    },
    security: [{ firebaseIdToken: [] }],
    paths: { ...targetPaths(), ...uploadPaths(), ...invitationPaths() },
    components: {
      securitySchemes: {
        firebaseIdToken: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Firebase Auth ID token.' },
      },
      schemas: componentSchemasOf(CAPTURE_API_SCHEMAS),
    },
    'x-nestor-upload-protocol': {
      kind: 'gcs-resumable',
      description: 'PUT των bytes στο `StartUploadResponse.sessionUri` (Google Cloud Storage resumable upload) · επανάληψη από το επιβεβαιωμένο offset μετά από διακοπή · `Content-Type` = `x-nestor-rules.panorama.contentType`.',
      reference: 'https://cloud.google.com/storage/docs/performing-resumable-uploads',
    },
    'x-nestor-rules': captureApiRules(),
  } as const;
}
