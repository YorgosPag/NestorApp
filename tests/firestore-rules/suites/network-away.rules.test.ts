/**
 * Firestore Rules — συλλογή `network_away` (ADR-867 §4.4, Β5)
 *
 * Πρότυπο: κλειστό **και στις δύο πλευρές**, για **καθέναν** — `networkServerOnlyMatrix`.
 *
 * 🔑 Η απουσία είναι **ημερολόγιο ανθρώπων**. Ο αντισυμβαλλόμενος χρειάζεται **μία** πρόταση
 * («ο Κώστας απουσιάζει ως 24/9 — διαβάζει η Ελένη»), και τη σερβίρει ο **διακομιστής** μόνο
 * σε όποιον διαβάζει **το ίδιο** νήμα. Μια ανάγνωση πελάτη εδώ θα έκανε το ημερολόγιο απουσιών
 * ενός γραφείου απαριθμήσιμο — ούτε ο συνάδελφος δεν το διαβάζει κατευθείαν.
 *
 * @since 2026-09-18 (ADR-867 Β5)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'network_away')!;

describe('network_away.rules — το ημερολόγιο απουσιών ΔΕΝ διαβάζεται από κανέναν πελάτη (ADR-867 §4.4)', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
