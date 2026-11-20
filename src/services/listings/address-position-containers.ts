/**
 * **ΠΟΥ ΖΟΥΝ ΟΙ ΔΙΕΥΘΥΝΣΕΙΣ ΚΑΘΕ ΟΝΤΟΤΗΤΑΣ, ΚΑΙ ΠΩΣ ΓΡΑΦΟΝΤΑΙ** — ADR-332 §D33.
 *
 * Ο γραφέας ολοκλήρωσης (§D29) ήξερε **ένα** σχήμα: πεδίο `addresses` στη ρίζα, με χειρόγραφη γραμμή
 * ιστορικού. Οι επαφές έχουν **άλλο**: αυθεντία `customFields.companyAddresses` + παράγωγο κάτοπτρο
 * `addresses` (ADR-332 D15), και ιστορικό από τον CDC τους (`auditContactWrite`), που διαβάζει τη
 * σφραγίδα φορέα. Ένας περιγραφέας ανά δοχείο ⇒ **ένας** γραφέας, χωρίς διακλαδώσεις ανά συλλογή μέσα του.
 *
 * 🔑 **Το κάτοπτρο γράφεται στην ΙΔΙΑ γραφή με την αυθεντία** — από τον **έναν** κατασκευαστή του
 * (`buildAddressInfoListFromCompanyAddresses`). Δύο γραφές θα άφηναν παράθυρο όπου διαφωνούν.
 *
 * @module services/listings/address-position-containers
 */

import 'server-only';

import type { DocumentData } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, SYSTEM_IDENTITY } from '@/config/domain-constants';
import { processPerformer } from '@/lib/audit/audit-performer';
import { primaryOrFirst } from '@/lib/primary-entry';
import { performerStamp, resolveProcessPerformer } from '@/server/lib/performer-stamp';
import type { AuditEntityType } from '@/types/audit-trail';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import { buildAddressInfoListFromCompanyAddresses } from '@/utils/contacts/address-info-builder';
import { authoritativeContactAddresses } from '@/utils/contacts/contact-addresses-reader';
import { contactAddressPositionView } from '@/utils/contacts/contact-address-position-view';
import type { ProjectAddressLike } from './address-place-writeback';

/**
 * Ποιος γράφει τη γραμμή ιστορικού μιας ολοκλήρωσης.
 * - `writer`: ο γραφέας, με την ίδια μηχανή διαφορών των ανθρώπινων αλλαγών (έργα · κτίρια).
 * - `cdc`: ο CDC της συλλογής, από τη σφραγίδα φορέα της γραφής (επαφές) — δεύτερη γραμμή θα ήταν διπλή.
 */
export type AddressPositionHistory = 'writer' | 'cdc';

export interface AddressPositionContainer {
  readonly collection: string;
  /** Ο τύπος οντότητας στο ιστορικό (ADR-195) και στα logs. */
  readonly entityType: AuditEntityType;
  readonly history: AddressPositionHistory;
  /** Οι διευθύνσεις **όπως είναι αποθηκευμένες** (με `id`) — σε αυτές γράφεται η θέση. Άγνωστο σχήμα ⇒ `[]`. */
  read(data: DocumentData): ProjectAddressLike[];
  /**
   * **Η όψη κρίσης** μιας αποθηκευμένης διεύθυνσης — ό,τι βλέπει ο κριτής θέσης («κρίθηκε;», «τι ρωτάμε;»).
   *
   * 🔴 ADR-332 §D33.1 — η επαφή λέει την ιεραρχία `municipalityName`/`regionName`/`regionalUnitName`· ο κριτής
   * ρωτά `municipality`/`region`/`regionalUnit`. Η αποθήκευση του ανθρώπου μεταφράζει (`contactAddressPositionView`)·
   * η σάρωση **δεν** μετέφραζε ⇒ το `resolvedFor` του ανθρώπου «διέφερε», η μηχανή ξαναρωτούσε **χωρίς δήμο** και η
   * κάρτα έδειχνε «Παλιά» (μετρημένο ζωντανά 2026-11-20, `cont_c4d79d09`). Μία όψη, και οι δύο διαδρομές.
   */
  view(address: ProjectAddressLike): ProjectAddressLike;
  /** Η γραφή των νέων διευθύνσεων **μαζί** με ό,τι παράγεται από αυτές. */
  patch(next: readonly ProjectAddressLike[]): Record<string, unknown>;
  /** Το όνομα της οντότητας για τη γραμμή ιστορικού (`writer`). */
  entityName(data: DocumentData): string | null;
}

function readText(data: DocumentData, field: string): string | null {
  const value: unknown = data[field];
  return typeof value === 'string' && value !== '' ? value : null;
}

function readRootAddresses(data: DocumentData): ProjectAddressLike[] {
  return Array.isArray(data.addresses) ? (data.addresses as ProjectAddressLike[]) : [];
}

