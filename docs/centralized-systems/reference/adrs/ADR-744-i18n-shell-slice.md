# ADR-744 — i18n shell slice σε επίπεδο κλειδιού (CHECK 3.34)

| Πεδίο | Τιμή |
|---|---|
| **Status** | Accepted — υλοποιημένο |
| **Ημερομηνία** | 2026-07-31 |
| **Owner** | Γιώργος Παγώνης |
| **Σχετικά** | ADR-279/280 (i18n governance + namespace splitting), ADR-267/300 (CHECK 3.25, no-flash), ADR-666 (pseudo locale), ADR-700 (module-graph, CHECK 3.30), ADR-727 (ντετερμινιστικό codegen, CHECK 3.33), ADR-584 (CHECK 3.28 jscpd) |
| **CHECK** | **3.34** — ZERO TOLERANCE, **όχι ratchet**, κανένα baseline αρχείο |

---

## 1. Το πρόβλημα — μετρημένο, όχι εικαζόμενο

Το `src/i18n/config.ts` είχε **δύο ανεξάρτητα κανάλια φόρτωσης**, και **κανένα gate δεν έλεγχε τη
συμφωνία τους**:

| Κανάλι | Πού | Πότε | Περιεχόμενο |
|---|---|---|---|
| **Σύγχρονο** `resources` | `config.ts:41-44` | μέσα στο `i18n.init()` | 9 namespaces, **χειρόγραφο literal** + 18 static JSON imports |
| **Ασύγχρονο** preload | `config.ts:80-103` (IIFE) | **μετά** το init | `CRITICAL_NAMESPACES` (72), στο `lazy-config.ts` |

Το UI βάφει πριν ολοκληρωθεί το `await` ⇒ **ωμό κλειδί στην οθόνη**.

### 1.1 Η απόδειξη από τα dev logs (ταιριάζει byte-προς-byte)

```
common=loaded  common-actions=loaded  common-navigation=loaded      ← ακριβώς το σύγχρονο literal
common-status=loaded  common-empty-states=loaded  common-validation=loaded
common-account=MISSING  common-photos=MISSING                        ← μόνο στο async κανάλι
common-sales=MISSING    common-shared=MISSING
```

Τα κλειδιά **ΥΠΑΡΧΟΥΝ** (`el/common-shared.json` → `search.globalSearch`, `search.placeholder`,
`search.hints.*`). Δεν έλειπε μετάφραση — **δεν είχε φορτώσει**.

### 1.2 Το πραγματικό μέγεθος

| Μέτρηση | Τιμή |
|---|---|
| Σύγχρονο bootstrap (el **+** en, static imports) | **295.093 bytes** |
| — από αυτά `admin.json` | **118.604 (40%)** — και **ΔΕΝ** είναι στο `CRITICAL_NAMESPACES` |
| `CRITICAL_NAMESPACES` σύνολο | 72 |
| **Critical αλλά ΟΧΙ σύγχρονα → μπορούν να δείξουν ωμό κλειδί** | **63** |
| Σύγχρονα αλλά ΟΧΙ critical | 6 |

🔴 **Το bug δεν ήταν 4 namespaces — ήταν 63.** Τα 4 ήταν απλώς όσα ζήτησε εκείνη η οθόνη.

Ίδιο σχήμα με τα `0` του N.11/N.12 και με το ADR-727: **το πράσινο σήμαινε «κανείς δεν κοίταξε».**

---

## 2. Τι αποκλείστηκε, και γιατί

| Επιλογή | Γιατί όχι |
|---|---|
| **Βάλε τα λείποντα σύγχρονα** | 295KB → **354KB** initial bundle. Μεταφέρει το πρόβλημα, δεν το λύνει. |
| **Μετάβαση σε next-intl / Lingui** | 100 namespaces / 30.016 κλειδιά / ~137 components / 4 gates (3.8, 3.13, 3.33, ADR-666 pseudo, ADR-280 compat) θα ξαναγράφονταν. **Και δεν θα είχε αποτρέψει το bug** — η αιτία είναι η ανέλεγκτη απόκλιση δύο λιστών, όχι η βιβλιοθήκη. |
| **Suspense / `if (!ready) return null`** | **Απαγορεύεται ρητά** από ADR-279 §9 + CHECK 3.25 (ADR-267/300): ανταλλάσσει το key-flash με blank-flash σε κάθε remount. |

---

## 3. Η απόφαση

**Το σύγχρονο bootstrap παράγεται από τον κώδικα, σε επίπεδο ΚΛΕΙΔΙΟΥ.**

Όλοι (next-intl, i18next, Lingui) κόβουν σε επίπεδο **namespace/catalog**: μια οθόνη που θέλει ένα
string από το `common-shared` φορτώνει και τα 39.935 bytes του. Εδώ κόβουμε σε επίπεδο **κλειδιού**:
το shell θέλει το `search.*`, δηλαδή ~400 bytes.

```
build step:
  1. στατική κλειστότητα εισαγωγών από τα layouts  → το πρώτο JS chunk
  2. namespaces + κλειδιά που ζητούν αυτά τα modules
  3. codegen  src/i18n/generated/shell-slice.el.json  (+ manifest με sha256)
  4. πύλη φρεσκάδας (πρότυπο CHECK 3.33 / ADR-727)
```

**Το κομμάτι που ξεπερνά τους μεγάλους:** αυτοί βασίζονται σε code review για να θυμούνται τι είναι
«critical». Εδώ **το εργαλείο το παράγει** → η απόκλιση γίνεται δομικά αδύνατη.

---

## 4. Τι είναι το «shell» — τρεις μετρήσεις που όρισαν τον ορισμό

Ο αφελής ορισμός δεν δουλεύει. Μετρημένο στο πραγματικό δέντρο (2026-07-31):

| Ορισμός | Αποτέλεσμα |
|---|---|
| Αφελής BFS, ακολουθώντας κάθε re-export | **7.901 αρχεία / 68 namespaces** |
| ADR-700 `computeLiveness` από το `layout.tsx` | **7.492 αρχεία / 67 namespaces / 2,93 MB** |
| **Στατική-μόνο, barrel-aware (αυτό που υλοποιήθηκε)** | **393 αρχεία / 15 namespaces / 35 KB** |

Ο πρώτος αριθμός είναι ο λόγος που το «απλώς περπάτα τα imports» δεν παράγει shell — παράγει την
**εφαρμογή**. Το χάσμα δεύτερου/τρίτου είναι σχεδόν αποκλειστικά το `next/dynamic`: το
`ConditionalAppShell` φτάνει τα `BuildingsPageContent`, `GlobalSearchDialog`,
`FloorplanImportWizard` και άλλα 15 μέσω `dynamic(() => import(...))`, και το καθένα σέρνει όλο του
το υποδέντρο.

### 4.1 Γιατί το dynamic import είναι σύνορο — και γιατί είναι η **αντίθετη** απόφαση από το ADR-700

