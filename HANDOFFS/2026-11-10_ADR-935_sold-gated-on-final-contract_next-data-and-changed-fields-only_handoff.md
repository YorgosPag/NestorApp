# Handoff — ADR-935 «Πωλήθηκε» μόνο μετά το οριστικό: ΕΝΤΑΓΜΕΝΟ · επόμενα: τα 4 παλιά `sold` + η φόρμα στέλνει μόνο ό,τι άλλαξε

**Ημερομηνία:** 2026-11-10 · **Worktree:** `C:\Nestor_Worktrees\pea-sold-truth` · **Κλαδί:** `agent/pea-sold-truth`
**Τοπικό `main`:** `ba856147` (ΟΧΙ push — push μόνο με εντολή Giorgio)

---

## 1. Τι έγινε (εντάχθηκε στο τοπικό `main`, χωρίς push)

| Commit | Τι |
|---|---|
| `55b4e3ac` | **ADR-915 §38** — τα πεδία ΠΕΑ + «Συμπλήρωση από ΠΕΑ (PDF)» κλειδώνουν μόνο όταν `isFinalContractSigned(legalPhase)`. Ο κριτής (`src/lib/conveyance/case-state.ts`) δέχεται `unknown`. `types/property-viewer.ts` += `commercial.legalPhase?: unknown`. |
| `ba856147` | **ADR-935** (νέο) — είσοδος σε `sold` μόνο με υπογεγραμμένο οριστικό: `assertSaleFollowsFinalContract` (`api/properties/[id]/property-commercial-validation.ts`, 409) · `assertParentFinalContractSigned` (`api/sales/[propertyId]/appurtenance-sync/appurtenance-sync-writes.ts`, 409) · `SellDialog` εξηγεί και απενεργοποιεί · ΕΝΑ μήνυμα `FINAL_CONTRACT_NOT_SIGNED_MESSAGE` (case-state.ts) → `sales.errors.finalContractNotSigned` (el/en) · `src/types/i18n.ts` ξαναπαράχθηκε. Και διόρθωση ψευδούς ισχυρισμού στο ADR-915 §38. |

Πύλες hook: ✅ και στα δύο. Land: 1η απόπειρα Β απέτυχε («οι πύλες απέρριψαν την ένωση», αιτία άγνωστη — πέρασε στη 2η) · Α: σύγκρουση μόνο στο παραγόμενο `src/types/i18n.ts` → rebase + `npm run generate:i18n-types`.

## 2. Γνώση που ΔΕΝ προκύπτει εύκολα από τον κώδικα

- Το `sold` το έγραφε **μόνο** η πράξη «Πώληση» (`SellDialog` → `use-sales-action-mutation` → `PATCH`), όχι το μενού (`EDITOR_COMMERCIAL_STATUSES` το εξαιρεί, ADR-777 §8.60.18). Τιμολόγιο/προμήθεια/θέσεις τρέχουν στο `onCommitted` ⇒ κληρονομούν τον φραγμό.
- **ADR-249 κλείδωμα**: `src/lib/property/property-locked-fields.ts` — `SOLD_LOCKED_FIELDS` (περιέχει `energy`, `name`, `code`, `type`, `commercialStatus` …) · `RESERVED_LOCKED_FIELDS` = `code/type/name`. Ελέγχει **κλειδιά παρόντα στο payload**, όχι αν άλλαξαν. Το εφαρμόζουν πελάτης (`services/property/property-mutation-gateway.ts` `assertFieldLocking`) **και** server (`lib/firestore/property-field-locking.ts`).
- Η φόρμα (`features/property-details/components/property-fields-form-mapper.ts` `buildPropertyUpdatesFromForm`) στέλνει **πάντα** `name/code/type/commercialStatus/floor/layout/orientations` ⇒ σε κρατημένο/πωλημένο ακίνητο **ΚΑΘΕ** αποθήκευση φόρμας απορρίπτεται (403/policy error).
- Το ΠΕΑ φτάνει στο μητρώο από **δύο** πηγές (`services/document-registry/registry-documents.server.ts`): (α) αρχείο με `documentFacts` — τα γράφει η εισαγωγή `api/properties/[id]/energy-certificate-import` **πάνω στο αρχείο**, χωρίς κλείδωμα· (β) δήλωση `energy` του ακινήτου (κλειδωμένη για sold). Η ανάθεση κλείνει όταν `latestIssuedOn ≥ ημέρα πρότασης` (`lib/document-validity/issuance-assignment.ts` `isIssuanceFulfilled`).

## 3. ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ (με αυτή τη σειρά)