/** Έργα · κτίρια: το αποθηκευμένο σχήμα **είναι** ήδη το λεξιλόγιο του κριτή. */
const asStored = (address: ProjectAddressLike): ProjectAddressLike => address;

/** Οι αποθηκευμένες διευθύνσεις του εγγράφου **στην όψη κρίσης** — η μία διατύπωση για ανακάλυψη και ερώτηση. */
export function judgedAddresses(container: AddressPositionContainer, data: DocumentData): ProjectAddressLike[] {
  return container.read(data).map((address) => container.view(address));
}

/**
 * Το σημείο της **κύριας** διεύθυνσης — ή `null` όταν δεν έχει θέση.
 *
 * 🏆 ADR-332 **D24** — «κύριο ή πρώτο» λέγεται ΜΙΑ φορά (`primaryOrFirst`).
 */
export function primaryPointOf(addresses: readonly ProjectAddressLike[]): { lat: number; lng: number } | null {
  const primary = primaryOrFirst(addresses);
  const lat = primary?.coordinates?.lat;
  const lng = primary?.coordinates?.lng;
  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
}

/**
 * Τα παράγωγα `latitude`/`longitude` του κτιρίου — **μία** διατύπωση για την αποθήκευση και για κάθε
 * ολοκλήρωση (D29 · §D33), ώστε να μην μπορούν να διαφωνήσουν. Γράφονται **μόνο** όταν υπάρχει σημείο.
 */
export function buildingPointFields(addresses: readonly ProjectAddressLike[]): Record<string, unknown> {
  const point = primaryPointOf(addresses);
  return point ? { latitude: point.lat, longitude: point.lng } : {};
}

export const PROJECT_ADDRESS_CONTAINER: AddressPositionContainer = {
  collection: COLLECTIONS.PROJECTS,
  entityType: ENTITY_TYPES.PROJECT,
  history: 'writer',
  read: readRootAddresses,
  view: asStored,
  patch: (next) => ({ addresses: next }),
  entityName: (data) => readText(data, 'name'),
};

export const BUILDING_ADDRESS_CONTAINER: AddressPositionContainer = {
  collection: COLLECTIONS.BUILDINGS,
  entityType: ENTITY_TYPES.BUILDING,
  history: 'writer',
  read: readRootAddresses,
  view: asStored,
  patch: (next) => ({ addresses: next, ...buildingPointFields(next) }),
  entityName: (data) => readText(data, 'name'),
};

/** Ο φορέας της μηχανής, λυμένος σύγχρονα — ο CDC τον διαβάζει από τη σφραγίδα της **ίδιας** γραφής. */
const ADDRESS_POSITION_PERFORMER = resolveProcessPerformer(processPerformer(SYSTEM_IDENTITY.ADDRESS_POSITION_ID));

/**
 * Επαφή: μόνο η **αυθεντική** λίστα. Ένα παλιό έγγραφο με διευθύνσεις μόνο σε κλειδιά ρίζας (§D30)
 * επιστρέφει `[]` ⇒ η μηχανή **δεν** το μεταφέρει σιωπηλά — η μεταφορά ανήκει στην επισκευή-κατά-την-
 * αποθήκευση και στη μετανάστευση `migrate-contact-hq-container`, που έχουν ανθρώπινο φορέα.
 */
export const CONTACT_ADDRESS_CONTAINER: AddressPositionContainer = {
  collection: COLLECTIONS.CONTACTS,
  entityType: ENTITY_TYPES.CONTACT,
  history: 'cdc',
  read: (data) => authoritativeContactAddresses(data.customFields as { companyAddresses?: unknown } | undefined) ?? [],
  // §D33.1 — η ΙΔΙΑ όψη με την αποθήκευση του ανθρώπου (`resolveContactAddressPositions`). Χωρίς `id` δεν
  // ταιριάζει με τίποτα ούτε εκεί (`contactAddressPositionViews`), άρα μένει αυτούσια και δεν ζητείται ποτέ.
  view: (address) =>
    address.id ? contactAddressPositionView({ ...(address as CompanyAddress), id: address.id }) : address,
  patch: (next) => {
    const companyAddresses = next as readonly CompanyAddress[];
    return {
      'customFields.companyAddresses': companyAddresses,
      addresses: buildAddressInfoListFromCompanyAddresses(companyAddresses),
      ...performerStamp(ADDRESS_POSITION_PERFORMER),
    };
  },
  entityName: () => null,
};

/** Τα δοχεία που κατέχει ο κύκλος ζωής της θέσης — η σάρωση τα περνά **όλα**, με αυτή τη σειρά. */
export const ADDRESS_POSITION_CONTAINERS: readonly AddressPositionContainer[] = [
  CONTACT_ADDRESS_CONTAINER,
  PROJECT_ADDRESS_CONTAINER,
  BUILDING_ADDRESS_CONTAINER,
];

export function addressPositionContainerFor(collection: string): AddressPositionContainer | undefined {
  return ADDRESS_POSITION_CONTAINERS.find((container) => container.collection === collection);
}
