/**
 * @fileoverview **Ποσό ολογράφως — ελληνικά** (ADR-928 §5.10). Ο συλλαβιστής της γλώσσας, όχι το σύνορο:
 *   την επικύρωση του ποσού και την επιλογή γλώσσας τις κάνει το `amount-in-words.ts`.
 * @module lib/money/amount-in-words/greek-amount-words
 *
 * 🔑 **Γιατί κώδικας και όχι κλειδιά i18n**: η αρίθμηση είναι **γραμματική**, όχι λεξιλόγιο. Το ίδιο ψηφίο
 * αλλάζει μορφή ανάλογα με το **γένος** του ουσιαστικού που ακολουθεί («τρία ευρώ» · «τρεις χιλιάδες»), και
 * το «εκατό» γίνεται «εκατόν» μόνο όταν ακολουθεί κάτι. Κανένας μεταφραστής δεν μεταφράζει πίνακα λέξεων σε
 * γραμματική άλλης γλώσσας. Ίδια επιλογή με το CLDR/ICU, που κρατά τους κανόνες `spellout` **ανά γλώσσα** ως
 * δεδομένα κανόνων (RBNF) και όχι ως μεταφράσιμες συμβολοσειρές.
 *
 * Κανόνες (Τριανταφυλλίδης, γραμματική της κοινής νεοελληνικής):
 * - «ευρώ» άκλιτο ουδέτερο · «λεπτό / λεπτά» ουδέτερο ⇒ τα ποσά συμφωνούν σε ουδέτερο γένος.
 * - «χιλιάδες» θηλυκό ⇒ «μία / τρεις / τέσσερις / δεκατρείς / διακόσιες χιλιάδες». Το 1.000 μόνο του = «χίλια».
 * - «εκατομμύριο», «δισεκατομμύριο», «τρισεκατομμύριο» ουδέτερα ⇒ «ένα εκατομμύριο», «τρία εκατομμύρια».
 * - 100 = «εκατό»· 101–199 = «εκατόν …». Τύποι γραπτού λόγου: «επτά», «οκτώ», «εννέα», «εννιακόσια».
 */

type Gender = 'neuter' | 'feminine';

/** 0–19. Μόνο όσα αλλάζουν με το γένος έχουν δεύτερη μορφή. */
const UNITS_NEUTER: readonly string[] = [
  '', 'ένα', 'δύο', 'τρία', 'τέσσερα', 'πέντε', 'έξι', 'επτά', 'οκτώ', 'εννέα',
  'δέκα', 'έντεκα', 'δώδεκα', 'δεκατρία', 'δεκατέσσερα', 'δεκαπέντε', 'δεκαέξι', 'δεκαεπτά', 'δεκαοκτώ', 'δεκαεννέα',
];

const FEMININE_OVERRIDES: Readonly<Record<number, string>> = {
  1: 'μία', 3: 'τρεις', 4: 'τέσσερις', 13: 'δεκατρείς', 14: 'δεκατέσσερις',
};

const TENS: readonly string[] = [
  '', '', 'είκοσι', 'τριάντα', 'σαράντα', 'πενήντα', 'εξήντα', 'εβδομήντα', 'ογδόντα', 'ενενήντα',
];

/** Ρίζες 200–900· η κατάληξη δίνει το γένος (`-α` ουδέτερο, `-ες` θηλυκό). */
const HUNDRED_STEMS: readonly string[] = [
  '', '', 'διακόσι', 'τριακόσι', 'τετρακόσι', 'πεντακόσι', 'εξακόσι', 'επτακόσι', 'οκτακόσι', 'εννιακόσι',
];

/** Κλίμακες από 10⁶ και πάνω — όλες ουδέτερες. Ο δείκτης = ομάδα τριών ψηφίων (2 = εκατομμύρια). */
const SCALES: Readonly<Record<number, { readonly one: string; readonly many: string }>> = {
  2: { one: 'εκατομμύριο', many: 'εκατομμύρια' },
  3: { one: 'δισεκατομμύριο', many: 'δισεκατομμύρια' },
  4: { one: 'τρισεκατομμύριο', many: 'τρισεκατομμύρια' },
};

const ZERO = 'μηδέν';

function unit(n: number, gender: Gender): string {
  return gender === 'feminine' ? (FEMININE_OVERRIDES[n] ?? UNITS_NEUTER[n]) : UNITS_NEUTER[n];
}

function hundredWord(h: number, remainder: number, gender: Gender): string {
  if (h === 0) return '';
  if (h === 1) return remainder === 0 ? 'εκατό' : 'εκατόν';
  return HUNDRED_STEMS[h] + (gender === 'feminine' ? 'ες' : 'α');
}

/** 1–999 στο ζητούμενο γένος. */
function belowThousand(n: number, gender: Gender): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const tail = rest < 20 ? unit(rest, gender) : [TENS[Math.floor(rest / 10)], unit(rest % 10, gender)].filter(Boolean).join(' ');
  return [hundredWord(h, rest, gender), tail].filter(Boolean).join(' ');
}

function groupWords(group: number, index: number): string {
  if (group === 0) return '';
  if (index === 0) return belowThousand(group, 'neuter');
  if (index === 1) return group === 1 ? 'χίλια' : `${belowThousand(group, 'feminine')} χιλιάδες`;
  const scale = SCALES[index];
  return group === 1 ? `ένα ${scale.one}` : `${belowThousand(group, 'neuter')} ${scale.many}`;
}

/** Μη αρνητικός ακέραιος ≤ 999 τρισεκατομμύρια, σε ουδέτερο γένος. */
export function greekIntegerWords(n: number): string {
  if (n === 0) return ZERO;
  const parts: string[] = [];
  for (let index = 0, rest = n; rest > 0; index += 1, rest = Math.floor(rest / 1000)) {
    const words = groupWords(rest % 1000, index);
    if (words) parts.unshift(words);
  }
  return parts.join(' ');
}

/** «τρία ευρώ και είκοσι λεπτά» · «χίλια ευρώ» · «ένα λεπτό» · «μηδέν ευρώ». */
export function greekAmountWords(euros: number, cents: number): string {
  if (euros === 0 && cents === 0) return `${ZERO} ευρώ`;
  const centWords = cents === 0 ? '' : `${greekIntegerWords(cents)} ${cents === 1 ? 'λεπτό' : 'λεπτά'}`;
  if (euros === 0) return centWords;
  const euroWords = `${greekIntegerWords(euros)} ευρώ`;
  return centWords ? `${euroWords} και ${centWords}` : euroWords;
}
