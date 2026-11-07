# Handoff — ADR-923 Wave 4 · L7 ζωντανή επαλήθευση (μέρος 2)

**Ημερομηνία:** 2026-11-07
**Worktree:** `C:\Nestor_Worktrees\adr-923-wave4`
**Κλαδί:** `agent/adr-923-wave4`
**Παραγωγή:** `live b324537` (Netcup, deploy επιβεβαιωμένο από τον Giorgio, 54″, firebase-apply skipped)

## 1. Τι έγινε (στο main, pushed `b3245370`)

- **Ρίζα που βρέθηκε ζωντανά:** η βιτρίνα ήταν δομικά κλειστή.
  - `src/server/catalog/public/public-standing.server.ts`: ο `readLiveSupplierStanding` ήταν stub που απαντούσε πάντα `unknown`.
    - Τώρα δένει στον υπάρχοντα `readSupplierStandingOutcome` (`supplier-review.server.ts`), την ίδια κρίση που ανοίγει τη βιτρίνα. Διαβάζει μόνο Firestore.
  - `src/config/cron-schedule.ts`: το `public-catalog-sweep` ήταν `enabled:false`.
    - Τώρα είναι `enabled:true` με `3,13,25,36,45,55 * * * *`, maxRuntime 2′, lease 5′, check-in 10′.
    - Κανένα επαναλαμβανόμενο λεπτό δεν μοιράζεται με άλλη εργασία (το :33 ανήκει στο `33 9-18 * * 1-5`).
- Τα changelog των ADR-923 και ADR-740 γράφτηκαν (2026-11-07).
- Βιτρίνα προμηθευτή δημοσιευμένη (`comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`).
  - Η έγκριση έγινε ως ΔΟΚΙΜΗ, παρόλο που η μορφή δεν ταιριάζει: Α.Ε. έναντι ατομικής επιχείρησης.
- Το `areaServed` επαληθεύτηκε ζωντανά: 18 `AdministrativeArea` (Ν11 ε ✅).
- Τα QR (σύντομο και μακρύ) δίνουν **ίδιο** 307 με `no-store`. Πριν το fix ο στόχος ήταν το `/suppliers/_`, επειδή τίποτα δεν είχε προβληθεί.
- Το CHECK 3.86 είπε ότι κανόνες και δείκτες δεν άλλαξαν από το deploy της 2026-10-27. Η ανάπτυξη των δεικτών του `catalog_public_outbox` **δεν έχει επιβεβαιωθεί ζωντανά**.

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ (με τη σειρά)

1. Περίμενε να τρέξει τουλάχιστον μία φορά το cron της σάρωσης μετά το `live b324537` (λεπτά :03/:13/:25/:36/:45/:55).
2. curl με User-Agent browser (χωρίς αυτόν η παραγωγή μπορεί να δώσει 403) στα:
   - `https://nestorconstruct.gr/Q/P1NCDRWA9AM8PMSSYD8GBZHAJ58`
   - `https://nestorconstruct.gr/q/cprod_356371c5-2554-45a9-9cf9-a882ff1548a8`
   - `https://nestorconstruct.gr/Q/M7E0VAW6A3F849R4QAT9XQ567W0`
   - `https://nestorconstruct.gr/q/cpmod_ee06d5c3-286f-4113-825d-5a4f6e531f80`

   **Αναμένεται:** 307, `Cache-Control` με no-store, `Location` στη σελίδα προϊόντος (όχι `/suppliers/_`), και ίδιος στόχος για σύντομη και μακριά μορφή.
3. Αν ο στόχος είναι ακόμη `/suppliers/_`: διάγνωση **χωρίς υποθέσεις**.
   - Έτρεξε το cron; Δες τα log του dispatcher και του `/api/cron/public-catalog-sweep`.
   - Έχει έγγραφα το `public_catalog_models`; Υπάρχει `FAILED_PRECONDITION` (δείκτης outbox);
   - Ο Firestore MCP ήταν αποσυνδεδεμένος· ζήτα από τον Giorgio να τον ξανασυνδέσει αν χρειαστεί.
4. Sitemap: `/sitemap.xml` πρέπει να περιέχει τα URL των μοντέλων. Η cache του sitemap μπορεί να είναι έως 5′ μπαγιάτικη.
5. Σελίδα έργου portfolio `/suppliers/comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757/w/<project>` (Ν11 στ).
   - Ίσως να μην υπάρχει ακόμη έργο portfolio. Πριν από οτιδήποτε, έλεγξε τι υπάρχει και ρώτα τον Giorgio.
6. Giorgio: σάρωση του QR της κάρτας με iPhone και Android, και άνοιγμα του IDML στο InDesign. Τι ελέγχει:
   - το QR είναι διανυσματικό, όχι εικόνα
   - είναι μέσα στο κελί της κάρτας, με quiet zone ≥ 4 modules
   - ~20,5 × 20,5 mm, 100% K
   - σαρώνει στο ίδιο URL
7. Γράψε τα αποτελέσματα στο changelog του ADR-923 και κάνε commit στο κλαδί με ρητή λίστα αρχείων.

## 3. ΜΗΝ

- ΜΗΝ κάνεις commit στο `main`. ΜΗΝ τρέξεις `wt:land` ή push χωρίς ρητή εντολή του Giorgio.
- ΜΗΝ τρέξεις jest ή tests χωρίς έγκριση. Εκκρεμεί πρόταση για `cron-schedule.test.ts` και `cron-route-contract.test.ts`, χωρίς έγκριση ακόμη.
- ΜΗΝ τρέξεις tsc. ΜΗΝ χρησιμοποιήσεις `--no-verify`.
- ΜΗΝ εισάγεις ποτέ κωδικούς (TAXIS ή άλλους). Τη σύνδεση την κάνει ο Giorgio.
- ΜΗΝ κάνεις `wt:remove` χωρίς εντολή.

## 4. Ανοιχτά από το προηγούμενο handoff (αμετάβλητα)

- Ορφανό worktree `agent-a4aa1ef33828efaf9` (πρόταση: απόρριψη).
- Πρόταση refine στο `catalog-import.schema.ts`.
- Αποφάσεις Α1 / Ν6 / Ν8 / Ν9β / Ν12.
