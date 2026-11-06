# HANDOFF — ADR-930 · Μεταβίβαση κατόχου ευκαιρίας (Τι 6 → Τι 5) + LeadsList delete + activities

- **Ημερομηνία:** 2026-11-05
- **Worktree:** `C:\Nestor_Worktrees\crm-pipeline-dnd` · **Κλαδί:** `agent/crm-pipeline-dnd`
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-930-crm-pipeline-stage-drag-drop.md` (§3.7 · §4 · §6)
- **Προηγούμενο handoff:** `HANDOFFS/2026-11-05_ADR-930_owner-authority-live-proof_handoff.md`
- **Ratchet:** `.claude-rules/pending-ratchet-work.md` → ενότητα «📈 Ευκαιρίες CRM…» Τι (3)–(6)

## 1. Κατάσταση (αλήθεια = git + ADR)

- ✅ **Ζωντανή απόδειξη §3.7 ΕΚΛΕΙΣΕ** (commit `2d829f08`, ADR-930 §6): nestorconstruct.gr έκδοση `d504d5b5` ⊇ `e5b192c2`,
  κανόνες ανεβασμένοι (run `41942519930`). Με `internal_user` `georgios.pagonis+staff@gmail.com`
  (Νέστωρ Θεσσαλονικεύς, uid `jlWQL73MyuXxMRVIa13RbmfDtYT2`): δική κάρτα σέρνεται/επεξεργάζεται, διαγραφή απενεργή·
  8 ξένες κλειδωμένες με όνομα κατόχου· ξένη stage/PATCH → 403 `OPPORTUNITY_NOT_OWNER` + `ownerUid`· δική → 200.
  `DELETE` ΔΕΝ δοκιμάστηκε ζωντανά (οριστική διαγραφή `docRef.delete()`).
- Δεδομένα παραγωγής που άλλαξαν: η «Αναζήτηση διαμερίσματος έως 180.000 €» (`opp_a1f20034-851a-4b54-bee5-c367444709ca`)
  έχει `assignedTo` = `+staff`. Οι άλλες 8 κατέχει ο super_admin (uid `WKBWEg3DSfcdSbLNJfzGEW3vkct1`).
- Body πόρτας σταδίου (για δοκιμές): `{ expectedStage, request: { kind: 'open'|'won'|'lost', target } }`.

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ — σειρά εγκεκριμένη από Giorgio: **Τι(6) → Τι(5) → Τι(3) → Τι(4)**

Τα (6)+(5) = μία ενότητα πολλών αρχείων ⇒ **Plan Mode** (N.8). Πριν τον κώδικα: **έρευνα** (Salesforce «Transfer Record» /
«Change Owner», HubSpot owner property + «Edit owner» permission, Pipedrive deal owner / visibility) και **SSoT audit με `git grep`**.

### 2.1 Τι (6) — κενό ασφαλείας: το `PATCH` δέχεται `assignedTo` ανεξέλεγκτα
- `src/app/api/opportunities/[id]/route.ts` — `UpdateOpportunitySchema` είναι `.passthrough()` ⇒ `assignedTo` περνά·
  `src/services/opportunities-server.service.ts:213` το γράφει. Ο ανατεθειμένος μεταβιβάζει μόνος του, και σε uid **εκτός μισθωτή**.
- Κατεύθυνση: ρητό πεδίο στο σχήμα (όχι passthrough για ιδιοκτησία) · νέο intent **`transfer`** στον ΕΝΑ κριτή
  `src/services/crm/opportunity-access.ts` (μόνο ικανότητα — όχι ρόλος, CHECK 3.68) · ο νέος κάτοχος **μέλος του `companyId`**
  (server-side επαλήθευση) · ιστορικό (ADR-195) με before/after κατόχου · ίδιο ερώτημα στους **κανόνες** `firestore.rules`
  `match /opportunities` (ο ανατεθειμένος στο `update` ΔΕΝ αλλάζει `assignedTo`) + σουίτα κανόνων + CHECK 3.114 (νέο Κ για
  ισοτιμία κριτή↔κανόνων στο `assignedTo`).
- Να ελεγχθεί και ο client SDK δρόμος `src/services/opportunities.service.ts` (`updateDoc` από browser).

### 2.2 Τι (5) — πεδίο «Κάτοχος» στη φόρμα
- `src/components/crm/dashboard/EditOpportunityModal.tsx` — δεν έχει πεδίο κατόχου.
- Radix Select (`@/components/ui/select`, ADR-001) με μέλη του μισθωτή· ορατό/ενεργό μόνο όταν ο κριτής δίνει `transfer`
  (μέσω `useOpportunityAccess` — όχι δεύτερη εκδοχή). Πηγή μελών: **να βρεθεί υπάρχον SSoT** (υποψήφιο:
  `src/components/obligations/workspace/MetadataPanel.tsx` έχει picker· `/api/admin/role-management/users` είναι admin-only).
  i18n el+en. Ιδέα «πάνω από τους μεγάλους»: «Ανάθεση σε μένα» (one-click claim) + ειδοποίηση στον νέο κάτοχο — να κριθεί.

### 2.3 Τι (3) — LeadsList delete
`src/components/leads/LeadsList.tsx` · `hooks/useLeadsList.ts` → το κουμπί να ρωτά `decideOpportunityAccess(intent:'delete')`
μέσω `useOpportunityLocks` + `CardAction` με λόγο (όπως η κάρτα). Ίδιο έλεγχο για `LeadDetailPageContent.tsx` / `PipelineTab.tsx`.

### 2.4 Τι (4) — `activities`
**Απόφαση Giorgio ΠΡΙΝ τον κώδικα** (HubSpot/Salesforce: ο owner του record επεξεργάζεται τις δραστηριότητές του).

## 3. Κρίσιμο context
- Ο κριτής δεν ονομάζει ρόλο (CHECK 3.68). `requireOpportunityInTenant` έχει ΕΝΑΝ καλούντα (CHECK 3.114).
- Νέα route με `defineRoute` + rate limit ⇒ γραμμή στο `.rate-limit-policy-baseline.json` (CHECK 3.78).
- Αναζήτηση με `git grep`. Σύνθετες εντολές git/gh τις αρνείται ο φύλακας worktree ⇒ απλές εντολές.
- Chrome: το screenshot μπορεί να λήγει (παράθυρο στο παρασκήνιο) — η ανάγνωση DOM με `javascript_tool` δουλεύει.
- Άλλα worktrees (`agent-a4aa1ef33828efaf9`, `land-raster-check351`) **δεν** είναι δικά μας.

## 4. ΜΗΝ
- ΜΗΝ commit στο `main`· commit μόνο στο `agent/crm-pipeline-dnd` με ρητή λίστα αρχείων· ποτέ `git add -A` / `--no-verify`.
- ΜΗΝ `wt:land` / push χωρίς ρητή εντολή Giorgio.
- ΜΗΝ dev server, ΜΗΝ `tsc`, ΜΗΝ μακριά αναμονή στο παρασκήνιο. ΜΗΝ κωδικοί σε φόρμες.
- ΜΗΝ ζωντανό `DELETE` σε πραγματική ευκαιρία.
- Πριν το «done»: `npm run jscpd:diff <αρχεία>` + ADR-930 changelog + ενημέρωση `pending-ratchet-work.md` (αφαίρεση ό,τι έκλεισε).
