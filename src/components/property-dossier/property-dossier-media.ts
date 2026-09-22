/**
 * @fileoverview **Οι καρτέλες αρχείων του φακέλου ακινήτου** — το ίδιο κέλυφος, με εύρος από τον **έναν** κατάλογο.
 * @related ADR-866 §2.10 (Β1 · Π2) · §5.3 · ADR-588 (κέλυφος) · `config/upload-entry-points/entries-property-dossier.ts`
 * @module components/property-dossier/property-dossier-media
 *
 * 🔴 **Η βλάβη (ζωντανή επαλήθευση 2026-09-19)**: η Φ1.2 έδωσε στον φάκελο τις ρυθμίσεις της **θέσης στάθμευσης**
 * (`construction/*`, φίλτρο κατηγορίας) χωρίς καμία γραμμή στον κατάλογο ⇒ μηδέν τύποι εγγράφου, καμία καρτέλα δεν
 * ανέβαζε. Και αν απλώς προστίθονταν οι τύποι του ακινήτου, οι φωτογραφίες τους (`sales`) θα ανέβαιναν **αόρατες**
 * σε καρτέλα που διάβαζε `construction`.
 *
 * 🔑 Τώρα η καρτέλα **δηλώνει τύπους** (`entryPointScope`) και το κέλυφος **παράγει** από αυτούς τι διαβάζει
 * (`media-tab-scope.ts`): ό,τι ανεβαίνει φαίνεται, κατασκευαστικά. Οι ρυθμίσεις **παρουσίασης** (δεκτοί τύποι αρχείων,
 * γκαλερί, μήνυμα σύνδεσης) μένουν οι **κοινές** του κελύφους — καμία δεύτερη διατύπωση.
 *
 * 🔑 **Προσφορά ανά κλάση, ανάγνωση πάντα της ένωσης**: αν ο κάτοχος αλλάξει «Οικόπεδο» σε «Μονοκατοικία», οι
 * φωτογραφίες και τα έγγραφά του **δεν** κρύβονται — αλλάζει μόνο τι προτείνεται για το επόμενο ανέβασμα.
 */

import {
  DOCUMENTS_MEDIA_CONFIG,
  FLOORPLAN_MEDIA_CONFIG,
  PHOTOS_MEDIA_CONFIG,
  VIDEOS_MEDIA_CONFIG,
  type MediaTabConfig,
} from '@/components/space-management/shared/tabs/media-tab-configs';
import { FILE_DOMAINS } from '@/config/domain-constants';
import {
  propertyDossierViewIds,
  type PropertyDossierFileTab,
  type PropertyDossierViewClass,
} from '@/config/upload-entry-points/entries-property-dossier';
import { floorplanTabKind } from '@/lib/property-dossier/property-dossier-view';
import { propertyDossierMediaBinding } from '@/components/space-management/shared/tabs/entity-media-binding';
import { mediaTabScopePolicy } from '@/components/space-management/shared/tabs/media-tab-scope';
import { matchesFileScopes } from '@/components/shared/files/utils/upload-scope';
import type { FileRecord } from '@/types/file-record';
import type { PropertyDossier } from '@/types/property-dossier';

/**
 * Οι **προεπιλογές** κάθε καρτέλας — ό,τι γράφεται όταν δεν επιλέχθηκε τύπος (λήψη κάμερας, σημείωση, ήχος) — πάνω
 * στις κοινές ρυθμίσεις παρουσίασης. Το `domain` ακολουθεί τον κατάλογο του ακινήτου (φωτογραφίες/βίντεο `sales`,
 * σχέδια `construction`, έγγραφα `admin`), ώστε η «λήψη» να καταλήγει εκεί που ζουν και οι επιλεγμένοι τύποι.
 */
