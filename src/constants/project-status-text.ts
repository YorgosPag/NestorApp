/**
 * =============================================================================
 * ΤΟ ΛΕΞΙΛΟΓΙΟ ΚΑΤΑΣΤΑΣΗΣ ΕΡΓΟΥ ΣΕ ΚΕΙΜΕΝΟ — ΧΩΡΙΣ i18next RUNTIME
 * =============================================================================
 *
 * 🔴 ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ (ADR-812): τρεις επιφάνειες γράφουν κείμενο έξω από
 * τον React κύκλο — PDF showcase, απαντήσεις Telegram/email του AI pipeline,
 * κοινοποίηση — και **καμία τους δεν έχει `useTranslation`**. Καθεμιά είχε
 * λύσει το ίδιο πρόβλημα μόνη της:
 *
 *   · `services/project-showcase/labels.ts`  — δικός του πίνακας el+en, ΣΚΛΗΡΟ
 *     κείμενο, με σχόλιο «no separate constants file exists for these enum
 *     labels» (ήταν ήδη ψευδές όταν γράφτηκε).
 *   · `ai-pipeline/.../project-status-types.ts` — δικός του πίνακας, ΣΚΛΗΡΑ
 *     ελληνικά, ΜΟΝΟΓΛΩΣΣΟΣ: αγγλόφωνος χρήστης έπαιρνε ελληνικά στο Telegram.
 *   · `lib/sharing/format-project-share.ts` — κλειδιά σε ΑΛΛΗ ορθογραφία.
 *
 * Πέντε πίνακες, τέσσερα αρχεία, ένα λεξιλόγιο. Η προσθήκη μιας κατάστασης
 * απαιτούσε **τέσσερις** συντονισμένες αλλαγές — και το ιστορικό δείχνει ότι
 * αυτό αποτυγχάνει: όσο έλειπε η γραμμή για τον κάδο, το κοινοποιημένο κείμενο
 * παρουσίαζε **διαγραμμένο** έργο ως «Ακυρωμένο».
 *
 * 🏆 Η ΑΡΧΗ: **ένα λεξιλόγιο, ένα σύνολο κλειδιών, πολλοί μηχανισμοί λύσης.**
 * Ο React καταναλωτής λύνει με `t()`· ο server με αυτό. Η ΠΗΓΗ είναι η ίδια —
 * το `PROJECT_STATUS_LABELS` — και τα ίδια αρχεία locale. Καμία επιφάνεια δεν
 * γράφει ξανά ούτε τιμή, ούτε κλειδί, ούτε κείμενο.
 *
 * ⚠️ ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΜΕΣΑ ΣΤΟ `project-statuses.ts`: εκείνο
 * είναι **leaf** και το δηλώνει («καμία εξάρτηση, ασφαλές για import παντού»).
 * Ένα `import … from 'locales/el/projects.json'` εκεί θα έβαζε **δύο locale
 * αρχεία στο bundle κάθε καταναλωτή** του λεξιλογίου — δεκάδες components που
 * θέλουν μόνο τις έξι τιμές. Ο διαχωρισμός είναι μέτρηση, όχι αισθητική.
 *
 * ⚠️ Ο ΤΥΠΟΣ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ: `Record<ProjectStatus, string>` σημαίνει ότι μια
 * έβδομη κατάσταση σπάει τη μεταγλώττιση εδώ, αντί να βγει ωμό κλειδί σε PDF
 * πελάτη ή σε απάντηση Telegram.
 *
 * ⚠️ ΜΗΝ γράψεις εδώ σκληρό κείμενο. Οι τιμές έρχονται από τα locale JSON —
 * ό,τι λείπει από εκεί πρέπει να προστεθεί ΕΚΕΙ (N.11).
 *
 * @module constants/project-status-text
 * @enterprise ADR-812 — Ένα λεξιλόγιο κατάστασης έργου, ένα σπίτι
 */

import elProjects from '@/i18n/locales/el/projects.json';
import enProjects from '@/i18n/locales/en/projects.json';
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus } from './project-statuses';
import { splitNamespacedLabelKey } from '@/core/badges/badge-label-key';

/** Οι γλώσσες που σερβίρει η εφαρμογή σε επιφάνειες εκτός React. */
export type ProjectStatusLocale = 'el' | 'en';

const NAMESPACES: Record<ProjectStatusLocale, Record<string, unknown>> = {
  el: elProjects as Record<string, unknown>,
  en: enProjects as Record<string, unknown>,
};

/** `'status.planning'` → η τιμή του, ή `undefined` αν λείπει κρίκος. */
function readPath(source: Record<string, unknown>, path: string): string | undefined {
  let node: unknown = source;
  for (const segment of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Το κείμενο μιας κατάστασης στη ζητούμενη γλώσσα.
 *
 * ⚠️ Πέφτει πίσω στο **αναγνωριστικό** (`'in_progress'`), ποτέ σε άλλη γλώσσα
 * και ποτέ σε ωμό κλειδί: μια χαμένη μετάφραση πρέπει να φαίνεται σαν χαμένη
 * μετάφραση, όχι σαν σωστό κείμενο σε λάθος γλώσσα.
 */
export function projectStatusText(status: ProjectStatus, locale: ProjectStatusLocale): string {
  const parsed = splitNamespacedLabelKey(PROJECT_STATUS_LABELS[status]);
  if (!parsed) return status;
  const source = NAMESPACES[locale];
  return (source ? readPath(source, parsed.key) : undefined) ?? status;
}

/**
 * Ολόκληρος ο πίνακας για μια γλώσσα — για καταναλωτές που θέλουν χάρτη αντί
 * για κλήση ανά τιμή (π.χ. `createEnumLabelTranslator` του showcase).
 */
export function projectStatusTexts(locale: ProjectStatusLocale): Record<ProjectStatus, string> {
  return Object.fromEntries(
    PROJECT_STATUSES.map(status => [status, projectStatusText(status, locale)]),
  ) as Record<ProjectStatus, string>;
}
