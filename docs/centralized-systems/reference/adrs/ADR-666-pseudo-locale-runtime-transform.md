# ADR-666: Pseudo Locale = Runtime Transform (`pseudo-post-processor.ts`)

## Status
✅ **ACTIVE — 2026-07-17** — Το `src/i18n/locales/pseudo/` ήταν **generated content χωρίς generator**: 80 committed JSON αρχεία (22.620 γραμμές) παραγμένα μια φορά από script που δεν υπήρξε ποτέ στο repo, και έκτοτε σάπιζαν. Καταργήθηκαν. Το pseudo παράγεται πλέον **runtime** από το `el` μέσω i18next postProcessor (`src/i18n/pseudo-post-processor.ts`, ~35 γρ.). Το `el` γίνεται **η μόνη πηγή**. Αποτέλεσμα: `npm run validate:i18n` **EXIT 1 → EXIT 0** (από 693 γραμμές σφαλμάτων σε καθαρό), κάλυψη pseudo **9/100 → 100/100 namespaces**, drift **δομικά αδύνατο**.

**Related:**
- **ADR-663** (DXF tsc ratchet) — **ίδιο archetype**: *a rule everyone believed was enforced, enforced by nothing*. Εκεί ο root `tsconfig` εξαιρούσε το subapp· εδώ το `validate:i18n` ήταν μόνιμα κόκκινο και **δεν καλούνταν από κανένα gate** (`grep` σε `scripts/git-hooks/pre-commit` + `.github/workflows/*.yml` → μηδέν).
- **ADR-280** (namespace splits) — τα 100 namespaces που το pseudo δεν πρόλαβε ποτέ.
- **ADR-665** — τα 7 κλειδιά `terrainAutoClip.*` που έλειπαν από το pseudo καλύπτονται πλέον αυτόματα· παύουν να είναι θέμα.

---

## Context

Ο **μόνος** λόγος ύπαρξης του pseudo locale είναι ένα σήμα: **«ελληνικό κείμενο στην οθόνη = hardcoded string»**. Το τεκμηριώνει και η Microsoft: *«Resources that haven't been exposed to localization are readily apparent because they won't be pseudo-translated.»*

Αυτό το σήμα ήταν **κατεστραμμένο**. Με 10.549 κλειδιά να λείπουν και 20 ολόκληρα namespace αρχεία ανύπαρκτα, ένα ελληνικό string σήμαινε είτε «hardcoded» είτε «λείπει από το pseudo» — **αδύνατο να ξεχωρίσεις**. Το εργαλείο δεν μετρούσε τίποτα.

### Τι βρέθηκε μετρημένα (2026-07-17)

| Εύρημα | Απόδειξη |
|---|---|
| **Το pseudo ήταν 95% φάντασμα** | `namespace-loaders.ts:228-232` είχε `getElLoader`/`getEnLoader` — **κανένα `getPseudoLoader`**. Κάθε lazy namespace → `null` → `lazy-config.ts:137-140` σιωπηλό fallback στο `el` → `lazy-config.ts:181` `addResourceBundle('pseudo', ns, elData)`. **91/100 namespaces έδειχναν ωμά ελληνικά.** Μόνο τα 9 static του `config.ts` δούλευαν. |
| **`validate:i18n` = νεκρό gate** | EXIT 1, 693 γραμμές σφαλμάτων, `PSEUDO: 16470/29468 (55.9%)`. Δεν καλούνταν από κανένα hook/workflow. **EL/EN parity ήταν ήδη 100%** — το failure ήταν αποκλειστικά pseudo. |
| **Ο κανόνας ήταν ανακτήσιμος** | `min(12, max(2, ceil(μήκος_χωρίς_κενά / 5)))` → **15.816/16.499**. |
| **Byte-identical = ανέφικτο ΚΑΙ ανεπιθύμητο** | **144 mismatches** (χειροκίνητες παρεμβάσεις· 30 από αυτά — όλο το `showcase` — **χωρίς wrapper καθόλου**, ωμά ελληνικά μέσα στο pseudo αρχείο) + **539 stale** (το `el` άλλαξε, το pseudo όχι). Το 100% byte-identical θα σήμαινε **αναπαραγωγή της σαπίλας**. |

Τα stale δεν ήταν κοσμητικά — έδειχναν **λάθος νόημα**:

