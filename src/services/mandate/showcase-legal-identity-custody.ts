/**
 * @fileoverview **Η ΝΟΜΙΚΗ ΤΑΥΤΟΤΗΤΑ ΤΗΣ ΒΙΤΡΙΝΑΣ, ΜΕΣΑ ΣΕ ΣΥΝΑΛΛΑΓΗ** — ανάγνωση εισόδων, σύνθεση,
 * ανανέωση (ADR-841 §7 Α23).
 * @related lib/agency/showcase-legal-identity.ts (ο κριτής) · services/mandate/agency-profile.service.ts
 * @module services/mandate/showcase-legal-identity-custody
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΜΕΣΑ ΣΤΗ ΣΥΝΑΛΛΑΓΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Προφίλ, αντίγραφο ΓΕΜΗ και έγγραφο βιτρίνας διαβάζονται με `transaction.get`: μια μετονομασία ή μια
 * επαλήθευση που προλαβαίνει ανάμεσα **ξανατρέχει** τη δημοσίευση, αντί να γραφτεί κρίση πάνω σε
 * μπαγιάτικη είσοδο. Καμία παρενέργεια μέσα στο σώμα — μόνο αναγνώσεις και μία γραφή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΔΕΝ ΜΠΑΓΙΑΤΕΥΕΙ ΣΙΩΠΗΛΑ (Α1.6)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ανώνυμος επισκέπτης δεν μπορεί να κρίνει μόνος του (`deny_all`), άρα η βιτρίνα κρατά αντίγραφο.
 * **Κάθε πράξη που αλλάζει είσοδο της κρίσης κατέχει την ανανέωση** — {@link refreshShowcaseLegalIdentity}:
 *
 * | Πράξη | Είσοδος που αλλάζει |
 * |---|---|
 * | αποθήκευση προφίλ (`PUT /api/accounting/setup`) · μετονομασία (`bootstrap-company`) | επωνυμία · αριθμός · μορφή · έδρα |
 * | «Επαλήθευση από ΓΕΜΗ» (`POST /api/companies/registry-verification`) | αντίγραφο μητρώου |
 * | αποθήκευση κάρτας (`PUT /api/agency-profile/card`) | οδός έδρας (`business-address`) |
 *
 * ⚠️ Η ανανέωση **δεν αρνείται** — δεν υπάρχει άνθρωπος να διαβάσει την άρνηση (Φ3.2):
 *
 * | Τι άλλαξε | Τι γράφεται | Γιατί |
 * |---|---|---|
 * | το ΓΕΜΗ λέει «ανενεργή» | ταυτότητα **μένει** + `registryClosure` · σήμα πέφτει | Google Business Profile «Οριστικά κλειστή» — ο επισκέπτης **μαθαίνει** |
 * | ο τίτλος δεν στηρίζεται πια | όνομα = **επωνυμία** | δημόσιο όνομα = επίσημα στοιχεία (Stripe · GBP) |
 * | σβήστηκε η επωνυμία · λείπει η διεύθυνση | `legalIdentity: null` · σήμα πέφτει | καμία αληθής εναλλακτική χωρίς επινόηση |
 *
 * Κάθε `verified` διαπιστευτήριο πέφτει σε `declared` όταν το σήμα πέφτει: **ψευδώς αρνητικό, ποτέ
 * ψευδώς θετικό** — ίδιο δόγμα με το `MAX_PRESENCE_AREAS`.
 */

import 'server-only';

import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { readShowcase, toStoredShowcase } from '@/lib/agency/showcase-read';
import {
  reresolveShowcaseLegalIdentity,
  resolveShowcaseLegalIdentity,
  type LegalIdentityInputs,
} from '@/lib/agency/showcase-legal-identity';
import { createModuleLogger } from '@/lib/telemetry';
import { registryDeclarationOf, seatDeclarationOf } from '@/services/company/company-legal-identity';
import { registryCheckOf, registryRecordRef } from '@/services/company-registry/company-registry-record.service';
import {
  attestFromRegistry,
  bindRegistryNumber,
  credentialFor,
  type ShowcaseCredentialDeclaration,
} from '@/services/mandate/agency-profile-credential';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type { PublicShowcase, ShowcaseCredential } from '@/types/agency-profile';
import type { ShowcaseLocation, ShowcaseStreetLine } from '@/types/showcase-card';
import type { ShowcaseLegalDeclaration, ShowcaseLegalIdentity } from '@/types/showcase-legal-identity';

const logger = createModuleLogger('showcase-legal-identity-custody');

/** Η οδός της **έδρας** της κάρτας — `null` χωρίς έδρα ή με δημοσιευμένη μόνο περιοχή. */
export function headquartersStreetOf(locations: readonly ShowcaseLocation[]): ShowcaseStreetLine | null {
  return locations.find((location) => location.role === 'headquarters')?.street ?? null;
}

/**
 * **Οι είσοδοι της κρίσης, από τη συναλλαγή.**
 *
 * ⚠️ Αποτυχία ανάγνωσης **πετά** — ο καλών αποτυγχάνει ολόκληρος (500 «ξαναδοκίμασε»). Ένα «δεν υπάρχει
 * προφίλ» σε βλάβη θα αρνιόταν δημοσίευση με «λείπει η επωνυμία» σε οργανισμό που την έχει (N.12).
 */
