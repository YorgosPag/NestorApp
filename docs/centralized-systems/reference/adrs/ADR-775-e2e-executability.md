# ADR-775 — **Εκτελεσιμότητα** της σουίτας e2e: «μπορεί να περάσει;» πριν το «περνάει;»

- **Κατάσταση**: 🟡 **Φάση 1 υλοποιημένη** 2026-08-08 — η **μηχανή** κρίσης (CHECK **3.46**, ZERO
  TOLERANCE). ⚠️ **ΔΕΝ είναι ακόμη συνδεδεμένη**: καμία εγγραφή σε pre-commit, κανένα npm script,
  καμία δοκιμή, κανένα workflow. Δες §7 — **η σύνδεση απαιτεί πρώτα τη θεραπεία των 5 ευρημάτων**,
  αλλιώς κάθε commit μπλοκάρει.
- **Προέκυψε από**: ADR-770 §13 (Στρώμα 2β) — εκεί καταγράφηκε ότι «κανένα workflow δεν τρέχει
  playwright» ως **παρατήρηση**· εδώ γίνεται **ερώτημα με απάντηση**.
- **Διορθώνει**: **ADR-770 §13** — ο αριθμός ήταν λάθος (§2 παρακάτω): **0/7**, όχι 7/7.
- **Σχετικά**: ADR-771 Φ.3 (SSoT `ts-read`), ADR-749 (μία μηχανή), ADR-757 (ιεράρχηση πυλών),
  ADR-587 §6.1 («anchor χωρίς gate είναι σχόλιο»).

> 🔑 **Σε μία γραμμή**: **369 tests σε 5 αρχεία δεν εκτελούνται πουθενά**, άρα κανείς δεν μαθαίνει
> αν *μπορούν* να περάσουν. Δεν έλειπε μια πύλη — **έλειπε η εκτέλεση**, και μια σουίτα που δεν
> τρέχει δεν έχει τρόπο να πει ότι είναι σπασμένη. Η πύλη ρωτά το προηγούμενο ερώτημα: **«μπορεί
> αυτή η σουίτα να περάσει;»**

---

## 1. Το μετρημένο γεγονός

Μετρημένο 2026-08-08:

```
5 spec αρχεία e2e         src/components/contacts/e2e/…               (1)
                          src/subapps/dxf-viewer/e2e/…                (3)
                          src/subapps/dxf-viewer/floorplan-background/… (1)
7 projects                playwright.config.ts
40 golden PNG             src/subapps/dxf-viewer/e2e/__snapshots__/
11 npm scripts            καλούν `playwright …`
 0 workflows              τρέχουν `playwright test`      ← το κενό
```

Η **μόνη** αναφορά playwright σε όλο το `.github/workflows/` είναι ένα `playwright install`
μέσα στο job του CHECK 3.40 (`ui-contrast-ratchet.yml:351`) — και το ίδιο το σχόλιο δίπλα του
(γρ. 346-348) το δηλώνει: *«ΚΑΝΕΝΑ workflow δεν έτρεχε ποτέ playwright σε αυτό το repo»*.

## 2. 🔴 Ο αριθμός του ADR-770 §13 ήταν λάθος — **0/7, όχι 7/7**

Το ADR-770 §13 δήλωσε ότι «τα **7** projects είναι δομικά σπασμένα, κανένα δεν θέτει
`userAgent`» και θα μπλοκαριστούν από το `headlesschrome` του `src/middleware.ts`.

**Μετρημένο: μηδέν από τα 7 μπλοκάρονται.** Τα device descriptors του Playwright **περιέχουν**
`userAgent` (τεκμηρίωση: *«The User Agent is included in the device and therefore you will rarely
need to change it»*), οπότε κάθε `...devices['Desktop Chrome']` στέλνει ήδη πραγματικό Chrome UA.

Η διάγνωση ήταν **σωστή για τον driver του 3.40** — εκείνος καλεί `newContext()` χωρίς descriptor
— και **λάθος γενικευμένη** στα projects του config.

