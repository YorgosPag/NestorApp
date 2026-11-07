# Handoff — ADR-923 Wave 4 · L7: δημόσια ορατότητα καταλόγου (κανόνας + ένδειξη «ορατά δημόσια X από Y»)

**Ημερομηνία:** 2026-11-07
**Worktree:** `C:\Nestor_Worktrees\adr-923-wave4`
**Κλαδί:** `agent/adr-923-wave4`
**Παραγωγή:** `live 839a9b4` (Netcup, deploy επιβεβαιωμένο, firebase-apply skipped)

## 1. Τι έγινε σε αυτή τη συνεδρία

- **Ρίζα #1 (διορθώθηκε, live 839a9b4):** το `publishSupplierShowcase` έγραφε μόνο το `supplier_showcases`, χωρίς να γράψει έγγραφο στο `catalog_public_outbox`.
  - Αποτέλεσμα: κατάλογος γραμμένος πριν από το outbox (`bd214d3c`, 2026-11-03) δεν προβαλλόταν ποτέ.
  - Η σάρωση έτρεχε πράσινη χωρίς δουλειά: `cron_job_state/public-catalog-sweep`, 0 αποτυχίες.
  - Διόρθωση στο `src/server/catalog/supplier-showcase.server.ts`: η συναλλαγή καλεί τον υπάρχοντα `signalPublicScopesInTx(tx, db, companyId, [PUBLIC_CATALOG_SCOPE])`.
  - Commit `839a9b43`, μαζί με γραμμή στο changelog του ADR-923. `wt:land` + push με εντολή του Giorgio.
- **Δείκτες outbox:** αναπτυγμένοι στο `pagonis-87766`. Ελέγχθηκε με `firebase firestore:indexes`, μόνο ανάγνωση.
- Το `/sitemap.xml` της ρίζας επιστρέφει HTML. Το sitemap του καταλόγου είναι το **`/suppliers/sitemap.xml`**.
- **Προφίλ παρόχου:** περιγραφή ΕΛ/EN αποθηκεύτηκε από το UI, με έγκριση του Giorgio. Η αποθήκευση έβαλε τον `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` στη σάρωση.
  - Προσοχή: η «Δημοσίευση βιτρίνας» **δεν** ξαναπατιέται όταν η βιτρίνα είναι ήδη δημοσιευμένη (`review.canPublish`, `SupplierVerificationPanel.tsx:111`).
- **Σάρωση 11:55 (Firebase Console, μόνο ανάγνωση):**
  - Το outbox `catalog` έχει `seenCondition: "open"`, `fullPassAtMs`, `drainedRevision 1`.
  - Το πέρασμα σημείωσε `model:cpmod_ee06d5c3-286f-4113-825d-5a4f6e531f80` και `model:cprod_356371c5-2554-45a9-9cf9-a882ff1548a8`, και τα δύο άδειασαν (`dirty: false`).
  - Το **`public_catalog_models` είναι ακόμη ΑΔΕΙΟ** και τα 4 QR δίνουν 307 `no-store` → `/suppliers/_`.
- **Ρίζα #2 (ανοιχτή, απόφαση κατόχου, όχι σφάλμα):** το `projectPublicModel` δημοσιεύει μόνο ό,τι βλέπει ο **ανώνυμος**. Η κρίση είναι η `judgeVisibility`, με `ANONYMOUS = { kind: 'anonymous' }`.
  - Η προεπιλογή είναι `DEFAULT_CATALOG_VISIBILITY = 'hidden'` (`src/subapps/catalog/vocabulary/pricing.ts:98`).
  - Στο `catalog_visibility_rules` υπάρχουν 3 κανόνες. Όλοι έχουν `audience.kind: "partner"` (`cont_3ce4b8db-3eb1-435e-9542-ffe0a6a83965`), subject `variant`, και τιμές `hidden` · `visibleNoPrice` · (3ος δεν διαβάστηκε ολόκληρος). **Κανένας** δεν αφορά το `anonymous`.

