/**
 * ADR-770 §14 — Η **ρητή** χαρτογράφηση: ποια μονοθεματική δήλωση αντιστοιχεί σε ποιο
 * θεματικό token του `globals.css`.
 *
 * 🔑 ΓΙΑΤΙ ΕΙΝΑΙ ΧΕΙΡΟΓΡΑΦΟΣ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΑΛΓΟΡΙΘΜΟΣ — **δύο μετρήσεις, δύο απορρίψεις**:
 *
 *   1. **«κοντινότερη τιμή»** (Ευκλείδεια απόσταση σε sRGB, όλα τα 72 tokens):
 *      `colors.background.primary = #ffffff` → πρότεινε **`--destructive-foreground`**
 *      (Δ=9,1) και το `background.secondary` το **ίδιο** με **Δ=0,0**. Ένα codemod που το
 *      εφάρμοζε θα έβαφε φόντα με «χρώμα κειμένου κουμπιού διαγραφής». ❌
 *
 *   2. **«ρόλος πρώτα, μετά κοντινότερη τιμή»** (υποψήφιοι φιλτραρισμένοι σε
 *      surface/foreground/border): καλύτερο — το `colors.text.secondary → --muted-foreground`
 *      βγήκε **Δ=0,0**, τα `severity.*` βρήκαν τα σωστά `--bg-*`/`--text-*` — αλλά
 *      `background.primary → --bg-success` (Δ=14,8) και `border.focus → --input` (Δ=162,6
 *      αντί `--ring`). **25 προτάσιμες / 18 λάθος.** ❌
 *
 * ⇒ **Η ονομασία κουβαλά σημασία που η τιμή δεν κουβαλά.** Το `background.primary` σημαίνει
 * «η βασική επιφάνεια», όχι «λευκό»· το `border.focus` σημαίνει «το δακτυλίδι εστίασης», όχι
 * «μπλε». Καμία μετρική χρώματος δεν ανακτά πρόθεση.
 *
 * Γι' αυτό ο πίνακας είναι **γραμμένος από άνθρωπο** — και το μηχάνημα κάνει το μόνο πράγμα
 * που κάνει καλύτερα: **επαληθεύει** ότι η πρόταση όντως λύνει τη βλάβη, με το ίδιο κριτήριο
 * της πύλης, και στα δύο θέματα.
 *
 * 🔑 **Αυτό είναι το σημείο που ξεπερνά το Atlassian codemod**: εκείνο *προτείνει* token και
 * αφήνει τον έλεγχο σε ανθρώπινη ανάγνωση διαφορών. Εδώ κάθε πρόταση συνοδεύεται από
 * **αριθμητική απόδειξη** — «πριν: φωτεινό 12,83:1 / σκοτεινό 1,01:1· μετά: 12,63:1 / 15,80:1».
 * Ο άνθρωπος εγκρίνει **σημασία**, όχι **αριθμούς**.
 *
 * ⚠️ ΟΤΙ ΔΕΝ ΕΙΝΑΙ ΕΔΩ **ΔΕΝ ΜΕΤΑΤΡΕΠΕΤΑΙ**. Δεν υπάρχει προεπιλογή, δεν υπάρχει «κοντινό
 * ταίριασμα ως εφεδρεία» — αυτό είναι fail-closed, και είναι σκόπιμο: **11 από τις 43**
 * δηλώσεις δεν έχουν θεματικό αντίστοιχο στο `globals.css` (χρωματιστά περιγράμματα, πορτοκαλί
 * «high» severity), και μια εικασία εκεί θα ήταν χειρότερη από την υπάρχουσα βλάβη.
 *
 * @module scripts/lib/contrast/token-migration-map
 */

'use strict';

/**
 * `μονοπάτι δήλωσης → όνομα CSS custom property`.
 *
 * Κάθε γραμμή είναι **σημασιολογική απόφαση**, με τον λόγο της δίπλα όπου δεν είναι προφανής.
 * Τα κλειδιά είναι **ακριβή μονοπάτια** — όχι μοτίβα: ένα regex εδώ θα ξανάφερνε την εικασία
 * από την πίσω πόρτα.
 */
