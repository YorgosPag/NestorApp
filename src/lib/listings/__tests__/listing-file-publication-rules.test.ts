/**
 * @fileoverview **Κώδικας και κανόνας παγώνουν τα ΙΔΙΑ πεδία δημοσίευσης** — ADR-845 §7.17 (κλάση Ο-35, Α4α).
 *
 * Οι Α1–Α3 έκαναν κάθε πόρτα **διακομιστή** να ξαναπροβάλλει, και η Α6 (CHECK 3.76) φυλά την επόμενη.
 * Ο **browser** δεν είναι στο μητρώο — δεν έχει πώς να ξαναπροβάλει. Τον κλείνουν οι κανόνες, και
 * αυτή η άγκυρα φυλά ότι η λίστα των κανόνων **είναι** το `LISTING_FILE_PUBLICATION_FIELDS`: νέο πεδίο
 * που αρχίζει να ρωτά το κατηγόρημα χωρίς γραμμή στον κανόνα θα ήταν πόρτα ανοιχτή από την κονσόλα.
 *
 * | Άγκυρα | Μετάλλαξη που πιάνει |
 * |---|---|
 * | Κ1 `publicationPredicateKeys()` === σταθερά κώδικα | κλειδί που λείπει ή περισσεύει στον κανόνα |
 * | Κ2 η θεματοφυλακή ⊂ κατηγορήματος | πεδίο που παγώνει «παντού» χωρίς να το ρωτά κανείς |
 * | Κ3 κάθε `allow update` της `files` φέρει φρουρό δημοσίευσης | σκέλος χωρίς φρουρό |
 * | Κ4 γέννηση χωρίς διαβάθμιση · το LINK παγώνει ΟΛΟ το κατηγόρημα + `purpose` | «δημόσιο από κούνια» · χαλάρωση του LINK |
 * | Κ5 (Α4β) ακριβώς δύο `allow update`, κανένα δεν θέτει `isDeleted` | επανεισαγωγή σκέλους κάδου/επαναφοράς |
 *
 * ℹ️ Το **αν ο κανόνας αρνείται πράγματι** το εκτελεί η σουίτα emulator
 * (`tests/firestore-rules/suites/files.rules.test.ts`, «publication freeze»). Εδώ φυλάσσεται η **ισότητα των λιστών**.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { LISTING_FILE_PUBLICATION_FIELDS } from '../listing-file-publication-fields';

/* eslint-disable @typescript-eslint/no-require-imports */
const { rulesKeyListOf } = require('../../../../scripts/_shared/firestore-rules-parser.js') as {
  rulesKeyListOf: (rulesText: string, functionName: string) => string[];
};
/* eslint-enable @typescript-eslint/no-require-imports */

const RULES = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');

/** Το σώμα του `match /files/{fileId}` — ΜΕΧΡΙ το επόμενο καθολικό σχόλιο-ενότητα. */
const FILES_BLOCK = RULES.split('match /files/{fileId} {')[1]?.split('\n    // ====')[0] ?? '';

/** Τα σκέλη ενός ρήματος, καθένα ως το κείμενό του μέχρι το επόμενο `allow`. */
const legsOf = (verb: string): readonly string[] =>
  FILES_BLOCK.split('allow ').filter((leg) => leg.startsWith(`${verb}:`));

const CUSTODY_GUARD = '&& publicationCustodyUnchanged()';
const PREDICATE_GUARD = '&& publicationPredicateUnchanged()';

describe('🏆 Α4α — κώδικας και κανόνας παγώνουν τα ΙΔΙΑ πεδία δημοσίευσης (ADR-845 §7.17)', () => {
  const predicateKeys = rulesKeyListOf(RULES, 'publicationPredicateKeys');
  const custodyKeys = rulesKeyListOf(RULES, 'publicationCustodyKeys');

  it('🔴 Κ1 `publicationPredicateKeys()` === `LISTING_FILE_PUBLICATION_FIELDS` (ούτε λιγότερα ούτε περισσότερα)', () => {
    expect(predicateKeys.length).toBeGreaterThan(0);
    expect([...predicateKeys].sort()).toEqual([...LISTING_FILE_PUBLICATION_FIELDS].sort());
  });

  it('🔴 Κ2 η θεματοφυλακή είναι υποσύνολο του κατηγορήματος — και ακριβώς τα δύο πεδία που γράφει ΜΟΝΟ πράξη', () => {
    expect([...custodyKeys].sort()).toEqual(['classification', 'publicationIdentity']);
    for (const key of custodyKeys) expect(predicateKeys).toContain(key);
  });

  it('🔴 Κ3 κάθε `allow update` της `files` φέρει φρουρό δημοσίευσης', () => {
    const updates = legsOf('update');
    expect(updates.length).toBeGreaterThan(0);
    for (const leg of updates) {
      expect(leg.includes(CUSTODY_GUARD) || leg.includes(PREDICATE_GUARD)).toBe(true);
    }
  });

  it('🔴 Κ4 γέννηση χωρίς διαβάθμιση · το σκέλος LINK παγώνει ΟΛΟ το κατηγόρημα και το `purpose`', () => {
    const [create, ...otherCreates] = legsOf('create');
    expect(otherCreates).toHaveLength(0);
    expect(create).toContain('&& publicationBornAbsent()');

    const linkLegs = legsOf('update').filter((leg) => leg.includes(PREDICATE_GUARD));
    expect(linkLegs).toHaveLength(1);
    expect(linkLegs[0]).toMatch(/affectedKeys\(\)\.hasAny\(\['purpose'\]\)/);
  });

  it('🔴 Κ5 ο κάδος ΔΕΝ είναι πράξη πελάτη: ακριβώς δύο `allow update`, κανένα δεν ζητά τιμή `isDeleted`', () => {
    const updates = legsOf('update');
    // Οριστικοποίηση (pending → ready) + σύνδεση. Τρίτο σκέλος = νέα πόρτα προς ό,τι βλέπει το κοινό.
    expect(updates).toHaveLength(2);
    // Το σχήμα και των δύο σκελών που αφαιρέθηκαν: «η αίτηση θέτει `isDeleted` σε συγκεκριμένη τιμή».
    for (const leg of updates) expect(leg).not.toMatch(/request\.resource\.data\.isDeleted\s*==\s*(?:true|false)/);
  });

  it('🔑 παρονομαστής: το μπλοκ διαβάστηκε — αλλιώς κάθε «φέρει» παραπάνω θα ήταν πράσινο πάνω σε κενό', () => {
    expect(FILES_BLOCK).toContain('allow delete:');
    expect(FILES_BLOCK).toContain('allow create:');
  });
});