Το ADR-700 ρωτά «είναι νεκρό αυτό το σύμβολο;» και λύνει κάθε ασάφεια **προς το LIVE**, άρα
ακολουθεί τις ακμές `import()`. Αυτό εδώ ρωτά **άλλο ερώτημα** — «μπορεί αυτό το module να βάψει
πριν λυθεί το async preload;» — και ένα module σε lazily-fetched chunk δεν μπορεί να βάψει πριν
ολοκληρωθεί το δικό του round-trip, δηλαδή πίσω από το ίδιο σύνορο που ήδη καλύπτει το loading state.

Είναι **σκόπιμη, μετρημένη ανταλλαγή**, όχι παράλειψη: ακολουθώντας τις, γυρίζουν 2,93 MB locale
δεδομένων στο σύγχρονο bootstrap. Το `.i18n-shell-slice.json → extraShellRoots` υπάρχει για να
επιστρέψει συγκεκριμένο dynamic υποδέντρο, αν ποτέ εμφανιστεί απόδειξη.

### 4.2 Ποιες είναι οι ρίζες

`src/app/**/layout.tsx` (**pattern**, όχι λίστα — ένα νέο nested layout μπαίνει στο shell μόλις
δημιουργηθεί, χωρίς επεξεργασία config· η απαριθμημένη λίστα είναι ακριβώς η σήψη που καταργεί αυτό
το ADR) **+** `src/app/page.tsx`, η μοναδική **σελίδα** στο σύνολο: είναι η cold-entry διαδρομή της
εφαρμογής, όπου φτάνεις χωρίς προηγούμενη πλοήγηση, άρα τίποτα δεν κρατά loading state γι' αυτήν.
Οι βαθύτερες διαδρομές μένουν έξω — αυτό είναι η Φ4 (§8).

---

## 5. Η σκάλα ταξινόμησης δυναμικών κλειδιών

Η δυσκολία δεν είναι το `t('a.b')` — είναι το `t(step.titleKey)`. Κάθε σκαλοπάτι μπήκε επειδή το
απαίτησε **πραγματικό call site** αυτού του repo:

| Σχήμα | Ανάλυση |
|---|---|
| `t('a.b')` · `t('files:upload.ok')` · `` t(`a.b`) `` | κλειδί |
| `t(cond ? 'a' : 'b')` · `t(a ?? 'b')` | **και οι δύο** κλάδοι (χωρίς short-circuit) |
| `` t(`emailShare.${k}`) `` · `t('errors.' + code)` | στατικό prefix ⇒ **όλο το υποδέντρο** |
| `t(NOTIFICATION_KEYS.files.upload.ok)` | καταχωρημένο key-constant SSoT (`src/config/notification-keys.ts`) |
| `t(MAP[runtimeValue])` | τοπικός const πίνακας, computed index ⇒ **όλες** οι τιμές |
| `t(item.labelKey)` | **property harvest** — τι κρατά ποτέ αυτή η ιδιότητα στα literals του shell |
| `t(x, { defaultValue })` | **δεν μπορεί να αναβοσβήσει** (συμβόλαιο i18next) ⇒ τίποτα προς slice |
| `t(step.titleKey)` | **ΑΝΕΠΙΛΥΤΟ** — αναφέρεται, ποτέ δεν μαντεύεται |

**Η άρνηση είναι η εγγύηση.** Ο generator **ΑΡΝΕΙΤΑΙ** να παράγει slice όσο υπάρχει ανεπίλυτη
δυναμική κλήση χωρίς καταχώρηση στο `dynamicKeyPolicy`. Το σιωπηλό μάντεμα είναι ακριβώς ο τρόπος με
τον οποίο φτάνει ωμό κλειδί στην οθόνη.

**Πορεία:** 11 ανεπίλυτες κλήσεις → 7 μετά τα γενικά σκαλοπάτια (`defaultValue`, τοπικοί πίνακες,
`??`) → **4 αρχεία** στο `dynamicKeyPolicy`, το καθένα με μετρημένο λόγο. Δεν είναι escape hatch που
μεγαλώνει· είναι υπόλοιπο που συρρικνώθηκε.

### 5.1 Γιατί AST και όχι regex

Το `ts.createSourceFile` είναι **parse, όχι type-check** — χωρίς Program, χωρίς diagnostics,
χιλιοστά του δευτερολέπτου ανά αρχείο. **Δεν είναι εκτέλεση `tsc`** (N.17), ίδιο σκεπτικό με το
`scripts/lib/module-graph/parse-module.js`. Ένα regex δεν ξεχωρίζει το `t(a ? 'x' : 'y')` από το
`t(a)`, και η διαφορά είναι 400 bytes έναντι ολόκληρου namespace 40 KB.

---

## 6. Αποτέλεσμα

| Μέτρηση | Πριν | Μετά |
|---|---|---|
| Σύγχρονο i18n bootstrap | **295.093 bytes** (el+en) | **184.599 bytes** (el) — **−37,4%** |
| — από αυτά: τα 9 προηγουμένως σύγχρονα namespaces, **ολόκληρα** | 295.093 (el+en) | 173.720 (el μόνο) |
| — από αυτά: **νέα** κάλυψη 7 namespaces που **δεν** ήταν σύγχρονα | 0 | 10.879 (key-sliced) |
| Χειρόγραφες λίστες namespace | 2 (αποκλίνουσες κατά 63) | **0** |
| Static JSON imports στο `config.ts` | 18 | **1** (το παραγόμενο slice) |
| Namespaces με πιθανό ωμό κλειδί **στο shell** | 63 | **0** (αποδεδειγμένα, §7.3) |

### 6.0 ⚠️ Η διόρθωση που άλλαξε αυτόν τον πίνακα — και γιατί καταγράφεται

Η **πρώτη** εκδοχή αυτού του ADR έκοβε σε επίπεδο κλειδιού **και** τα 9 namespaces που ήταν 100%
σύγχρονα πριν, και ανέφερε **35.140 bytes**. Ήταν **λάθος**, και το έδειξε ζωντανή χρήση: το
`/dxf/viewer` έβαψε το ωμό κλειδί **`dxfViewer.checkingPermissions`**
(`src/app/dxf/viewer/page.tsx:43`), επειδή το κλειδί ζει στο `common.json`, το οποίο είχε πέσει από
34.201 σε 5.076 bytes.

**Η αιτία του λάθους ήταν στον ορισμό, όχι στην υλοποίηση.** Το «shell» ορίστηκε ως τα layouts, και
μια **σελίδα** είναι route boundary — άρα εκτός κλειστότητας **εξ ορισμού**. Αυτό είναι σωστό για
*μετάβαση* διαδρομής· είναι λάθος για **cold load**, όπου το page βάφει στο **ίδιο καρέ** με το
layout χωρίς κανένα loading state να το καλύπτει.

