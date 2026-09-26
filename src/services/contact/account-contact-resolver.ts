import 'server-only';

/**
 * @fileoverview **ΛΟΓΑΡΙΑΣΜΟΣ → ΕΠΑΦΗ CRM** — υπάρχουσα καρτέλα, ή καινούρια· ποτέ δεύτερη για τον ίδιο άνθρωπο.
 * @related ADR-827 §8.4 (αποδοχή εντολής — ο πρώτος καλών) · ADR-884 Φ0.13β (έγκριση θέασης — ο δεύτερος)
 * @module services/contact/account-contact-resolver
 *
 * 🔴 **Γιατί υπάρχει ως ΕΝΑ αρχείο**: γράφτηκε μέσα στο `mandate-acceptance-prepare.ts` (ADR-827). Όταν η έγκριση
 * αιτήματος θέασης χρειάστηκε την **ίδια** απάντηση («αυτός ο λογαριασμός είναι ήδη επαφή του γραφείου;»), η
 * εναλλακτική ήταν αντίγραφο — και τα δύο θα απέκλιναν στο πιο ευαίσθητο σημείο: το «είναι ο ίδιος άνθρωπος;».
 *
 * 🔑 **Ακριβής ερώτηση, όχι πιθανολογική**: ο άνθρωπος έχει λογαριασμό με email — `findContactByEmail` με το
 * `companyId` του γραφείου. ⛔ **Ποτέ** `checkContactDuplicates` (ασαφής ταύτιση ονόματος — θα κόλλαγε δεδομένα
 * ενός ανθρώπου στην καρτέλα **άλλου**).
 *
 * 🔴 **Αποτυχία ανάγνωσης = `unavailable`, ΟΧΙ «γράψε καινούρια»**: μια βλάβη διαβασμένη ως «δεν υπάρχει» παράγει
 * δεύτερη καρτέλα για τον ίδιο άνθρωπο — και δεύτερο αντίγραφο προσωπικών δεδομένων.
 *
 * ⛔ **Δεν γράφει**: η ταυτότητα γεννιέται (`generateContactId`) και το έγγραφο **ταξιδεύει** έτοιμο στη
 * συναλλαγή του καλούντα, που είναι ο **μόνος** γραφέας.
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { buildContactDocument } from '@/services/ai-pipeline/shared/contact-document-builder';
import { findContactByEmail } from '@/services/ai-pipeline/shared/contact-lookup-search';
import { generateContactId } from '@/services/enterprise-id-convenience';

const logger = createModuleLogger('account-contact-resolver');

/** Ό,τι ταξιδεύει από τον λογαριασμό στην καρτέλα — **και τίποτα άλλο**. */
export interface AccountContactIdentity {
  readonly givenName: string;
  readonly familyName: string;
  readonly email: string;
  /** Μόνο όπου το ζητά νομικό κείμενο (εντολή) — `null` αλλού. */
  readonly vatNumber: string | null;
}

export interface ResolvedAccountContact {
  readonly contactId: string;
  /** `null` ⇒ υπάρχουσα καρτέλα (τίποτα να γραφτεί)· αλλιώς το έγγραφο για τη συναλλαγή του καλούντα. */
  readonly doc: Record<string, unknown> | null;
  readonly displayName: string;
}

export type AccountContactResolution = ResolvedAccountContact | { readonly kind: 'unavailable' };

/** **Υπάρχουσα καρτέλα, ή καινούρια** — για το γραφείο `companyId`, με συντάκτη `createdBy`. */
export async function resolveAccountContact(input: {
  readonly identity: AccountContactIdentity;
  readonly companyId: string;
  readonly createdBy: string;
}): Promise<AccountContactResolution> {
  const { identity, companyId, createdBy } = input;
  try {
    const existing = await findContactByEmail(identity.email, companyId);
    if (existing !== null) return { contactId: existing.contactId, doc: null, displayName: existing.name };
  } catch (error) {
    logger.error('Ο έλεγχος υπάρχουσας επαφής απέτυχε — άγνωστο, όχι «δεν υπάρχει»', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'unavailable' };
  }

  // 🔴 `setDoc` + γεννήτορας του `enterprise-id` (N.6) — **ΠΟΤΕ** `addDoc`.
  const built = buildContactDocument({
    firstName: identity.givenName,
    lastName: identity.familyName,
    email: identity.email,
    phone: null,
    type: 'individual',
    companyId,
    createdBy,
    // Ο έλεγχος διπλοτύπου έγινε **ήδη**, με το σωστό ερώτημα — η σημαία δηλώνει την πρόθεση.
    skipDuplicateCheck: true,
    vatNumber: identity.vatNumber,
  });
  return { contactId: generateContactId(), doc: built.doc, displayName: built.displayName };
}

/** Από πού γεννήθηκε η καρτέλα — ένα πεδίο στο ίχνος (π.χ. `mandateRequestId` · `tourAccessRequestId`). */
export interface AccountContactOrigin {
  readonly field: string;
  readonly value: string;
  readonly label: string;
}

/**
 * **Το ίχνος ελέγχου της νέας επαφής** (ADR-195, CHECK 3.17) — **μόνο** για επαφή που όντως γεννήθηκε: μια
 * υπάρχουσα καρτέλα δεν «δημιουργήθηκε» επειδή την αναγνωρίσαμε. ⚠️ **Δεν πετά** — παρενέργεια μετά τη συναλλαγή.
 */
export async function recordAccountContactBirth(input: {
  readonly contactId: string;
  readonly displayName: string;
  readonly companyId: string;
  readonly performedBy: string;
  readonly origin: AccountContactOrigin;
}): Promise<void> {
  try {
    await EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.CONTACT,
      entityId: input.contactId,
      entityName: input.displayName,
      action: 'created',
      changes: [
        { field: 'displayName', oldValue: null, newValue: input.displayName, label: 'Όνομα' },
        { field: input.origin.field, oldValue: null, newValue: input.origin.value, label: input.origin.label },
      ],
      performedBy: input.performedBy,
      performedByName: input.performedBy,
      companyId: input.companyId,
    });
  } catch (error) {
    logger.error('Το ίχνος ελέγχου της νέας επαφής δεν γράφτηκε', {
      contactId: input.contactId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
