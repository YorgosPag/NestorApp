# ADR-752 — Το namespace που δεν φορτώθηκε ποτέ: reachability των locale (CHECK 3.36)

**Κατάσταση:** Ενεργό
**Ημερομηνία:** 2026-08-04
**Συγγραφέας:** Claude (Opus 5) + Γιώργος Παγώνης
**Κατηγορία:** i18n / Pre-commit Gates / Static Analysis
**Σχετικά:** ADR-344 §7.C (`PLACEHOLDER_REGISTRY`) · ADR-651 Φάση Ε (ο έλεγχος πληρότητας που
φανέρωσε το σφάλμα) · ADR-279/ADR-280 (namespace splits, compat στρώμα) · ADR-727/CHECK 3.33
(φρεσκάδα παραγόμενων τύπων) · ADR-744/CHECK 3.34 (shell slice) · ADR-666 (pseudo locale) ·
ADR-635 Φ C.23 (`isUnresolved` — γιατί το ωμό κλειδί φαινόταν επιτυχία) · ADR-747 (ίδιο σχήμα:
«η πύλη που έλειπε ανάμεσα σε δύο πύλες»)

---

## Summary

Έξι namespaces είχαν **αρχεία μετάφρασης σε el και en**, καταχώριση στους **παραγόμενους
τύπους**, και **~20 αρχεία καταναλωτές** — αλλά **κανένα `case` στο `namespace-loaders.ts`**.
Το `loadTranslations` έπεφτε στο `default: null`, κατέγραφε **άδειο bundle**, και κάθε `t()`
ζωγράφιζε **ωμό κλειδί** σε παραγωγή. Όλες οι υπόλοιπες CHECK ήταν **πράσινες**, γιατί καμία
δεν έκανε την ερώτηση «**φορτώνεται** αυτό το namespace;».

🔴 **Ο έλεγχος υπήρχε ήδη και ήταν ΚΟΚΚΙΝΟΣ.** Ο `scripts/validate-i18n-config.js` ονομάτιζε
και τα έξι — απλώς **καμία πύλη δεν τον έτρεχε**. Ένα anchor χωρίς gate δεν είναι anchor·
είναι σχόλιο.

---

## 1. Το εύρημα, όπως εμφανίστηκε

Στιγμιότυπο οθόνης του Γιώργου (04/08, 15:15), διάλογος «Εκτύπωση Σχεδίου» → «Έλεγχος
πληρότητας για κατάθεση»:

```
Κενά πεδία: placeholders.drawing.title, placeholders.project.name, placeholders.user.fullName
Το πρότυπο δεν περιλαμβάνει: placeholders.project.client, placeholders.project.location,
placeholders.user.licenseNumber, placeholders.user.title
```

Οι μεταφράσεις **υπήρχαν** στον δίσκο, ολόκληρες, στο `src/i18n/locales/el/textTemplates.json`:

| κλειδί | τιμή στον δίσκο | τι είδε ο χρήστης |
|---|---|---|
| `placeholders.drawing.title` | Τίτλος Σχεδίου | `placeholders.drawing.title` |
| `placeholders.project.name` | Όνομα Έργου | `placeholders.project.name` |
| `placeholders.user.licenseNumber` | Αριθμός Μητρώου | `placeholders.user.licenseNumber` |

**Δεν ήταν ελλιπής μετάφραση. Ήταν αφόρτωτο namespace.**

---

## 2. Η αλυσίδα, βήμα-βήμα

1. `text-engine/templates/resolver/variables.ts` — το `PLACEHOLDER_REGISTRY` ορίζει
   `labelI18nKey: 'textTemplates:placeholders.drawing.title'` (ADR-344 §7.C).
2. `ui/components/print/PrintComplianceHint.tsx` καλεί `t(key)` για κάθε λείπον πεδίο.
3. `namespace-loaders.ts` **δεν είχε `case 'textTemplates'`**.
4. `lazy-config.ts:loadTranslations` → `getNamespaceLoader()` → `null` →
   `logger.warn(...)` → **`return {}`**.
