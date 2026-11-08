/**
 * =============================================================================
 * ΔΗΜΟΣΙΕΥΜΕΝΗ ΕΚΔΟΣΗ ΚΑΤΑΛΟΓΟΥ — το έντυπο που διαβάζει ένα κοινό (ADR-923 §5.15)
 * =============================================================================
 *
 * Η **έκδοση του εκδότη** (`PublicationRun`) είναι αρχείο που ανήκει στον προμηθευτή. Η **δημοσιευμένη έκδοση** είναι η ρητή
 * πράξη του «αυτό το αρχείο το διαβάζει αυτό το κοινό». Χωριστή οντότητα, γιατί έχει δικό της κύκλο ζωής (δημοσίευση →
 * αντικατάσταση / απόσυρση) και δικό της ιστορικό, ενώ το αρχείο δεν αλλάζει ποτέ (ADR-861).
 *
 * 🔑 **Αμετάβλητο αρχείο (Η1)**: το `file` αντιγράφεται από το artifact τη στιγμή της δημοσίευσης, με το sha256 του. Νέα έκδοση
 *    ⇒ νέα εγγραφή, ποτέ αλλαγή αρχείου σε υπάρχουσα.
 * 🔑 **Ράφι (`shelfKey`)**: η σειρά στην οποία ανήκει η έκδοση (για έκδοση του εκδότη, η συνταγή). Μία **ισχύουσα** έκδοση ανά
 *    (ράφι, κοινό)· η νεότερη αντικαθιστά την προηγούμενη, που μένει ορατή ως «αντικαταστάθηκε από…».
 * 🔒 **Θ4**: στην πρώτη φάση δημοσιεύονται μόνο εκδόσεις **χωρίς τιμές**. Το κοινό εδώ λέει **ποιος βλέπει το έντυπο**, όχι ποια
 *    τιμή τυπώθηκε μέσα του.
 *
 * @module subapps/catalog/types/catalog-edition
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { LocalizedText } from '@/i18n/localized-text';
import type { AudienceKind } from '../vocabulary/pricing';
import type { PriceAudience } from './price-list';

export const CATALOG_EDITION_STATUSES = ['published', 'superseded', 'withdrawn'] as const;
export type CatalogEditionStatus = (typeof CATALOG_EDITION_STATUSES)[number];

/** Τα είδη κοινού που δέχεται έντυπο στην πρώτη φάση (§5.15)· το `signedIn` / `partner` των τιμών μένουν έξω. */
export const CATALOG_EDITION_AUDIENCE_KINDS = ['anonymous', 'customerGroup'] as const satisfies readonly AudienceKind[];

/** Ποιος διαβάζει το έντυπο: **υποσύνολο** του `PriceAudience`, δεμένο στη ρίζα του (CHECK 3.73), όχι δεύτερο λεξιλόγιο. */
export type CatalogEditionAudience = Extract<PriceAudience, { readonly kind: (typeof CATALOG_EDITION_AUDIENCE_KINDS)[number] }>;

/**
 * Από πού ήρθε το αρχείο. Στη Θ.1 μόνο η έκδοση του εκδότη (`screen`)· το ανέβασμα δικού του PDF (Θ1) προστίθεται στη Θ.5 ως
 * νέος κλάδος, ώστε κάθε `switch` να το απαιτήσει.
 */
export type CatalogEditionSource = { readonly kind: 'publication'; readonly runId: string; readonly profile: 'screen' };

/** Το αμετάβλητο αρχείο, όπως ήταν τη στιγμή της δημοσίευσης. */
export interface CatalogEditionFile {
  readonly storagePath: string;
  readonly sizeBytes: number;
  readonly pageCount: number;
  readonly sha256: string;
}

export interface CatalogEditionDefinition {
  readonly shelfKey: string;
  readonly title: LocalizedText;
  readonly language: HumanLanguage;
  readonly audience: CatalogEditionAudience;
  readonly source: CatalogEditionSource;
  readonly file: CatalogEditionFile;
  readonly status: CatalogEditionStatus;
  readonly publishedAt: string;
  readonly publishedBy: string;
  /** Πότε έπαψε να ισχύει (αντικατάσταση ή απόσυρση)· `null` όσο ισχύει. */
  readonly endedAt: string | null;
  readonly endedBy: string | null;
  /** Η έκδοση που την αντικατέστησε, μόνο όταν `status === 'superseded'`. */
  readonly supersededBy: string | null;
}

/**
 * Η έκδοση όπως τη βλέπει **ο ιδιοκτήτης** (η οθόνη «Δημοσιευμένοι κατάλογοι»): όλος ο κύκλος ζωής και το κοινό, **χωρίς**
 * τη διαδρομή αποθήκευσης — το αρχείο φτάνει στον φυλλομετρητή μόνο με υπογεγραμμένη άδεια (Η4).
 */
export type CatalogEditionOwnerView = Omit<CatalogEditionDefinition, 'file'> & {
  readonly id: string;
  readonly file: Omit<CatalogEditionFile, 'storagePath'>;
};

/**
 * Η έκδοση όπως τη βλέπει **ο θεατής**: χωρίς διαδρομή αποθήκευσης, χωρίς κοινό, χωρίς ταυτότητες προσώπων.
 * 🔑 Το `current` το αποφασίζει **ο διακομιστής** με τον ένα κριτή (`latestVisibleEdition`), γιατί ο θεατής δεν ξέρει το κοινό
 *    και δεν μπορεί να το κρίνει μόνος του (ADR-923 §5.15.3).
 */
export interface CatalogEditionView {
  readonly id: string;
  /** Το ράφι (σειρά) της έκδοσης — αδιαφανές id, στόχος του σταθερού συνδέσμου ραφιού. */
  readonly shelfKey: string;
  /** Είναι το ισχύον έντυπο του ραφιού **γι' αυτόν τον θεατή**. */
  readonly current: boolean;
  readonly title: LocalizedText;
  readonly language: HumanLanguage;
  readonly pageCount: number;
  readonly sizeBytes: number;
  readonly publishedAt: string;
  readonly status: Exclude<CatalogEditionStatus, 'withdrawn'>;
  readonly supersededBy: string | null;
}
