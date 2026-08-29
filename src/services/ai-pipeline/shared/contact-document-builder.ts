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

import type { CreateContactParams } from './contact-lookup-types';

// ============================================================================
// PHONE PARSING (E.164 country-code split)
// ============================================================================

/**
 * Split an international phone string into countryCode + local number.
 * Handles `+359...` and `00359...` prefixes. Returns raw string if no prefix found.
 * Exported for unit-testing only.
 */
export function parsePhoneForStorage(raw: string): { number: string; countryCode?: string } {
  const clean = raw.replace(/[\s\-.() ]+/g, '');
  const e164 = clean.startsWith('00') ? '+' + clean.slice(2) : clean;
  if (!e164.startsWith('+')) return { number: clean };

  const rest = e164.slice(1); // digits after '+'

  // 3-digit codes (checked before 2-digit to avoid prefix collision in zones 35x/38x)
  const CC3 = [
    '350','351','352','353','354','355','356','357','358','359',
    '370','371','372','373','374','375','376','377','378','380',
    '381','382','385','386','387','388','389','420','421','423',
    '500','501','502','503','504','505','506','507','508','509',
    '590','591','592','593','594','595','596','597','598','599',
    '850','852','853','855','856','880','886',
    '960','961','962','963','964','965','966','967','968','969',
    '970','971','972','973','974','975','976','977',
    '992','993','994','995','996','998',
  ];
  for (const cc of CC3) {
    if (rest.startsWith(cc) && rest.length > cc.length) {
      return { countryCode: '+' + cc, number: rest.slice(cc.length) };
    }
  }

  // 2-digit codes
  const CC2 = [
    '20','27','30','31','32','33','34','36','39','40','41','43',
    '44','45','46','47','48','49','51','52','53','54','55','56',
    '57','58','60','61','62','63','64','65','66','81','82','84',
    '86','90','91','92','93','94','95','98',
  ];
  for (const cc of CC2) {
    if (rest.startsWith(cc) && rest.length > cc.length) {
      return { countryCode: '+' + cc, number: rest.slice(cc.length) };
    }
  }

  // 1-digit (+1 NANP, +7 Russia/Kazakhstan)
  if ((rest[0] === '1' || rest[0] === '7') && rest.length > 1) {
    return { countryCode: '+' + rest[0], number: rest.slice(1) };
  }

  return { number: rest };
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
export function buildContactDocument(params: CreateContactParams): BuiltContact {
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
      emails: params.email
        ? [{ email: params.email, type: 'work', isPrimary: true }]
        : [],
      phones: parsedPhone
        ? [{ number: parsedPhone.number, ...(parsedPhone.countryCode ? { countryCode: parsedPhone.countryCode } : {}), type: 'mobile', isPrimary: true }]
        : [],
      addresses: [],
      companyId: params.companyId,
      createdBy: params.createdBy,
      lastModifiedBy: params.createdBy,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      tags: null,
      notes: null,
      customFields: null,
      photoURL: null,
      // ADR-827 §8.3 — the imprint, copied by the server at the moment of engagement.
      // Absent for every other creation path, exactly as it was before.
      vatNumber: params.vatNumber ?? null,
      taxOffice: null,
      profession: null,
    },
  };
}