⚠️ **Αυτό δεν ακυρώνει την πύλη· τη δικαιολογεί.** Η προστασία υπάρχει αλλά είναι **τυχαία**:
κανείς δεν αποφάσισε «τα e2e μας πρέπει να περνούν τον bot-blocker», προέκυψε επειδή κάποιος
ήθελε viewport. Μετρημένο με πραγματικό browser (headless chromium 143): σκέτο `newContext()`
⇒ `HeadlessChrome/143.0.7499.4` ⇒ ταιριάζει στο pattern `headlesschrome` ⇒ **403 χωρίς σώμα**.
Το επόμενο project που θα γραφτεί χωρίς descriptor το παθαίνει **σιωπηλά**.

## 3. 🔴 Η πραγματική βλάβη — **το golden δεν ξέρει ποιανού είναι**

Το default `snapshotPathTemplate` του Playwright είναι
`{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}-{platform}{ext}`.
Τα δύο tokens `{projectName}` και `{platform}` υπάρχουν **ακριβώς** επειδή *«screenshots differ
between browsers and platforms due to different rendering, fonts and more»*.

Το `playwright.config.ts` παρέκαμψε το default σε **δύο** projects (`visual-dxf`,
`visual-bim-3d`) και έσβησε **και τα δύο**:

```
src/subapps/dxf-viewer/e2e/__snapshots__/{testFilePath}/{arg}{ext}
                                                        ▲ κανένα {projectName}, κανένα {platform}
```

Συνέπεια, μετρημένη: **40 golden PNG** παραγμένα σε chromium/Windows, με ονόματα που **δεν το
λένε**. Τα projects `firefox` · `webkit` · `Mobile Chrome` · `Mobile Safari` **δεν έχουν
testMatch**, άρα τρέχουν κι αυτά τα ίδια visual tests και συγκρίνονται με τα **ίδια** αρχεία.
Και σε **Linux runner** αποτυγχάνει **ακόμα και το chromium**, γιατί λείπει και το `{platform}`.

Μια προεπιλογή που προστάτευε, παρακάμφθηκε χειροκίνητα, και **κανείς δεν το είδε επειδή κανείς
δεν έτρεξε δεύτερο project**.

## 4. Ο τρίτος τρόπος — **εντολή που δείχνει στο πουθενά**

Τρία npm scripts (`test:visual`, `test:visual:update`, `test:visual:headed`) καλούν
`playwright test e2e/grid-visual-regression.spec.ts` ενώ **δεν υπάρχει φάκελος `e2e/` στη ρίζα**
και το αρχείο δεν υπάρχει πουθενά. Το Playwright απαντά **«No tests found»**: μηδέν κάλυψη με
μήνυμα που μοιάζει διαδικαστικό.

⚠️ Το `test:cross-browser` δείχνει σε `e2e/visual-cross-browser.spec.ts` και **περνά** — γιατί το
Playwright ερμηνεύει τα ορίσματα ως **regex πάνω στο μονοπάτι**, και ταιριάζει το
`src/subapps/dxf-viewer/e2e/visual-cross-browser.spec.ts`. Γι' αυτό η κρίση της ομάδας Γ ρωτά
**«ταιριάζει κάπου;»** και όχι «υπάρχει το αρχείο;» — ένα κριτήριο ύπαρξης θα έβγαζε ψευδώς
θετικό εδώ.

## 5. Η κρίση — **τρεις ανεξάρτητες ομάδες, ποτέ μία με «ή»**

| | ερώτηση | βλάβη όταν σπάει |
|---|---|---|
| **Α** ταυτότητα πελάτη | «ο UA μου περνά τον **δικό μας** bot-blocker;» | **403 χωρίς σώμα** |
| **Β** ταυτότητα golden | «η εικόνα που συγκρίνω είναι **δική μου**;» | διαφορά που δεν είναι regression |
| **Γ** στόχος εντολής | «η εντολή τρέχει **κάτι**;» | «No tests found» = σιωπηλά μηδέν κάλυψη |

