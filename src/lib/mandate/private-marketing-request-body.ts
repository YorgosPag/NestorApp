/**
 * @fileoverview **ΤΟ ΣΩΜΑ ΤΩΝ ΠΡΑΞΕΩΝ ΚΛΕΙΣΤΗΣ ΔΙΑΘΕΣΗΣ** — ένα σύνορο για τις δύο υπάρχουσες διαδρομές.
 * @related ADR-864 §17.5 · `PATCH /api/owner-properties/[id]` · `POST /api/mandate/[token]`
 * @module lib/mandate/private-marketing-request-body
 *
 * 🔑 **Καμία νέα διαδρομή** (CHECK 3.78): οι πράξεις είναι παραλλαγές σωμάτων που υπάρχουν ήδη.
 * ⚠️ Το `zod` κόβει ό,τι δεν δηλώνεται — γι' αυτό **κάθε** πεδίο που φτάνει στην υπηρεσία είναι εδώ,
 * και κλειστό σύνολο (`action`) ελέγχεται **πριν** αγγίξουμε τη βάση.
 */

import { z } from 'zod';

import { LEGAL_DOCUMENT_LOCALES } from '@/constants/legal-documents';
import { MARKETING_AUDIENCES } from '@/constants/marketing-audiences';
import {
  PRIVATE_MARKETING_REVOCATION_OUTCOMES,
  isClosedMarketingAudience,
} from '@/types/private-marketing-consent';

/** Η `refine` με στενευτή **στενεύει τον τύπο** (zod 3.25) — κανένα `as`. */
const closedAudience = z.enum(MARKETING_AUDIENCES).refine(isClosedMarketingAudience);

const submissionSchema = z.object({
  version: z.number().int().positive(),
  acknowledged: z.array(z.string().min(1)).max(32),
  locale: z.enum(LEGAL_DOCUMENT_LOCALES),
  values: z.object({ agency: z.string(), expiresOn: z.string() }),
});

const grantBase = { requestId: z.string().min(1).nullable(), submission: submissionSchema };

/** Μία συναίνεση ανά γραφείο — κάθε γραφείο **μία** φορά (αλλιώς δύο γεγονότα για μία πράξη). */
const consentsSchema = z
  .array(z.object({ agencyCompanyId: z.string().min(1), ...grantBase }))
  .min(1)
  .max(16)
  .refine((lines) => new Set(lines.map((line) => line.agencyCompanyId)).size === lines.length);

/** `PATCH /api/owner-properties/[id]` — `{ privateMarketing: … }`. */
const accountBodySchema = z.discriminatedUnion('action', [
  /** Το γραφείο **ζητά** (Ε-11). */
  z.object({ action: z.literal('request'), audience: closedAudience }),
  /** Ο ιδιοκτήτης με λογαριασμό **συναινεί** — προς **όλα** τα γραφεία μαζί, ατομικά (§18.4 Δ3). */
  z.object({ action: z.literal('grant'), audience: closedAudience.nullable(), consents: consentsSchema }),
  /** Το γραφείο ανεβάζει **υπογεγραμμένο έντυπο** (Ε-12)· **ταυτότητα αρχείου**, ποτέ διαδρομή (§18.4 Δ1). */
  z.object({ action: z.literal('attest'), audience: closedAudience, documentFileId: z.string(), ...grantBase }),
  /** Ο ιδιοκτήτης με λογαριασμό **ανακαλεί** (Ε-13). */
  z.object({ action: z.literal('revoke'), agencyCompanyId: z.string().min(1), outcome: z.enum(PRIVATE_MARKETING_REVOCATION_OUTCOMES) }),
]);

/** `POST /api/mandate/[token]` — ο σύνδεσμος μόνο **εκτελεί αίτημα** ή **ανακαλεί**. */
const linkBodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('grant'), requestId: z.string().min(1), submission: submissionSchema }),
  z.object({ action: z.literal('revoke'), outcome: z.enum(PRIVATE_MARKETING_REVOCATION_OUTCOMES) }),
]);

export type AccountPrivateMarketingBody = z.infer<typeof accountBodySchema>;
export type LinkPrivateMarketingBody = z.infer<typeof linkBodySchema>;

type Parsed<T> = { readonly ok: true; readonly body: T } | { readonly ok: false; readonly malformed: readonly string[] };

function parseWith<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, value: unknown): Parsed<T> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, body: parsed.data };
  return { ok: false, malformed: [...new Set(parsed.error.issues.map((i) => `privateMarketing.${i.path.join('.')}`))] };
}

export const accountPrivateMarketingFrom = (value: unknown): Parsed<AccountPrivateMarketingBody> =>
  parseWith(accountBodySchema, value);

export const linkPrivateMarketingFrom = (value: unknown): Parsed<LinkPrivateMarketingBody> =>
  parseWith(linkBodySchema, value);
