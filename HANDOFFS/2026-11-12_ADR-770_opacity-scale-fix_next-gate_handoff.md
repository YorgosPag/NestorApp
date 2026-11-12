# Handoff — ADR-770 · διαφάνεια `/12` που δεν παράγεται · επόμενο: ΠΥΛΗ «διαφάνεια εκτός κλίμακας»

**Ημερομηνία:** 2026-11-12
**Worktree:** `C:\Nestor_Worktrees\pea-sold-truth` · **Κλαδί:** `agent/pea-sold-truth`
**Η νέα συνεδρία συνεχίζει στο ΙΔΙΟ worktree.**

---

## 1. Κατάσταση

- **Ζωντανό** (`0b404fb`, land+push με εντολή Giorgio): θεματικό `--hue-purple` (φωτεινό `271 76% 44%` ·
  σκοτεινό `270 95% 75%`) · `COLOR_BRIDGE.text.purple` / `.pink` θεματικά · `STAT_TONE_ICON_BG` στο
  `src/design-system/stat-tone.ts` · `--status-purple` έφυγε ως μελάνι από NavigationCard / QuickActionsStrip /
  SalesSidebar / ModuleBreadcrumb. Ζωντανή μέτρηση: όλα τα μελάνια ≥5,23 (εικονίδια) και ≥4,60 (κείμενο σε hover).
  Λεπτομέρειες: `ADR-770-ui-contrast-gate.md` §11 (γραμμές 2026-11-12).
- **Land + push ΕΓΙΝΑΝ (εντολή Giorgio), deploy σε εξέλιξη**: διόρθωση `/12` → `/10` σε 7 σημεία
  (`stat-tone.ts` ×2 · `NavigationCard.tsx` ×4 · `QuickActionsStrip.tsx` ×1) + γραμμή ADR-770 §11 —
  commit κλαδιού `352e07a4` → τοπικό main **`aec900e2`** → push `0de6dc9e..aec900e2`.

## 1α. ΒΗΜΑ 1 της νέας συνεδρίας — ζωντανή επαλήθευση (όταν ο Giorgio πει ότι τελείωσε το deploy)

1. Έλεγχος git: `git merge-base --is-ancestor aec900e2 <live-sha του μηνύματος deploy>`.
2. **Μόνο με «ναι» για browser** (μόνο ανάγνωση): στο nestorconstruct.gr, ότι ο κανόνας
   `bg-[hsl(var(--hue-purple))]/10` (και `--hue-pink/10`, `--hue-indigo/10`, `--hue-teal/10`) **υπάρχει** στα
   `document.styleSheets` και ότι το φόντο του τσιπ **ΔΕΝ** είναι `rgba(0,0,0,0)`, και στα δύο θέματα:
   - Αναφορές `/o/<companyId>/reports` → τσιπ εικονιδίου «Ποσοστό Είσπραξης» (purple)
   - Dashboard `/o/<companyId>/dashboard` (από `/home`) → NavigationCard «Έργα» (purple) · «Λογιστικό» (pink) ·
     QuickActionsStrip «Νέο Έργο» (purple, κείμενο — ≥4,5:1 σε ηρεμία ΚΑΙ hover `/20`)
   - Μέθοδος: δες §5 (μεταβάσεις CSS OFF + δύο frames). Κλείσε την καρτέλα στο τέλος.
3. Γράψε το αποτέλεσμα στο ADR-770 §11 (νέα γραμμή), commit στο κλαδί με ρητή λίστα.

## 2. Το εύρημα (γιατί χρειάζεται πύλη)

Ο Tailwind **3.4** (`package.json` `^3.4.0`, το `tailwind.config.ts` δεν επεκτείνει το `opacity`) παράγει
modifier διαφάνειας **μόνο** για βήματα της κλίμακας (0·5·10·15·20·25·…·100). Το `bg-[…]/12` **πετιέται
σιωπηλά**: καμία προειδοποίηση στο build, κανένα σφάλμα, απλώς διάφανο φόντο. Επιβεβαιώθηκε ζωντανά (ο κανόνας
έλειπε από τα `document.styleSheets`, ενώ το `hover:…/20` υπήρχε). Το `/12` στο `NavigationCard` υπήρχε **από
πριν** (pink/indigo/teal/status-purple) — δεν αποδόθηκε **ποτέ**, και καμία από τις 105 πύλες δεν το είδε.
Εκτός κλίμακας, η σωστή γραφή είναι `/[0.12]`.

