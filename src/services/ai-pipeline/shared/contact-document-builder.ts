import 'server-only';

/**
 * =============================================================================
 * CONTACT DOCUMENT SHAPE — one builder, two writers
 * =============================================================================
 *
 * The Firestore shape of a `contacts/{cont_*}` document, built from creation params.
 * Pure: no I/O, no clock of its own, no Firestore handle.
 *
 * -----------------------------------------------------------------------------
 * WHY IT WAS EXTRACTED (ADR-827 §9.21 · ADR-749)
 * -----------------------------------------------------------------------------
 *
 * `createContactServerSide` writes on its own, which makes it unusable from inside a
 * Firestore transaction. The mandate-acceptance flow (ADR-827 Σ3) *must* be
 * transactional: it creates the contact, writes the mandate and closes the request in
 * a single atomic act, guarded by a compare-and-set on the request status.
 *
 * Writing a second contact builder there would be the ADR-749 shape in its purest
 * form — two engines producing "the same" document, diverging on the first field
 * anyone adds to one of them. So the *shape* moved here, and both writers ask for it:
 *
 *   createContactServerSide  ->  ref.set(doc)
 *   mandate acceptance       ->  transaction.set(ref, doc)
 *
 * `FieldValue.serverTimestamp()` is valid in both contexts, so nothing is special-cased.
 *
 * `parsePhoneForStorage` moved with it, and it is imported back by `contact-lookup-crud`
 * because `updateContactField` uses it too. The first draft of this comment claimed the
 * builder was its "only production caller" — the ai-pipeline suite proved that false in
 * one run (`contact-lookup.test.ts` line 412). Two callers, one implementation: it lives
 * next to the document shape it feeds, and the other caller imports it by name.
 *
 * @module services/ai-pipeline/shared/contact-document-builder
 * @see ADR-080, ADR-145, ADR-227, ADR-827
 */

import { FieldValue } from 'firebase-admin/firestore';

import { inferPhoneType } from '@/server/lib/phone-line-type';
import { inferEmailType } from '@/lib/contact/email-type-vocabulary';
import { splitCountryCallingCode } from '@/lib/contact/channel-phone';

import { performerStamp, type ResolvedPerformer } from '@/server/lib/performer-stamp';

import type { CreateContactParams } from './contact-lookup-types';

// ============================================================================
// PHONE PARSING (E.164 country-code split)
// ============================================================================

/**
 * Split an international phone string into countryCode + local number.
 * Handles `+359...` and `00359...` prefixes. Returns the cleaned string if there is no
 * prefix (a local number — the country is implied, not guessed).
 *
 * ADR-327 §8.5.4 ☎️#3 — the country code comes from the phone SSoT
 * (`splitCountryCallingCode`, libphonenumber metadata), never from a hand-kept table.
 */
export function parsePhoneForStorage(raw: string): { number: string; countryCode?: string } {
  const clean = raw.replace(/[\s\-.() ]+/g, '');
  const e164 = clean.startsWith('00') ? '+' + clean.slice(2) : clean;
  if (!e164.startsWith('+')) return { number: clean };

  const split = splitCountryCallingCode(e164);
  return split ? { countryCode: split.countryCode, number: split.number } : { number: e164.slice(1) };
}

// ============================================================================
// THE DOCUMENT
// ============================================================================

/** A contact document ready to write, plus the display name derived for it. */
export interface BuiltContact {
  readonly displayName: string;
  readonly doc: Record<string, unknown>;
}

/**
 * Build the Firestore contact document from creation params.
 *
 * CRITICAL: every optional field uses `?? null` — Firestore rejects `undefined`.
 */
export function buildContactDocument(
  params: CreateContactParams,
  /** Ο φορέας **ήδη λυμένος** (`resolvePerformer`) — ο builder μένει σύγχρονος, χωράει σε συναλλαγή. */
  performer: ResolvedPerformer,
): BuiltContact {
  const displayName = params.type === 'company'
    ? params.companyName ?? `${params.firstName} ${params.lastName}`.trim()
    : `${params.firstName} ${params.lastName}`.trim();

  const parsedPhone = params.phone ? parsePhoneForStorage(params.phone) : null;

  return {
    displayName,
    doc: {
      type: params.type,
      status: 'active',
      isFavorite: false,
      displayName,
      firstName: params.firstName ?? null,
      lastName: params.lastName ?? null,
      ...(params.type === 'company' && params.companyName
        ? { companyName: params.companyName }
        : {}),
      // ADR-327 §8.5.4 — μέσα στο υποσύνολο του κατόχου: εταιρεία `info@` ⇒ `info`, πρόσωπο ⇒ `work` (όπως πριν).
      emails: params.email
        ? [{ email: params.email, type: inferEmailType(params.email, params.type, 'work'), isPrimary: true }]
        : [],
      phones: parsedPhone
        ? [{
          number: parsedPhone.number,
          ...(parsedPhone.countryCode ? { countryCode: parsedPhone.countryCode } : {}),
          // ADR-327 §8.5.4 — σταθερό ≠ κινητό: ο τύπος από τα metadata του αριθμού, όχι καρφωτός.
          type: inferPhoneType(params.phone ?? '', params.type),
          isPrimary: true,
        }]
        : [],
      addresses: [],
      companyId: params.companyId,
      createdBy: performer.id,
      // ADR-195 — η σφραγίδα που διαβάζει ο CDC (όχι το ωμό `lastModifiedBy`, που γινόταν «αλλαγή» στο Ιστορικό).
      ...performerStamp(performer),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      tags: null,
      notes: null,
      customFields: null,
      photoURL: null,
      // ADR-827 §8.3 — the imprint, copied by the server at the moment of engagement.
      // Absent for every other creation path, exactly as it was before.
      vatNumber: params.vatNumber ?? null,
      // ADR-884 §9.1 Α1 — μόνο όταν ο δημιουργός το ξέρει· απουσία = τίποτα να επιβεβαιωθεί.
      ...(params.nameReview ? { nameReview: params.nameReview } : {}),
      taxOffice: null,
      profession: null,
    },
  };
}
