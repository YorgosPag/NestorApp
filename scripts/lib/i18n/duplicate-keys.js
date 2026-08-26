#!/usr/bin/env node
/**
 * =============================================================================
 * ΔΙΠΛΑ ΚΛΕΙΔΙΑ ΣΕ LOCALE JSON — «δηλώνεται το ίδιο κλειδί ΔΥΟ ΦΟΡΕΣ;» (ADR-810)
 * =============================================================================
 *
 * 🔴 **ΤΟ `JSON.parse` ΕΙΝΑΙ ΔΟΜΙΚΑ ΤΥΦΛΟ ΣΕ ΑΥΤΟ ΤΟ ΕΡΩΤΗΜΑ.** Το πρότυπο ECMA-404
 * επιτρέπει διπλά ονόματα και ο αναλυτής κρατά σιωπηλά **το τελευταίο**. Άρα κάθε
 * εργαλείο του έργου που ξεκινά με `JSON.parse` — ο `locale-keys.js`, ο γεννήτορας
 * τύπων (**CHECK 3.33**), ο σαρωτής λειπόντων κλειδιών (**CHECK 3.8**) — βλέπει έναν
 * κόσμο όπου **το διπλότυπο δεν υπήρξε ποτέ**. Το 3.8 ρωτά «**λείπει** κλειδί;» και η
 * απάντηση είναι πάντα «όχι»: το κλειδί υπάρχει, απλώς με **λάθος τιμή** ή έχοντας
 * καταπιεί δεκάδες αδέλφια του.
 *
 * ⚠️ **ΓΙ' ΑΥΤΟ Ο ΣΑΡΩΤΗΣ ΕΙΝΑΙ ΣΥΝΤΑΚΤΙΚΟΣ.** Δεν υπάρχει τρόπος να απαντηθεί το
 * ερώτημα από το **αποτέλεσμα** της ανάλυσης — μόνο από το **κείμενο**. Δεν είναι
 * δεύτερη μηχανή δίπλα στον `locale-keys.js` (ADR-749): εκείνος απαντά «**ποια**
 * κλειδιά υπάρχουν» πάνω στο *αποτέλεσμα*· εδώ η ερώτηση είναι «**πόσες φορές**
 * γράφτηκε το καθένα» και ζει **μόνο** στην πηγή.
 *
 * 📏 **ΜΕΤΡΗΜΕΝΟ ΤΗΝ ΗΜΕΡΑ ΠΟΥ ΓΡΑΦΤΗΚΕ** (2026-08-26, 206 αρχεία locale):
 * **16 διπλότυπα σε 8 αρχεία · 360 νεκρές μεταφράσεις**. Το χειρότερο ήταν το
 * `common.json → audit.fields`, δηλωμένο **δύο φορές** (γρ. 767 και 1100) με **177**
 * ετικέτες πεδίων της πρώτης δήλωσης να μην φτάνουν **ποτέ** στην οθόνη — ο χρήστης
 * έβλεπε **ωμό όνομα πεδίου** στο ιστορικό αλλαγών.
 *
 * @module lib/i18n/duplicate-keys
 */

'use strict';

/**
 * @returns {{path:string,key:string,lines:number[],spans:{pairStart:number,valueStart:number,pairEnd:number}[]}[]}
 *          κάθε κλειδί που δηλώνεται >1 φορά **στο ίδιο αντικείμενο**.
 * @throws  αν το κείμενο δεν είναι έγκυρο JSON — fail-closed, ΠΟΤΕ σιωπηλό `[]`.
 */
function findDuplicateKeys(text) {
  let i = 0;
  const dups = [];
  const lineAt = (idx) => text.slice(0, idx).split('\n').length;

  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };

  // ⚠️ Ο δείκτης μπαίνει στο ανοίγον `"` και βγαίνει ΜΕΤΑ το κλείνον, πάντα.
  const readString = () => {
    const start = i;
    i++;
    while (i < text.length) {
      const c = text[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '"') { i++; return JSON.parse(text.slice(start, i)); }
      i++;
    }
    throw new Error('συμβολοσειρά που δεν κλείνει');
  };

  const skipValue = () => {
    ws();
    const c = text[i];
    if (c === '{' || c === '[') {
      const open = c;
      const close = c === '{' ? '}' : ']';
      let depth = 0;
      while (i < text.length) {
        const ch = text[i];
        if (ch === '"') { readString(); continue; }   // ΧΩΡΙΣ χειρισμό escape έξω από string
        if (ch === open) depth++;
        else if (ch === close) { depth--; i++; if (!depth) return; continue; }
        i++;
      }
      throw new Error(`${open} που δεν κλείνει`);
    }
    if (c === '"') { readString(); return; }
    while (i < text.length && !/[,}\]\s]/.test(text[i])) i++;
  };

  const readObject = (pathStr) => {
    i++;                                              // {
    const seen = new Map();
    for (;;) {
      ws();
      if (text[i] === '}') { i++; break; }
      if (text[i] === ',') { i++; continue; }
      if (i >= text.length) throw new Error('{ που δεν κλείνει');
      const pairStart = i;
      const key = readString();
      ws();
      if (text[i] !== ':') throw new Error(`αναμενόταν «:» μετά το «${key}»`);
      i++;
      ws();
      const valueStart = i;
      if (text[i] === '{') readObject(pathStr ? `${pathStr}.${key}` : key);
      else skipValue();
      const pairEnd = i;

      // 🔴 ΦΡΟΥΡΟΣ ΟΛΙΣΘΗΣΗΣ: αν ο σαρωτής ξεφύγει, το span κόβει **μέσα σε
      //    συμβολοσειρά** — και σε ελληνικό κείμενο αυτό εμφανίζεται ως «άκυρο JSON»
      //    πολύ αργότερα, σε άλλο αρχείο. Fail-closed, **εδώ**.
      // ⚠️ **ΔΟΜΙΚΟΣ, ΟΧΙ `JSON.parse`**: το ξανα-ανάλυμα κάθε υποδέντρου σε κάθε
      //    επίπεδο είναι **O(n²)** — μετρημένο **8,7s** για 206 αρχεία έναντι **0,4s**.
      //    Πύλη που κοστίζει τόσο δεν είναι αυστηρότερη, είναι ανενεργή (CHECK 3.52).
      //    Ο έλεγχος «ανοίγει και κλείνει σωστά» πιάνει ΑΚΡΙΒΩΣ την ολίσθηση.
      const open = text[valueStart];
      const close = text[pairEnd - 1];
      const wellFormed = open === '{' ? close === '}'
        : open === '[' ? close === ']'
          : open === '"' ? (close === '"' && pairEnd - valueStart >= 2)
            : /^(?:-?\d|true|false|null)/.test(text.slice(valueStart, pairEnd));
      if (!wellFormed) throw new Error(`άκυρο span για «${pathStr ? `${pathStr}.` : ''}${key}»`);

      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push({ pairStart, valueStart, pairEnd });
    }
    for (const [key, spans] of seen) {
      if (spans.length > 1) {
        dups.push({ path: pathStr || '', key, lines: spans.map((s) => lineAt(s.pairStart)), spans });
      }
    }
  };

  ws();
  if (text[i] !== '{') throw new Error('το locale δεν είναι αντικείμενο');
  readObject('');
  return dups;
}

/** `''` + `'a'` → `'a'` · `'x.y'` + `'a'` → `'x.y.a'` */
const dottedName = (d) => (d.path ? `${d.path}.${d.key}` : d.key);

module.exports = { findDuplicateKeys, dottedName };
