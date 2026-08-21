/**
 * @fileoverview **Η ΕΠΙΒΟΛΗ ΣΤΟ BOOT** — ό,τι λείπει, ονομάζεται **πριν** το δει πελάτης.
 * @related ADR-777 §8.35 · `config/environment-contract.ts` · `instrumentation.ts`
 * @module lib/environment/environment-startup
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΗΝ ΚΡΙΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `environment-audit.ts` **απαντά** («τι λείπει;») και είναι καθαρό — δοκιμάσιμο
 * χωρίς τίποτα. Αυτό εδώ **αντιδρά** (πετά · γράφει στο ημερολόγιο) και έχει
 * παρενέργειες εξ ορισμού. Δύο ευθύνες, δύο αρχεία: αλλιώς κάθε test της κρίσης θα
 * έπρεπε να ανέχεται ημερολόγιο, και κάθε αλλαγή στη διατύπωση θα ακουμπούσε τη
 * μηχανή που κρίνει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ **ΕΝΑ** ΜΗΝΥΜΑ ΚΑΙ ΟΧΙ ΕΝΑ ΑΝΑ ΡΥΘΜΙΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τρία ξεχωριστά `logger.error` στο boot διαβάζονται ως **τρία περιστατικά** και
 * χάνονται μέσα στον υπόλοιπο θόρυβο εκκίνησης. Ένα μήνυμα που λέει «**2 από 3
 * δυνατότητες είναι εκτός λειτουργίας, να ποιες**» είναι **γεγονός**, και έχει τον
 * παρονομαστή μέσα του: το «2» χωρίς το «από 3» δεν λέει αν κοίταξε κανείς.
 *
 * ⚠️ **Καμία τιμή δεν φτάνει ποτέ στο ημερολόγιο** — μόνο ονόματα και συνέπειες. Το
 * ημερολόγιο ταξιδεύει στο Sentry· ένα μυστικό εκεί μέσα είναι διαρροή, όχι διάγνωση.
 *
 * **Layering**: server startup — καταναλώνει την κρίση και την τηλεμετρία.
 */

import { auditEnvironment, describeMissing, type EnvironmentSource } from './environment-audit';

import type { EnvironmentRequirement } from '@/config/environment-contract';

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('environment-contract');

/**
 * Επαληθεύει το συμβόλαιο και **αντιδρά ανάλογα με τη βαθμίδα**.
 *
 * - `fatal` λείπει ⇒ **πετά**. Η εφαρμογή δεν ξεκινά, και ο λόγος είναι στο μήνυμα.
 * - `feature` λείπει ⇒ **δεν** πετά, αλλά ονομάζει δυνατά τη **συνέπεια για τον άνθρωπο**.
 * - τίποτα δεν λείπει ⇒ **μία γραμμή επιβεβαίωσης με τον παρονομαστή**.
 *
 * ⚠️ **Η τελευταία περίπτωση δεν είναι φλυαρία.** Σιωπή στο boot είναι διφορούμενη:
 * σημαίνει «όλα ρυθμισμένα» **ή** «ο έλεγχος δεν έτρεξε ποτέ» — και οι δύο μοιάζουν
 * ακριβώς ίδιες σε ένα αρχείο καταγραφής. Μια γραμμή «**3 από 3 ρυθμισμένες**» κάνει
 * την απουσία του ελέγχου **ορατή**, που είναι όλο το νόημα αυτής της δουλειάς.
 */
export function assertEnvironmentContract(
  env: EnvironmentSource,
  contract?: readonly EnvironmentRequirement[],
): void {
  const audit = contract ? auditEnvironment(env, contract) : auditEnvironment(env);

  if (audit.missingFeature.length > 0) {
    logger.error('Δυνατότητες εκτός λειτουργίας — λείπει ρύθμιση', {
      data: {
        missing: audit.missingFeature.length,
        declared: audit.declared,
        details: describeMissing(audit.missingFeature),
      },
    });
  }

  if (audit.missingFatal.length > 0) {
    const names = audit.missingFatal.map((r) => r.name).join(', ');
    logger.error('Η εφαρμογή δεν μπορεί να ξεκινήσει — λείπει κρίσιμη ρύθμιση', {
      data: { missing: names, details: describeMissing(audit.missingFatal) },
    });
    throw new Error(
      `Λείπουν κρίσιμες ρυθμίσεις περιβάλλοντος: ${names}. ` +
        'Δες src/config/environment-contract.ts για το τι σπάει χωρίς αυτές.',
    );
  }

  if (audit.missingFeature.length === 0) {
    logger.info('Συμβόλαιο περιβάλλοντος πλήρες', {
      data: { configured: audit.configured, declared: audit.declared },
    });
  }
}