### 3.1 Τα 4 υπάρχοντα `sold` χωρίς οριστικό — ο Giorgio είπε «κάνε ό,τι είναι καλύτερο»
Παραγωγή (Firestore, 10/11): `prop_2d612992-32fd-4ec3-b459-38c9882f7017` «Μεζονέτα 95 τ.μ.» (αγοραστής, προκαταβολή 3.000, υπόθεση `cvc_db8314ef…` open) · `prop_a0000005-7777-4aaa-8aaa-000000000005` «ΔΟΚΙΜΗ Ε» · `prop_a0000006-7777-4aaa-8aaa-000000000006` «ΔΟΚΙΜΗ ΣΤ» · `prop_ffd81800-160e-4707-bbb8-7e3c2f04e49b` «ΔΟΚΙΜΗ Υ2» (τα ΔΟΚΙΜΗ: χωρίς `owners`, χωρίς ημερομηνίες).
Πρόταση πράκτορα (να επαληθευτεί πριν γραφτεί τίποτα):
1. **SSoT audit πρώτα**: υπάρχει ήδη μηχανισμός επαναφοράς/μετανάστευσης με ίχνος; (`revertPropertySaleWithPolicy` στο mutation-gateway · scripts μετανάστευσης στο `scripts/` · `EntityAuditService.recordChange`). Πώς γεννήθηκαν τα ΔΟΚΙΜΗ (grep `prop_a0000005` / `ΔΟΚΙΜΗ Ε` σε seeds/scripts/tests) — αν είναι fixtures αναφορών εσόδων, η αλλαγή τους επηρεάζει αναφορές.
2. Μεζονέτα → `reserved` (κρατά αγοραστή + προκαταβολή· σβήνει `finalPrice`/`saleDate`) **με ίχνος** στο Ιστορικό. Έλεγξε τι έγινε στο τελικό τιμολόγιο (`final_sale_invoice`) που εκδόθηκε στις 19/10 — ADR-ACC λογιστική: ακύρωση/πιστωτικό;
3. ΔΟΚΙΜΗ: απόφαση μετά το audit του (1). Καμία εγγραφή στην παραγωγή χωρίς να πεις στον Giorgio τι ακριβώς θα γραφτεί.
4. Τεκμηρίωση: ADR-935 §6 + changelog.

### 3.2 Η φόρμα στέλνει μόνο ό,τι ΑΛΛΑΞΕ — «όπως οι μεγάλοι», full enterprise + SSoT
- **Έρευνα (web)**: Google AIP-134 `update_mask` / field masks · JSON Merge Patch (RFC 7386) · πώς Figma/Revit/ArchiCAD/Zillow/Idealista στέλνουν αλλαγές (delta, όχι ολόκληρο έγγραφο) · και κάτι εξυπνότερο αν υπάρχει.
- **SSoT audit (grep)**: υπάρχει ήδη diff/«changed fields» μηχανισμός; Ενδεικτικά `changedCommercialAmounts` (`lib/properties/commercial-draft.ts`), το «μόνο όταν άλλαξε» των εμβαδών (ADR-777 §8.97 στο form-mapper), `usePropertyFormSync` (ADR-287 Batch 23, per-field reconciliation), ImpactGuard (`useGuardedPropertyMutation`). **Επέκτεινε το υπάρχον — όχι δεύτερο diff.**
- Στόχος: σε κρατημένο/πωλημένο ακίνητο μια αλλαγή σε μη κλειδωμένο πεδίο αποθηκεύεται· αλλαγή σε κλειδωμένο → σαφές μήνυμα· ο server κρίνει ό,τι **αλλάζει** (όχι ό,τι υπάρχει στο payload) — ή ο πελάτης δεν στέλνει αμετάβλητα. Επιλογές Α/Β/Γ με σύσταση → «ναι» Giorgio → ADR (ADR-249 ή νέο) → υλοποίηση → changelog.

### 3.3 Δοκιμή ΠΕΑ με τον Γιάννη (μετά από push — ΜΟΝΟ με εντολή Giorgio)
«Μεζονέτα 95 τ.μ.» → Επεξεργασία → «Συμπλήρωση από ΠΕΑ (PDF)» με ΠΕΑ έκδοσης ≥ 10/11/2026 → η ανάθεση κλείνει μόνη της (σελίδα «Λήξεις εγγράφων»). Μέχρι το 3.2, **μην** πατηθεί «Αποθήκευση» στη φόρμα (θα απορριφθεί). Μετά: ADR-915 §38.4 ⏳ → ✅ στο changelog.

## 4. Ανοιχτά, εκτός πεδίου (μόνο αν ζητηθούν)
- Αν το οριστικό ακυρωθεί μετά το `sold`, το `sold` δεν αναιρείται (ADR-935 §5).
- `translateServerError` (`components/sales/dialogs/sales-dialog-utils.ts`) αντιστοιχίζει «Unit …» ενώ ο server γράφει «Property …» ⇒ ωμά αγγλικά για noArea/noBuilding κ.λπ.
- Tests του `appurtenance-sync` για `sell` ίσως θέλουν ακίνητο με `legalPhase` (δεν έτρεξαν· οι πύλες του hook πέρασαν).
- Από το προηγούμενο handoff: combobox ανάθεσης δείχνει «Αναζήτηση επαφής…» μετά την επιλογή · 7 μεταβλητές λείπουν στο `/api/health/config` · υπόλειμμα worktree `pea-sold-status-truth`.

## 5. ⛔ ΜΗΝ
- Tests / πύλες / tsc χωρίς έγκριση (κανόνες 2026-11-05 · N.17).
- Εγγραφή στην παραγωγή (Firestore) χωρίς να πεις πρώτα τι ακριβώς γράφεται.
- Email σε πραγματικές επαφές.
- Commit στο `main`· `wt:land` και push **μόνο** με εντολή Giorgio.
- Κώδικας πριν το SSoT audit + έρευνα + «ναι».
