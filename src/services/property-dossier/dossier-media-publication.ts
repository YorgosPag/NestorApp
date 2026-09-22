/**
 * @fileoverview **«ΠΟΙΑ ΑΡΧΕΙΑ ΤΟΥ ΦΑΚΕΛΟΥ ΦΕΥΓΟΥΝ ΜΕ ΑΥΤΗ ΤΗΝ ΑΓΓΕΛΙΑ — ΚΑΙ ΩΣ ΤΙ;»** — η μία απάντηση (ADR-866 Φ1.3).
 * @related ADR-866 §2.7.4 · §2.11 · services/listings/agency-media-selection (ο αδελφός του γραφείου) ·
 *   lib/listings/listing-file-deliverability (ο κοινός κριτής καταλληλότητας)
 * @module services/property-dossier/dossier-media-publication
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΦΡΟΥΡΟΙ, ΟΠΩΣ ΣΤΟ ΓΡΑΦΕΙΟ — ΜΕ ΑΛΛΗ ΑΥΘΕΝΤΙΑ ΣΤΟΝ ΠΡΩΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   1. **ΕΞΟΥΣΙΟΔΟΤΗΣΗ** — *«το διάλεξε ο άνθρωπος για ΑΥΤΗ την αγγελία;»* ⇒ η ταυτότητα είναι στη **δήλωση**
 *      (`OwnerProperty.publishedFileIds`). Όχι `classification`: η απόφαση είναι **ανά αγγελία**, όχι ανά αρχείο.
 *   2. **ΚΑΤΑΛΛΗΛΟΤΗΤΑ** — *«είναι φωτογραφία/κάτοψη αυτού του φακέλου, έτοιμη, ζωντανή, αποκωδικοποιήσιμη;»* ⇒ ο
 *      **κοινός** κριτής + η καρτέλα όπου το δείχνει **η σελίδα του φακέλου** (`propertyDossierFileTabOf`).
 *
 * 🔑 **Η σειρά ΕΙΝΑΙ η δήλωση**: στον ιδιώτη η δήλωση απαντά μαζί *«ποια;»* **και** *«με ποια σειρά;»* (§2.7.4),
 * ενώ στο γραφείο το `publishedMediaOrder` απαντά **μόνο** τη σειρά. Γι' αυτό ο `orderByDeclaration` του γραφείου
 * (που βάζει στο τέλος τα αδήλωτα) **δεν** είναι το σωστό εργαλείο εδώ: αδήλωτο αρχείο **δεν φεύγει**.
 *
 * 🔴 **ΖΩΝΗ ΑΣΦΑΛΕΙΑΣ (N.7.2 #4)**: ο αναγνώστης φέρνει ήδη μόνο αρχεία του φακέλου· ο επιλογέας **το ξαναρωτά**
 * (`entityId` · `userId`). Ξένη ταυτότητα στη δήλωση ⇒ **αγνοείται**, όποιος κι αν γέμισε τη λίστα εισόδου.
 */

import { normalizeToISO } from '@/lib/date-local';
import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  PHOTO_MATERIAL,
  declaredFloorplanMaterial,
  type ListingMaterial,
} from '@/lib/listings/listing-material';
import {
  isDeliverableListingImage,
  type ListingFileCandidate,
} from '@/lib/listings/listing-file-deliverability';
import type { DeclaredFileIds } from '@/lib/listings/declared-file-ids';
import {
  PUBLISHED_MEDIA_LIMIT,
  type PublicShelfSource,
} from '@/services/upload/utils/storage-path-public-shelf';
import { propertyDossierFileTabOf } from '@/components/property-dossier/property-dossier-media';
import type { PropertyDossierFileTab } from '@/config/upload-entry-points/entries-property-dossier';
import type { FileRecord } from '@/types/file-record';
import type { PropertyDossier } from '@/types/property-dossier';

/** Το `FileRecord` όσο το χρειάζεται η απόφαση: καταλληλότητα + εμβέλεια καρτέλας + κάτοχος. */
export type DossierMediaCandidate = ListingFileCandidate &
  Pick<FileRecord, 'entityId' | 'userId' | 'domain' | 'category' | 'purpose'>;

/** Ο φάκελος όσο τον χρειάζεται η απόφαση. */
export type DossierMediaOwner = Pick<PropertyDossier, 'id' | 'label' | 'userId' | 'type'>;

/** **Ό,τι διάβασε ο διακομιστής από τον φάκελο** — ο φάκελος και τα έτοιμα αρχεία του. Είσοδος, ποτέ απόφαση. */
export interface DossierMediaRead {
  readonly dossier: DossierMediaOwner;
  readonly files: readonly DossierMediaCandidate[];
}

