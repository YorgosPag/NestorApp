/**
 * =============================================================================
 * «Ποιος είναι ο Πωλητής 2;» — τα ονόματα των προσώπων, ΖΩΝΤΑΝΑ (ADR-915 §23.10)
 * =============================================================================
 *
 * Ο **ένας** δρόμος από τα πρόσωπα μιας όψης στα ονόματά τους, για τον οικοδεσπότη **και** τον επαγγελματία. Ποια
 * πρόσωπα το αποφασίζει ο καλών (όλα · τα ορατά των γραμμών του θεατή)· πότε χρειάζονται ονόματα το `party-labels`.
 *
 * 🔑 Το όνομα διαβάζεται από την **επαφή** σε κάθε όψη — ποτέ αντίγραφο στην υπόθεση (θα πάλιωνε στην πρώτη διόρθωση,
 *    πρότυπο `ActingOffice`, ADR-901 §15). Μία ανάγνωση `getAll` με έλεγχο μισθωτή (`readOwnedContactDocs`):
 *    ξένη ≡ ανύπαρκτη ⇒ κενό όνομα, καμία μαρτυρία ύπαρξης.
 * 🔑 Αποτυχία ⇒ κενά ονόματα («Πωλητής N»)· η όψη **δεν** πέφτει. Στο log **ποτέ** όνομα — μόνο πλήθος.
 *
 * @module services/conveyance/conveyance-party-labels.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { casePartyLabels, needsPartyNames } from '@/lib/conveyance/party-labels';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import type { CasePartyLabel, ConveyanceSellerParty } from '@/types/conveyance-case';

const logger = createModuleLogger('CONVEYANCE_PARTY_LABELS');

/** Τα ονόματα κατά κλειδί προσώπου — μόνο όσων η επαφή υπάρχει **και** ανήκει στον μισθωτή. */
async function readPartyNames(db: Firestore, companyId: string, sellers: readonly ConveyanceSellerParty[]): Promise<ReadonlyMap<string, string>> {
  try {
    const contactIds = sellers.flatMap((party) => (party.contactId === null ? [] : [party.contactId]));
    const contacts = await readOwnedContactDocs(db, companyId, contactIds);
    const names = new Map<string, string>();
    for (const party of sellers) {
      const contact = party.contactId === null ? undefined : contacts.get(party.contactId);
      if (contact) names.set(party.key, extractContactDisplayName(contact));
    }
    return names;
  } catch (error) {
    logger.warn('party names read failed', { parties: sellers.length, error: getErrorMessage(error, 'unknown') });
    return new Map();
  }
}

/**
 * Οι ετικέτες των **δοσμένων** προσώπων (ήδη κομμένων στα ορατά του θεατή). Με ≤ 1 πρόσωπο ⇒ `[]` **χωρίς** ανάγνωση:
 * ό,τι δεν θα δειχτεί δεν διαβάζεται ούτε στέλνεται.
 */
export async function readCasePartyLabels(
  db: Firestore,
  companyId: string,
  sellers: readonly ConveyanceSellerParty[],
): Promise<readonly CasePartyLabel[]> {
  if (!needsPartyNames(sellers.length)) return [];
  return casePartyLabels(sellers, await readPartyNames(db, companyId, sellers));
}
