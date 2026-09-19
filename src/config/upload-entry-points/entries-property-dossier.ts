/**
 * @fileoverview **Η όψη του φακέλου ακινήτου πάνω στον ΕΝΑ κατάλογο τύπων εγγράφου** — ταυτότητες, όχι αντίγραφο.
 * @related ADR-866 §5.3 («ο ιδιώτης βλέπει όψη, όχι αντίγραφο») · §2.10 (Β1) · ADR-031
 * @module config/upload-entry-points/entries-property-dossier
 *
 * 🔴 **Γιατί υπάρχει (ζωντανή επαλήθευση 2026-09-19)**: ο φάκελος (Φ1.2) δεν είχε **καμία** γραμμή στον κατάλογο ⇒
 * ο επιλογέας τύπου ήταν κενός και **καμία** από τις 4 καρτέλες αρχείων δεν μπορούσε να ανεβάσει.
 *
 * 🔑 **Κανένα νέο είδος εγγράφου εδώ.** «Συμβόλαιο Μεταβίβασης» είναι το ίδιο έγγραφο όποιος κι αν το ανεβάσει
 * (ADR-866 §3.1): ο φάκελος **δανείζεται** ταυτότητες από τον κατάλογο του ακινήτου (`entries-property`) και των
 * μελετών (`entries-studies`) — ίδιο `id`, ίδιος σκοπός, ίδιο `domain`/`category`. Όσα **λείπουν** (ΠΕΑ ως χωριστή
 * θέση ακινήτου, ΗΤΚ, βεβαίωση νομιμότητας, παροχές, φωτογραφία οικοπέδου) προστίθενται **μία φορά** στον κατάλογο
 * (ADR-866 Φ2) — όχι εδώ.
 *
 * 🔑 **Η όψη αλλάζει μόνο την παρουσίαση**: σειρά = σειρά της λίστας (ADR-777 Α14 — «δεν επιβάλλουμε στον ιδιώτη να
 * γίνει ειδικός»), και **επίπεδη** λίστα (χωρίς `group`/`visibleIn` των μελετών, που θα άνοιγαν τον ιεραρχικό
 * επιλογέα έργου). Η ταυτότητα του εγγράφου μένει ανέγγιχτη.
 *
 * Config/data file — no logic (exempt from the 40-line / 500-line limits).
 */

import { PROPERTY_ENTRY_POINTS } from './entries-property';
import { STUDY_ENTRIES } from './entries-studies';
import type { UploadEntryPoint } from './types';

/** Οι τέσσερις καρτέλες αρχείων του φακέλου. */
export type PropertyDossierFileTab = 'floorplan' | 'documents' | 'photos' | 'videos';

/** Η κλάση του ακινήτου για την όψη — `land` για οικόπεδο/αγροτεμάχιο (`PROPERTY_TYPE_CLASS`), αλλιώς `building`. */
export type PropertyDossierViewClass = 'building' | 'land';

/** Ένας τύπος της όψης και οι κλάσεις ακινήτου στις οποίες **προσφέρεται** για ανέβασμα. */
export interface PropertyDossierViewEntry {
  readonly id: string;
  readonly classes: readonly PropertyDossierViewClass[];
}

const BOTH: readonly PropertyDossierViewClass[] = ['building', 'land'];
const BUILDING: readonly PropertyDossierViewClass[] = ['building'];
const LAND: readonly PropertyDossierViewClass[] = ['land'];

/**
 * **Τι προσφέρει κάθε καρτέλα** — ΜΙΑ διατεταγμένη λίστα ανά καρτέλα (η σειρά που βλέπει ο άνθρωπος), με τις κλάσεις
 * κάθε τύπου. ⚠️ Όχι χωριστή λίστα ανά κλάση: θα ήταν **δύο** αλήθειες για τη σειρά (μετρημένο — η άγκυρα Α38.1
 * κοκκίνισε όταν η γη δήλωνε «drone πριν από περιήγηση» και ο επιλογέας ταξινομούσε αλλιώς).
 *
 * ⚠️ Το **τοπογραφικό** ζει **πάντα** στην πρώτη καρτέλα (Giorgio 2026-09-19): «Τοπογραφικό» σε γη, «Κάτοψη» σε
 * κτίριο — ποτέ στα «Έγγραφα». Έτσι ένα αρχείο δεν εμφανίζεται ποτέ σε δύο καρτέλες (άγκυρα Α38.1).
 */