const DOSSIER_TAB_PRESENTATION: Readonly<Record<PropertyDossierFileTab, MediaTabConfig>> = {
  floorplan: { ...FLOORPLAN_MEDIA_CONFIG, entryPointCategoryFilter: undefined },
  documents: { ...DOCUMENTS_MEDIA_CONFIG, domain: FILE_DOMAINS.ADMIN, entryPointExcludeCategories: undefined },
  photos: { ...PHOTOS_MEDIA_CONFIG, domain: FILE_DOMAINS.SALES, entryPointCategoryFilter: undefined },
  videos: { ...VIDEOS_MEDIA_CONFIG, domain: FILE_DOMAINS.SALES, entryPointCategoryFilter: undefined },
};

const EMPTY_KEY_PREFIX = 'dossier.tabs.empty';

/** Κείμενο κενής όψης ανά καρτέλα/κλάση — τα έγγραφα κρατούν τη γενική λίστα του διαχειριστή αρχείων. */
function emptyKeyOf(tab: PropertyDossierFileTab, viewClass: PropertyDossierViewClass): string | undefined {
  if (tab === 'documents') return undefined;
  if (tab === 'floorplan') return `${EMPTY_KEY_PREFIX}.${viewClass === 'land' ? 'topographic' : 'floorplan'}`;
  return `${EMPTY_KEY_PREFIX}.${tab}`;
}

/** Η κλάση της όψης — από τον **ίδιο** κριτή που ονομάζει την καρτέλα «Τοπογραφικό» (`floorplanTabKind`). */
export function propertyDossierViewClass(type: PropertyDossier['type']): PropertyDossierViewClass {
  return floorplanTabKind(type) === 'topographic' ? 'land' : 'building';
}

/** **Η ρύθμιση μιας καρτέλας αρχείων του φακέλου** — κοινή παρουσίαση + εύρος από την όψη του καταλόγου. */
export function propertyDossierMediaTab(tab: PropertyDossierFileTab, type: PropertyDossier['type']): MediaTabConfig {
  const viewClass = propertyDossierViewClass(type);
  return {
    ...DOSSIER_TAB_PRESENTATION[tab],
    emptyKey: emptyKeyOf(tab, viewClass),
    entryPointScope: {
      offer: propertyDossierViewIds(tab, viewClass),
      read: propertyDossierViewIds(tab),
      purposeAuthority: 'entry',
    },
  };
}

/**
 * **Σε ποια καρτέλα του φακέλου φαίνεται αυτό το αρχείο;** (ADR-866 Φ1.3 · §2.11) — ή `null`.
 *
 * 🔑 **Η ΙΔΙΑ απάντηση με τη σελίδα, όχι δεύτερη αντιστοίχιση**: ρωτά τις εμβέλειες ανάγνωσης που **παράγει** το
 * κέλυφος (`mediaTabScopePolicy` → `matchesFileScopes`). Μετρημένο: το τοπογραφικό είναι `admin`/`documents` με
 * `purpose: study-topographic` — ένας κανόνας «κατηγορία `floorplans` ⇒ κάτοψη» θα το έχανε, και ό,τι ο άνθρωπος
 * βλέπει στην καρτέλα «Τοπογραφικό» **δεν** θα δημοσιευόταν ποτέ ως τέτοιο.
 *
 * @param tabs — οι καρτέλες που ρωτά ο καλών, **με σειρά προτεραιότητας** (πρώτη που ταιριάζει).
 */
export function propertyDossierFileTabOf(
  dossier: Pick<PropertyDossier, 'id' | 'label' | 'userId' | 'type'>,
  file: Pick<FileRecord, 'domain' | 'category' | 'purpose'>,
  tabs: readonly PropertyDossierFileTab[],
): PropertyDossierFileTab | null {
  const binding = propertyDossierMediaBinding(dossier);
  const match = tabs.find((tab) => {
    const scopes = mediaTabScopePolicy(binding, propertyDossierMediaTab(tab, dossier.type))?.readScopes;
    return scopes !== undefined && matchesFileScopes(file, scopes);
  });
  return match ?? null;
}
