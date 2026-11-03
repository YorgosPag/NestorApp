# Handoff — ADR-928 Φ3 (υπόλοιπο) · μετά τον ρόλο έργου

**Ημερομηνία:** 2026-11-03 · **Worktree:** `C:\Nestor_Worktrees\adr-923-phase6b` · **Κλαδί:** `agent/adr-923-phase6b`
**Αντικαθιστά** το `HANDOFFS/2026-11-03_ADR-928_after-F2_handoff.md` (αφαιρέθηκε στο ίδιο commit).

## Πηγή της αλήθειας
- ADR: `docs/centralized-systems/reference/adrs/ADR-928-subcontract-offer-agreement.md` — §5.4, §5.4.1, §5.9, §5.14, **§5.15**, §6.
- **Εγκεκριμένο πλάνο Φ3** (Giorgio 2026-11-03): `C:\Users\user\.claude\plans\toasty-dazzling-scott.md` — διάβασέ το ολόκληρο.

## Κατάσταση
- Φ0–Φ2 στο `main` (`a296e382`) **και push** (εντολή Giorgio). Η σύγκρουση rebase ήταν μόνο σε παραγόμενα i18n → γεννήτορες.
- **Δείκτες Firebase ✅**: η γραμμή παραγωγής (ADR-865 §11) τους ανέπτυξε — run `41684653779` = `completed success`.
  Η λίστα ανά έργο (`companyId + projectIds CONTAINS + updatedAt↓`) έχει δείκτη στην παραγωγή.
  ⛔ Ποτέ τοπικό `firestore:deploy` (μόνο έκτακτη ανάγκη)· νέος δείκτης = commit + push + έγκριση Giorgio στη γραμμή.
- **Φ3α-1 ✅ (commit στο κλαδί)**: ρόλος έργου (§5.15) — `agreement-resource.server.ts`, `assign`, `project_manager`,
  `PROJECT_ROLE_POLICY` `enforcedBy`. 23/23 μέσα από το πραγματικό `withAuth`, 4/4 μεταλλάξεις κόκκινες, 3.111 227/227.
- **Δεν** έχει γίνει `wt:land` της Φ3α-1 (μόνο με εντολή Giorgio).

## Επόμενα (από το πλάνο, με τη σειρά)
**➡️ ΤΩΡΑ: Φ3α-2** (εντολή Giorgio). Ροή: N.14 δήλωσε μοντέλο (Opus) → SSoT audit με grep **πριν** από κώδικα (επαλήθευσε
ότι τα SSoT της λίστας πιο κάτω υπάρχουν ακόμη) → Plan Mode (N.8: 5+ αρχεία) → υλοποίηση → jest + μεταλλάξεις → ADR §5.16
(χάρτης κώδικα + changelog) → commit στο κλαδί. Έρευνα στο διαδίκτυο για τη λίστα (Procore Commitments list: στήλες,
φίλτρα, κατάσταση· Autodesk Build Contracts) — ακολούθησε και ξεπέρασε.

1. **Φ3α-2** — δεδομένα/λίστα: επέκταση `useProcurementCatalogList` (προαιρετικά `constraints` + φίλτρο διαγραφής, χωρίς
   αλλαγή στους 2 καταναλωτές) · `useProjectSubcontractAgreements` · hooks βιβλιοθήκης/προτύπων → `ApprovedLibrary` ·
   `subcontract-agreements-api.ts` (πάνω στο `apiClient`, Idempotency-Key αυτόματο) · `subcontract-messages.ts`
   (issue codes + write-error kinds → κλειδιά el/en, πρότυπο `floor-stack-messages.ts`) · `useSubcontractAuthority`
   (`useCapabilities` ή `useProjectCapabilities` για `manage`/`assign`) · `SubcontractAgreementStatusBadge` · καρτέλα
   `subcontracts` (`procurement-urls.ts`, `ProjectProcurementTabs.tsx`, `projects.json`, σελίδα + client + route slice).
2. **Φ3β** — ένα μοντέλο εγγράφου (καθαρό) → προεπισκόπηση HTML τώρα, Typst στη Φ4 · `render-clause-body` ·
   `describe-payment-plan` (namespace `subcontract-document` + `src/i18n/bundle-translate.ts`, γλώσσα **εγγράφου**) ·
   `src/lib/calendar/business-days.ts` πάνω στο `greekPublicHolidayOn` · `payment-schedule-projection`.
3. **Φ3γ** — επεξεργαστής από πρότυπο, ζωντανή κρίση με τους **ίδιους** κριτές, CAS 409, αποκλίσεις, αναθέσεις.

## SSoT που βρέθηκαν (audit 2026-11-03) — χρησιμοποίησέ τα
`firestoreQueryService.subscribe` · `createStaleCache` · `useCompanyId` · `apiClient`/`ApiClientError` ·
`explainProcurementError` · `useFormFields` + `useFormSubmission` + `FormActions` · `NumericField` · `DatePickerField` ·
`@/components/ui/select` · `POProjectSelector`/`POBuildingSelector` · `usePOSupplierContacts` · `resizable.tsx` ·
`formatMinor`/`minorFromMajor` · `amountInWords` · `formatPercentage` · `useCapability(ies)` · `useProjectCapabilities` ·
`Badge` · `RouteTabs` · `@/lib/workspace/navigation`. **Δεν υπάρχουν** (φτιάξ' τα κεντρικά): εργάσιμες ημέρες,
μορφοποίηση μονάδων βάσης, προεπισκόπηση εγγράφου, μηνύματα υπεργολαβίας, badge συμφωνητικού.

## Παγίδες που μετρήθηκαν
- **Προϋπάρχον κόκκινο** (όχι δικό μας, μετρημένο): `src/lib/auth/__tests__/` → `ownership-callsite-coverage-anchor`,
  `personal-scope-consumers`, `project-team-birth-anchor`, `identity-provenance`, `identity-remediation`,
  `acting-workspace` (λίστες catalog/engagements/listings κ.ά.). Μην τα «διορθώσεις» στα τυφλά.
- Η πύλη 3.111 αναγνωρίζει σημείο επιβολής μόνο από literal `permissions` + `permissionResource` στις 4 διαδρομές
  κτιρίων **ή** από γραμμή `enforcedBy` (αρχείο που περιέχει `projectId`). Η άγκυρα μετρά τις πράξεις (τώρα 10).
- Φρένο βαριών εργασιών: `C:\Users\user\.claude\heavy-task.lock` — αν υπάρχει, κάνε άλλη δουλειά.
- `HANDOFFS/` στο gitignore ⇒ `git add -f`. Γεννήτορας ADR index: `docs/centralized-systems/reference/scripts/generate-adr-index.cjs`.

## Κανόνες
Commit **μόνο** στο `agent/adr-923-phase6b`, ρητή λίστα. `wt:land`/push **μόνο** με εντολή Giorgio. Όχι tsc, όχι
`--no-verify`, όχι `git add -A`, όχι bare stash. Ειδοποίησε `nestor-pagonis-92` πριν από κοινά αρχεία (λίστα στο πλάνο).