Κανένας δεν υποκαθιστά τον άλλο. **Ένας κανόνας με «ή» θα έμενε πράσινος πάνω σε δύο από τα
τρία** — το μάθημα του CHECK 3.41.

**Εννέα ρητές καταστάσεις**, καμία σιωπηλή τρίτη επιλογή:

| ομάδα | ⛔ μπλοκάρουν | ✅ δηλωμένα εντάξει |
|---|---|---|
| **Α** | `bot-blocked` · `agent-unresolved` | `agent-clear` |
| **Β** | `ambiguous-golden` | `golden-distinct` · `golden-default` |
| **Γ** | `phantom-target` | `target-resolved` · `whole-suite` |

**Κλειστή λογιστική, fail-closed**: κάθε project κρίνεται από **Α ΚΑΙ Β** (όχι «την πρώτη που
ταιριάζει»), και το `assertBalanced` **σκάει** αν οι δύο ομάδες δεν έκριναν **ακριβώς** όσα
projects υπάρχουν. Άγνωστη κατάσταση ⇒ `throw` **με όνομα**. Πρότυπο: το `auditPalette` του
CHECK 3.39, όπου η `Μμ7` απέδειξε ότι κάδος που **δηλώνεται αλλά δεν ασκείται ποτέ** είναι
φρουρός χωρίς απόδειξη ζωής, και το «0» του διαβάζεται ως «κοίταξα και δεν υπάρχουν».

## 6. Τι **δεν** γράφτηκε, και γιατί είναι σωστό

**α) Κανένα αντίγραφο των `BLOCKED_BOT_PATTERNS`.** Διαβάζονται από το `src/middleware.ts` με
AST. Είναι **κώδικας ασφαλείας** και αλλάζει για λόγους άσχετους με τα e2e (νέος crawler, νέος
scanner)· ένα αντίγραφο θα απέκλινε **σιωπηλά** την πρώτη φορά, και η πύλη θα έλεγε «πράσινο»
για σουίτα που πλέον παίρνει 403. Είναι το σχήμα των **δύο** χειρόγραφων λιστών namespace του
CHECK 3.34 (απόκλιναν κατά **63**) και της χειρόγραφης λίστας **18/26** του CHECK 3.37.

**β) 🔴 Κανένα `playwright test --list --reporter=json`.** Το προφανές — «ρώτα το ίδιο το εργαλείο
για τη **λυμένη** ρύθμιση», όπως το CHECK 3.42 ρωτά το `resolveConfig` του Tailwind —
**δοκιμάστηκε και απορρίφθηκε με μέτρηση**: ο JSON reporter εκθέτει `config.projects[].name`
αλλά το **`use` έρχεται ΚΕΝΟ** (playwright 1.57.0). Πύλη χτισμένη πάνω του θα απαντούσε «κανένα
project δεν έχει userAgent» σε **κάθε** εκτέλεση — δηλαδή **7 ψευδώς θετικά**, ή με το κριτήριο
ταιριάσματος **«0 παραβιάσεις, πάντα»**. Η **όγδοη** εμφάνιση του «0 = κανείς δεν κοίταξε»,
γραμμένη από εμάς, μέσα στο όργανο που το κυνηγά.

**γ) Καμία νέα μηχανή ανάγνωσης AST.** Καταναλώνεται το `scripts/lib/contrast-promise/ts-read.js`
(ADR-771 Φ.3) — `parseSource` / `initializerOf`.

**δ) Καμία λίστα device descriptors.** Η αυθεντία του UA είναι η **εγκατεστημένη** βιβλιοθήκη
(`require('@playwright/test').devices`), ώστε αναβάθμιση να μη γεννά απόκλιση. Στις δοκιμές
ενίεται πίνακας descriptors, άρα το module φορτώνεται και **χωρίς** εγκατεστημένο playwright.

## 7. ⚠️ Τι **δεν κάνει** — δηλωμένο

- **Δεν τρέχει** τα tests και **δεν** κρίνει αν περνούν. Απαντά μόνο «**μπορούν;**».
- **Δεν** ελέγχει ότι υπάρχει golden για την πλατφόρμα του runner — αυτό είναι ερώτημα
  **εκτέλεσης**, όχι ρύθμισης.