| κλειδί | `el` (αλήθεια) | pseudo (τι έδειχνε) |
|---|---|---|
| `accounting:categories.income.construction_res_income` | Πωλήσεις Ακινήτων | Κατασκευαστικά (Οικιστικά) |
| `accounting:reports.taxDashboard` | Πίνακας Ελέγχου Φόρου | Dashboard Φόρου |
| `accounting-setup:reconciliation.batchAcceptAll` | Αυτόματη Αποδοχή Όλων | Αποδοχή Όλων Auto |

Η πρόθεση «generated» υπήρχε ήδη γραπτή: `scripts/check-icu-interpolation.sh:65` → `# Skip pseudo locale (generated)`. Ο generator απλώς δεν γράφτηκε ποτέ. **Committed pseudo = σαν commit του `dist/`: εξ ορισμού σαπίζει.**

---

## Decision

**Το pseudo δεν έχει resources. Παράγεται τη στιγμή του `t()`.**

Το `el` παραδίδεται από το **υπάρχον** fallback (`lazy-config.ts:139` → `config.ts` `fallbackLng: 'el'`) και ο postProcessor το τυλίγει. **Ο μηχανισμός που ήταν το bug έγινε ο μηχανισμός τροφοδοσίας** — γι' αυτό τα `lazy-config.ts` και `namespace-loaders.ts` **δεν άλλαξαν καθόλου**.

Ο postProcessor τρέχει **μετά** το ICU + interpolation, άρα τα `{count, plural, …}` / `{{var}}` έχουν ήδη επιλυθεί → το πρόβλημα «skip placeholders» (που ο Godot λύνει ρητά) το παίρνουμε **δωρεάν από τη σειρά εκτέλεσης**.

```ts
// src/i18n/pseudo-post-processor.ts
export function toPseudo(value: string): string {
  if (!value) return value;
  if (ALREADY_PSEUDO.test(value)) return value;          // idempotent
  const width = value.replace(/ /g, '').length;
  const tildeCount = Math.min(12, Math.max(2, Math.ceil(width / 5)));
  const tildes = '~'.repeat(tildeCount);
  return `[[${tildes} ${value} ${tildes}]]`;
}
```

### Γιατί όχι generator + build artifact (το αρχικά καταγεγραμμένο σχέδιο)

Το σχέδιο «generator → `predev`/`prebuild` → `.gitignore` → `git rm --cached`» απαιτούσε **σιωπηλά +100 dynamic imports** (`getPseudoLoader`) — αλλιώς παρήγαγε 100 αρχεία που 91 δεν θα φόρτωνε κανείς. Διατηρούσε επίσης την αλυσίδα «λάθος σειρά = σπασμένο fresh clone», 100 untracked αρχεία στον δίσκο, και έναν generator που **πρέπει** να τρέξει πριν από κάθε dev/build/test. Το runtime transform κάνει το πρόβλημα **να εξαφανιστεί** αντί να το μεταφέρει στο build.

### Γιατί όχι το `i18next-pseudo` package

Κάνει accents/vowel-doubling, **όχι** το καθιερωμένο μας `[[~~ … ~~]]`. Θα πρόσθετε dependency για 20 γραμμές λογικής που ήδη κατέχουμε. Ο Godot έχει το pseudoloc **στον πυρήνα** του — δεν κάνει `npm install`.

### Πρακτική μεγάλων παικτών (επαληθευμένο με πηγές, όχι από μνήμη)

| Παίκτης | Πρακτική |
|---|---|
| **Microsoft** | *«Pseudotranslation is an **automated transformation of source text**»* — transform, όχι δεδομένα |
| **Godot** (native engine, στον πυρήνα) | runtime transformation· toggle από project setting / `TranslationServer.pseudolocalization_enabled`· **μηδέν αρχεία** |
| **i18next** (το framework *μας*) | το επίσημο plugins page listάρει pseudolocalization ως **postProcessor** — το idiomatic answer |
| **Mozilla Fluent** | `--pseudo=accented` = runtime transform |

Σύγκλιση: **pseudo = transform, ΠΟΤΕ committed source.**

---

## Consequences

