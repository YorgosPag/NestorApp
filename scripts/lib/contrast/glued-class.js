/**
 * ADR-770 — «κολλημένη utility»: μία κλάση χωμένη στην επόμενη επειδή λείπει ένα κενό.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΟ MODULE (και δεν ζει μέσα στον σαρωτή ή μέσα στο test):
 * η βλάβη έχει **δύο** μορφές, και ο κάθε καταναλωτής έβλεπε **μία**.
 *
 *   Μορφή Α — ονομασμένη κλάση:   `"text-primaryflex items-center gap-2"`
 *   Μορφή Β — αυθαίρετη τιμή:     `"text-[hsl(var(--text-warning))]flex items-center"`
 *
 * Ο `text-primary-sites.js` βλέπει **μόνο** την Α (την πιάνει ως κατάληξη μετά το
 * `text-primary` ⇒ κατάσταση `inert-class`). Όταν ψάχτηκε το δέντρο, οι πραγματικές
 * εμφανίσεις ήταν **3**, και οι **2 από τις 3** ήταν μορφής Β — δηλαδή η πλειοψηφία
 * της βλάβης ήταν αόρατη σε αυτόν που υποτίθεται ότι την έψαχνε (ADR-759 §4.12.3).
 *
 * ⚠️ ΓΙΑΤΙ ΔΕΝ ΤΟ ΠΙΑΝΕΙ ΤΙΠΟΤΑ ΑΛΛΟ: το `"text-primaryflex"` είναι **έγκυρη
 * συμβολοσειρά** που δεν αντιστοιχεί σε **καμία** utility. Ο μεταγλωττιστής δεν έχει
 * λόγο, ο Tailwind απλώς δεν παράγει κανόνα, το ESLint βλέπει ένα string. Χάνονται
 * **και** το χρώμα **και** το `flex` — άρα και τα `items-center`/`gap-2` που το
 * προϋποθέτουν. Η βλάβη είναι **σιωπηλή διάταξη**, όχι μόνο χρώμα.
 *
 * ΜΗΔΕΝΙΚΗ ΑΝΟΧΗ, ΠΟΤΕ BASELINE: μια κολλημένη κλάση δεν είναι «λιγότερο κακή από
 * χθες» — δεν υπάρχει νόμιμη περίπτωση. Το δέντρο είναι στο **0** από 2026-08-07.
 */

'use strict';

const { isInsideComment } = require('./text-primary-sites');

/**
 * Μορφή Β. Το `)]` κλείνει αυθαίρετη τιμή Tailwind (`text-[hsl(var(--x))]`,
 * `w-[calc(100%-2rem)]`); αμέσως μετά πρέπει να ακολουθεί κενό, εισαγωγικό,
 * `}` ή τέλος — ποτέ γράμμα.
 *
 * ⚠️ ΜΗΝ το χαλαρώσεις σε σκέτο `\][a-z]`: το `min-w-[100px] justify-start` έχει `]`
 * και το `cn(x, "p-[2px]")` επίσης — χωρίς το `)` μπροστά, το σχήμα θα χτυπούσε
 * νόμιμο κώδικα. Το `)` είναι που κάνει το κλείσιμο **σίγουρα** συναρτησιακής τιμής.
 */
const ARBITRARY_CLOSE_GLUED = /\)\][a-z]/;

/**
 * Μορφή Α. Ονομασμένο χρωματικό token αμέσως ακολουθούμενο από utility, χωρίς κενό.
 *
 * ⚠️ Η λίστα των utilities είναι ΡΗΤΗ και όχι `[a-z]+`: το `text-primary-foreground`
 * και το `text-muted-foreground` είναι **νόμιμες** κλάσεις, και ένα άπληστο σχήμα θα
 * τις έβαφε παραβιάσεις. Ο διαχωριστής είναι το ότι μετά το χρώμα ακολουθεί
 * **γνωστό όνομα utility**, όχι οποιοδήποτε γράμμα.
 */
const NAMED_COLOR_GLUED =
  /text-(primary|secondary|muted|foreground|destructive|accent|card|popover)(flex|grid|block|hidden|absolute|relative|inline|items-|justify-|gap-|bg-|border|rounded|min-|max-|font-|w-|h-|p-|m-|z-|opacity|transition|cursor|overflow|shadow|space-|truncate|whitespace)/;

/** Οι δύο κανόνες, με σταθερό αναγνωριστικό ώστε οι αναφορές να είναι σταθερές. */
const GLUED_RULES = [
  { id: 'arbitrary-close', re: ARBITRARY_CLOSE_GLUED, describe: 'κλείσιμο αυθαίρετης τιμής `)]` κολλημένο στην επόμενη κλάση' },
  { id: 'named-color', re: NAMED_COLOR_GLUED, describe: 'ονομασμένη χρωματική κλάση κολλημένη σε utility' },
];

/**
 * Εντοπίζει κάθε κολλημένη utility σε ένα αρχείο πηγής.
 *
 * Τα σχόλια εξαιρούνται μέσω του **ίδιου** `isInsideComment` που χρησιμοποιεί ο
 * σαρωτής `text-primary-sites.js` — μία απάντηση στο «είναι σχόλιο;», όχι δύο.
 * (Χωρίς αυτό, η τεκμηρίωση αυτού ακριβώς του αρχείου θα ήταν παραβίαση.)
 *
 * @param {string} text περιεχόμενο αρχείου
 * @returns {Array<{rule: string, line: number, snippet: string}>}
 */
function findGluedClasses(text) {
  // Φθηνό φίλτρο σε επίπεδο ΑΡΧΕΙΟΥ πρώτα. Το δέντρο είναι στο 0, άρα σχεδόν κάθε
  // αρχείο τερματίζει εδώ με δύο `test` αντί για δύο `exec` ανά γραμμή — μετρημένο
  // 6,4s → 1,3s σε 14.670 αρχεία. (Οι regex είναι χωρίς `g`, άρα δεν κρατούν
  // `lastIndex`: το `test` πάνω στο ολόκληρο κείμενο είναι ασφαλές να επαναληφθεί.)
  const candidates = GLUED_RULES.filter((rule) => rule.re.test(text));
  if (candidates.length === 0) return [];

  const hits = [];
  const lines = text.split('\n');
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of candidates) {
      const m = rule.re.exec(line);
      if (!m) continue;
      if (isInsideComment(text, offset + m.index)) continue;
      hits.push({ rule: rule.id, line: i + 1, snippet: line.trim().slice(0, 160) });
    }
    offset += line.length + 1; // +1 για το \n που έφαγε το split
  }
  return hits;
}

module.exports = { GLUED_RULES, findGluedClasses, ARBITRARY_CLOSE_GLUED, NAMED_COLOR_GLUED };
