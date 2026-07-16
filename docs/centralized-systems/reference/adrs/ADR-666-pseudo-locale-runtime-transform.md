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
- **`validate:i18n` EXIT 1 → EXIT 0.** Πρώτη φορά που μπορεί να γίνει gate — **αυτό ήταν πάντα το ζητούμενο**· το pseudo ήταν το εμπόδιο.
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

## Changelog

- **2026-07-17** — ADR-666 δημιουργήθηκε. Pseudo locale: 80 committed αρχεία (22.620 γρ.) → runtime postProcessor 35 γρ. `validate:i18n` EXIT 1 → 0. Κάλυψη 9/100 → 100/100 namespaces. Enforcement αντιστράφηκε στο `validate-i18n-config.js`. Dev-only gate στο language switcher. 48/48 tests, mutation-verified ×3. Καταγραφή 144 mismatches + 539 stale + 10.549 missing keys ως τεκμήριο σαπίλας.
