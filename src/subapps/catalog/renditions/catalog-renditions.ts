/**
 * =============================================================================
 * ΟΙ ΑΠΟΔΟΣΕΙΣ ΕΝΟΣ ΜΕΣΟΥ ΚΑΤΑΛΟΓΟΥ — η καταγεγραμμένη κατάσταση (ADR-923 §5.10.3 · Δ10)
 * =============================================================================
 *
 * Πρότυπο «derivative manifest» (Akeneo transformations · Salsify renditions · Autodesk APS · το `publishRaster` του
 * ADR-922): οι αποδόσεις είναι **παράγωγα** του αρχείου, φτιαγμένα από τον διακομιστή, με **καταγεγραμμένη κατάσταση**
 * στην εγγραφή (`FileRecord.catalogRenditions`) και ντετερμινιστικό όνομα από το μητρώο συνοδευτικών.
 *
 * | χρήση | χρώμα | μέγεθος | γιατί |
 * |---|---|---|---|
 * | `web` | **sRGB** (CMYK/P3 μετατρέπονται με το προφίλ της πηγής) | μέγιστη πλευρά 2048 | βιτρίνα · PDF οθόνης |
 * | `print` | **ο χώρος της πηγής** (CMYK μένει CMYK με το ICC του) | πλήρης ανάλυση | έκδοση: late binding (PDF/X-4) |
 *
 * 🔑 **Έκδοση συνταγής**: αλλαγή συνταγής (ποιότητα, όριο, χρώμα) ⇒ νέα έκδοση ⇒ κάθε παλιά απόδοση είναι **μπαγιάτικη
 *   ΑΠΟΔΕΙΚΤΙΚΑ** και το `ensure` την ξαναφτιάχνει. Καμία «σιωπηλά παλιά» απόδοση.
 * ⚠️ `failed` **μόνο** για τα bytes (μη αποκωδικοποιήσιμα · πάνω από το όριο). Βλάβη υποδομής **δεν** καταγράφεται ποτέ.
 * 🔒 **Την κατάσταση τη γράφει ΜΟΝΟ ο διακομιστής** (`firestore.rules` → `measuredKeys()`).
 *
 * **Layering**: καθαρό — κοινό σε οθόνη (2δ), κρίση σύνδεσης και διακομιστή.
 * @module subapps/catalog/renditions/catalog-renditions
 */

import { canonicalMimeForFilename, specByMime } from '@/config/file-types/classification-registry';
import type { ImageColour } from '@/lib/images/image-colour';
import type { AssetKind } from '../vocabulary/attribute-types';

/**
 * Η τρέχουσα έκδοση της συνταγής (`catalog-asset-renditions.server` · `CATALOG_RENDITION_SPECS`). Κάθε αλλαγή εκεί
 * ανεβάζει τον αριθμό εδώ — η άγκυρα `catalog-asset-renditions.test.ts` κλειδώνει τη συνταγή στην έκδοσή της.
 */
export const CATALOG_RENDITION_RECIPE_VERSION = 2;

export const CATALOG_RENDITION_USES = ['web', 'print'] as const;
export type CatalogRenditionUse = (typeof CATALOG_RENDITION_USES)[number];

/** Γιατί **δεν** βγήκαν αποδόσεις — μόνο αιτίες που ανήκουν στα bytes. */
export const CATALOG_RENDITION_FAILURES = ['undecodable', 'tooLarge'] as const;
export type CatalogRenditionFailure = (typeof CATALOG_RENDITION_FAILURES)[number];

/** Ό,τι **μετρήθηκε** στην έξοδο μιας απόδοσης. */
export interface CatalogRenditionFacts {
  readonly contentType: string;
  readonly width: number;
  readonly height: number;
  readonly sizeBytes: number;
  readonly colour: ImageColour;
  /** Η πηγή δεν είχε προφίλ ⇒ τα χρώματά της ερμηνεύτηκαν με υπόθεση (η έκδοση το λέει στον άνθρωπο). */
  readonly assumedProfile: boolean;
  /** Ο χρωματικός τύπος της πηγής κρατήθηκε (σημαίνει κάτι μόνο στην εκτύπωση). */
  readonly colourPreserved: boolean;
}

/**
 * Η καταγεγραμμένη κατάσταση — πεδίο `catalogRenditions` της εγγραφής αρχείου. 🔑 `sourceGeneration` = η **γενιά** του
 * πρωτοτύπου από την οποία βγήκε η έκβαση: αν κάποιος ξαναγράψει το αντικείμενο (ίδιο όνομα, νέα bytes), η έκβαση
 * **αποδεικτικά** δεν το περιγράφει πια και ο γραφέας την ξαναφτιάχνει (πέρα από Akeneo/Salsify, που κρίνουν μόνο ανά όνομα).
 */
export type CatalogRenditions =
  | {
      readonly status: 'ready';
      readonly recipe: number;
      readonly sourceGeneration: string;
      readonly renderedAt: string;
      readonly web: CatalogRenditionFacts;
      readonly print: CatalogRenditionFacts;
    }
  | {
      readonly status: 'failed';
      readonly recipe: number;
      readonly sourceGeneration: string;
      readonly failure: CatalogRenditionFailure;
      readonly failedAt: string;
    };

/** Η κατάσταση **ως προς την τρέχουσα συνταγή** — `stale` = καμία, ή παλιότερης συνταγής ⇒ το `ensure` την ξαναφτιάχνει. */
export type CatalogRenditionsStanding = 'ready' | 'failed' | 'stale';

export function catalogRenditionsStanding(value: CatalogRenditions | undefined): CatalogRenditionsStanding {
  if (value === undefined || value.recipe !== CATALOG_RENDITION_RECIPE_VERSION) return 'stale';
  return value.status;
}

/** Ό,τι χρειάζεται η κρίση από ένα αρχείο — δομικό. */
export interface RenditionCandidate {
  readonly ext?: string;
  readonly contentType?: string;
}

/**
 * **Χρειάζεται αποδόσεις αυτό το αρχείο αυτού του είδους;** — κάθε εικόνα **εκτός SVG** (διανυσματικό: η ραστεροποίηση
 * ξένου SVG στον διακομιστή είναι επιφάνεια επίθεσης, ADR-899). 🔑 Όχι «μόνο ό,τι ξέρουμε να αποκωδικοποιούμε»: μια
 * φωτογραφία καταλόγου **πρέπει** να αποδίδεται — ένα HEIC που το `sharp` δεν διαβάζει παίρνει `failed: undecodable`
 * και η σύνδεση αρνείται με ονομασμένη αιτία, αντί να περάσει σιωπηλά χωρίς αποδόσεις. Το MIME από την κατάληξη (το
 * μητρώο τύπων)· η δήλωση του browser μόνο όταν η κατάληξη δεν λέει τίποτα.
 */
export function needsCatalogRenditions(kind: AssetKind, file: RenditionCandidate): boolean {
  if (kind !== 'image') return false;
  const byExt = file.ext ? canonicalMimeForFilename(`file.${file.ext}`, '') : '';
  const mime = (byExt !== '' ? byExt : (file.contentType ?? '')).split(';')[0].trim().toLowerCase();
  return specByMime(mime)?.id !== 'svg';
}