Ο ισχυρισμός «63 → 0 χωρίς regression» ίσχυε σε επίπεδο **namespace** και **δεν** ίσχυε σε επίπεδο
**κλειδιού**: αντάλλασσε τον κίνδυνο των 63 με νέο κίνδυνο στα page-level κλειδιά των 9.

**Διόρθωση:** τα 9 μένουν **ολόκληρα** (`guaranteedNamespaces`) — «μηδέν regression» εξ ορισμού, όχι
κατά εκτίμηση. Κλειδώθηκε με **regression anchor** στο
`src/i18n/__tests__/shell-slice-no-raw-keys.test.ts`: 9 tests που απαιτούν `whole === true` για κάθε
ένα, **συν** ονομαστικό test για τα τρία κλειδιά του `/dxf/viewer`. Η λίστα είναι **παγωμένη
ιστορία** (ό,τι ακριβώς έστελνε το `config.ts:41-44`) — δεν συντηρείται, **μόνο συρρικνώνεται**, μία
εγγραφή τη φορά, καθώς έρχονται τα per-route slices.

**Τι παραμένει πραγματικό κέρδος σήμερα:** ολόκληρο το μισό `en` (147 KB που δεν διαβαζόταν ποτέ),
η κατάργηση των δύο αποκλινουσών λιστών, και η κάλυψη 7 namespaces που **δεν** ήταν σύγχρονα.

### 6.1 Γιατί μόνο `el`

Το `getInitialLanguage()` επιστρέφει **πάντα** `DEFAULT_LANGUAGE` (για να αποφευχθεί SSR/CSR
mismatch) και το `fallbackLng` είναι το ίδιο `el`. Άρα το σύγχρονο μισό `en` — **147 KB από τα 295
KB** — δεν μπορούσε ποτέ να διαβαστεί πριν το async preload το είχε ήδη αντικαταστήσει. Η αλλαγή
γλώσσας περνά από `changeLanguage()` → `preloadCriticalNamespaces()`, που κάνει `await`.

### 6.2 Το migration ledger — **173.720 bytes, και πρέπει να συρρικνωθεί**

Και τα **9** namespaces που ήταν σύγχρονα πριν μπαίνουν ολόκληρα μέσω `guaranteedNamespaces`, με τον
generator να τυπώνει το κόστος τους σε **κάθε** εκτέλεση ώστε να μην μπορεί να κρυφτεί:

| Namespace | bytes (el) | Τι θα το απελευθερώσει |
|---|---|---|
| `admin` | 70.689 | per-route slices για `/admin/*` (το `admin/layout.tsx` είναι **ήδη** shell root — μόνο οι σελίδες λείπουν) |
| `common` | 67.761 | per-route slices γενικά· είναι προσβάσιμο σχεδόν από κάθε σελίδα |
| `navigation` | 21.321 | per-route slices |
| `common-validation` | 4.499 | per-route slices |
| `landing` | 4.269 | **φθηνότερο πρώτο βήμα** — μετρήθηκε ότι ο μόνος καταναλωτής του (`src/components/landing/LandingPage.tsx`) είναι προσβάσιμος **αποκλειστικά** μέσω dynamic import στο `src/utils/lazyRoutes.tsx`, άρα πιθανότατα δεν χρειάζεται καθόλου· κρατιέται μόνο επειδή το «πιθανότατα» δεν είναι ο πήχης εδώ |
| `common-empty-states` | 2.111 | per-route slices |
| `common-navigation` | 1.547 | per-route slices |
| `common-actions` | 874 | per-route slices |
| `common-status` | 649 | per-route slices |

⚠️ **Αυτό ΔΕΝ είναι δεύτερη χειρόγραφη λίστα** — είναι **παγωμένη ιστορία**: ό,τι ακριβώς έστελνε το
`config.ts:41-44` πριν το ADR. Δεν συντηρείται· **μόνο συρρικνώνεται**. Ένα regression anchor
(§7.3) αποτυγχάνει αν κάποιο βγει χωρίς να έχει έρθει η αντικατάστασή του.

---

## 7. CHECK 3.34 — δύο στρώσεις, και τίμια δήλωση πού σταματά η φθηνή

### 7.1 Layer 1 — pre-commit, **0,7s μετρημένα**, χωρίς module graph

| | Τι ελέγχει |
|---|---|
| **A. ακεραιότητα artifact** | τα bytes στον δίσκο είναι αυτά που υπογράφει το manifest ⇒ πιάνει χειρόγραφη επεξεργασία |
| **B. locale drift** | ξανα-κλαδεύει το **καταγεγραμμένο** σύνολο κλειδιών από τα τρέχοντα locale ⇒ **ΑΚΡΙΒΕΣ**, όχι προσέγγιση — το σύνολο είναι η ίδια η έξοδος του generator |
| **C. shell surface drift** | ξανα-υπολογίζει fingerprint για κάθε staged αρχείο που το manifest δηλώνει shell module ⇒ πιάνει αλλαγμένη `t()` **ΚΑΙ** αλλαγμένη ακμή import, που είναι ο μόνος τρόπος να μπει νέο module στην κλειστότητα |
| **D. resolution drift** | νέο αρχείο που ικανοποιεί specifier τον οποίο ο walk είχε καταγράψει ως unresolved |

**Τι ΔΕΝ βλέπει το Layer 1:** αλυσίδα re-export ξαναγραμμένη **εκτός** shell module (το barrel B
προωθεί το X· η δήλωση του X μετακινείται από C σε D). Κανένα shell αρχείο δεν αλλάζει bytes, όμως η
κλειστότητα αλλάζει. Είναι πραγματικό, είναι σπάνιο, και γι' αυτό υπάρχει το Layer 2. **Η δήλωση του
κενού είναι το ζητούμενο** — μια πύλη που υπονοεί κάλυψη που δεν έχει είναι χειρότερη από ανύπαρκτη.

### 7.2 Layer 2 — CI, `.github/workflows/i18n-shell-slice.yml`

Πλήρης ανακατασκευή γράφου (13.877 modules, ~19s) + αναπαραγωγή + σύγκριση. Το κανονικό
«regenerate and diff» (`go generate` + `git diff --exit-code`, Bazel `diff_test`), ίδιο σχήμα με το
CHECK 3.33.

### 7.3 Runtime απόδειξη

`src/i18n/__tests__/shell-slice-no-raw-keys.test.ts`: αρχικοποιεί i18next με το slice **και τίποτα
άλλο** — χωρίς async preload, χωρίς `CRITICAL_NAMESPACES`, χωρίς δίκτυο — και περπατά **κάθε** κλειδί
που ο generator κατέγραψε ως προσβάσιμο από shell module. Αν κάποιο δεν επιλυθεί, το μήνυμα αποτυχίας
**είναι** το string που θα έβλεπε ο χρήστης.

