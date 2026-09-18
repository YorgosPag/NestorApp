/**
 * entity-media-binding — per-entity adapter for the shared media/files tabs
 *
 * Normalises a Parking spot, a Storage unit or a property dossier into the
 * minimal shape the generic {@link EntityMediaFilesTab} needs. This is the
 * "per-entity binding" half of the shell+binding pattern (mirrors ADR-585
 * DomainCard binding and ADR-586 webhook adapters).
 *
 * 🔑 ADR-866 Φ1.2 (§2.9.3 Κ1) — **ΠΟΙΟΣ ΚΑΤΕΧΕΙ ΤΑ ΑΡΧΕΙΑ ΤΟ ΛΕΕΙ Η ΣΥΝΔΕΣΗ, ΟΧΙ ΤΟ ΚΕΛΥΦΟΣ.**
 * Μέχρι τη Φ1.2 το κέλυφος έγραφε `custody={{ companyId }}` με το χέρι, δηλαδή **κάθε** οντότητα θεωρούνταν
 * εταιρική — και ο προσωπικός φάκελος ακινήτου θα χρειαζόταν **δεύτερο** κέλυφος. Τώρα κάθε σύνδεση **δηλώνει**
 * την πηγή της θεματοφυλακής ({@link MediaCustodySource}), και το κέλυφος μένει **ένα**.
 *
 * @module components/space-management/shared/tabs/entity-media-binding
 * @see ADR-588 — Space Media Tab Shell
 * @see ADR-866 §5.2 — FileCustody
 */

import { ENTITY_TYPES, type EntityType } from '@/config/domain-constants';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import type { FileCustody } from '@/lib/files/file-custody';
import type { Storage } from '@/types/storage/contracts';
import type { PropertyDossier } from '@/types/property-dossier';

/**
 * **Από πού έρχεται η θεματοφυλακή των αρχείων** — κλειστό σύνολο.
 *
 * · `session-company` — η εταιρεία της **συνεδρίας** (`useCompanyId`). Ό,τι ίσχυε **αυτούσιο** για Parking/Storage:
 *   καμία αλλαγή συμπεριφοράς, κανένα νέο ερώτημα.
 * · `personal` — ρητός κάτοχος-**άνθρωπος** (`{ userId }`). ⛔ Το κέλυφος **δεν** ρωτά ποτέ εταιρεία γι' αυτόν: ο
 *   προσωπικός χώρος δεν διευρύνεται ποτέ προς την εταιρεία του υπαλλήλου (ADR-866 §5.2).
 *
 * ⚠️ Όχι σκέτο `FileCustody`: για Parking/Storage η εταιρεία **δεν** είναι γνωστή τη στιγμή που χτίζεται η σύνδεση
 * (είναι της συνεδρίας)· ένα `{ companyId: parking.companyId }` θα ήταν **αλλαγή** κριτή, όχι μεταφορά.
 */
export type MediaCustodySource =
  | { readonly kind: 'session-company' }
  | { readonly kind: 'personal'; readonly custody: Extract<FileCustody, { userId: string }> };

/** Η πηγή των εταιρικών οντοτήτων του κελύφους — μία σταθερά, ώστε οι factories να μη γράφουν το σχήμα με το χέρι. */
export const SESSION_COMPANY_CUSTODY: MediaCustodySource = { kind: 'session-company' };

/** Normalised, entity-agnostic binding consumed by EntityMediaFilesTab. */
export interface EntityMediaBinding {
  /** Canonical entity type for the file storage path (ADR-031). */
  entityType: EntityType;
  /** Entity document id. */
  entityId: string;
  /** Human-readable label shown in the files manager. */
  entityLabel?: string;
  /** Owning project id, when available. */
  projectId?: string;
  /** i18n namespace used to resolve the unauthenticated sign-in message. */
  i18nNamespace: string;
  /** Purpose prefix for canonical file naming (`${prefix}-${purposeKey}`). */
  purposePrefix: string;
  /** Who owns the files — **declared** by the binding (ADR-866 Φ1.2). */
  custodySource: MediaCustodySource;
}

/** Binding for a parking spot detail view. */
export function parkingMediaBinding(parking: ParkingSpot): EntityMediaBinding {
  return {
    entityType: ENTITY_TYPES.PARKING_SPOT,
    entityId: parking.id,
    entityLabel: parking.number,
    projectId: parking.projectId,
    i18nNamespace: 'parking',
    purposePrefix: 'parking',
    custodySource: SESSION_COMPANY_CUSTODY,
  };
}

/** Binding for a storage unit detail view. */
export function storageMediaBinding(storage: Storage): EntityMediaBinding {
  return {
    entityType: ENTITY_TYPES.STORAGE,
    entityId: storage.id,
    entityLabel: storage.name,
    projectId: storage.projectId,
    i18nNamespace: 'storage',
    purposePrefix: 'storage',
    custodySource: SESSION_COMPANY_CUSTODY,
  };
}

/**
 * Binding for a **property dossier** (ADR-866 Φ1.2) — ο φάκελος του σπιτιού στον προσωπικό χώρο.
 *
 * 🔑 Ο κάτοχος των αρχείων είναι ο **κάτοχος του φακέλου** (`dossier.userId`), όχι ο συνδεδεμένος: σήμερα
 * ταυτίζονται· από τη Φ3 (καλεσμένοι) ο καλεσμένος ανεβάζει **στον φάκελο του κατόχου**, ποτέ στον δικό του χώρο.
 * Χωρίς έργο (`projectId`): ο φάκελος δεν ανήκει σε έργο.
 */
export function propertyDossierMediaBinding(
  dossier: Pick<PropertyDossier, 'id' | 'label' | 'userId'>,
): EntityMediaBinding {
  return {
    entityType: ENTITY_TYPES.PROPERTY_DOSSIER,
    entityId: dossier.id,
    entityLabel: dossier.label,
    i18nNamespace: 'property-market',
    purposePrefix: 'dossier',
    custodySource: { kind: 'personal', custody: { userId: dossier.userId } },
  };
}