const TOKEN_MAP = Object.freeze({
  // ── Κείμενο ────────────────────────────────────────────────────────────────
  'colors.text.primary': '--foreground',
  // ⚠️ `--foreground` ≡ `--card-foreground` ≡ `--popover-foreground` ≡ `--accent-foreground`
  // ≡ `--secondary-foreground` ≡ `--sidebar-foreground`: **αριθμητικά ταυτόσημα και στα δύο
  // θέματα** (μετρημένο). Άρα το «ποιο από αυτά;» δεν είναι δίλημμα — είναι το ίδιο χρώμα.
  'colors.text.secondary': '--muted-foreground',
  'colors.text.muted': '--muted-foreground',
  'colors.text.tertiary': '--muted-foreground',

  // ── Επιφάνειες ─────────────────────────────────────────────────────────────
  'colors.background.primary': '--background',
  'colors.background.secondary': '--card',
  // «secondary background» στην πράξη σημαίνει «κάρτα πάνω στο φόντο», όχι «λίγο πιο γκρι
  // φόντο»: το `#f8fafc` πάνω σε `#ffffff` είναι ανεπαίσθητο στο φωτεινό και **ανύπαρκτο**
  // στο σκοτεινό. Το `--card` κουβαλά αυτή τη σημασία ανά θέμα.
  'colors.background.tertiary': '--muted',
  'colors.background.hover': '--accent',
  'colors.background.accent': '--accent',
  'colors.background.muted': '--muted',

  // ── Περιγράμματα ───────────────────────────────────────────────────────────
  'colors.border.primary': '--border',
  'colors.border.secondary': '--input',
  'colors.border.tertiary': '--border',
  'colors.border.focus': '--ring',
  // ⚠️ ΟΧΙ `--input`, που ήταν η αριθμητικά κοντινότερη επιλογή (Δ=162,6 — δηλαδή ούτε
  // κοντινή): το «focus» είναι ο δακτύλιος εστίασης και έχει **δικό του** token.
  'borderColors.default.light': '--border',
  'borderColors.default.dark': '--border',
  'borderColors.muted.light': '--input',
  'borderColors.muted.dark': '--input',
  // ⚠️ Τα δύο σκέλη `{light,dark}` καταλήγουν στο **ίδιο** token, και αυτό είναι το νόημα:
  // το token **είναι** το θεματικό ζεύγος. Η χειρόγραφη διάκριση light/dark παύει να
  // χρειάζεται — γι' αυτό και τα 6 `borderColors.*.dark` ήταν αόρατα σε 23/23 επιφάνειες
  // (κάποιος έγραψε σκούρα περιγράμματα για σκοτεινό θέμα, ADR-770 §12.4 ομάδα Β).

  // ── Σοβαρότητα: επιφάνεια + εικονίδιο ──────────────────────────────────────
  'colors.severity.critical.background': '--bg-error',
  'colors.severity.critical.icon': '--text-error',
  'colors.severity.medium.background': '--bg-warning',
  'colors.severity.medium.icon': '--text-warning',
  'colors.severity.low.background': '--bg-success',
  'colors.severity.low.icon': '--text-success',
  'colors.severity.info.background': '--bg-info',
  'colors.severity.info.icon': '--text-info',

  // ── Διάφορα με σαφές αντίστοιχο ────────────────────────────────────────────
  'photoPreviewComponents.colors.uploadingBackground': '--muted',
});

/**
 * Δηλώσεις που **ρητά δεν μεταναστεύουν**, με τον λόγο. Δεν είναι «ξεχασμένες» — είναι
 * **αποφασισμένες**, και η διάκριση έχει σημασία: μια πύλη που δεν ξεχωρίζει «δεν κοίταξα»
 * από «κοίταξα και δεν γίνεται» παράγει το ίδιο ψευδές πράσινο που κυνηγά όλο το ADR-770.
 */
