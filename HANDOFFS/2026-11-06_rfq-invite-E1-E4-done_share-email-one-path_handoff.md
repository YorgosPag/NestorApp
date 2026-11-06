# Handoff 2026-11-06 — Ε1–Ε4 πρόσκλησης RFQ ✅ (στο κλαδί) · επόμενο: ΕΝΑΣ δρόμος κοινοποίησης ακινήτου με email

**Worktree:** `C:\Nestor_Worktrees\xchange-report-typography` · **Κλαδί:** `agent/xchange-report-typography`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree και κλαδί.** Προηγούμενο handoff: `HANDOFFS/2026-11-06_rfq-invite-findings-E1-E4_handoff.md`.

## Κανόνες (Giorgio)
- Στο `main` **ΔΕΝ** κάνεις commit. `wt:land`, push, εγκρίσεις Firebase **ΜΟΝΟ** με ρητή εντολή. Πριν το `wt:land`: squash των commits του κλαδιού σε ένα.
- Πριν από κάθε push: `git fetch` + `git log origin/main..main` και αναφορά αν υπάρχουν commits άλλης συνεδρίας.
- CLAUDE.md N.(-2): κανένα test χωρίς έγκριση (η έγκριση σχεδίου που **ονομάζει** τα jest = έγκριση), μόνο ό,τι ζητήθηκε, καμία πρωτοβουλία (πρόταση σε 1 γραμμή + στοπ). N.17: **ποτέ tsc**. Ποτέ `--no-verify`. Ελληνικά πάντα. Δείκτης context στο τέλος.
- **ΠΟΤΕ αποστολή σε MACON** (`info@macon.gr`). Δοκιμές email μόνο προς georgios.pagonis@gmail.com.
- Πριν τον κώδικα: έρευνα διαδικτύου + **πραγματικό SSoT audit με grep** + Plan Mode. Commit στο κλαδί με ρητή λίστα αρχείων, πλήρες hook, ADR-ιδιοκτήτης στο ίδιο commit. Πήχης: Revit / ArchiCAD / Figma / Procore / Zillow / Idealista.
- Περιεχόμενο αρχείων με `Write` (N.19 — το Bash σπάει > ~6.000 χαρακτήρες).

## Έγινε (commits στο κλαδί, πλήρες hook, ΟΧΙ στο main, ΟΧΙ push)
- `75ecbfc6` — **Ε1–Ε4** (ADR-327 **§7.5** νέα ενότητα · ADR-598 «(θ)» · ADR-121 · ADR-923 §5.13):
  - ΕΝΑΣ builder `services/vendor-invite-message.ts` (`buildVendorInviteMessage`, `greetingName`) για τις 4 διαδρομές (outbox · νέα · επαναποστολή · ανανέωση). Όνομα έργου `resolveCompanyProjectNameOrNull` (`financial-intelligence/project-reference.ts`, ποτέ «Unknown», βλάβη ⇒ χωρίς γραμμή).
  - Composer `services/channels/vendor-invite-email-compose.ts` — κοινός για αποστολή **και** `POST /api/rfqs/[id]/invites/preview` (`vendor-invite-preview.ts`, μηδέν παρενέργειες).
  - Φόρμα: πρότυπο συστήματος + `buyerNote` (στο έγγραφο `vendor_invites`) · λήξη πάντα ημερομηνία (`config/vendor-invite-policy.ts`, `VendorInviteExpiryField.tsx`) · προεπισκόπηση «ως <παραλήπτης>» (`VendorInvitePreview.tsx`, `useVendorInvitePreview.ts`) · `manualName` προαιρετικό · νέα φόρμα σε κάθε άνοιγμα.
  - Ε4: `resolveEditingFormData` (`contact-details-helpers.ts`) για πεδία + κεφαλίδα + διακόπτη ρόλων.
- `9c5a8452` — `PersonalMessageField`: ετικέτα/μετρητής συνδεδεμένα (`useId`, `aria-describedby`, `maxLength`) · όριο στο `config/personal-message-policy.ts` · εγγραφή `pending-ratchet-work.md` στενεμένη.
- `c44dccbc` — `lib/html/plain-text-html.ts` (`plainTextToHtml`, καθαρό): σημείωμα RFQ · photo-share · intro showcase.
- Test: 151/151 στις σχετικές σουίτες + νέες · μεταλλάξεις: 15/15 (Ε1–Ε4) · 2/2 (πεδίο) · 3/3 (escape) κόκκινες.
- ⏳ **Ζωντανή επαλήθευση Ε1–Ε4: ΔΕΝ έγινε** — μόνο μετά από εντολή Giorgio για land/push, ad-hoc πρόσκληση **χωρίς όνομα** προς georgios.pagonis@gmail.com, με σημείωμα και ημερομηνία· ελέγχεις χαιρετισμό, «αίτημα προσφοράς «X» για το έργο Y», σημείωμα, λήξη, προεπισκόπηση = email. Ε4: διακόπτης ρόλου ορατός σε επεξεργασία.

