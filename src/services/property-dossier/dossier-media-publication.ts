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
 *
 * ⛰️ **ΤΟ ΤΟΠΟΓΡΑΦΙΚΟ ΔΕΝ ΠΕΡΝΑ ΑΠΟ ΤΗ ΔΗΛΩΣΗ** (ADR-920 Β4.4): την εξουσιοδότηση τη δίνει η **πράξη** της πόρτας
 * εδάφους (δήλωση Δ2 ⇒ `classification` + `publicationIdentity`, γραμμένα ΜΟΝΟ από τον διακομιστή — κανόνες Β4.6), όχι
 * το `publishedFileIds`. Το επιλέγει ο **ίδιος** κριτής με το εταιρικό ακίνητο ({@link dossierTerrainSource}).
 */

import { normalizeToISO } from '@/lib/date-local';
import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  PHOTO_MATERIAL,
  declaredFloorplanMaterial,
  type ListingMaterial,
} from '@/lib/listings/listing-material';
import {
  isDeliverableListingFile,
  isDeliverableListingImage,
  type ListingFileCandidate,
} from '@/lib/listings/listing-file-deliverability';
import { dxfPublishRasterPathOf } from '@/services/floorplans/dxf-publish-raster';
import type { DeclaredFileIds } from '@/lib/listings/declared-file-ids';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';
import type { PhotoCaptureSpot } from '@/lib/listings/photo-capture-spot';
import type { DeclaredFloorplanNorth } from '@/lib/listings/floorplan-north';
import {
  PUBLISHED_MEDIA_LIMIT,
  type PublicShelfSource,
} from '@/services/upload/utils/storage-path-public-shelf';
import { currentTerrainSource } from '@/services/listings/terrain-source-selection';
import { propertyDossierFileTabOf } from '@/components/property-dossier/property-dossier-media';
import type { PropertyDossierFileTab } from '@/config/upload-entry-points/entries-property-dossier';
import type { FileRecord } from '@/types/file-record';
import type { PropertyDossier } from '@/types/property-dossier';

/**
 * **Ό,τι ΔΗΛΩΣΕ ο άνθρωπος για τα αρχεία που φεύγουν** — ονομασμένα πεδία, ποτέ ομόηχοι χάρτες σε σειρά ορισμάτων
 * (μια αντιμετάθεση δύο `ReadonlyMap<string, …>` θα ήταν **σιωπηλή** — ίδιο δόγμα με το `AgencyMediaDeclaration`).
 * Κάθε πεδίο προαιρετικό: απόν ⇒ καμία δήλωση. Καμία δεν **δημοσιεύει** τίποτα· λένε μόνο **πώς** φαίνεται ό,τι φεύγει.
 */
export interface DossierMediaDeclaration {
  /** 🎯 ADR-880 — σημείο εστίασης ανά φωτογραφία. */
  readonly focalPoints?: ReadonlyMap<string, PhotoFocalPoint>;
  /** 📍 ADR-897 — σημείο λήψης ανά φωτογραφία. */
  readonly captureSpots?: ReadonlyMap<string, PhotoCaptureSpot>;
  /** 🧭 ADR-897 Φ5.2 — βορράς ανά κάτοψη. */
  readonly floorplanNorth?: DeclaredFloorplanNorth;
}

/**
 * Το `FileRecord` όσο το χρειάζεται η απόφαση: καταλληλότητα + εμβέλεια καρτέλας + κάτοχος — και, για το τοπογραφικό
 * (ADR-920 Β4.4), τα δύο πεδία θεματοφυλακής δημοσίευσης που γράφει μόνο ο διακομιστής.
 */
export type DossierMediaCandidate = ListingFileCandidate &
  Pick<FileRecord, 'entityId' | 'userId' | 'domain' | 'category' | 'purpose' | 'classification' | 'publicationIdentity'> &
  // 🖼️ ADR-922 — είδος + κατάσταση της εικόνας δημοσίευσης ενός DXF (ο κριτής ρωτά `dxfPublishRasterPathOf`).
  Pick<FileRecord, 'ext' | 'publishRaster'>;

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

/** **Ως τι φεύγει** ένα αρχείο **και ποια bytes** το εκπροσωπούν στο ράφι — ιδιωτική διαδρομή, ποτέ URL. */
interface DossierMediaPublication {
  readonly material: ListingMaterial;
  /**
   * Η εικόνα που παραλαμβάνει το ράφι. Για φωτογραφία/εικόνα κάτοψης **το ίδιο** το αρχείο· για DXF **το PNG
   * δημοσίευσης** δίπλα του (ADR-922) — το DXF **δεν** φτάνει ποτέ στον καθαριστή.
   */
  readonly imagePath: string;
}

/**
 * **Ποια εικόνα εκπροσωπεί αυτό το αρχείο στη βιτρίνα** — ή `null`.
 *
 * 🖼️ ADR-922: το DXF φεύγει **μόνο** ως κάτοψη/τοπογραφικό και **μόνο** όταν το παράγωγο είναι έτοιμο. Ίδιοι φρουροί
 * καταλληλότητας με κάθε αρχείο (κάτοχος · `ready` · ζωντανό) — αλλάζει μόνο η μορφή που κρίνεται αποκωδικοποιήσιμη.
 */
function dossierImagePathOf(file: DossierMediaCandidate, tab: PublishableDossierTab): string | null {
  if (isDeliverableListingImage(file, DOSSIER_ENTITY_TYPE)) return file.storagePath;
  if (tab !== 'floorplan' || !isDeliverableListingFile(file, DOSSIER_ENTITY_TYPE)) return null;
  return dxfPublishRasterPathOf(file);
}

