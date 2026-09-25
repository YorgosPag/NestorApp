/**
 * Storage Rules — Καραντίνα ανεβάσματος πανοράματος (ADR-884 Φ0.8 · Φ0.9)
 *
 * Pattern: server_only_sealed · Path: /tour-ingest/**
 *
 * Τι φυλάει:
 *   Τα bytes του φωτογράφου πριν από τον έλεγχο (τύπος, μέγεθος, αφαίρεση EXIF/GPS, IPTC). Αν χαλαρώσει το `allow write`,
 *   ο πελάτης γράφει κατευθείαν πάνω από τον διακομιστή — καμία καραντίνα· αν χαλαρώσει το `allow read`, μια λήψη
 *   με θέση GPS του σπιτιού διαβάζεται πριν καθαριστεί.
 *
 * Κοινό σώμα: `_harness/sealed-suite.ts`.
 */

import { defineSealedStorageCell, useSealedStorageEmulator } from '../_harness/sealed-suite';
import { STORAGE_RULES_COVERAGE } from '../_registry/coverage-manifest';

export const COVERAGE = STORAGE_RULES_COVERAGE.find((c) => c.pathId === 'tour_ingest')!;

const TEST_PATH = 'tour-ingest/stour_1/tcap_1/original.jpg';

describe('tour-ingest.storage — server_only_sealed pattern', () => {
  const env = useSealedStorageEmulator();
  for (const cell of COVERAGE.matrix) {
    defineSealedStorageCell(env, cell, TEST_PATH);
  }
});