## ΕΠΟΜΕΝΟ ΒΗΜΑ — ΕΝΑΣ δρόμος «κοινοποίηση ακινήτου με email» (🔴 ασφάλεια + αξιοπιστία)
Εγγραφή: `.claude-rules/pending-ratchet-work.md` «ΔΥΟ ΔΡΟΜΟΙ ΚΟΙΝΟΠΟΙΗΣΗΣ ΑΚΙΝΗΤΟΥ ΜΕ EMAIL» · ADR-327 §7.5 «ΑΝΟΙΧΤΟ».
- Ο διάλογος (`src/components/ui/sharing/panels/UserAuthPermissionPanel.tsx`, `handleEmailShare` ~γρ. 207) στέλνει από το νέο `showcase/email` όταν υπάρχει `showcaseContext`, **αλλιώς** από το παλιό `POST /api/communications/email/property-share` → `src/services/email.service.ts` → `src/services/email-templates.service.ts` (residential/commercial/premium).
- Τα 3 παλιά πρότυπα: (α) `personalMessage` **και** όλα τα πεδία **ωμά** στο HTML — το `sanitizeString` (`property-share-validation.ts:86`) είναι μαύρη λίστα, περνούν `<a href>`/`<img>` από το domain μας· (β) **κατασκευασμένα** στοιχεία: `+30 210 123 4567`, `commercial@`/`premium@nestorconstruct.gr`, «20+ χρόνια εμπειρίας»· (γ) υποσέλιδο εκτός `resolveSenderIdentity` (ADR-857 Φ9) και «Nestor Construct» γραμμένο με το χέρι (CHECK 3.81)· (δ) **17 ωμά ελληνικά εκτός baseline** ⇒ κάθε άγγιγμα του αρχείου μπλοκάρει (N.11, μηδενική ανοχή — ΜΗΝ παρακάμψεις). Ο `TemplateSelector.tsx` (browser) φορτώνει το ίδιο αρχείο (`getAllTemplates`) ⇒ ό,τι εισάγεις εκεί πρέπει να είναι χωρίς `server-only`.
- **Κατεύθυνση (Giorgio: «όπως οι μεγάλοι»)**: Zillow/Idealista έχουν **έναν** δρόμο — ένα επώνυμο πρότυπο, κάρτα ακινήτου, προαιρετικό σημείωμα, υποσέλιδο από τον πραγματικό αποστολέα.
  1. **Μέτρηση πρώτα**: ποιοι καλούντες ανοίγουν τον διάλογο **χωρίς** `showcaseContext` (`UnifiedShareDialog.tsx`, `ShareModal.tsx`, `PlatformShareController.tsx`) και αν το showcase/email τους καλύπτει (ακίνητο / κτίριο / έργο / parking / αποθήκη έχουν `.../showcase/email` routes).
  2. Πρόταση στον Giorgio: **απόσυρση** του παλιού δρόμου (αν καλύπτονται όλα) ή **μετάβαση** του στο branded σύστημα (`wrapInBrandedTemplate` · `personal-note-block.ts` · `plainTextToHtml` · κείμενα ανά γλώσσα, όπως `vendor-invite-email-texts.ts`).
  3. Plan Mode, ρητή λίστα jest στο σχέδιο.
- SSoT που ήδη υπάρχουν: `lib/html/escape-html.ts` · `lib/html/plain-text-html.ts` · `services/email-templates/base-email-template.ts` · `services/email-templates/personal-note-block.ts` · `services/company/sender-identity.ts` · `services/showcase-core/email-builder-factory.ts` · `components/sharing/fields/PersonalMessageField.tsx` · `config/personal-message-policy.ts`.

## Μετά
1. **Φόρμα πρόσκλησης RFQ**: το `delivery.success === false` μετρά ακόμη ως «στάλθηκε» στο `VendorInviteDialog.sendBatch` (εγγραφή στο `pending-ratchet-work.md`). Η επανάληψη πρέπει να είναι **επαναποστολή**, όχι νέα πρόσκληση.
2. Χ-Α…Χ-Ζ της Λ1 (`HANDOFFS/2026-11-05_ADR-923_coordinator_wave3_progress3_handoff.md`): `stopOnUncertain` · test ταυτόχρονων κρατήσεων · κείμενο/κουμπί επαναποστολής · try/catch στο `markDispatched` · `.catch` στο `fetchVendorContact` · θέση JSDoc.
3. Λωρίδες Λ3 / Λ4 / Λ7 του ADR-923 §23.

## Γνωστό, όχι δικό μας
- `src/features/property-grid/__tests__/catalog-grid-ssot.test.ts` **Κ9 κόκκινο** στο κλαδί: 13 δηλώσεις `minmax(...)` χωρίς φρουρό σε αρχεία που δεν αγγίξαμε (π.χ. `ParameterDefinitionCard.tsx`, `PublicModelView.tsx`). Μόνο αναφορά.

## Καθαρισμός (από τον Giorgio, όχι από πράκτορα) — αμετάβλητο από το προηγούμενο handoff
- `C:\Nestor_Pagonis\.claude\worktrees\agent-a4aa1ef33828efaf9` (κλαδί `agent/adr-923-w3-l1-quote-delivery`): ταυτόσημο 34/34 με `agent/adr-923-w3-l1-wip-archive` (`52dd2bb8`). **ΜΗΝ** commit/ένταξη. `git worktree remove -f -f …` + `git worktree prune`.
- `C:\Nestor_Worktrees\raster-plan-recognition`: WIP άλλης συνεδρίας (ADR-929) — μην αγγιχτεί.
- Τελική συνεδρία: Revoke των δύο tokens `claude-traefik` στο Coolify, διαγραφή `C:\Users\user\.coolify-token`. Το `claude-agent` (root) **δεν** αγγίζεται.
- Ανοιχτά από Τ5: screenshot Sentry monitor `rfq-invite-delivery` · έλεγχος purge cron μετά 05:00 UTC 2026-11-06. Τα δεδομένα δοκιμής Τ5 μένουν.