## 3. ΒΗΜΑ 2 — ΠΥΛΗ (μπορεί να ξεκινήσει ΟΣΟ περιμένουμε το deploy· «ναι» του Giorgio = δόθηκε για την πύλη)

Πριν από κώδικα: πραγματικό SSoT audit με `git grep` (υπάρχει ήδη έλεγχος κλάσεων Tailwind; π.χ. CHECK 3.42
`scripts/check-tailwind-theme-classes-ratchet.js`, CHECK 3.23 native-tooltip AST, `tailwind-hardcoded-palette`
στο `.ssot-registry.json`) — **επέκτεινε** υπάρχον εργαλείο αν ταιριάζει, ΜΗΝ φτιάξεις δεύτερη μηχανή.
Αν αβέβαιος για το πώς το λύνουν οι μεγάλοι (π.χ. ESLint `eslint-plugin-tailwindcss` `no-custom-classname`,
Tailwind IntelliSense «unknown class») → έρευνα στο διαδίκτυο πριν αποφασίσεις.
⚠️ Κανένα test / πύλη / tsc χωρίς **ρητή** έγκριση — ρώτα πριν τα τρέξεις.

Ερώτηση της πύλης: «γράφει κάποιος modifier διαφάνειας που ο Tailwind **ΔΕΝ** θα παραγάγει;»
1. ADR: επόμενος ελεύθερος αριθμός με `ls docs/centralized-systems/reference/adrs/` (ΜΗΝ εμπιστευτείς αριθμό).
2. Αυθεντία της κλίμακας = **ο ίδιος ο Tailwind** (`resolveConfig(tailwind.config).theme.opacity`), ΟΧΙ
   χειρόγραφη λίστα — αλλιώς επέκταση του config θα έδινε ψευδώς θετικά.
3. Σάρωση `src/**/*.{ts,tsx}` για `<utility>/<N>` όπου N ∉ κλίμακα και δεν είναι `[…]`. Πρώτα **μέτρα** πόσα
   υπάρχουν σήμερα (`git grep -nE '/(1[1-46-9]|[2-9][1-46-9]|[0-9]?[1-46-9])\b'` είναι μόνο αφετηρία — θα έχει
   θόρυβο από paths/κλάσματα· η πύλη πρέπει να κρίνει **μέσα σε string κλάσης**, όχι regex σε όλο το αρχείο).
4. Πρότυπο υλοποίησης: δες `scripts/check-tailwind-theme-classes-ratchet.js` (CHECK 3.42) +
   `scripts/lib/ratchet-baseline.js` (`runSetRatchetCli`) — ZERO-TOL ή RATCHET ανάλογα με το πόσα βρεθούν.
5. Εγγραφή στο μητρώο πυλών (CHECK 3.66: `docs/gates/3.NN.md` + γεννήτορας, ΠΟΤΕ χειρόγραφη γραμμή στο CLAUDE.md).
6. Tests (μετάλλαξη: `/12` → κόκκινο · `/10` και `/[0.12]` → πράσινο).

## 4. Κανόνες (Giorgio)

- Commit μόνο στο `agent/pea-sold-truth` με ρητή λίστα αρχείων — **ΠΟΤΕ στο main**.
- `wt:land` και push **ΜΟΝΟ** με εντολή Giorgio· πριν: έλεγχος για land/push άλλου πράκτορα
  (`C:\Nestor_Pagonis\.git\agent-worktree-land.lock`) και αναμονή.
- Κανένα test / πύλη / tsc χωρίς έγκριση. Καμία αποστολή email. Browser: μόνο ανάγνωση, μόνο αν εγκριθεί.
- Απαντήσεις πάντα στα ελληνικά.

## 5. Μην

- Μην ξαναμετρήσεις τα μελάνια purple/pink — έγινε ζωντανά, είναι στο ADR-770 §11.
- Μετρώντας ζωντανά με εναλλαγή θέματος: **απενεργοποίησε τις μεταβάσεις CSS** (`*{transition:none!important}`)
  και περίμενε δύο frames — αλλιώς διαβάζεις χρώματα του προηγούμενου θέματος (συνέβη, απορρίφθηκε).
- Ανοιχτό, εκτός εντολής: `src/lib/design-system.ts:87` (`'status-purple'.text` = `--status-purple` ως μελάνι) ·
  reseed της `.theme-classes-baseline.json` (CHECK 3.42) — και τα δύο μόνο με «ναι».