5. `loadNamespace` → `addResourceBundle(el, 'textTemplates', {})` — **άδειο, αλλά υπαρκτό**.
6. Το i18next αστοχεί σε κλειδί με πρόθεμα ns και επιστρέφει το κλειδί **χωρίς** το πρόθεμα
   (η ιδιότητα που τεκμηριώνει το ADR-635 Φ C.23) ⇒ `placeholders.drawing.title` στην οθόνη.

### 2.1 Γιατί δεν έσωσε το compat στρώμα (ADR-280)

Το `namespace-compat.ts` χαρτογραφεί `dxf-viewer.textTemplates → dxf-viewer-wizard`, δηλαδή
περιμένει το κλειδί ως `dxf-viewer:textTemplates.…`. Το registry γράφει
`textTemplates:placeholders.…` — το `textTemplates` ως **namespace**, όχι ως ρίζα-κλειδί.
Το `remapLegacyTranslationKey` δεν βρίσκει κανόνα για namespace `textTemplates` και
επιστρέφει το κλειδί ανέπαφο.

⚠️ Και **ούτε θα έσωζε αν έσωζε**: το `textTemplates` **μέσα** στο `dxf-viewer-wizard.json`
είναι **άλλο πράγμα** — έχει ρίζες `normalText, heading, technicalText, categories`, **καμία
`placeholders`**. Δύο διαφορετικά περιεχόμενα με το ίδιο όνομα, σε δύο διαφορετικά επίπεδα.

---

## 3. Η έκταση — έξι, όχι ένα

| namespace | αρχεία locale | αρχεία καταναλωτές | κατάσταση πριν |
|---|---|---|---|
| `textTemplates` | el + en | 6 | άδειο bundle |
| `textSpell` | el + en | 7 | άδειο bundle |
| `textFonts` | el + en | 3 | άδειο bundle |
| `textDraft` | el + en | 2 | άδειο bundle |
| `textAi` | el + en | 1 | άδειο bundle |
| `dxf-viewer-dimensions` | el + en | 0 (ορφανό) | άδειο bundle |

**100 αρχεία locale (el) — 94 loaders.** Η διαφορά ήταν ακριβώς αυτά τα έξι.

---

## 4. Γιατί καμία πύλη δεν το είδε

| πύλη | τι ρωτά | απάντηση εδώ |
|---|---|---|
| CHECK 3.8 | «υπάρχει το κλειδί σε αρχείο locale;» | **ναι** ✅ |
| CHECK 3.33 (ADR-727) | «είναι φρέσκοι οι παραγόμενοι τύποι;» | **ναι** ✅ |
| CHECK 3.34 (ADR-744) | «είναι φρέσκο το shell slice;» | **ναι** (εκτός shell) ✅ |
| CHECK 3.13 | «φτάνει ο resolver στο κλειδί;» | δεν κοιτά loaders ✅ |
| — | **«φορτώνεται το namespace;»** | **κανείς δεν ρώτησε** 🔴 |

Ίδιο σχήμα με το `0` του N.11 και του CHECK 3.18: **«πράσινο» σήμαινε «κανείς δεν κοίταξε»**.

### 4.1 🔴 Η χειρότερη λεπτομέρεια: ο έλεγχος υπήρχε

Ο `scripts/validate-i18n-config.js` συγκρίνει ήδη τα αρχεία locale με το
`SUPPORTED_NAMESPACES`. Εκτελεσμένος στο δέντρο **πριν** τη διόρθωση:

```
[ERROR] SUPPORTED_NAMESPACES drift vs …\locales\el.
        Missing: dxf-viewer-dimensions, textAi, textDraft, textFonts, textSpell, textTemplates
```

Τα ονομάτιζε **και τα έξι**. Δεν τον έτρεχε **ούτε το hook ούτε το CI** — και το ίδιο το
`i18n-governance.yml` το είχε γραμμένο ως δικαιολογία: *«bundles validate:i18n-config (2
pre-existing errors) … which would red the workflow on day one»*. **Ένας κόκκινος έλεγχος
που κανείς δεν τρέχει είναι ισοδύναμος με ανύπαρκτο έλεγχο** — με το επιπλέον κόστος ότι
δημιουργεί την ψευδαίσθηση κάλυψης.