**Γιατί δεν είναι πλεονασμός με το 3.34:** η πύλη αποδεικνύει ότι το slice είναι **φρέσκο**· δεν
μπορεί να αποδείξει ότι είναι **χρησιμοποιήσιμο**. Ένα slice μπορεί να είναι τέλεια φρέσκο, τέλεια
υπογεγραμμένο, και να του λείπει το plural sibling ενός κλειδιού. Φρεσκάδα και ορθότητα είναι
διαφορετικοί ισχυρισμοί — και το πράσινο tooling που αποδεικνύει τον λάθος ισχυρισμό είναι ακριβώς
πώς η αρχική απόκλιση 63 namespaces επέζησε από κάθε CHECK του repo.

### 7.4 ΟΧΙ ratchet

Η φρεσκάδα είναι δυαδική. **Κανένα baseline αρχείο, ποτέ.** Αν βρεθείς να γράφεις
`.i18n-shell-slice-baseline.json`, έχεις στρίψει λάθος: «ανεκτός αριθμός μπαγιάτικων κλειδιών» =
ανεκτός αριθμός ωμών κλειδιών στην οθόνη του χρήστη.

---

## 8. Τι έμεινε ανοιχτό

1. **Φ4 — per-route slices. Η μόνη ουσιαστική εκκρεμότητα, και πλέον με μετρημένο κόστος: 173.720
   bytes.** Σε cold load του `/buildings`, το layout **και** το page βάφουν στο ίδιο καρέ· εδώ
   καλύπτεται μόνο η ρίζα. Η μηχανή το υποστηρίζει ήδη (οι ρίζες είναι config) — λείπει ένα
   `shell-slice.<route>.json` ανά page και η φόρτωσή του από τον router. Αυτό μηδενίζει το migration
   ledger του §6.2.

   **Μετρήθηκε γιατί δεν γίνεται με ένα flag:** με `shellRoots: ['src/app/**/layout.tsx',
   'src/app/**/page.tsx']` ο generator βρίσκει **131 ανεπίλυτες δυναμικές `t()`** — δηλαδή 131
   καταχωρήσεις policy που θα έπρεπε να δικαιολογηθούν μία-μία. Το σωστό μονοπάτι είναι
   **ανά-διαδρομή** (ώστε κάθε slice να έχει μικρό, ελέγξιμο υπόλοιπο), όχι μία ένωση όλων.
2. **CHECK 3.8 να υιοθετήσει τον AST classifier.** Σήμερα κρατά το regex `extractTCalls` γιατί το
   ratchet baseline του είναι βαθμονομημένο σε ακριβώς αυτά τα matches. Ο classifier είναι γνήσιο
   υπερσύνολο (βλ. §5)· η μετάβαση θέλει νέο baseline και είναι δική του δουλειά, όχι αυτού του ADR.
3. **14 shell κλειδιά που κανένα locale δεν ορίζει** (`aiInbox`, `auditLog`, `newContact`, …). Είναι
   υπερ-συλλογή του property harvest (το πραγματικό call site είναι
   `` t(`sidebar.nav.${item.labelKey}`) ``, που επιλύεται σωστά ως prefix) — **ακίνδυνα**, πέφτουν στο
   prune. Αναφέρονται από τον generator αντί να κρύβονται.
4. ~~**Hardcoded ελληνικά στα labels πλοήγησης.** Το `MODAL_SELECT_MAIN_NAVIGATION_LABELS`
   (`src/subapps/dxf-viewer/config/modal-select.ts`) κρατά ωμά ελληνικά (`'Κτίρια'`, `'Έργα'`), όχι
   i18n κλειδιά — γι' αυτό το `translateTitle()` του sidebar δεν καλεί ποτέ `t()`.~~
   🔴 **ΑΝΑΙΡΕΘΗΚΕ 2026-08-09 — ο ισχυρισμός ήταν ΨΕΥΔΗΣ, και η ψευδότητά του ήταν η αιτία της
   βλάβης του §12.** Ο πίνακας που ονομάτιζε ζει σε **άλλο subapp** και **δεν φτάνει ποτέ** σε αυτό
   το component· τα labels του sidebar έρχονται από το `src/config/smart-navigation-factory.ts` και
   είναι **dotted κλειδιά**, άρα το `t()` καλείται σε **κάθε** διαδρομή. Βλ. **§12**.

---

## 9. Αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `scripts/generate-i18n-shell-slice.js` | CLI generator (`npm run generate:i18n-shell-slice`) |
| `scripts/check-i18n-shell-slice.js` | CHECK 3.34, Layer 1 + `--full` |
| `scripts/lib/i18n-shell-slice/shell-closure.js` | στατική κλειστότητα, barrel-aware, σύνορα |
| `scripts/lib/i18n-shell-slice/key-extract.js` | η σκάλα ταξινόμησης (AST) |
| `scripts/lib/i18n-shell-slice/slice-build.js` | κλάδεμα, plural siblings, ντετερμινιστικά bytes, fingerprints |
| `scripts/lib/i18n-shell-slice/plan.js` | **ένα** μονοπάτι κώδικα, κοινό generator ↔ πύλη |
| `scripts/lib/i18n-shell-slice/config.js` | defaults σε κώδικα· το JSON μόνο overrides |
| `scripts/lib/i18n-namespace-extract.js` | SSoT: `extractNamespaces`, **`extractTCalls`** (μετακινήθηκε εδώ), `stripComments` |
| `.i18n-shell-slice.json` | ρίζες, migration ledger, dynamic-key policy |
| `src/i18n/generated/shell-slice.el.json` | **παραγόμενο** — μην το επεξεργαστείς |
| `src/i18n/generated/shell-slice.manifest.json` | **παραγόμενο** — προέλευση + wants + fingerprints |
| `src/i18n/config.ts` | καταναλωτής (Φ2) + δήλωση bootstrap (§11) |
| `src/i18n/bundle-registry.ts` | **SSoT πληρότητας — τρεις ρητές καταστάσεις (§11)** |
| `src/i18n/generated/shell-slice.whole.json` | **παραγόμενο — ποια namespaces ταξιδεύουν ολόκληρα (§11)** |
| `src/i18n/lazy-config.ts` | `loadNamespace` — ο ένας από τους δύο καταναλωτές του μητρώου |
| `src/i18n/hooks/useTranslation.ts` | ο άλλος — **δύο** σημεία απόφασης + η διάγνωση. **Ο ΜΟΝΟΣ** hook μετάφρασης από 2026-08-09 (§12) |
| ~~`src/i18n/hooks/useTranslationLazy.ts`~~ | **ΔΙΑΓΡΑΦΗΚΕ** — ψευδές `isLoading` σε SSR (§12) |
| `scripts/__tests__/i18n-shell-slice.test.js` | 62 tests — self-test της πύλης |
| `src/i18n/__tests__/shell-slice-no-raw-keys.test.ts` | 5 tests — runtime απόδειξη |
| `src/i18n/__tests__/bundle-completeness.test.ts` | 26 tests — η λίστα whole δεν μπορεί να ψεύδεται (§11) |
| `src/i18n/__tests__/bundle-hydration.integration.test.ts` | 5 tests — ο **πραγματικός** loader σε κομμένο bundle (§11) |
| `src/i18n/__tests__/use-translation-partial-bundle.test.tsx` | 5 tests — τα δύο σημεία απόφασης του hook (§11) |
| `.github/workflows/i18n-shell-slice.yml` | Layer 2 |