## 2. Απόφαση Giorgio

«Αν μπορείς, κάνε και τα δύο, αλλιώς το πιο επαγγελματικό». Ποιότητα επιπέδου Revit / ArchiCAD / Figma / Zillow / Idealista, έρευνα στο διαδίκτυο όπου υπάρχει αμφιβολία, πλήρες SSoT.

Έρευνα που ήδη έγινε:
- **Akeneo:** ρητή ενεργοποίηση ανά κανάλι, με πληρότητα ανά κανάλι.
- **Πλατφόρμες B2B:** ο επισκέπτης βλέπει τα προϊόντα, η τιμή μένει πίσω από σύνδεση ή αίτημα προσφοράς.
- Καμία πηγή ειδικά για κατασκευαστές δομικών υλικών.

## 3. ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ (με τη σειρά)

### Α. Ο κανόνας (δεδομένα, όχι κώδικας)
1. Πρόταση: κανόνας για **όλο τον κατάλογο**, κοινό `anonymous` → **`visibleNoPrice`**.
   - Τα προϊόντα και το QR γίνονται δημόσια, οι τιμές μένουν πίσω από σύνδεση ή αίτημα προσφοράς.
   - Οι κανόνες του συνεργάτη εξακολουθούν να ισχύουν, γιατί είναι πιο ειδικοί και κερδίζουν στην `selectMostSpecific`.
   - **Πριν από την ενέργεια:** επιβεβαίωσε με τον Giorgio αν θα δημιουργήσει τον κανόνα ο πράκτορας από το UI (Chrome) ή ο ίδιος. Στο UI ο κανόνας μπαίνει στο `/o/<ws>/catalog/discounts` → `VisibilityRulesPanel`. Το `/o/comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757/...` λειτουργεί ως segment χώρου.
   - Έλεγξε αν το UI δέχεται subject «όλος ο κατάλογος» και κοινό `anonymous`. Αν όχι, **ρώτα** και μην αυτοσχεδιάσεις.
2. Η γραφή κανόνα ορατότητας λερώνει τα σχετικά scopes (`scopesOfVisibilityRule` στο `public-scopes-of-write.ts`). Περίμενε την επόμενη σάρωση (λεπτά :03/:13/:25/:36/:45/:55).
3. Επαλήθευση:
   - curl με User-Agent browser στα `/Q/P1NCDRWA9AM8PMSSYD8GBZHAJ58`, `/q/cprod_356371c5-2554-45a9-9cf9-a882ff1548a8`, `/Q/M7E0VAW6A3F849R4QAT9XQ567W0`, `/q/cpmod_ee06d5c3-286f-4113-825d-5a4f6e531f80`. Αναμένεται 307 `no-store` → σελίδα προϊόντος, ίδιο αποτέλεσμα για σύντομη και μακριά μορφή.
   - `/suppliers/sitemap.xml` με URL μοντέλων.
   - Η σελίδα του προμηθευτή δείχνει προϊόντα **χωρίς τιμές**.
   - Το `public_catalog_models` έχει 2 έγγραφα.
4. Μετά: σελίδα `/w/<έργο>` (Ν11 στ, πιθανόν δεν υπάρχει ακόμη έργο portfolio, **ρώτα**). Ο Giorgio σαρώνει τα QR με iPhone και Android και ανοίγει το IDML (διανυσματικό QR, quiet zone ≥ 4, ~20,5 mm, 100% K).