const NO_TARGET = Object.freeze({
  'colors.text.inverse':
    'Το «inverse» σημαίνει «αντίθετο του τρέχοντος θέματος», που ΔΕΝ είναι σταθερό χρώμα. '
    + 'Κανένα υπάρχον token δεν το εκφράζει: το `--primary-foreground` είναι φωτεινό σε ΚΑΙ '
    + 'ΤΑ ΔΥΟ θέματα. Θέλει νέο token ζεύγος, δηλαδή απόφαση σχεδίασης.',
  'colors.severity.high.background':
    'Δεν υπάρχει `--bg-*` για πορτοκαλί. Η κλίμακα σοβαρότητας έχει ΠΕΝΤΕ βαθμίδες, το '
    + 'globals.css τέσσερα σημασιολογικά χρώματα (error/warning/success/info).',
  'colors.severity.high.icon':
    'Δεν υπάρχει `--text-*` για πορτοκαλί, για τον ίδιο λόγο με το φόντο του «high»: '
    + 'πέντε βαθμίδες σοβαρότητας, τέσσερα σημασιολογικά χρώματα στο globals.css.',
  'colors.severity.critical.border': 'Δεν υπάρχει σημασιολογικό token περιγράμματος ανά σοβαρότητα.',
  'colors.severity.high.border':
    'Δεν υπάρχει σημασιολογικό token περιγράμματος ανά σοβαρότητα — τα `--border`/`--input` '
    + 'είναι ουδέτερα και θα έσβηναν τη διάκριση σοβαρότητας, που είναι το ΝΟΗΜΑ του χρώματος εδώ.',
  'colors.severity.medium.border':
    'Δεν υπάρχει σημασιολογικό token περιγράμματος ανά σοβαρότητα (βλ. critical.border).',
  'colors.severity.low.border':
    'Δεν υπάρχει σημασιολογικό token περιγράμματος ανά σοβαρότητα (βλ. critical.border).',
  'colors.severity.info.border':
    'Δεν υπάρχει σημασιολογικό token περιγράμματος ανά σοβαρότητα (βλ. critical.border).',
  'borderColors.success.light': 'Δεν υπάρχει σημασιολογικό token περιγράμματος επιτυχίας.',
  'borderColors.success.dark':
    'Δεν υπάρχει σημασιολογικό token περιγράμματος επιτυχίας. ⚠️ Και αυτό είναι ένα από τα '
    + 'ΕΞΙ `*.dark` που μετρήθηκαν αόρατα σε 23/23 σκοτεινές επιφάνειες: η σωστή θεραπεία '
    + 'είναι ΝΕΟ token ζεύγος, όχι ανακατεύθυνση σε ουδέτερο περίγραμμα.',
  'borderColors.error.light': 'Δεν υπάρχει σημασιολογικό token περιγράμματος σφάλματος.',
  'borderColors.error.dark':
    'Δεν υπάρχει σημασιολογικό token περιγράμματος σφάλματος· επίσης αόρατο σε 23/23 '
    + 'σκοτεινές επιφάνειες (βλ. borderColors.success.dark).',
  'borderColors.warning.light': 'Δεν υπάρχει σημασιολογικό token περιγράμματος προειδοποίησης.',
  'borderColors.warning.dark':
    'Δεν υπάρχει σημασιολογικό token περιγράμματος προειδοποίησης· επίσης αόρατο σε 23/23 '
    + 'σκοτεινές επιφάνειες (βλ. borderColors.success.dark).',
  'borderColors.info.light': 'Δεν υπάρχει σημασιολογικό token περιγράμματος πληροφορίας.',
  'borderColors.info.dark':
    'Δεν υπάρχει σημασιολογικό token περιγράμματος πληροφορίας· επίσης αόρατο σε 23/23 '
    + 'σκοτεινές επιφάνειες (βλ. borderColors.success.dark).',
});

/** Η μορφή που γράφεται στον κώδικα — ίδια με το `semanticColors` του ίδιου αρχείου. */
const themedValue = (token) => `hsl(var(${token}))`;

module.exports = { TOKEN_MAP, NO_TARGET, themedValue };