> ⚠️ **Και τα πέντε suites τρέχουν από `npm run test:i18n-shell-slice` (115 tests).** Μέχρι
> 2026-08-07 το script έτρεχε **μόνο** το πρώτο· τα υπόλοιπα υπήρχαν αλλά κανείς δεν τα εκτελούσε.
> Αν προσθέσεις suite εδώ, πρόσθεσέ το **και** στο script — αλλιώς γράφεις σχόλιο, όχι άγκυρα.

### 9.1 Δύο παγίδες ADR-727 που τηρήθηκαν κατά γράμμα

1. **ΠΟΤΕ `new Date()`** σε παραγόμενο αρχείο. Η προέλευση είναι `sha256` των **εισόδων** — η μόνη
   εκδοχή του «πότε χτίστηκε» που μπορεί να απαντήσει «είναι ακόμα σωστό;».
2. **ΜΗΝ αφαιρέσεις την κανονικοποίηση CRLF.** `core.autocrlf=true` χωρίς `.gitattributes` ⇒ ωμή
   σύγκριση bytes = **μονίμως κόκκινο** σε κάθε μηχάνημα Windows, ανεξάρτητα φρεσκάδας.

---

## 10. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-07-31 | **Αρχική υλοποίηση.** Φ1 generator · Φ2 κατανάλωση στο `config.ts` (18 static imports → 1) · Φ3 CHECK 3.34 δύο στρώσεων + tests + CI workflow. `extractTCalls` εξήχθη από το `check-i18n-missing-keys.js` στο κοινό SSoT (μετακίνηση, όχι αντιγραφή — CHECK 3.28). Δύο σφάλματα πιάστηκαν από τις ίδιες τις δοκιμές πριν το commit: (α) το `t('a.b', { ns: 'files' })` έχανε το namespace override, (β) τα λείποντα κλειδιά namespace με άδειο slice δεν αναφέρονταν καθόλου. |
| 2026-07-31 | **🔴 Διόρθωση regression που εντόπισε ζωντανή χρήση.** Το `/dxf/viewer` έβαψε το ωμό `dxfViewer.checkingPermissions`: η πρώτη εκδοχή έκοβε σε επίπεδο κλειδιού **και** τα 9 προηγουμένως σύγχρονα namespaces, ενώ οι **σελίδες** είναι εκτός shell closure εξ ορισμού και σε cold load βάφουν στο **ίδιο καρέ** με το layout. Τα 9 μένουν πλέον **ολόκληρα** (§6.0, §6.2). Ο αριθμός διορθώθηκε **35.140 → 184.599 bytes** (−37,4% αντί για −88%). Προστέθηκε regression anchor: 9 tests `whole === true` + ονομαστικό test για τα κλειδιά του `/dxf/viewer`. **Μάθημα: ο ισχυρισμός «καμία οπισθοδρόμηση» επαληθεύτηκε σε επίπεδο namespace ενώ η αλλαγή ήταν σε επίπεδο κλειδιού — λάθος μονάδα μέτρησης, όχι λάθος υλοποίηση.** |
| 2026-08-07 | **🔴 Δεύτερο regression από ζωντανή χρήση — και το πιο σοβαρό: το §11.** Το `/projects` έβαφε ωμό `page.loadingMessage`. Αιτία: το `loadNamespace` αποφάσιζε «χρειάζεται φόρτωση;» με `hasResourceBundle` («υπάρχει **κάτι**;»), και αυτό το ADR είχε φροντίσει να υπάρχει πάντα κάτι ⇒ το πλήρες locale **δεν φορτωνόταν ΠΟΤΕ** για τα 7 κομμένα namespaces. Προστέθηκε `src/i18n/bundle-registry.ts` (τρεις ρητές καταστάσεις) + παραγόμενο `shell-slice.whole.json`. **5/5 μεταλλάξεις + Μ0.** Βλ. §11. |
| 2026-08-09 | **🔴 Τρίτο regression από ζωντανή χρήση — και η πρώτη φορά που το κλειδί ΥΠΗΡΧΕ και πετάχτηκε: το §12.** Το sidebar έβαφε **17 ωμά κλειδιά ανά διαδρομή** στο HTML του server, ενώ το `navigation` ταξίδευε **ολόκληρο** στο slice. Αιτία: ο `useTranslationLazy` κρατούσε `isLoading = true` **για πάντα σε SSR** (αρχικοποίηση `useState(false)`, διόρθωση μόνο σε `useEffect`), άρα κάθε φρουρός από κάτω ήταν άνευ όρων. **Ο hook ΔΙΑΓΡΑΦΗΚΕ**· 24 καταναλωτές στον `useTranslation`· 6 φρουροί απόδοσης αφαιρέθηκαν. Η καταχώρηση policy του sidebar δήλωνε **μηδέν** συνεισφορά κλειδιών με αιτιολογία που ονόμαζε **λάθος αρχείο** — αντικαταστάθηκε από **9 παραποιήσιμα `prefixes`** (επαληθεύτηκε: **71/71** dotted τιμές του `smart-navigation-factory.ts` κάτω από αυτές τις 9 ρίζες). Ο ισχυρισμός του **§8 #4 αναιρέθηκε**. Boy Scout (N.0.2): παραβίαση Rules of Hooks στο `GeoAccuracyLegend` + structural clone (CHECK 3.28) → `accuracy-stats.ts`. ⚠️ **Δεν προστέθηκε πύλη** — βλ. §12.7 για το τι μένει ακάλυπτο. |

---

## 11. Πληρότητα bundle — η ερώτηση που το i18next δεν μπορεί να απαντήσει

### 11.1 Το περιστατικό

**2026-08-07, `/projects`, σκληρή ανανέωση:** στην οθόνη το ωμό κλειδί `page.loadingMessage`.

Όλες οι σχετικές πύλες ήταν **πράσινες**, και όλες σωστά:

| πύλη | ρωτά | απάντηση |
|---|---|---|
| CHECK 3.8 | υπάρχει το κλειδί στα locales; | ναι — `locales/el/projects.json:149` |
| CHECK 3.36 | έχει το namespace loader; | ναι — `namespace-loaders.ts:56` |
| CHECK 3.33 | είναι φρέσκοι οι τύποι; | ναι |
| CHECK 3.34 | είναι το slice αυτό που παράγει ο κώδικας; | ναι, υπογεγραμμένο |

Καμία δεν ρωτούσε **«έφτασε το περιεχόμενο στον χρήστη;»**, γιατί μέχρι αυτό το ADR η ερώτηση δεν είχε
νόημα: ο σύγχρονος bootstrap έγραφε **ολόκληρα** namespaces.

