/**
 * Ελάχιστο fake Firestore για τα custody/sweeper tests (ADR-694).
 *
 * Ίδιο μοτίβο με το `shared/__tests__/file-ownership-resolver.test.ts`: μηδέν emulator,
 * μηδέν Admin SDK — το `resolveCustody` δέχεται το `db` injected, οπότε ελέγχεται
 * ντετερμινιστικά και σε χιλιοστά του δευτερολέπτου.
 *
 * Δεν είναι test αρχείο (δεν ταιριάζει με το `*.test.ts` pattern) — είναι κοινό fixture.
 */

import type * as admin from 'firebase-admin';

export interface CustodyFixtureOptions {
  /** `${collection}/${docId}` → υπάρχει. */
  readonly docs?: Readonly<Record<string, boolean>>;
  /** `${collection}:${field}=${value}` → το doc id που ταιριάζει (ή απόν = κανένα). */
  readonly query?: Readonly<Record<string, string>>;
  /** Κάθε ανάγνωση πετά — προσομοιώνει αστοχία δικτύου/δικαιωμάτων. */
  readonly throwOnGet?: boolean;
}

/**
 * Φτιάχνει fake `Firestore` που εξυπηρετεί και `doc().get()` και `where().limit().get()`.
 * Το cast είναι σκόπιμο και περιορισμένο: υλοποιεί ακριβώς την επιφάνεια που αγγίζει ο
 * κώδικας υπό δοκιμή, όχι ολόκληρο το Firestore API.
 */
export function candidateKeyFixtures(opts: CustodyFixtureOptions): admin.firestore.Firestore {
  const fake = {
    collection(collection: string) {
      return {
        doc(docId: string) {
          return {
            async get() {
              if (opts.throwOnGet) throw new Error('simulated firestore failure');
              return { id: docId, exists: Boolean(opts.docs?.[`${collection}/${docId}`]) };
            },
          };
        },
        where(field: string, _op: string, value: string) {
          return {
            limit() {
              return {
                async get() {
                  if (opts.throwOnGet) throw new Error('simulated firestore failure');
                  const hit = opts.query?.[`${collection}:${field}=${value}`];
                  return {
                    empty: hit === undefined,
                    docs: hit === undefined ? [] : [{ id: hit }],
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return fake as unknown as admin.firestore.Firestore;
}