/**
 * **Οι καρτέλες που ΜΠΟΡΟΥΝ να φύγουν στη βιτρίνα**, με σειρά προτεραιότητας.
 * ⛔ Έγγραφα (συμβόλαια, ΠΕΑ, τίτλοι) και βίντεο **δεν** φεύγουν — ο δημόσιος πίνακας έχει μόνο `gallery` και `floorplans`.
 *
 * 🔑 **Εξάγεται για τη ΦΟΡΜΑ** (Φ1.3β): η οθόνη που ζητά τη δήλωση προσφέρει **ακριβώς** όσα μπορεί να δημοσιεύσει ο
 * γραφέας. Μια δεύτερη λίστα εκεί θα ήταν η ημέρα που η φόρμα προσφέρει βίντεο και η βιτρίνα το αγνοεί σιωπηλά.
 */
export const PUBLISHABLE_TABS = ['photos', 'floorplan'] as const satisfies readonly PropertyDossierFileTab[];

/**
 * Μια καρτέλα που **μπορεί** να φύγει στη βιτρίνα — ο τύπος που κρατά τη φόρμα ευθυγραμμισμένη με τον γραφέα.
 *
 * ⚠️ **`as const satisfies`, ΟΧΙ σχολιασμός τύπου**: ένα `: readonly PropertyDossierFileTab[]` θα **φάρδαινε** τον
 * τύπο σε **και τις τέσσερις** καρτέλες, και αυτός ο τύπος θα επέτρεπε στη φόρμα να ζητήσει ανέβασμα σε «Έγγραφα»
 * — δηλαδή ακριβώς αυτό που η λίστα υπάρχει για να αποκλείσει. Το `satisfies` κρατά **και** τον έλεγχο **και** το στένεμα.
 */
export type PublishableDossierTab = (typeof PUBLISHABLE_TABS)[number];

const DOSSIER_ENTITY_TYPE = ENTITY_TYPES.PROPERTY_DOSSIER;

/**
 * **Ως τι φεύγει αυτό το αρχείο** — ή `null` (δεν φεύγει). ΜΙΑ συνάρτηση για «φεύγει;» **και** «τι είναι;», ώστε να
 * μην μπορούν να διαφωνήσουν (ίδιο δόγμα με το `agencyMediaMaterial`, ADR-841 Α17.7.4). **Δεν** ρωτά τη δήλωση.
 */
export function dossierMediaMaterial(
  dossier: DossierMediaOwner,
  file: DossierMediaCandidate,
): ListingMaterial | null {
  if (file.entityId !== dossier.id || file.userId !== dossier.userId) return null;
  if (!isDeliverableListingImage(file, DOSSIER_ENTITY_TYPE)) return null;

  switch (propertyDossierFileTabOf(dossier, file, PUBLISHABLE_TABS)) {
    case 'photos':
      return PHOTO_MATERIAL;
    case 'floorplan': {
      // 🔑 Η κάτοψη κουβαλά **πότε** (`SourcedAttribute`): η στιγμή του αρχείου, ή δεν φεύγει καθόλου.
      const at = normalizeToISO(file.createdAt);
      return at === null ? null : declaredFloorplanMaterial(at);
    }
    default:
      return null;
  }
}

/** Ένα δηλωμένο αρχείο που **φεύγει**, μαζί με το υλικό του — υπολογισμένο **μία** φορά. */
export interface PublishedDossierFile<T extends DossierMediaCandidate> {
  readonly file: T;
  readonly material: ListingMaterial;
}

/**
 * **Τα αρχεία που φεύγουν, στη σειρά της δήλωσης**, ως το όριο του ραφιού.
 *
 * ⚠️ **Διπλή ταυτότητα στη δήλωση μετρά μία φορά**: το σχήμα αιτήματος τις απορρίπτει ήδη, αλλά παλιό ή χειροποίητο
 * έγγραφο δεν περνά από εκεί — και ένα αρχείο δύο φορές στη βιτρίνα είναι ορατό ελάττωμα.
 */
export function publishedDossierFiles<T extends DossierMediaCandidate>(
  dossier: DossierMediaOwner,
  files: readonly T[],
  declared: DeclaredFileIds,
): readonly PublishedDossierFile<T>[] {
  const byId = new Map(files.map((file) => [file.id, file] as const));
  const seen = new Set<string>();
  const published: PublishedDossierFile<T>[] = [];

  for (const id of declared) {
    const file = byId.get(id);
    if (file === undefined || seen.has(id)) continue;
    seen.add(id);
    const material = dossierMediaMaterial(dossier, file);
    if (material !== null) published.push({ file, material });
  }
  return published.slice(0, PUBLISHED_MEDIA_LIMIT);
}

/** Το ίδιο, στο σχήμα που παραλαμβάνει το ράφι (`PublicShelfSource`) — μονοπάτι στον **ιδιωτικό** κάδο, ποτέ URL. */
export function publishedDossierMediaSources(
  dossier: DossierMediaOwner,
  files: readonly DossierMediaCandidate[],
  declared: DeclaredFileIds,
): readonly PublicShelfSource[] {
  return publishedDossierFiles(dossier, files, declared).map(({ file, material }) => ({
    privateStoragePath: file.storagePath,
    material,
  }));
}