### 11.2 Η αιτία, σε μία γραμμή

```ts
// src/i18n/lazy-config.ts — ΠΡΙΝ
if (!forceReload && i18n.hasResourceBundle(currentLanguage, namespace)) return;
```

Το `hasResourceBundle` απαντά **«υπάρχει κάτι;»**. Το i18next **δεν έχει καθόλου** έννοια πληρότητας
ανά namespace — ούτε με `partialBundledLanguages`. Όσο οι δύο ερωτήσεις ταυτίζονταν, ο έλεγχος ήταν
σωστός. Το §3 (key-granularity slicing) τερμάτισε την ταύτιση: **7 από τα 16** namespaces του slice
μπαίνουν κομμένα.

| namespace | φύλλα στο slice / σύνολο |
|---|---|
| `projects` | **1 / 49** top-level |
| `dashboard` | 1 / 8 |
| `files` | 6 / 45 |
| `common-shared` | 7 / 16 |
| `common-photos` | 1 / 6 |
| `common-account` | 2 / 3 |
| `onboarding` | 1 / 1 |

Ο έλεγχος γύριζε `true` **ακριβώς** για τα bundles που ήταν ελλιπή, άρα `return`, άρα το
`addResourceBundle` — που κάνει σωστά το merge — **δεν εκτελούνταν ποτέ**.

### 11.3 Γιατί δεν το είδε κανείς

Η παραδοχή ήταν **γραμμένη**, όχι ξεχασμένη. Στο `slice-build.js` στεκόταν ως αιτιολόγηση ασφάλειας:

> «A namespace present in i18next with SOME of its keys is not a half-loaded namespace —
> `addResourceBundle` merges the full version over the slice **when the async load lands** […] The
> slice can only ever ADD correct strings to the first frame; it can never remove one.»

Κάθε πρόταση ήταν σωστή **εκτός από την προϋπόθεση**: η φόρτωση δεν landάριζε. Μια αιτιολόγηση που
περιγράφει σωστά έναν μηχανισμό δύο βήματα πιο κάτω, χωρίς να ελέγξει το πρώτο βήμα, διαβάζεται ως
απόδειξη και δεν είναι.

**Δύο συνθήκες έκρυψαν το μέγεθος:**
- Στο **dev** ο `useTranslation` περνά `forceReload = true`, οπότε το πλήρες locale τελικά έφτανε —
  το φαινόμενο ήταν *αργό*, όχι *σπασμένο*. Στην **παραγωγή** ήταν μόνιμο.
- Το bug χτυπά **μόνο στα ελληνικά**: το slice είναι `el`-only (§4), άρα σε `en` το
  `hasResourceBundle` γύριζε `false` και όλα δούλευαν. Η default γλώσσα ήταν η σπασμένη.

### 11.4 Η απόφαση

**Η πληρότητα δεν είναι συναγώγιμη — πρέπει να δηλώνεται από όποιον γράφει το bundle.**

Δεν υπάρχει φθηνός έλεγχος «είναι πλήρες;»: για να συγκρίνεις το bundle με το πλήρες αρχείο πρέπει
να κατεβάσεις το πλήρες αρχείο, δηλαδή να κάνεις ακριβώς ό,τι ήθελες να αποφύγεις.

Τρεις **ρητές** καταστάσεις σε ένα SSoT μητρώο (`src/i18n/bundle-registry.ts`):

| κατάσταση | ποιος τη γράφει | σημαίνει |
|---|---|---|
| `absent` | κανείς (προεπιλογή) | το i18next δεν έχει τίποτα |
| `shell-partial` | ο bootstrap | το slice έγραψε **υποσύνολο** κλειδιών |
| `complete` | ο loader | εγκαταστάθηκε το **πλήρες** αρχείο locale |

Το `shell-partial` **δεν είναι σφάλμα** — είναι το σχέδιο του §3. Σφάλμα είναι μόνο να διαβαστεί ως
`complete`.

**Ποιος ξέρει ποια είναι ολόκληρα:** ο generator, και μόνο αυτός. Εξάγει
`src/i18n/generated/shell-slice.whole.json` (~200 bytes) στο **ίδιο πέρασμα**, από την **ίδια** πηγή
(`wants[ns].whole`). Δεν είναι δεύτερη λίστα· είναι δεύτερη προβολή της πρώτης — η διάκριση είναι
ολόκληρο το νόημα αυτού του ADR.

> ⚠️ Η αυθεντία είναι το **`wants[ns].whole`**, όχι το `config.guaranteedNamespaces`. Το `whole`
> τίθεται από **δύο** μονοπάτια: τον migration ledger (§6.2) **και** το
> `dynamicKeyPolicy[file].wholeNamespaces` (§5). Σήμερα ταυτίζονται· διαβάζοντας τον ledger θα
> χανόταν το δεύτερο.

Το νέο artifact μπαίνει στο `artifacts` Map του `renderArtifacts`, οπότε **κληρονομεί δωρεάν** και τις
δύο στρώσεις του CHECK 3.34: υπογραφή sha256 (Layer 1) και πλήρη αναπαραγωγή (Layer 2). Επαληθεύτηκε
εκτελεστικά — χειρόγραφο πείραγμα του `whole.json` παράγει `CHECK 3.34 FAIL`.

### 11.5 Τι άλλαξε

| αρχείο | αλλαγή |
|---|---|
| `src/i18n/bundle-registry.ts` | **νέο** — το SSoT μητρώο, τρεις καταστάσεις |
| `src/i18n/generated/shell-slice.whole.json` | **νέο παραγόμενο** — ποια ταξιδεύουν ολόκληρα |
| `scripts/lib/i18n-shell-slice/plan.js` | `wholeNamespaces()` + το artifact στο render |
| `src/i18n/config.ts` | ο bootstrap **δηλώνει** τι έγραψε |
| `src/i18n/lazy-config.ts` | `isBundleComplete` αντί `hasResourceBundle` |
| `src/i18n/hooks/useTranslation.ts` | τα **δύο** σημεία απόφασης + η διάγνωση |

**Η διάγνωση ήταν κι αυτή μέρος του προβλήματος.** Το `warnUnresolvedKey` τύπωνε
`loaded | MISSING` — **δύο** καταστάσεις εκεί που υπήρχαν **τρεις**. Το ίχνος του `/projects` έλεγε
κατά λέξη `projects=loaded` ενώ το bundle είχε 1 από 49 κλειδιά: το μόνο όργανο που θα μπορούσε να
δείξει την αιτία **έδειχνε το αντίθετό της**. Τυπώνει πλέον `getBundleState`.

**Κόστος:** μηδέν επιπλέον δίκτυο. Τα 9 ολόκληρα namespaces δηλώνονται `complete` στο boot, οπότε το
preload των 72 CRITICAL τα παραλείπει όπως πάντα. Χωρίς τη λίστα θα ξαναφορτώνονταν 162.803 bytes.

