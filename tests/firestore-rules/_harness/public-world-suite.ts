/**
 * Firestore Rules Test Harness — `public_world` suite building blocks (ADR-777 επίπεδο Α)
 *
 * Το πρότυπο `public_world` (`allow read: if true` · `allow write: if false`) έχει **ένα** σώμα
 * τεστ: σπορά του εγγράφου, πλαίσιο persona, `assertCell`. Γραμμένο inline ήταν ήδη δίδυμο σε
 * `public_lands` + `public_buildings`, και η τρίτη συλλογή (`public_units`, ADR-900 §8 #2) θα το
 * έκανε τρίδυμο (ADR-584, CHECK 3.28). Ίδια λύση με το `deny-all-suite.ts`: το σώμα ζει **εδώ**,
 * ο βρόχος `for (const cell of COVERAGE.matrix)` και το `COVERAGE` μένουν στη σουίτα (CHECK 3.16,
 * ADR-298 §3.4 — το συμβόλαιο που κρατά μητρώο και εκτελεσμένα κελιά συγχρονισμένα).
 *
 * ⚠️ **ΚΑΝΕΝΑ `listFilter`**: δεν υπάρχει `companyId` να φιλτράρει. Η αφιλτράριστη λίστα είναι
 * εδώ **νόμιμη** — και είναι ακριβώς αυτό που πρέπει να αποδειχθεί ότι επιτρέπεται.
 *
 * @module tests/firestore-rules/_harness/public-world-suite
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import type { CoverageCell } from '../_registry/coverage-manifest';
import { getContext } from './auth-contexts';
import { assertCell } from './assertions';
import type { EnvAccessor } from './deny-all-suite';

export interface PublicWorldFixture {
  readonly collection: string;
  readonly docId: string;
  /** Σπέρνει το έγγραφο (και ό,τι χρειάζεται για να είναι ρεαλιστικό — π.χ. τη γη του κτιρίου). */
  readonly seed: (env: RulesTestEnvironment) => Promise<void>;
  /** Payload ενημέρωσης — αδιάφορο (ο κανόνας είναι `if false`), αλλά μη κενό. */
  readonly data: Record<string, unknown>;
  /** Πλήρες σχήμα δημιουργίας — το ίδιο που γράφει ο διακομιστής. */
  readonly createData: Record<string, unknown>;
}

/** Το `describe`/`it` ενός κελιού της μήτρας `public_world`. */
export function definePublicWorldCell(env: EnvAccessor, cell: CoverageCell, fixture: PublicWorldFixture): void {
  describe(`${cell.persona} × ${cell.operation}`, () => {
    it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
      await fixture.seed(env());
      await assertCell(getContext(env(), cell.persona), cell, {
        collection: fixture.collection,
        docId: fixture.docId,
        data: fixture.data,
        createData: fixture.createData,
      });
    });
  });
}