export const PROPERTY_DOSSIER_VIEW: Readonly<Record<PropertyDossierFileTab, readonly PropertyDossierViewEntry[]>> = {
  floorplan: [
    { id: 'unit-floor-plan', classes: BUILDING },
    { id: 'unit-section-drawing', classes: BUILDING },
    { id: 'unit-electrical-plan', classes: BUILDING },
    { id: 'unit-plumbing-plan', classes: BUILDING },
    { id: 'study-admin-topographic', classes: BOTH },
  ],
  documents: [
    { id: 'study-admin-title-deed', classes: BOTH },
    { id: 'study-admin-cadastre', classes: BOTH },
    { id: 'study-admin-legal-status', classes: BOTH },
    { id: 'study-admin-urban-plan', classes: LAND },
    { id: 'unit-permit', classes: BUILDING },
    { id: 'study-energy-certificate', classes: BUILDING },
    { id: 'study-admin-regulation', classes: BUILDING },
    { id: 'unit-contract', classes: BUILDING },
    { id: 'unit-invoice', classes: BOTH },
    { id: 'generic-unit-doc', classes: BOTH },
  ],
  photos: [
    { id: 'unit-interior-photo', classes: BUILDING },
    { id: 'unit-exterior-photo', classes: BOTH },
    { id: 'unit-view-photo', classes: BOTH },
    { id: 'unit-progress-photo', classes: BOTH },
  ],
  videos: [
    { id: 'unit-walkthrough-video', classes: BOTH },
    { id: 'unit-tour-video', classes: BUILDING },
    { id: 'unit-drone-video', classes: BOTH },
    { id: 'unit-progress-video', classes: BOTH },
  ],
};

/** Οι ταυτότητες μιας καρτέλας — όλες (`undefined` ⇒ ό,τι **διαβάζεται**) ή όσες **προσφέρονται** σε μια κλάση. */
export function propertyDossierViewIds(tab: PropertyDossierFileTab, viewClass?: PropertyDossierViewClass): string[] {
  return PROPERTY_DOSSIER_VIEW[tab]
    .filter((entry) => viewClass === undefined || entry.classes.includes(viewClass))
    .map((entry) => entry.id);
}

/** Όλες οι ταυτότητες της όψης, μία φορά, με τη σειρά των καρτελών. */
function dossierViewIds(): string[] {
  return [...new Set(Object.values(PROPERTY_DOSSIER_VIEW).flatMap((entries) => entries.map((entry) => entry.id)))];
}

/** Η πηγή των ταυτοτήτων — ο κατάλογος του ακινήτου και των μελετών, **αυτούσιος**. */
const CATALOG_SOURCES: readonly UploadEntryPoint[] = [...PROPERTY_ENTRY_POINTS, ...STUDY_ENTRIES];

/**
 * **Ο κατάλογος του φακέλου** — προβολή, όχι αντίγραφο: ίδια ταυτότητα (`id`/σκοπός/`domain`/`category`/ετικέτες),
 * σειρά της όψης, χωρίς ομάδα μελέτης. Ταυτότητα που δεν λύνεται **παραλείπεται** — και η άγκυρα Α38.1 κοκκινίζει.
 */
export const PROPERTY_DOSSIER_ENTRY_POINTS: UploadEntryPoint[] = dossierViewIds().flatMap((id, order) => {
  const source = CATALOG_SOURCES.find((entry) => entry.id === id);
  if (!source) return [];
  const { group: _group, visibleIn: _visibleIn, ...identity } = source;
  return [{ ...identity, order }];
});
