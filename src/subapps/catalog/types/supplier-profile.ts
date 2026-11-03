/**
 * =============================================================================
 * ΤΟ ΠΡΟΦΙΛ ΤΟΥ ΠΑΡΟΧΟΥ — περιγραφή και portfolio (ADR-923 §22 Υ8)
 * =============================================================================
 *
 * Ένα έγγραφο ανά χώρο (`catalog_supplier_profiles`). Είναι ιδιότητες του παρόχου, όχι του SKU, και κανένας νέος τύπος χώρου (§5.1).
 * Λογότυπο, ιστοσελίδα και περιοχή **δεν** ζουν εδώ: τα κρατά το `agency_profiles`, και δεύτερη δήλωση θα ήταν δεύτερη αλήθεια.
 *
 * 🔑 Οι εικόνες είναι **μέσα της βιβλιοθήκης** (`assetIds`), άρα κουβαλούν δικαιώματα, αποδόσεις και το ίδιο δημόσιο ράφι.
 * 🔒 Το έργο **δεν έχει τόπο ή πελάτη**. Τόπος έργου σημαίνει σπίτι τρίτου σε σελίδα ανοιχτή στις μηχανές.
 *
 * @module subapps/catalog/types/supplier-profile
 */

import type { LocalizedText } from '@/i18n/localized-text';

export const MAX_PORTFOLIO_PROJECTS = 24;
export const MAX_PORTFOLIO_PROJECT_IMAGES = 12;
export const MIN_PORTFOLIO_YEAR = 1900;
export const MAX_PORTFOLIO_YEAR = 2100;
/** Τόσο χωρά η περιγραφή σε κάθε γλώσσα, στην οθόνη και στο δημόσιο έγγραφο. */
export const MAX_PROFILE_TEXT_LENGTH = 2000;

export interface CatalogPortfolioProject {
  readonly id: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly year: number | null;
  /** Η πρώτη είναι το εξώφυλλο. */
  readonly assetIds: readonly string[];
}

export interface CatalogSupplierProfileDefinition {
  readonly description: LocalizedText;
  readonly projects: readonly CatalogPortfolioProject[];
}

export const EMPTY_SUPPLIER_PROFILE: CatalogSupplierProfileDefinition = { description: {}, projects: [] };

/** RFC 5321: το μέγιστο μήκος διεύθυνσης που περνά από SMTP. */
export const MAX_QUOTE_RECIPIENT_EMAIL_LENGTH = 254;

/**
 * **Αιτήματα προσφοράς από τη βιτρίνα** (ADR-923 §5.13 Ε6β): opt-in του προμηθευτή.
 * 🔒 Το email **δεν** φεύγει ποτέ στο δημόσιο έγγραφο: εκεί πάει μόνο το «δέχεται». Λύνεται τη στιγμή της αποστολής (Ε6δ).
 */
export interface CatalogQuoteIntake {
  readonly enabled: boolean;
  readonly recipientEmail: string | null;
}

export const QUOTE_INTAKE_OFF: CatalogQuoteIntake = { enabled: false, recipientEmail: null };

/**
 * Το έγγραφο όπως αποθηκεύεται. Δύο πράξεις, ένα CAS: το προφίλ γράφει περιγραφή και έργα, η ρύθμιση γράφει το `quoteIntake`,
 * και καθεμία κρατά το κομμάτι της άλλης. Έγγραφα παλιότερα από το Ε6β δεν έχουν `quoteIntake` και διαβάζονται ως «όχι».
 */
export interface CatalogSupplierProfileStored extends CatalogSupplierProfileDefinition {
  readonly quoteIntake?: CatalogQuoteIntake;
}