### 11.6 Άγκυρες — 5/5 μεταλλάξεις + Μ0

`npm run test:i18n-shell-slice` (**115 tests**, 5 suites):

| # | μετάλλαξη | πιάνεται από |
|---|---|---|
| Μ1 | ο bootstrap δηλώνει τα πάντα `complete` | `bundle-completeness` (2) |
| Μ2 | το `whole.json` ισχυρίζεται ότι το `projects` είναι ολόκληρο | `bundle-completeness` (4) |
| Μ3 | `loadNamespace` προς `hasResourceBundle` | `bundle-hydration.integration` (2) |
| Μ4 | `useTranslation` useEffect προς `hasResourceBundle` | `use-translation-partial-bundle` (2) |
| Μ5 | `useTranslation` αρχικό `useState` προς `hasResourceBundle` | `use-translation-partial-bundle` (1) |

> 🔴 **Τρεις παγίδες που κόστισαν, γραμμένες ώστε να μην ξαναστηθούν:**
>
> 1. **Το `shell-slice-no-raw-keys.test.ts` δεν έτρεχε από κανένα npm script.** Υπήρχε από
>    2026-07-31, αναφερόταν στο CLAUDE.md ως «runtime απόδειξη (5)», και **κανείς δεν το εκτελούσε** —
>    το ίδιο σχήμα με τον `validate-i18n-config.js` του ADR-752. *Ένα anchor χωρίς gate είναι σχόλιο.*
>    Το `test:i18n-shell-slice` τρέχει πλέον και τα πέντε suites.
> 2. **Η πρώτη γραφή του `use-translation-partial-bundle` επέζησε ΚΑΙ ΤΩΝ ΔΥΟ μεταλλάξεων.**
>    Χρησιμοποιούσε `projects`, που έχει compat splits (ADR-280) τα οποία το instance του test δεν
>    είχε, άρα το `allLoaded` έβγαινε `false` **ανεξάρτητα** από το κριτήριο. Πράσινο επειδή δεν
>    ρωτούσε τίποτα. Τα ονόματα `dashboard` / `landing` (καμία εγγραφή στο `COMPAT_NAMESPACE_MAP`)
>    **είναι μέρος του test** — μην τα αλλάξεις.
> 3. **Το πρώτο καρέ χρειάζεται δικό του assertion.** Το `useEffect` προλαβαίνει να διορθώσει το
>    `namespaceLoaded` πριν επιστρέψει το `renderHook`, οπότε η Μ5 ήταν αόρατη μέχρι να καταγραφεί η
>    τιμή **κατά** το render. Κι όμως είναι το καρέ που βλέπει ο χρήστης: περίπου 38 καταναλωτές
>    βάφουν με βάση το `isNamespaceReady`.

### 11.7 Τι ΔΕΝ λύνει

Το `/projects` σε **cold load** μπορεί ακόμη να δείξει το ωμό κλειδί για **ένα-δύο καρέ**, όσο τρέχει
το async preload. Αυτό είναι το **ίδιο** ανοιχτό ζήτημα με το `/dxf/viewer` (§8.1): μια **σελίδα**
είναι route boundary και μένει εκτός shell closure εξ ορισμού, ενώ σε cold load βάφει στο ίδιο καρέ με
το layout. Το λύνουν οι **per-route slices (Φ4)**, όχι αυτό το κεφάλαιο.

Η διαφορά που κάνει αυτό το κεφάλαιο είναι κατηγορική: **μόνιμο προς παροδικό**. Πριν, το κλειδί έμενε
ωμό στην παραγωγή για όλη τη ζωή της σελίδας.

---

## 12. Ο φρουρός ετοιμότητας — η **τρίτη** διαδρομή προς το ίδιο ωμό κλειδί

### 12.1 Το περιστατικό

Το πλαϊνό μενού έβαφε **ωμά κλειδιά** (`pages.home`, `sidebar.spaces`, `tools.legal`, …) στο HTML που
στέλνει ο server — σε **κάθε** διαδρομή, γιατί το sidebar ζει στο root layout. Μετρημένο 2026-08-09 με
σκέτο `curl`: **17 ωμά κλειδιά ανά διαδρομή, σε 6 διαδρομές.**

**Και η μετάφραση ΗΤΑΝ ήδη εκεί.** Το `navigation` ταξιδεύει **ολόκληρο** στο slice
(`shell-slice.el.json → navigation.pages.home === "Αρχική"`). Δεν έλειπαν δεδομένα· το component
**αρνιόταν να τα δει**.

### 12.2 Η αιτία, σε μία γραμμή

Ο `useTranslationLazy` αρχικοποιούσε την ετοιμότητά του σε `useState(false)` και τη διόρθωνε **μόνο
μέσα σε `useEffect`** — που **δεν τρέχει ΠΟΤΕ σε SSR**. Άρα στον server το `isLoading` ήταν `true`
**για πάντα**, και κάθε `if (isLoading) …` από κάτω ήταν, στην πράξη, **άνευ όρων**.

Αυτό είναι κατηγορικά **τρίτη** διαδρομή προς το ίδιο σύμπτωμα, ανεξάρτητη από τις δύο του §6.0/§11:
εκεί το κλειδί έλειπε από το bundle· εδώ **υπήρχε** και το component το πέταγε.

### 12.3 Γιατί δεν το είδε καμία πύλη — τρία ανεξάρτητα τυφλά σημεία

1. **CHECK 3.25 (ADR-267/300)** απαγορεύει ακριβώς αυτό το σχήμα, αλλά κοιτάζει μόνο
   `*PageContent.tsx`. Οι φρουροί εδώ ήταν σε **επίπεδο τιμής** μέσα σε helper (`translateTitle`) ή σε
   components εκτός του ονοματολογικού μοτίβου.
2. **Ο ίδιος ο generator του CHECK 3.34 ήταν ΔΟΜΙΚΑ ΤΥΦΛΟΣ** σε αυτά τα αρχεία: το
   `scripts/lib/i18n-namespace-extract.js` ταιριάζει `/useTranslation\(/`, που το
   `useTranslationLazy(` **δεν** ταιριάζει. Ένα ολόκληρο υποσύνολο καταναλωτών ήταν αόρατο στην πύλη
   που υπάρχει για να τους μετρά — μέχρι να μεταναστεύσει ο hook.
