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
import { PUBLIC_LAUNCH_ENV, readPublicLaunch } from './public-launch';

import type { EnvironmentRequirement } from '@/config/environment-contract';
import type { OperatorRecord } from '@/constants/platform-operator';

import { describeReadiness, judgeLaunchReadiness } from '@/lib/platform-operator/operator-readiness';
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

/**
 * 🔴 **ΠΟΤΕ ΔΗΜΟΣΙΟ ΑΝΟΙΓΜΑ ΜΕ ΑΓΡΑΦΗ ΤΑΜΠΕΛΑ** (ADR-861 Φ1 — απόφαση Giorgio 2026-09-15).
 *
 * - σημαία **αθέτη** ⇒ η εφαρμογή ξεκινά όπως σήμερα· μία γραμμή λέει την κατάσταση του φορέα·
 * - σημαία **δηλωμένη** και φορέας `ready` ⇒ ξεκινά·
 * - σημαία **δηλωμένη** και φορέας `pending`/`incomplete` ⇒ **ΠΕΤΑ**, με τα ελαττώματα ονομασμένα·
 * - σημαία με **άγνωστη** τιμή ⇒ **ΠΕΤΑ** (δεν μαντεύεται προς καμία κατεύθυνση).
 *
 * ⚠️ **Γιατί στο boot και όχι σε πύλη pre-commit**: η σημαία ζει στο περιβάλλον παραγωγής
 * (Coolify), **έξω από το git** — καμία πύλη commit δεν τη βλέπει. Ο μόνος τόπος όπου σημαία
 * και φορέας συναντιούνται είναι η εκκίνηση. Η εγκυρότητα του ιστορικού φυλάγεται **επιπλέον**
 * από άγκυρες jest (`operator-readiness.test.ts` · CHECK 3.54), πριν φτάσει ποτέ εδώ.
 */
export function assertPublicLaunch(
  env: EnvironmentSource,
  now: Date = new Date(),
  history?: readonly OperatorRecord[],
): void {
  const declaration = readPublicLaunch(env);
  if (declaration === 'unrecognized') {
    logger.error('Άγνωστη τιμή σημαίας δημόσιου ανοίγματος', { data: { name: PUBLIC_LAUNCH_ENV } });
    throw new Error(`Unrecognized value for ${PUBLIC_LAUNCH_ENV} — accepted: 1, true, 0, false.`);
  }

  const readiness = judgeLaunchReadiness(now, history);
  if (declaration === 'not-declared') {
    logger.info('Η εφαρμογή δεν έχει δηλωθεί ανοιχτή στο κοινό', { data: { operator: readiness.status } });
    return;
  }
  if (readiness.status === 'ready') {
    logger.info('Δημόσιο άνοιγμα — ο φορέας είναι δηλωμένος και πλήρης', {
      data: { effectiveFrom: readiness.record.effectiveFrom },
    });
    return;
  }

  const details = describeReadiness(readiness);
  logger.error('Άρνηση δημόσιου ανοίγματος — τα στοιχεία του φορέα δεν είναι πλήρη', {
    data: { operator: readiness.status, details },
  });
  throw new Error(
    `${PUBLIC_LAUNCH_ENV} is declared, but the platform operator is "${readiness.status}": ` +
      `${details.join(' · ')}. See src/constants/platform-operator.ts.`,
  );
}
