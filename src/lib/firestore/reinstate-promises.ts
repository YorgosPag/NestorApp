/**
 * **Τι υπόσχεται η οθόνη ότι θα κάνει η επαναφορά** — client-safe (ADR-281 · ADR-329 §3.9).
 *
 * Η συμπεριφορά ζει στον διακομιστή (`LIFECYCLE_EFFECTS[…].reinstatePatch`, `server-only`): ο πελάτης δεν
 * μπορεί να τη διαβάσει, και μια ταινία που την περιέγραφε με δικά της λόγια θα ήταν δεύτερη αλήθεια.
 * Εδώ γράφεται **μία φορά** ως κλειστό σύνολο, και **άγκυρα jest** (`reinstate-promises.test.ts`) εκτελεί
 * το πραγματικό `reinstatePatch` για κάθε απόσυρση: αν η συμπεριφορά αλλάξει και ο πίνακας όχι, κοκκινίζει.
 *
 * Leaf και ουδέτερο, όπως το `trashed-status.ts`: καμία εξάρτηση πέρα από αυτό.
 *
 * @module lib/firestore/reinstate-promises
 */

import type { RetiredKind } from './trashed-status';

/**
 *   `returns-as-it-was`   — η επαναφορά είναι αναίρεση: η εγγραφή γυρίζει όπως ήταν.
 *   `returns-off-market`  — γυρίζει **εκτός αγοράς**· η δημοσίευση είναι ρητή πράξη ανθρώπου.
 */
export type ReinstatePromise = 'returns-as-it-was' | 'returns-off-market';

/** Οι οντότητες για τις οποίες η οθόνη **λέει** τι θα κάνει η επαναφορά. */
export type ReinstatePromiseEntity = 'property';

export const REINSTATE_PROMISES: Readonly<
  Record<ReinstatePromiseEntity, Readonly<Record<RetiredKind, ReinstatePromise>>>
> = {
  property: {
    archived: 'returns-off-market',
    trashed: 'returns-as-it-was',
  },
};

export const reinstatePromiseOf = (entity: ReinstatePromiseEntity, kind: RetiredKind): ReinstatePromise =>
  REINSTATE_PROMISES[entity][kind];
