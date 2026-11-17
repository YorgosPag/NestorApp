/**
 * @fileoverview ADR-916 Φ-Ε1 Πρόταση 3 — **το λεξιλόγιο των καρτελών φακέλου: δύο αντίγραφα, ΜΙΑ λέξη**.
 *
 * Τα ονόματα καρτελών ζουν σε **δύο** bundles επίτηδες: η σελίδα του κατόχου φορτώνει ήδη το `property-market`, οι
 * σελίδες του επαγγελματία («Οι υποθέσεις μου» · `/case-invite`) ήδη το `conveyance`. Ένα τρίτο, κοινό namespace
 * μετρήθηκε (ADR-744 §27): **+5 αναμονές** πριν ζωγραφίσει η σελίδα (χρέος 330 → 335) — απορρίφθηκε. Η πρακτική των
 * message catalogs ανά bundle: το αντίγραφο επιτρέπεται **μόνο** όταν εργαλείο εγγυάται ότι λέει το ίδιο. Αυτό είναι
 * το εργαλείο.
 *
 * 🔴 Γιατί υπάρχει: πριν την άγκυρα τα δύο αντίγραφα είχαν **ήδη** αποκλίνει (en «Site survey» ≠ «Topographic plan»).
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | αλλαγή λέξης στο ένα αντίγραφο μόνο (οποιαδήποτε γλώσσα) | Π1 |
 * | νέα καρτέλα στη μία πλευρά χωρίς την άλλη | Π2 |
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { PROPERTY_DOSSIER_FILE_TABS } from '@/config/upload-entry-points/entries-property-dossier';
import { HUMAN_LANGUAGES } from '@/i18n/languages';
import { DOSSIER_TAB_KEY } from '../dossier-space-labels';

type Json = Record<string, unknown>;

function locale(language: string, namespace: string): Json {
  return JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/locales', language, `${namespace}.json`), 'utf8')) as Json;
}

function at(root: Json, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node !== null && typeof node === 'object' ? (node as Json)[key] : undefined), root);
}

/** Οι λέξεις που λέει η σελίδα του κατόχου — το `property-market:dossier.tabs.<καρτέλα>`. */
const ownerWord = (language: string, tab: string) => at(locale(language, 'property-market'), `dossier.tabs.${tab}`);
/** Οι λέξεις που λέει ο επαγγελματίας — ακριβώς τα κλειδιά του `DOSSIER_TAB_KEY` που αποδίδει η όψη του. */
const professionalWord = (language: string, key: string) =>
  at(locale(language, 'conveyance'), key.replace(/^conveyance:/, ''));

const TABS = [...PROPERTY_DOSSIER_FILE_TABS, 'topographic'] as const;

describe('ADR-916 Φ-Ε1 — το λεξιλόγιο των καρτελών φακέλου', () => {
  it('Π1 — κάτοχος και επαγγελματίας λένε την ΙΔΙΑ λέξη για κάθε καρτέλα, σε κάθε γλώσσα', () => {
    for (const language of HUMAN_LANGUAGES) {
      for (const tab of TABS) {
        const owner = ownerWord(language, tab);
        expect(typeof owner === 'string' && owner.length > 0).toBe(true);
        expect({ language, tab, word: professionalWord(language, DOSSIER_TAB_KEY[tab]) }).toEqual({ language, tab, word: owner });
      }
    }
  });

  it('Π2 — ο πίνακας κλειδιών του επαγγελματία καλύπτει ΑΚΡΙΒΩΣ τις καρτέλες του καταλόγου (+ τοπογραφικό)', () => {
    expect(Object.keys(DOSSIER_TAB_KEY).sort()).toEqual([...TABS].sort());
    for (const key of Object.values(DOSSIER_TAB_KEY)) expect(key.startsWith('conveyance:')).toBe(true);
  });
});