export async function readLegalIdentityInputs(
  adminDb: AdminFirestore,
  transaction: Transaction,
  companyId: string,
  locations: readonly ShowcaseLocation[],
): Promise<LegalIdentityInputs> {
  const profileRef = adminDb.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(companyId);
  const [profile, record] = await Promise.all([
    transaction.get(profileRef),
    transaction.get(registryRecordRef(adminDb, companyId)),
  ]);
  const data = profile.exists ? profile.data() : undefined;
  return {
    declaration: data ? registryDeclarationOf(data) : null,
    seat: data ? seatDeclarationOf(data) : null,
    stored: registryCheckOf(record, companyId),
    headquarters: headquartersStreetOf(locations),
  };
}

export type LegalShowcaseForm =
  | { readonly displayName: string; readonly legalIdentity: ShowcaseLegalIdentity; readonly credentials: ShowcaseCredential[] }
  | { readonly reason: AgencyProfileRejection };

/**
 * **Όνομα + ταυτότητα + διαπιστευτήρια, από μία κρίση.**
 *
 * 🔑 Η σειρά είναι απόφαση: πρώτα η **ταυτότητα** (ποιος είσαι), μετά τα διαπιστευτήρια — που
 * **διαβάζουν** τον αριθμό ΓΕΜΗ της ταυτότητας (Δ1) και παίρνουν από αυτήν το `verified` (Α9.2).
 */
export function formLegalShowcase(
  inputs: LegalIdentityInputs,
  legal: ShowcaseLegalDeclaration,
  declared: readonly ShowcaseCredentialDeclaration[],
): LegalShowcaseForm {
  const resolved = resolveShowcaseLegalIdentity(inputs, legal);
  if ('reason' in resolved) return resolved;
  // ⛔ Φ3.2 — κλεισμένη στο ΓΕΜΗ **δεν δημοσιεύεται ως νέα**. Η ήδη δημοσιευμένη κρατά την ετικέτα της
  //    (ανανέωση)· μια νέα πράξη δημοσίευσης θα έβαζε στον κατάλογο επιχείρηση που το μητρώο λέει κλειστή.
  if (resolved.identity.registryClosure !== null) return { reason: 'agency-profile-registry-inactive' };

  const credentials: ShowcaseCredential[] = [];
  for (const entry of bindRegistryNumber(declared, resolved.identity.gemiNumber)) {
    const formed = credentialFor(entry);
    if ('reason' in formed) return formed;
    credentials.push(attestFromRegistry(formed.credential, resolved.identity));
  }
  return { displayName: resolved.displayName, legalIdentity: resolved.identity, credentials };
}

export type LegalIdentityRefresh =
  | { readonly kind: 'refreshed'; readonly publicNameChanged: boolean }
  /** Η κρίση δεν περνά πια ⇒ η ταυτότητα αποσύρθηκε. Ο λόγος καταγράφεται, δεν «σερβίρεται». */
  | { readonly kind: 'withheld'; readonly reason: AgencyProfileRejection }
  /** Καμία βιτρίνα, ή βιτρίνα πριν την Α23 (καμία επιλογή να ξαναλυθεί — δεν επινοείται). */
  | { readonly kind: 'not-applicable' }
  | { readonly kind: 'failed' };

const NOT_APPLICABLE: LegalIdentityRefresh = { kind: 'not-applicable' };

/** Η επόμενη βιτρίνα μετά την ανανέωση — ίδια επιλογή, φρέσκες είσοδοι. */
function refreshedShowcase(showcase: PublicShowcase, identity: ShowcaseLegalIdentity, inputs: LegalIdentityInputs) {
  const resolved = reresolveShowcaseLegalIdentity(inputs, identity, showcase.displayName);
  const legalIdentity = 'reason' in resolved ? null : resolved.identity;
  const next: PublicShowcase = {
    ...showcase,
    displayName: 'reason' in resolved ? showcase.displayName : resolved.displayName,
    legalIdentity,
    credentials: showcase.credentials.map((credential) => attestFromRegistry(credential, legalIdentity)),
  };
  return { next, reason: 'reason' in resolved ? resolved.reason : null };
}

/**
 * **Ξανακρίνει τη νομική ταυτότητα μιας δημοσιευμένης βιτρίνας** — ιδεμποτής, γράφει μόνο αν άλλαξε κάτι.
 *
 * Ο καλών **κατέχει** τη συνέπεια του ονόματος: `publicNameChanged` ⇒ ανανέωση αγγελιών (Α22).
 */
export async function refreshShowcaseLegalIdentity(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<LegalIdentityRefresh> {
  const ref = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId);
  try {
    return await adminDb.runTransaction(async (transaction): Promise<LegalIdentityRefresh> => {
      const snapshot = await transaction.get(ref);
      const read = snapshot.exists ? readShowcase(snapshot.data(), companyId) : null;
      if (read?.outcome !== 'showcase' || read.showcase.legalIdentity === null) return NOT_APPLICABLE;

      const { showcase } = read;
      const inputs = await readLegalIdentityInputs(adminDb, transaction, companyId, showcase.locations);
      const { next, reason } = refreshedShowcase(showcase, showcase.legalIdentity, inputs);
      const stored = toStoredShowcase(next);
      if (JSON.stringify(stored) !== JSON.stringify(toStoredShowcase(showcase))) transaction.set(ref, stored);

      if (reason !== null) return { kind: 'withheld', reason };
      return { kind: 'refreshed', publicNameChanged: next.displayName !== showcase.displayName };
    });
  } catch (error) {
    logger.error('[LEGAL-IDENTITY] Η ανανέωση της νομικής ταυτότητας απέτυχε', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}