/** Το υλικό μιας καρτέλας — ή `null` (δεν φεύγει). */
function tabMaterialOf(tab: PublishableDossierTab, file: DossierMediaCandidate): ListingMaterial | null {
  if (tab === 'photos') return PHOTO_MATERIAL;
  // 🔑 Η κάτοψη κουβαλά **πότε** (`SourcedAttribute`): η στιγμή του αρχείου, ή δεν φεύγει καθόλου.
  const at = normalizeToISO(file.createdAt);
  return at === null ? null : declaredFloorplanMaterial(at);
}

/**
 * **Ως τι φεύγει αυτό το αρχείο, και με ποια bytes** — ή `null`. ΜΙΑ κρίση για «φεύγει;» · «τι είναι;» · «ποια
 * εικόνα;», ώστε να μην μπορούν να διαφωνήσουν (ίδιο δόγμα με το `agencyMediaMaterial`, ADR-841 Α17.7.4).
 */
function dossierMediaPublication(
  dossier: DossierMediaOwner,
  file: DossierMediaCandidate,
): DossierMediaPublication | null {
  if (file.entityId !== dossier.id || file.userId !== dossier.userId) return null;
  const tab = propertyDossierFileTabOf(dossier, file, PUBLISHABLE_TABS);
  if (tab !== 'photos' && tab !== 'floorplan') return null;

  const imagePath = dossierImagePathOf(file, tab);
  const material = imagePath === null ? null : tabMaterialOf(tab, file);
  return imagePath === null || material === null ? null : { material, imagePath };
}

/**
 * **Ως τι φεύγει αυτό το αρχείο** — ή `null` (δεν φεύγει). **Δεν** ρωτά τη δήλωση. Η ίδια κρίση με τον γραφέα
 * ({@link dossierMediaPublication}), χωρίς τη διαδρομή — αυτή ανήκει μόνο στο ράφι.
 */
export function dossierMediaMaterial(
  dossier: DossierMediaOwner,
  file: DossierMediaCandidate,
): ListingMaterial | null {
  return dossierMediaPublication(dossier, file)?.material ?? null;
}

/** Ένα δηλωμένο αρχείο που **φεύγει**, μαζί με το υλικό και την εικόνα του — υπολογισμένα **μία** φορά. */
export interface PublishedDossierFile<T extends DossierMediaCandidate> {
  readonly file: T;
  readonly material: ListingMaterial;
  /** Η ιδιωτική διαδρομή της εικόνας που παραλαμβάνει το ράφι (ADR-922: για DXF, το PNG δημοσίευσης). */
  readonly imagePath: string;
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
    const publication = dossierMediaPublication(dossier, file);
    if (publication !== null) published.push({ file, ...publication });
  }
  return published.slice(0, PUBLISHED_MEDIA_LIMIT);
}

/** Το ίδιο, στο σχήμα που παραλαμβάνει το ράφι (`PublicShelfSource`) — μονοπάτι στον **ιδιωτικό** κάδο, ποτέ URL. */
export function publishedDossierMediaSources(
  dossier: DossierMediaOwner,
  files: readonly DossierMediaCandidate[],
  declared: DeclaredFileIds,
  declaration: DossierMediaDeclaration = {},
): readonly PublicShelfSource[] {
  return publishedDossierFiles(dossier, files, declared).map(({ file, material, imagePath }) => ({
    // 🖼️ ADR-922 — η **εικόνα** του αρχείου: το ίδιο για φωτογραφία, το PNG δημοσίευσης για DXF.
    privateStoragePath: imagePath,
    // ADR-895 — η θέση ταξιδεύει ΜΑΖΙ με το μονοπάτι.
    storagePlacement: file.storagePlacement,
    material,
    // 🎯 ADR-880 — δεμένο στο **αρχείο**, ποτέ στη θέση.
    focalPoint: declaration.focalPoints?.get(file.id) ?? null,
    // 📍 ADR-897 — ταυτότητα + σημείο λήψης, δεμένα στο **αρχείο** όπως το σημείο εστίασης.
    sourceFileId: file.id,
    captureSpot: declaration.captureSpots?.get(file.id) ?? null,
    // 🧭 ADR-897 Φ5.2 — ο βορράς της **κάτοψης**· για φωτογραφία απλώς απών.
    northRad: declaration.floorplanNorth?.get(file.id) ?? null,
  }));
}

/**
 * ⛰️ **Η πηγή εδάφους του φακέλου** — ή `null` (ADR-920 Β4.4).
 *
 * 🔴 **Ο ΚΑΤΟΧΟΣ ΞΑΝΑΡΩΤΙΕΤΑΙ ΕΔΩ** (ζώνη ασφαλείας, όπως στο {@link dossierMediaMaterial}): ο αναγνώστης φέρνει ήδη
 * μόνο αρχεία του φακέλου, αλλά ο επιλογέας δεν εμπιστεύεται τη λίστα εισόδου — αρχείο άλλου φακέλου ή άλλου ανθρώπου
 * δεν γίνεται ποτέ έδαφος αυτής της αγγελίας. Το «είναι γη;» το κρίνει ο καλών, από το **δημοσιευόμενο** είδος.
 */
export function dossierTerrainSource(
  dossier: DossierMediaOwner,
  files: readonly DossierMediaCandidate[],
): PublicShelfSource | null {
  const owned = files.filter((file) => file.entityId === dossier.id && file.userId === dossier.userId);
  return currentTerrainSource(owned, DOSSIER_ENTITY_TYPE);
}