### Κερδίζουμε
- **`validate:i18n` EXIT 1 → EXIT 0 → CI gate.** Πρώτη φορά που μπορούσε να γίνει gate — **αυτό ήταν πάντα το ζητούμενο**· το pseudo ήταν το εμπόδιο. **Έγινε** (2026-07-17, βλ. Enforcement).
- **Κάλυψη 9/100 → 100/100 namespaces.** Τα DXF panels/ribbon που έδειχναν ωμά ελληνικά τυλίγονται πλέον.
- **0 stale, 0 drift — δομικά.** Δεν υπάρχουν δεδομένα να ξεσυγχρονιστούν.
- **−22.620 γραμμές**, −9 static imports από κάθε production bundle.
- **Το σήμα ξαναδουλεύει**: ελληνικό κείμενο σε pseudo mode = **σίγουρα** hardcoded string.

### Χάνουμε / Προσοχή
- **Τα 144 + 539 δεν αναπαράγονται** — σκόπιμα. Ήταν η σαπίλα, όχι δεδομένα. Πλήρης καταγραφή έγινε πριν τη διαγραφή.
- Ο ακριβής αριθμός tildes διαφέρει ελαφρώς για interpolated strings (το μήκος μετριέται **μετά** την επίλυση). Κοσμητικό: το wrapper είναι text-expansion simulation, κανείς δεν εξαρτάται από τον ακριβή αριθμό.

### Enforcement (αντί για σύμβαση)
Το `scripts/validate-i18n-config.js` **αντιστράφηκε**: από «απαιτεί pseudo imports» σε **«απαγορεύει `locales/pseudo/` + απαιτεί τον postProcessor»**. Επιστροφή σε committed pseudo = **error**.

Το `scripts/_shared/i18n-governance.js` διαχωρίζει πλέον ρητά δύο έννοιες που ταυτίζονταν:
- `SUPPORTED_LOCALES = ['el','en']` — locales **με αρχεία**
- `RUNTIME_ONLY_LANGUAGES = ['pseudo']` → `SUPPORTED_LANGUAGES` — **επιλέξιμες γλώσσες**

### Dev-only gate
Το `🧪 Pseudo (Dev)` διέρρεε σε **production χρήστες** από το `language-switcher.tsx` (ενώ το `PreferencesPageContent.tsx:78` το έκρυβε ρητά — ασυνέπεια). Πλέον πίσω από `NODE_ENV !== 'production'`, όπως το project setting του Godot.

---

## Verification

- **Regression lock πριν από κάθε διαγραφή**: τα 15.816 συνεπή ζεύγη εξήχθησαν και το test πέρασε **ενώ τα αρχεία υπήρχαν ακόμα**. Μόνο τότε `git rm`.
- **48/48 tests GREEN** (`src/i18n/__tests__/pseudo-post-processor.test.ts`). Fixture = **αντιπροσωπευτικό δείγμα 36 ζευγών σε 9 κλάσεις** (floor/cap/ICU plural/placeholders/μία λέξη/στίξη/αριθμοί/λατινικά+ελληνικά), αντλημένο από τα πραγματικά δεδομένα — **όχι** dump 2MB (θα ήταν ακριβώς το λάθος που καταργεί αυτό το ADR).
- **Mutation-verified ×3**: `CHARS_PER_TILDE` 5→6 → **22 fails**· μέτρηση **με** τα κενά → **12 fails**· cap 12→20 → **7 fails**. Revert → 48/48. Το suite δεν είναι διακοσμητικό.
- `validate:i18n` → **EXIT 0** (ήταν 1). `validate:i18n-config` **3 → 2 errors** (τα 2 προϋπάρχοντα: `textAi`/`dxf-viewer-dimensions` κ.λπ., άσχετα με pseudo — **δεν εισήχθη νέο**). `validate:i18n-manifest` **3 → 3** (αμετάβλητο).
- `jscpd:diff` σε 4 αρχεία → **0 clones** (N.18, χωρίς `SKIP_JSCPD_DIFF`).
- **ΟΧΙ tsc** (N.17).

### ⚠️ Εκκρεμεί browser verify
Switch σε 🧪 Pseudo → **κάθε** οθόνη τυλιγμένη, ειδικά DXF panels/ribbon που έδειχναν ωμά ελληνικά. **Ό,τι μείνει αμετάβλητο ελληνικό = πραγματικό hardcoded string** — και αυτό είναι πλέον αξιόπιστο εύρημα, όχι θόρυβος.

---

## Πρώτο εύρημα του ξαναζωντανεμένου εργαλείου (2026-07-17)