3. **Η καταχώρηση policy του `.i18n-shell-slice.json` δήλωνε ΜΗΔΕΝ συνεισφορά κλειδιών**, με
   αιτιολογία που ονόμαζε λάθος αρχείο (βλ. §8 #4, αναιρεμένο). Συνέπεια: τα 71 κλειδιά του sidebar
   **δεν ήταν στο `wants` κανενός namespace** — επέζησαν στο slice **μόνο** επειδή το migration
   ledger στέλνει το `navigation` ολόκληρο. Τη στιγμή που θα συρρικνωνόταν το ledger (§6.2 / §8 #1),
   και τα 71 θα εξαφανίζονταν **σιωπηλά** από κάθε διαδρομή.

> Δηλαδή: η πύλη ήταν **πράσινη** ενώ (α) η βλάβη ήταν ζωντανή στην παραγωγή και (β) η επόμενη
> προγραμματισμένη βελτίωση θα την **πολλαπλασίαζε**. Έκτη εμφάνιση του σχήματος «0 = κανείς δεν
> κοίταξε» στο έργο.

### 12.4 Η απόφαση — ο hook **διαγράφηκε**, δεν διορθώθηκε

Δεν μπήκε `useState(true)` ούτε `useSyncExternalStore` στον `useTranslationLazy`. Ο hook
**διαγράφηκε ολόκληρος** (`src/i18n/hooks/useTranslationLazy.ts`, 58 γραμμές) και **και οι 24
καταναλωτές** πέρασαν στον κανονικό `useTranslation`.

**Γιατί διαγραφή και όχι διόρθωση** — τρεις λόγοι, ο καθένας αρκετός:

1. Ο `useTranslation` αρχικοποιεί **σύγχρονα** (`isBundleComplete`), άρα είναι εξ ορισμού σωστός σε
   SSR· ο lazy θα έπρεπε να ξαναγραφτεί ώστε να **γίνει** αυτός.
2. Ο `useTranslation` έχει ήδη την πλήρη αλυσίδα υποβάθμισης (compat ADR-280 → cross-namespace
   ADR-716 → τηλεμετρία). Ο lazy δεν είχε καμία — σιωπούσε.
3. **Δύο hooks που απαντούν την ίδια ερώτηση με διαφορετική απάντηση** είναι ακριβώς το σχήμα του
   ADR-749. Ένας από τους δύο έπρεπε να πάψει να υπάρχει.

**Οι φρουροί απόδοσης δεν μεταφέρθηκαν.** Ένας φρουρός `if (isLoading) return <spinner/>` δεν
προστατεύει από ωμό κλειδί — **ανταλλάσσει** ένα καρέ κειμένου με ένα κενό καρέ, σε κάθε remount. Στο
`GeoCanvasContent.tsx` έφτανε στο παράλογο: περίμενε τις μεταφράσεις **βάφοντας μια μετάφραση**
(`t('loadingStates.loadingTranslations')`) — αν όντως έλειπαν, η ετικέτα του ίδιου του φρουρού θα ήταν
ωμό κλειδί. Στο `FloatingPanelContainer.tsx` ζωγράφιζε **σκληρό αγγλικό** `"Loading translations..."`:
παράβαση N.11 αόρατη σε **κάθε** στατικό εργαλείο, επειδή ζούσε σε κλάδο που «δεν έτρεχε ποτέ».

### 12.5 Τι άλλαξε

| Αρχείο | Αλλαγή |
|---|---|
| `src/i18n/hooks/useTranslationLazy.ts` | **ΔΙΑΓΡΑΦΗΚΕ** |
| `src/components/sidebar/sidebar-menu-item.tsx` | αφαίρεση φρουρού **επιπέδου τιμής** (`if (isLoading) return title`) — η πηγή των 17 ωμών κλειδιών |
| `src/components/app-sidebar.tsx` | μετανάστευση hook· δούλευε **κατά τύχη** (χωρίς φρουρό + `navigation` ολόκληρο) — ήταν οπλισμένο, όχι σπασμένο |
| `.i18n-shell-slice.json` | η ψευδής αιτιολογία → **9 `prefixes`**, δηλαδή **παραποιήσιμος** ισχυρισμός αντί για πρόζα |
| `src/i18n/generated/shell-slice.manifest.json` | αναγέννηση: `shellFiles` 413 → 412· το `navigation.wants` απέκτησε τα 9 prefixes + 9 ρητά κλειδιά |
| `GeoCanvasContent` · `FloatingPanelContainer` · `PropertyStatusManager` · `UserTypeSelector` | αφαίρεση φρουρού **απόδοσης** |
| `GeoCanvasPanels.tsx` | αφαίρεση **νεκρού** prop `isLoading` (δηλωμένο, ποτέ χρησιμοποιημένο) |
| 15 ακόμη components (`geo-canvas`, `dxf-viewer`) | μετανάστευση hook, χωρίς αλλαγή συμπεριφοράς |

### 12.6 Δύο ευρήματα Boy Scout (N.0.2) μέσα στην ίδια δουλειά

1. **Παραβίαση Rules of Hooks** στο `GeoAccuracyLegend.tsx`: το `useMemo` ήταν **κάτω** από early
   return. Όταν το `controlPoints` περνούσε από κενό σε μη κενό, το component εκτελούσε **διαφορετικό
   πλήθος hooks** μεταξύ δύο renders («Rendered fewer hooks than expected»). **Προϋπήρχε**·
   διορθώθηκε επειδή το αρχείο άνοιξε.
2. **Structural clone (CHECK 3.28)**: ο ίδιος υπολογισμός στατιστικών ακρίβειας ήταν γραμμένος **δύο
   φορές** — `GeoAccuracyLegend.tsx` και `GeoStatusBar.tsx`, byte-identical στο HEAD, με μόνη διαφορά
   την **προβολή** (`{avg,best,worst}` έναντι `{avg,best}`). Εξήχθη σε
   `components/map-overlays/accuracy-stats.ts`. Δύο overlays στον **ίδιο** χάρτη, δίπλα-δίπλα, δεν
   επιτρέπεται να διαφωνήσουν επειδή κάποιος άλλαξε το ένα αντίγραφο.

### 12.7 Τι ΔΕΝ λύνει

Αυτό το κεφάλαιο **δεν** προσθέτει πύλη. Η κλάση «φρουρός ετοιμότητας σε επίπεδο τιμής, εκτός
`*PageContent.tsx`» παραμένει **ακάλυπτη** — το CHECK 3.25 δεν τη φτάνει, και δεν επεκτάθηκε εδώ.

Ό,τι έκλεισε δομικά είναι στενότερο και πρέπει να λέγεται με ακρίβεια: **η πηγή** του ψευδούς
`isLoading` έπαψε να υπάρχει, άρα κανείς δεν μπορεί πια να γράψει φρουρό πάνω της. Ένας νέος φρουρός
πάνω σε δικό του `useState` είναι ακόμη γραπτός σήμερα.

Το τυφλό σημείο #2 του §12.3 (ο generator δεν έβλεπε `useTranslationLazy(`) έκλεισε **ως παρενέργεια**
— δεν υπάρχει πια τέτοια κλήση. Αν αύριο εμφανιστεί δεύτερο wrapper γύρω από το `useTranslation` με
άλλο όνομα, ο `i18n-namespace-extract.js` θα είναι **ξανά** τυφλός. Αυτό είναι δηλωμένο, όχι λυμένο.