---

## 5. Η απόφαση

### 5.1 Η διόρθωση του σφάλματος

1. **`namespace-loaders.ts`** — 12 `case` (6 namespaces × el/en).
2. **`lazy-config.ts`** — τα 6 στο `SUPPORTED_NAMESPACES` (χωρίς αυτό, τα `case` είναι
   απροσπέλαστα: ο τύπος `Namespace` δεν τα περιέχει).
3. **`PrintComplianceHint.tsx`** — `useTranslation(['dxf-viewer-shell', 'textTemplates'])`.
   Ένα κλειδί με ρητό πρόθεμα ns επιλύεται **μόνο** αν το bundle έχει φορτωθεί, και το
   `useTranslation` φορτώνει **μόνο όσα του δηλώσεις**. Πριν, η επίλυση εξαρτιόταν από το αν
   ο χρήστης είχε ανοίξει νωρίτερα τον διαχειριστή προτύπων — **τυχαία σωστό**.
   Ο διάλογος δεν έχει loading boundary (ανοίγει χωρίς αλλαγή διαδρομής, ADR-279 §9), οπότε
   η προειδοποίηση κρύβεται ώσπου `isNamespaceReady` — ένα καρέ αργότερα, ποτέ ωμή.

### 5.2 Η πύλη — CHECK 3.36

**Επέκταση του υπάρχοντος `validate-i18n-config.js`, ΟΧΙ νέο script** (N.0.2): ο έλεγχος
«αρχείο locale ↔ δήλωση» ζούσε ήδη εκεί για τρεις SSoT· η τέταρτη (loaders) ανήκει δίπλα
τους. Νέος shared parser `parseNamespaceLoaders()` στο `scripts/_shared/i18n-governance.js`.

**Τρεις ρητές καταστάσεις — καμία σιωπηλή απόρριψη:**

| κατάσταση | τι σημαίνει στην οθόνη |
|---|---|
| `no-loader` | αρχείο locale χωρίς `case` ⇒ άδειο bundle ⇒ **ωμά κλειδιά** (το αρχικό σφάλμα) |
| `orphan` | `case` χωρίς αρχείο ⇒ **σφάλμα δυναμικής εισαγωγής** στον browser |
| `wrong-target` | `case` που δείχνει σε άλλη γλώσσα/άλλο αρχείο ⇒ σιωπηλά **λάθος κείμενο** |

Το τρίτο είναι το χειρότερο: δεν φαίνεται σαν σφάλμα, **φαίνεται σωστό**. Γι' αυτό ο parser
κρατά τον **πραγματικό στόχο** του `import`, όχι μόνο το όνομα του `case`.

**ΔΕΝ είναι ratchet — καμία baseline, ποτέ.** Μια δήλωση υπάρχει ή δεν υπάρχει· δεν υπάρχει
«ανεκτό πλήθος αφόρτωτων namespaces».

**Δύο επίπεδα:**
- **Layer 1** — pre-commit, Phase 1 worker (`run-checks-parallel.js`), σκανδάλη: staged
  αρχείο locale **ή** οτιδήποτε κάτω από `src/i18n/` **ή** `src/types/i18n.ts`. Καθαρό
  in-memory Node (~60ms). Escape: `SKIP_I18N_NAMESPACE_WIRING=1`.
- **Layer 2** — `i18n-governance.yml`, **άνευ όρων**. Commit με `--no-verify` ή μηχάνημα
  χωρίς `core.hooksPath` δεν περνά.

### 5.3 Παράπλευρη διόρθωση: ο parser διάβαζε κείμενο, όχι δηλώσεις

