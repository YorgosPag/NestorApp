/**
 * =============================================================================
 * Κοινόχρηστος χώρος — σχήματα σώματος + σύνθεση πεδίων (καθαρό, ADR-931)
 * =============================================================================
 *
 * Τα πεδία που **μόνο** ο κοινόχρηστος έχει (κατηγορία · νομική φύση · αποκλειστική χρήση)
 * πάνω στο κοινό σχήμα χώρου κτιρίου (`SPACE_COMMON_*_FIELDS`, ADR-696).
 *
 * 🔒 Ό,τι **δεν** δέχεται ο κοινόχρηστος δηλώνεται `z.undefined()` — όχι παράλειψη: με
 * `.passthrough()` ένα παραλειπόμενο πεδίο περνά σιωπηλά, ενώ εδώ ο πελάτης παίρνει **400**:
 *   - `commercialStatus` / `commercial` — ΑΚ 1117: δεν μεταβιβάζεται αυτοτελώς.
 *   - `type` — ο κοινόχρηστος έχει `category` (λεξιλόγιο), όχι ελεύθερο `type`.
 *
 * ⚖️ Κανόνας νομικής φύσης (ελέγχεται στη **σύνθετη** κατάσταση σώμα ⊕ αποθηκευμένο):
 *   `exclusive_use` ⇔ τουλάχιστον μία ιδιοκτησία αποκλειστικής χρήσης.
 *   `common_use`   ⇒ η λίστα **σβήνει** (δεν μένει ορφανή αποκλειστικότητα).
 *
 * @module lib/common-spaces/common-space-fields
 */

import { z } from 'zod';
import {
  COMMON_SPACE_CATEGORIES,
  COMMON_SPACE_LEGAL_NATURES,
  DEFAULT_COMMON_SPACE_LEGAL_NATURE,
  isCommonSpaceLegalNature,
  type CommonSpaceLegalNature,
} from '@/constants/common-space-categories';
import { SPACE_COMMON_CREATE_FIELDS, SPACE_COMMON_UPDATE_FIELDS } from '@/lib/api/space-entity-fields';

/** Ανώτατο πλήθος ιδιοκτησιών αποκλειστικής χρήσης — όριο Firestore `getAll` με περιθώριο. */
export const MAX_EXCLUSIVE_USE_PROPERTIES = 20;

const exclusiveUseIds = z.array(z.string().min(1).max(128)).max(MAX_EXCLUSIVE_USE_PROPERTIES);

/** Ό,τι ο κοινόχρηστος αρνείται ρητά (400), πάνω από το κοινό σχήμα. */
const NOT_ACCEPTED = {
  type: z.undefined(),
  commercialStatus: z.undefined(),
  commercial: z.undefined(),
} as const;

export const CreateCommonSpaceSchema = z.object({
  ...SPACE_COMMON_CREATE_FIELDS,
  ...NOT_ACCEPTED,
  name: z.string().trim().min(1).max(200),
  buildingId: z.string().trim().min(1).max(128),
  category: z.enum(COMMON_SPACE_CATEGORIES),
  legalNature: z.enum(COMMON_SPACE_LEGAL_NATURES).optional(),
  exclusiveUsePropertyIds: exclusiveUseIds.optional(),
});

export type CreateCommonSpaceBody = z.infer<typeof CreateCommonSpaceSchema>;

export const UpdateCommonSpaceSchema = z.object({
  ...SPACE_COMMON_UPDATE_FIELDS,
  ...NOT_ACCEPTED,
  name: z.string().max(200).optional(),
  /** Ο κοινόχρηστος ανήκει **πάντα** σε κτίριο: αλλαγή επιτρέπεται, αποσύνδεση (`null`) όχι. */
  buildingId: z.string().trim().min(1).max(128).optional(),
  category: z.enum(COMMON_SPACE_CATEGORIES).optional(),
  legalNature: z.enum(COMMON_SPACE_LEGAL_NATURES).optional(),
  exclusiveUsePropertyIds: exclusiveUseIds.optional(),
}).passthrough();

export type UpdateCommonSpaceBody = z.infer<typeof UpdateCommonSpaceSchema>;

// =============================================================================
// ΝΟΜΙΚΗ ΦΥΣΗ
// =============================================================================

/** Η επιλυμένη νομική κατάσταση — ή ο λόγος άρνησης. */
export type LegalNatureResolution =
  | { readonly kind: 'ok'; readonly legalNature: CommonSpaceLegalNature; readonly exclusiveUsePropertyIds: readonly string[] }
  | { readonly kind: 'rejected'; readonly reason: 'exclusive-use-without-properties' };

/** Μήνυμα HTTP ανά άρνηση (αγγλικά, όπως κάθε μήνυμα API). */
export const LEGAL_NATURE_REJECTION_MESSAGE = {
  'exclusive-use-without-properties': 'Exclusive use requires at least one property',
} as const satisfies Record<Extract<LegalNatureResolution, { kind: 'rejected' }>['reason'], string>;

function storedIds(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

/**
 * Σώμα ⊕ αποθηκευμένο → η νομική κατάσταση **μετά** τη γραφή.
 * `existing` κενό στη δημιουργία. Ιδεμποτικό: ίδια είσοδος ⇒ ίδια έξοδος.
 */
export function resolveLegalNature(
  body: Readonly<{ legalNature?: CommonSpaceLegalNature; exclusiveUsePropertyIds?: readonly string[] }>,
  existing: Readonly<Record<string, unknown>> = {},
): LegalNatureResolution {
  const legalNature = body.legalNature
    ?? (isCommonSpaceLegalNature(existing.legalNature) ? existing.legalNature : DEFAULT_COMMON_SPACE_LEGAL_NATURE);
  if (legalNature === 'common_use') {
    return { kind: 'ok', legalNature, exclusiveUsePropertyIds: [] };
  }
  const ids = [...new Set(body.exclusiveUsePropertyIds ?? storedIds(existing.exclusiveUsePropertyIds))];
  if (ids.length === 0) return { kind: 'rejected', reason: 'exclusive-use-without-properties' };
  return { kind: 'ok', legalNature, exclusiveUsePropertyIds: ids };
}

/** Αλλάζει το σώμα τη νομική κατάσταση; (Αν όχι, δεν χρειάζεται ούτε έλεγχος ούτε γραφή.) */
export function touchesLegalNature(body: Readonly<Record<string, unknown>>): boolean {
  return body.legalNature !== undefined || body.exclusiveUsePropertyIds !== undefined;
}

/** Τα πεδία PATCH που ανήκουν **μόνο** στον κοινόχρηστο (η νομική φύση γράφεται από τον έλεγχό της). */
export function mapCommonSpaceExtraFields(body: UpdateCommonSpaceBody): Record<string, unknown> {
  return body.category !== undefined ? { category: body.category } : {};
}