Στο **πρώτο** browser verify, η οθόνη Επαφών έδειξε `[[~~ Επιλέξτε ~~]] [[~~~ νομική μορφή ~~~]]` — **δύο ξεχωριστά wrappers δίπλα-δίπλα = concatenation**. Ακριβώς το σενάριο που η Microsoft ονομάζει ρητά: *«Concatenations will also be revealed by paired delimiters embedded in the displayed text.»* Το εργαλείο δούλεψε όπως έπρεπε, την πρώτη μέρα.

**Αιτία** — `GenericFormRenderer.tsx:89-94` + `IndividualFormRenderer.tsx:81-82` (δύο αντίγραφα):
```ts
`${resolveI18nKeyLabel('common.select', t)} ${resolveI18nKeyLabel(field.label, t).toLowerCase()}`
```
Δύο ανεξάρτητα `t()` κολλημένα με κενό: **κλείδωνε τη σειρά «ρήμα → ουσιαστικό» μέσα στον κώδικα** — καμία γλώσσα με άλλη σύνταξη δεν μπορούσε να τη διορθώσει. Το `.toLowerCase()` **κατέστρεφε ελληνικά ακρωνύμια**: «Κατάσταση ΓΕΜΗ» → «κατάσταση γεμη» (ορατό στο screenshot).

**Το σωστό κλειδί υπήρχε ήδη και κανείς δεν το χρησιμοποιούσε**: `common:forms.selectPlaceholder` = `"Επιλέξτε {label}"` / `"Select {label}"` — με ICU placeholder, δηλαδή η σειρά ανήκει στον μεταφραστή. Κλασικό N.0: το SSoT υπήρχε, ο κώδικας το παρέκαμπτε.

**Fix** — νέο pure SSoT `src/components/generic/i18n/select-placeholder.ts` (`buildSelectPlaceholder`), και οι δύο renderers δείχνουν σε αυτό. Η λογική βγήκε **έξω** από τα components: το import του `GenericFormRenderer` σε test τραβούσε την αλυσίδα μέχρι το `@firebase/auth` και έσκαγε — σήμα ότι το pure κομμάτι δεν ανήκε εκεί (ίδιο μοτίβο με το `band-stack-fit.ts` του ADR-584).

**Verification:** **7 νέα tests** με **πραγματικό i18next + ICU + τα πραγματικά locale αρχεία** (όχι mocks — αν λείψει/αλλάξει το κλειδί, πέφτουν). **118/118 GREEN** (`src/components/generic` + `src/i18n`). **Mutation-verified ×2**: επαναφορά `.toLowerCase()` → **3 fails**· επαναφορά concatenation → **3 fails**· revert → πράσινο. `jscpd:diff` 4 αρχεία → **0 clones**.

⚠️ **Καταγραφή, όχι σιωπή** — δύο εκκρεμότητες που εντοπίστηκαν και **δεν** διορθώθηκαν εδώ:
- **Διπλότυπο κλειδί**: το `common.select` = «Επιλέξτε» υπάρχει **και** στο `forms` **και** στο `contacts-core`. Μετά το fix κανένα από τα δύο δεν χρησιμοποιείται από τους renderers — υποψήφια για dead-key sweep, αλλά μπορεί να έχει άλλους καταναλωτές (θέλει grep πριν διαγραφή).
- **`ServiceFormRenderer.tsx:100`**: `selectPlaceholder: (field) => field.placeholder || field.label` — **δεν καλεί καθόλου `t()`**. Δεν είναι concatenation, είναι πιθανό untranslated placeholder. Διαφορετικό θέμα, δεν αγγίχθηκε.

---

## Changelog