Το `parseConstArray` έπαιρνε **κάθε** συμβολοσειρά σε μονά εισαγωγικά μέσα στο μπλοκ —
**μαζί με τα σχόλια**. Γράφοντας αυτή τη διόρθωση, ένα σχόλιο με παράδειγμα κλειδιού γέννησε
**φάντασμα namespace** και κοκκίνισε τον validator με `Extra: textTemplates:…`. Προστέθηκε
`stripLineComments()` (σέβεται τα `//` μέσα σε συμβολοσειρές). Το περιστατικό είναι test
(Ομάδα 3), όχι ανέκδοτο.

---

## 6. Απόδειξη ότι η πύλη πιάνει το σφάλμα

Μεταλλάξεις στο **πραγματικό** `namespace-loaders.ts`, με τον validator ως έχει:

| # | μετάλλαξη | αποτέλεσμα |
|---|---|---|
| **Μ1** | διαγραφή του `case 'textTemplates'` (el) — **το αρχικό σφάλμα** | ❌ EXIT 1 — `Missing: textTemplates` |
| **Μ2** | το `case 'textSpell'` δείχνει στο `textFonts.json` | ❌ EXIT 1 — `wrong file: textSpell → ./locales/el/textFonts.json` |
| **Μ3** | `case 'fantasma'` χωρίς αρχείο | ❌ EXIT 1 — `Extra: fantasma` |
| **Μ0** | επαναφορά | ✅ EXIT 0 |

**3/3 + Μ0.** Και **μέσα από τον hook orchestrator** (όχι μόνο απευθείας):

```
⚡ 2 checks running in parallel
[ERROR] el namespace loader drift … Missing: textTemplates
⛔ CHECK 3.36 (i18n namespace reachability) exited 1        EXIT=1
```

**Tests:** `npm run test:i18n-namespace-reachability` — 17 tests / 4 ομάδες. Η **Ομάδα 4**
τρέχει στο πραγματικό δέντρο και θα ήταν κόκκινη πριν τη διόρθωση.

---

## 7. Τι ΔΕΝ καλύπτει (ρητά)

- **Δεν ελέγχει αν το namespace δηλώνεται από τον καταναλωτή.** Το `PrintComplianceHint`
  έπασχε **και** από αυτό: `t('textTemplates:…')` με δηλωμένο μόνο το `dxf-viewer-shell`.
  Διορθώθηκε χειροκίνητα εδώ, και **σαρώθηκε όλο το `src/`**: κανένα άλλο component δεν
  χρησιμοποιεί ένα από τα 6 προθέματα χωρίς να το δηλώνει (τα 7 άλλα ευρήματα είναι registries
  που **μεταφέρουν** το κλειδί, δεν καλούν `t()`). Ο γενικός έλεγχος «δηλωμένο vs
  χρησιμοποιούμενο πρόθεμα» είναι ανοιχτό θέμα — δες §8.
- **Δεν ελέγχει το `namespace-manifest.json`.** Ο `validate-i18n-manifest.js` έχει **3
  προϋπάρχοντα σφάλματα** (17 namespaces χωρίς εγγραφή governance — owner/budget/surface),
  ανάμεσά τους και τα 6 δικά μας. Καταγράφηκε στο `.claude-rules/pending-ratchet-work.md`·
  **δεν** μπήκε σε πύλη σήμερα γιατί θα γεννιόταν κόκκινη.
- **Δεν εγγυάται ότι το bundle έφτασε πριν το πρώτο καρέ.** Αυτό είναι ο κανόνας εισδοχής του
  ADR-279 §9 (`CRITICAL_NAMESPACES`) ή ένα loading boundary στον καταναλωτή, όπως εδώ.

---

## 8. Ανοιχτά

1. **Πρόθεμα ns χωρίς δήλωση** (§7). Έλεγχος AST: για κάθε `t('ns:key')`, ανήκει το `ns` στα
   ορίσματα του `useTranslation` του ίδιου component; Πιάνει την κλάση, όχι το δείγμα.
2. **`namespace-manifest.json` drift** — 17 namespaces, χειρόγραφη εγγραφή ανά namespace.
3. **`dxf-viewer-dimensions`**: έχει αρχεία και τύπους αλλά **κανέναν καταναλωτή**. Είτε το
   UI διαστάσεων δεν συνδέθηκε ποτέ (ADR-362), είτε το αρχείο είναι νεκρό. Χρειάζεται
   απόφαση, όχι εικασία.