### Β. Η ένδειξη «Δημόσια ορατά: X από Y — γιατί» (κώδικας, μετά το Α)
- Στόχος: να μη ξαναγίνει «βιτρίνα δημοσιευμένη με 0 ορατά προϊόντα» χωρίς καμία ενημέρωση. Η πρόταση πηγαίνει πιο πέρα από το Akeneo, γιατί απαντά και στο «γιατί δεν φαίνεται».
- Θέση: το πάνελ «Επιβεβαίωση προμηθευτή» (`src/components/catalog/settings/SupplierVerificationPanel.tsx`), με σύνδεσμο προς τους κανόνες ορατότητας.
- **SSoT:** ο αριθμός Y είναι τα μοντέλα ρίζας, με το ίδιο ερώτημα που χρησιμοποιεί το `public-catalog-pass.server.ts` (`rootPage`). Ο αριθμός X είναι όσα έχουν τουλάχιστον ένα SKU ορατό στο `anonymous`, με την **ίδια** `judgeVisibility` / `projectPublicModel`, ποτέ δεύτερος υπολογισμός. Εναλλακτικά, ως «ήδη δημοσιευμένα», μέτρηση του `public_catalog_models` ανά `companyId` μέσω του `public-catalog.reader.ts`, που είναι ο μόνος αναγνώστης κατά την CHECK 3.112.
- **Πρώτα σχέδιο:** Plan Mode, γιατί αγγίζονται 3+ αρχεία. Πραγματικό SSoT audit με grep. Ενημέρωση ADR-923 (Φάση 1, ADR πριν από τον κώδικα). Τα κλειδιά i18n μπαίνουν σε el και en. Καμία συμβολοσειρά γραμμένη απευθείας στον κώδικα.
- Το κόστος πρέπει να μείνει χαμηλό: το πλήθος μοντέλων μπορεί να είναι πολλές χιλιάδες. Η μέτρηση γίνεται είτε σε σελίδες/aggregate, είτε σε πεδίο που γράφει η σάρωση στο outbox `catalog` στο τέλος του περάσματος. Το δεύτερο είναι μάλλον το καλύτερο, γιατί ένα σημείο κατέχει τον αριθμό. Προτίνεται στον Giorgio πριν γίνει.

## 4. ΜΗΝ
- ΜΗΝ κάνεις commit στο `main`. ΜΗΝ τρέξεις `wt:land` ή push χωρίς ρητή εντολή του Giorgio.
- ΜΗΝ τρέξεις jest ή tests χωρίς έγκριση. Εκκρεμεί πρόταση για test στο `src/server/catalog/__tests__/supplier-showcase.test.ts`: η δημοσίευση γράφει outbox με `scope: 'catalog'`.
- ΜΗΝ τρέξεις tsc. ΜΗΝ χρησιμοποιήσεις `--no-verify`.
- ΜΗΝ αλλάξεις το `DEFAULT_CATALOG_VISIBILITY` (`hidden` = ρητή ενεργοποίηση, σύμφωνο με το Akeneo και το ADR-923 §12).
- ΜΗΝ γράφεις στο Firebase Console. Μόνο ανάγνωση. Ο Firestore MCP αποτυγχάνει να ξεκινήσει στο worktree (✗ στο `/mcp`). Η ανάγνωση γίνεται από το Console μέσω Chrome (`https://console.firebase.google.com/u/0/project/pagonis-87766/firestore/databases/-default-/data/~2F<συλλογή>~2F<id>`, κείμενο με `javascript_tool` → `document.querySelector('main').innerText`).
- Σε controlled textarea **ΜΗΝ** χρησιμοποιείς `computer type`: το κείμενο βγήκε ανακατεμένο. Χρησιμοποίησε `form_input` και επαλήθευσε την τιμή πριν πατήσεις Αποθήκευση.
- ΜΗΝ κάνεις `wt:remove` χωρίς εντολή.

## 5. Ανοιχτά από παλαιότερα handoff (αμετάβλητα)
- Ορφανό worktree `agent-a4aa1ef33828efaf9` (πρόταση: απόρριψη).
- Πρόταση refine στο `catalog-import.schema.ts`.
- Αποφάσεις Α1 / Ν6 / Ν8 / Ν9β / Ν12.