- **Δεν** αγγίζει το `src/middleware.ts`: το διαβάζει ως **αυθεντία**. ⚠️ **ΜΗΝ** αφαιρέσεις
  pattern από το middleware για να γίνει πράσινη η πύλη — η διόρθωση είναι στην πλευρά του e2e.

## 8. Κατάσταση σήμερα — **5 ευρήματα, όλα πραγματικά**

```
node scripts/check-e2e-executability.js --verbose
```

```
⛔ ambiguous-golden  2   visual-dxf · visual-bim-3d
⛔ phantom-target    3   test:visual · test:visual:update · test:visual:headed
✅ agent-clear       7   και τα 7 projects περνούν τον bot-blocker (§2)
✅ golden-default    5
✅ target-resolved   3
✅ whole-suite       4
```

## 9. Φάσεις

| Φάση | Τι | Κατάσταση |
|---|---|---|
| **Φ1** | Η μηχανή: `check-e2e-executability.js` + `lib/e2e-executability/{bot-patterns,project-identity,verdicts}.js` | ✅ **αυτό το commit** |
| **Φ2** | **Θεραπεία**: `{projectName}`+`{platform}` στα 2 πρότυπα + **μετονομασία των 40 golden** · διόρθωση/διαγραφή των 3 phantom scripts | ⬜ εκκρεμεί |
| **Φ3** | Δοκιμές (`npm run test:e2e-executability`, μεταλλάξεις + Μ0) + npm script + εγγραφή στο `run-checks-parallel.js` ως **CHECK 3.46** | ⬜ εκκρεμεί |
| **Φ4** | Layer 2 σε **υπάρχον** workflow (⚠️ **ΟΧΙ νέο** — νέο απαιτεί εγγραφή στο `.ci-gate-tiers.json`, αλλιώς μπλοκάρει το CHECK 3.37) | ⬜ εκκρεμεί |
| **Φ5** | Το ερώτημα που **μένει ανοιχτό**: ποιο workflow **εκτελεί** επιτέλους `playwright test`; Η πύλη λέει «μπορεί να περάσει» — δεν λέει «περνάει». | ⬜ εκκρεμεί |

🔴 **Η σειρά είναι δεσμευτική**: η Φ3 **μετά** τη Φ2. Η πύλη είναι **ZERO TOLERANCE** και σήμερα
**κόκκινη** — σύνδεση στο pre-commit πριν τη θεραπεία μπλοκάρει **κάθε** commit του repo.
⚠️ **ΜΗΝ** τη «λύσεις» με baseline: το ratchet θα κλείδωνε τα 5 ευρήματα ως **αποδεκτά**, δηλαδή
θα μετέτρεπε την ερώτηση «μπορεί να περάσει;» σε «μπορούσε χθες;» — και η απάντηση και στα δύο
είναι **όχι**.

## 10. Αρχεία

| Αρχείο | Ρόλος | Γρ. |
|---|---|---|
| `scripts/check-e2e-executability.js` | CLI + αναφορά | 147 |
| `scripts/lib/e2e-executability/bot-patterns.js` | **αυθεντία** «ποιος μπλοκάρεται» ← `src/middleware.ts` | 99 |
| `scripts/lib/e2e-executability/project-identity.js` | ταυτότητα project: πραγματικός UA + πρότυπο golden | 216 |
| `scripts/lib/e2e-executability/verdicts.js` | **η κρίση**: 3 ομάδες / 9 καταστάσεις / κλειστή λογιστική | 206 |

Escape (όταν συνδεθεί): `SKIP_E2E_EXECUTABILITY=1`

---

## Changelog

- **2026-08-08** — Φ1: η μηχανή. Τεκμηρίωση της διόρθωσης του ADR-770 §13 (**0/7**, όχι 7/7) και
  της πραγματικής βλάβης (**40 golden χωρίς ταυτότητα project/πλατφόρμας**). Η πύλη **δεν είναι
  ακόμη συνδεδεμένη** — δες §9.
