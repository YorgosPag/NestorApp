/**
 * 🤖 ΠΑΡΑΓΟΜΕΝΟ ΑΡΧΕΙΟ — ΜΗΝ ΤΟ ΕΠΕΞΕΡΓΑΣΤΕΙΣ.
 *
 * Πηγή: `design-tokens.json → spacing.layout.density`
 * Εντολή: `npm run build:tokens`
 *
 * Οι ρόλοι πυκνότητας ζουν **μία** φορά, στο JSON. Αυτό το αρχείο είναι η
 * **προβολή** τους για τον πελάτη — όχι δεύτερη αυθεντία.
 */

/** Ρόλος πυκνότητας διεπαφής. */
export type DensityRole = 'comfortable' | 'compact';

/** Όλοι οι ρόλοι, στη σειρά δήλωσης του JSON (η σειρά ΕΙΝΑΙ το ανθρώπινο νόημα). */
export const DENSITY_ROLES: readonly DensityRole[] = ['comfortable', 'compact'] as const;

/** Ο ουδέτερος πολλαπλασιαστής — ό,τι βλέπει όποιος δεν διάλεξε ποτέ. */
export const DEFAULT_DENSITY: DensityRole = 'comfortable';

/** Το attribute που φοράει το `<html>`. */
export const DENSITY_ATTRIBUTE = 'data-density' as const;

/** Το κλειδί αποθήκευσης στον πελάτη. */
export const DENSITY_STORAGE_KEY = 'appearance-density' as const;