- **2026-07-17** — **Το `validate:i18n` έγινε CI gate** — ο πραγματικός στόχος του ADR, εφικτός πρώτη φορά επειδή τα 80 pseudo JSON έπαψαν να το κρατούν σε EXIT 1. Υλοποίηση: **ένα step** στο υπάρχον `i18n-governance.yml` (Layer 2), όχι νέο workflow — το `validate-translations.js` είναι pure Node.js (253 γρ., μόνο `fs`/`path` + `_shared/i18n-governance`), άρα σέβεται τον σχεδιαστικό περιορισμό του workflow «καμία `pnpm install`, <30s». Προστέθηκαν `scripts/validate-translations.js` + `scripts/_shared/i18n-governance.js` στα paths filters (κενό: το υπάρχον glob `check-i18n-*.js` δεν έπιανε τον validator — αλλαγή στον ίδιο τον έλεγχο δεν τον ενεργοποιούσε). Επαληθεύτηκε με σκέτο `node` όπως στο CI: και τα 3 steps EXIT 0.
  - **Σκόπιμα ΜΟΝΟ το `validate:i18n`, ΠΟΤΕ το `i18n:check`**: το npm script `i18n:check` (package.json:99) πακετάρει `validate:i18n-config` (**2 προϋπάρχοντα errors**: `textAi`/`dxf-viewer-dimensions`) + `validate:i18n-manifest` (**3**) → θα έβαφε το workflow κόκκινο την πρώτη μέρα για λόγους άσχετους με πληρότητα μεταφράσεων. Τα 5 αυτά errors παραμένουν **ανοιχτά, καταγεγραμμένα, εκτός scope**.
  - **Δεν επικαλύπτεται με το CHECK 3.8**: το 3.8 πάει κώδικας→locale (`t('key')` χωρίς αντιστοιχία, ratchet baseline 4762)· το `validate:i18n` πάει locale→locale (EL/EN ισοτιμία, 29.472/29.472). Κανένα από τα δύο δεν βλέπει το κενό του άλλου.
  - ❌ Το `i18n-validation.yml.disabled` **ΔΕΝ αναστήθηκε** (τεκμηριωμένη απόρριψη): τρέχει `pnpm run typecheck` (υπάρχει ήδη `ts-error-gate.yml`), αφελής `grep '[Α-Ω]…'` για hardcoded χωρίς baseline (το CHECK 3.8 το αντικατέστησε), Node 18 + `pnpm install --frozen-lockfile` — δηλαδή ό,τι ακριβώς αποφεύγει by design το governance workflow. Είναι προγενέστερο της αρχιτεκτονικής ratchet· να μείνει θαμμένο.
- **2026-07-17** — Nested wrapping fix: το `buildSelectPlaceholder` περνά `t(field.label)` ως interpolation value, οπότε το ήδη τυλιγμένο label ξανατυλιγόταν μαζί με το «Επιλέξτε» (`[[~~~~~~~ Επιλέξτε [[~~~ Νομική Μορφή ~~~]] ~~~~~~~]]`). Η `toPseudo` ξετυλίγει πλέον εσωτερικά wrappers (`NESTED_PSEUDO`) πριν τυλίξει· το `ALREADY_PSEUDO` guard καταργήθηκε ως περιττό (το unwrap καλύπτει και το idempotency). **Η ανίχνευση concatenation ΔΕΝ επηρεάζεται**: η ένωση `t('a') + t('b')` γίνεται σε JS μετά τα `t()`, δεν ξαναπερνά ποτέ από τον postProcessor → τα δύο αδελφά wrappers παραμένουν ορατά (test το κλειδώνει). 4 νέα tests, **122/122 GREEN**, mutation-verified (αφαίρεση unwrap → 4 fails: 3 nested + idempotency· το concat test παραμένει πράσινο, αποδεικνύοντας ότι το σήμα είναι ανεξάρτητο του unwrap). `validate:i18n` EXIT 0, `jscpd:diff` 0 clones.
- **2026-07-17** — Πρώτο browser verify → το pseudo αποκάλυψε concatenation στα select placeholders (2 renderers). Fix: νέο SSoT `i18n/select-placeholder.ts` + χρήση του υπάρχοντος `common:forms.selectPlaceholder` με ICU placeholder· αφαίρεση `.toLowerCase()` που κατέστρεφε ακρωνύμια. 7 νέα tests (πραγματικό i18next+ICU), 118/118 GREEN, mutation-verified ×2, jscpd 0 clones.
- **2026-07-17** — ADR-666 δημιουργήθηκε. Pseudo locale: 80 committed αρχεία (22.620 γρ.) → runtime postProcessor 35 γρ. `validate:i18n` EXIT 1 → 0. Κάλυψη 9/100 → 100/100 namespaces. Enforcement αντιστράφηκε στο `validate-i18n-config.js`. Dev-only gate στο language switcher. 48/48 tests, mutation-verified ×3. Καταγραφή 144 mismatches + 539 stale + 10.549 missing keys ως τεκμήριο σαπίλας.