---

## 9. Changelog

### 2026-08-04 — Αρχική έκδοση (ADR-752)

**Διόρθωση σφάλματος**
- `src/i18n/namespace-loaders.ts` — +12 `case` (textTemplates, textSpell, textFonts,
  textDraft, textAi, dxf-viewer-dimensions × el/en).
- `src/i18n/lazy-config.ts` — τα 6 στο `SUPPORTED_NAMESPACES`.
- `src/subapps/dxf-viewer/ui/components/print/PrintComplianceHint.tsx` — δήλωση του
  `textTemplates` + φραγμός `isNamespaceReady`.

**Πύλη (CHECK 3.36)**
- `scripts/_shared/i18n-governance.js` — νέα `parseNamespaceLoaders()`, `stripLineComments()`,
  `LOADER_FUNCTIONS`· θωράκιση του `parseConstArray` απέναντι σε σχόλια.
- `scripts/validate-i18n-config.js` — νέα `collectLoaderErrors()` (3 καταστάσεις)·
  αναδιάρθρωση της `main()` σε βοηθητικές (ήταν 67 γρ. — N.7.1).
- `scripts/run-checks-parallel.js` — CHECK 3.36 στη Phase 1 + `SKIP_I18N_NAMESPACE_WIRING`.
- `.github/workflows/i18n-governance.yml` — άνευ όρων βήμα Layer 2· διορθώθηκε το σχόλιο που
  δικαιολογούσε τη μη-εκτέλεση του validator ως «2 pre-existing errors» (τώρα: 0).
- `scripts/__tests__/i18n-namespace-reachability.test.js` — 17 tests / 4 ομάδες.

**Επαληθεύτηκε:** 3/3 μεταλλάξεις + Μ0 (§6)· 17/17 tests· CHECK 3.36 μπλοκάρει μέσα από τον
hook orchestrator.
**Δεν επαληθεύτηκε ζωντανά:** η ίδια η οθόνη — ο διάλογος εκτύπωσης δεν ξανα-ανοίχτηκε μετά
τη διόρθωση. Τα ελληνικά labels αποδεικνύονται μόνο από το περιεχόμενο του
`el/textTemplates.json`, όχι από στιγμιότυπο.

---

## §9 — ΤΙ ΔΕΝ ΚΑΛΥΠΤΕΙ ΑΥΤΗ Η ΠΥΛΗ (2026-08-09, ADR-781)

Το CHECK 3.36 ρωτά «**έχει αυτό το namespace `case` στον loader;**» — δηλαδή «μπορεί να φορτωθεί;».
Είναι σωστό ερώτημα και **δεν είναι** το ερώτημα «θα βαφτεί ωμό κλειδί στην οθόνη;».

Μετρημένο παράδειγμα (ADR-744 §12): **17 ωμά κλειδιά σε 141 διαδρομές** με το 3.36 **ΠΡΑΣΙΝΟ** — και
σωστά πράσινο: το `navigation` **είχε** loader, **είχε** αρχεία σε el+en, και η μετάφραση **ήταν ήδη
στο bundle**. Το ελάττωμα ήταν ότι **το component αρνιόταν δεδομένα που ήδη κρατούσε**, επειδή
περίμενε `useEffect` που **δεν τρέχει σε SSR**.

Γενικά: το 3.36 απαντά για τη **διαθεσιμότητα** του namespace. Το **CHECK 3.51 (ADR-781)** απαντά για
την **ετοιμότητα του καταναλωτή** (Κ1), για την **επάρκεια του αποστελλόμενου slice** (Κ2), και —
μέσω του **ΧΡΗΣΜΟΥ** — για το **τι στέλνει πραγματικά ο server** (Χ). Τέσσερα ερωτήματα, τέσσερις
πύλες· η συγχώνευσή τους θα ήταν το λάθος του ADR-749.
