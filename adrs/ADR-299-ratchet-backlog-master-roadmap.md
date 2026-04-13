# ADR-299 — Ratchet Backlog Master Roadmap

**Status:** ✅ APPROVED
**Date:** 2026-04-11
**Category:** Governance / Technical Debt Tracking / SSoT Enforcement
**Decision drivers:** Γιώργος Παγώνης (session 2026-04-11)
**Supersedes:** —
**Superseded by:** —

---

## 1. Context

### 1.1 Γιατί υπάρχει αυτό το ADR

Κατά τη session 2026-04-11, ο Γιώργος ζήτησε εκτίμηση για το «πόσες ώρες ακόμα θέλει η ολοκλήρωση όλων των παραβιάσεων». Η απάντηση που δόθηκε ad-hoc (55-75 ώρες) **ερχόταν σε αντίφαση** με παλιότερη εκτίμηση της τάξης των 15 ωρών που είχε δοθεί σε προηγούμενη συνεδρία. Ο Γιώργος παρατήρησε τη διαφορά και ζήτησε τεκμηρίωση σε μόνιμο αρχείο.

**Root cause της ad-hoc διαφοράς:** δεν ήταν αύξηση scope — ήταν **διαφορετικό scope**. Η παλιά εκτίμηση κάλυπτε μόνο το ADR-298 Phase B critical path (~6-8 ώρες + buffer). Η νέα εκτίμηση κάλυπτε **όλα τα pre-commit ratchets μαζί** (CHECK 3.13 / 3.16 / 3.17 + i18n missing keys + SSoT + entity audit coverage), το οποίο φτάνει ρεαλιστικά 55-75 ώρες αν επιδιώξουμε zero backlog παντού.

Χωρίς consolidated SSoT, η ίδια σύγχυση θα επαναληφθεί κάθε φορά που συζητούμε «πόσα μένουν». Αυτό το ADR είναι το **single source of truth** για:

1. **Τρέχων αριθμός violations** ανά ratchet (snapshot 2026-04-11)
2. **Scope breakdown** ανά περιοχή — τι ακριβώς μετράει κάθε check
3. **Hour estimates με ρητές assumptions** — όχι «εντύπωση», αλλά δομημένη εκτίμηση
4. **Scenarios** — κρίσιμο path vs πλήρες zero backlog
5. **Bidirectional cross-references** σε όλα τα per-check ADRs

### 1.2 Τι **δεν** είναι αυτό το ADR

- **Δεν** αντικαθιστά τα per-check ADRs (ADR-195, ADR-294, ADR-296, ADR-298). Αυτά παραμένουν οι canonical περιγραφές κάθε συστήματος.
- **Δεν** είναι task list που τσεκάρεται per-session. Το update γίνεται **όταν ένα ratchet αλλάζει scope** ή όταν ένα master milestone ολοκληρώνεται.
- **Δεν** υποκαθιστά τα baselines (`.i18n-violations-baseline.json`, `.ssot-violations-baseline.json`, κλπ.) — αυτά είναι οι authoritative μετρήσεις. Αυτό το ADR τα **aggregate-άρει σε ανθρώπινη μορφή**.

---

## 2. Current State Snapshot (2026-04-11)

### 2.1 ✅ Zero backlog (complete)

| Περιοχή | Canonical ADR | Baseline file | Violations | Σχόλιο |
|---------|---------------|---------------|------------|--------|
| **i18n hardcoded `defaultValue`** (CHECK 3.2) | ADR-296 | `.i18n-violations-baseline.json` | **0** | Πλήρες cleanup ολοκληρώθηκε. Ratchet συνεχίζει να προστατεύει regression. |
| **SSoT centralized modules** (CHECK 3.7) | ADR-294 | `.ssot-violations-baseline.json` | **0 / 22 tiers** | 100% progress to zero. 22 modules (core, data integrity, security, business logic, enum constants, infrastructure, config consolidation, expanded coverage). |
| **Firestore queries without `companyId`** (CHECK 3.10) | — | `.firestore-companyid-baseline.json` | **0** | Ratchet στο zero. |
| **ICU interpolation `{{var}}`** (CHECK 3.9) | ADR-296 | `.icu-violations-baseline.json` | **0** | Cleanup ολοκληρώθηκε 2026-04-09. |
| **Audit value catalogs** (CHECK 3.14) | ADR-195 | — | **0** | Zero-tolerance check, όχι ratchet. |
| **Firestore index coverage** (CHECK 3.15) | ADR-195 | — | **0 on touch** | Zero-tolerance on touch, Boy Scout για backlog. |
| **Firestore rules test coverage — static** (CHECK 3.16) | ADR-298 | manifest-driven | **0 drift** | 8 / 96 collections covered, 84 pending στο `FIRESTORE_RULES_PENDING` (tracked list). |

### 2.2 🟡 Backlog με ratchet (σταδιακό cleanup)

| Περιοχή | Canonical ADR | Baseline | Violations | Αρχεία | Τύπος |
|---------|---------------|----------|------------|--------|-------|
| **Firestore rules test coverage — runtime** (Phase B/C/E) | ADR-298 | manifest pending | **88 collections** | — | Test suites required |
| **Entity audit coverage — write side** (CHECK 3.17) | ADR-195 | `.entity-audit-coverage-baseline.json` | **19 violations** (base 19, ratcheted 20→19 στο commit `56d95be4` — admin-link destructive chain deletion) | 19 αρχεία | Boy Scout |
| **i18n missing keys** (CHECK 3.8) | ADR-280 | `.i18n-missing-keys-baseline.json` | **4.762** legacy | — | Ratchet down only |
| **i18n resolver reachability** (CHECK 3.13) | ADR-279 / ADR-280 | `.i18n-resolver-reachability-baseline.json` | **378** violations | 13 αρχεία | Ratchet down only |

### 2.3 Πώς υπολογίζονται οι μετρήσεις

- **Authoritative source:** τα `.*-baseline.json` files στο repo root. Διαβάζονται από τους pre-commit scanners (`scripts/check-*.sh`/`*.js`).
- **Refresh commands:**
  - `npm run ssot:audit` / `ssot:baseline`
  - `npm run i18n:audit` / `i18n:baseline`
  - `npm run audit-coverage:audit` / `audit-coverage:baseline`
  - `npm run firestore:audit` / `firestore:baseline`
  - `pnpm firestore-rules:coverage:audit`
- **Snapshot date** κάθε section πρέπει να ανανεώνεται όταν αλλάζει το scope, όχι ανά commit. Σταδιακές μετρήσεις ζουν στα baselines.

---

## 3. Scope breakdown — τι ακριβώς μετράει κάθε ratchet

### 3.1 ADR-298 Firestore Rules Test Coverage (88 pending)

**Phase B — Critical path** (6 P0/P1 slices, 16 collections)
Canonical breakdown στο `adrs/ADR-298-firestore-rules-test-coverage-ssot.md` §4 Phase B table.

| Slice | Collections | Pattern | Status |
|-------|-------------|---------|--------|
| B.1 | `attendance_events`, `attendance_qr_tokens` | `tenant_dual_path` + `admin_write_only` | ✅ done (Phase B.1) |
| B.2 | `accounting_audit_log`, `accounting_invoices`, `accounting_journal_entries` | `role_dual` + immutable overrides (audit_log) | ✅ done (2026-04-13) |
| B.3 | `contacts` (Phase A), `opportunities`, `leads`, `activities` | `tenant_direct` + `crmDirectMatrix` | ✅ done (2026-04-13) |
| **B.4** | `properties`, `storage_units`, `parking_spots`, `floors` | `admin_write_only` + delta (properties update) | ✅ done (2026-04-13) |
| **B.5** | `conversations`, `external_identities` | `tenant_direct` + `crmDirectMatrix` | ✅ done (2026-04-13) |
| B.6 | `obligations`, `obligation_transmittals`, `obligation_templates` | `tenant_direct` | ⏳ pending |

**Phase C — Full coverage** (74 remaining collections, 7 subcategories)
C.1 remaining accounting (15), C.2 DXF/CAD/floorplans (15), C.3 file variants (10), C.4 BoQ/ownership/commissions (8), C.5 system-global (11), C.6 ownership-based users (5), C.7 specialized (10). Πολλά C.5 είναι trivial (~15 min/collection).

**Phase D — CI integration** ✅ complete

**Phase E — Storage rules** (separate future ADR) — `storage.rules` 12KB, νέο harness shape.

### 3.2 CHECK 3.17 Entity Audit Coverage (19 files)

Κάθε αρχείο στο baseline κάνει Firestore write σε audit-tracked collection (`projects`, `contacts`, `buildings`, `properties`, `floors`, `parking`, `storage`, `purchase_orders`, `companies`) χωρίς να καλεί `EntityAuditService.recordChange()`. Fix ανά αρχείο = fetch `performedBy`/`performedByName`/`companyId` + recordChange call στο ίδιο transactional block. File-level granularity — ένα αρχείο περνάει όταν έχει έστω **ένα** covered write path.

### 3.3 i18n Missing Keys (4.762 legacy)

Scanner: `scripts/check-i18n-missing-keys.js`. Εντοπίζει `t('key')` calls όπου το key λείπει από τα locale JSON files (`src/i18n/locales/{el,en}/*.json`) **και** namespace mismatches (π.χ. `t('common.close')` σε namespace `files` αντί `t('share.close')`). Το 4.762 είναι legacy — πολλά προέρχονται από το ADR-280 namespace split όπου keys μετακινήθηκαν σε νέα namespaces αλλά old callers δεν ενημερώθηκαν.

### 3.4 i18n Resolver Reachability (378 violations σε 13 αρχεία)

Scanner: `scripts/check-i18n-resolver-reachability.js`. Επιβεβαιώνει ότι κάθε dotted i18n key που αναφέρεται σε static config (service-config.ts, individual-config.ts, modal-select label tables, dropdown-*-labels.ts) είναι προσβάσιμη μέσω του `SERVICE_FORM_NAMESPACES` list στο `src/components/generic/i18n/translate-field-value.ts`. Κλείνει την τρύπα «key exists in locales but unreachable at runtime» που άνοιξε το ADR-280 namespace split.

---

## 4. Hour Estimates — assumptions ρητές

### 4.1 Assumptions ανά εργασία

Οι εκτιμήσεις προϋποθέτουν:
- **1 session = 4-5 ώρες εστιασμένης εργασίας** (όχι clock time)
- **Plan Mode / Recognition** για νέα patterns = 20-30% της slice
- **Boy Scout coexists** — δεν μετράμε incidental cleanup σε slices που αγγίζονται ούτως ή άλλως
- **Δεν συμπεριλαμβάνει push / Vercel deploy** — push είναι manual gate (N.(-1))
- **Emulator runtime** = ~75s ανά full suite run — πρακτικά «free» κόστος iteration

### 4.2 Breakdown ανά ratchet

| Εργασία | Best | Expected | Worst | Assumptions |
|---------|------|----------|-------|-------------|
| **ADR-298 Phase B.2** (accounting ΚΦΔ — 3 coll, role_dual new pattern) | 2,5 | 3,5 | 5 | Plan Mode πρώτα, role_dual matrix builder χρειάζεται |
| **ADR-298 Phase B.3** (CRM — 4 coll, tenant_direct existing) | 1,5 | 2,5 | 3,5 | Canonical pattern, no new work |
| **ADR-298 Phase B.4** (properties — 4 coll, admin_write_only existing) | 1,5 | 2 | 3 | Existing pattern, seed helpers reuse |
| **ADR-298 Phase B.5** (conversations, external_identities — 2 coll) | 1 | 1,5 | 2,5 | tenant_direct + enum validation |
| **ADR-298 Phase B.6** (obligations — 3 coll, tenant_direct) | 1 | 1,5 | 2 | Canonical pattern |
| **Phase B subtotal** | **7,5** | **11** | **16** | |
| **CHECK 3.17 entity audit** (19 αρχεία, Boy Scout) | 4 | 6 | 10 | 15-30 min/file average |
| **i18n resolver reachability** (13 αρχεία, 378 violations) | 2 | 4 | 6 | Εστιασμένο scope, known locations |
| **Critical path total (Scenario A)** | **13,5** | **21** | **32** | |
| **ADR-298 Phase C** (74 coll, 7 subcategories) | 14 | 22 | 35 | C.5 trivial (~15 min/coll), C.1/C.2 complex (~30-45 min/coll) |
| **ADR-298 Phase E** (storage rules, separate ADR) | 4 | 7 | 10 | Νέο harness shape, storage.rules 12KB |
| **i18n missing keys** (4.762 legacy) | 8 | 14 | 22 | Namespace mass-migration + individual fixes |
| **Extra for zero-backlog (Scenario B)** | **+26** | **+43** | **+67** | |
| **Total Scenario B** | **39,5** | **64** | **99** | |

### 4.3 Γιατί τα εύρη είναι μεγάλα

- **Expected** βάσει τρέχουσας ταχύτητας session, σταθερή ποιότητα κώδικα, zero iteration loops.
- **Best** προϋποθέτει ότι κάθε slice είναι πρώτη-φορά-σωστά (realistic για υπάρχοντα patterns, optimistic για νέα).
- **Worst** περιλαμβάνει iteration cycles για test failures, latent bugs που ξυπνάνε σε emulator (ακριβώς αυτό συνέβη στο Phase D.2), ADR drift που χρειάζεται διόρθωση πριν την υλοποίηση.

**Η Phase D.2 του ADR-298** είναι case study για τη διαφορά best vs worst: αρχική εκτίμηση ~3 ώρες, actual ~8 ώρες γιατί 26 runtime failures χρειάστηκαν triage + latent CEL helper bug στο `isAttemptingToModifySystemFields` + harness docId collision bug + manifest misclassifications.

---

## 5. Scenarios

### 5.1 Scenario A — Κρίσιμο path (Google-preferred)

**Στόχος:** Production-ready security + critical compliance. Τα υπόλοιπα ratchets συνεχίζουν να προστατεύουν regression σε Boy Scout mode.

**Scope:**
- ADR-298 Phase B (όλες οι 6 slices B.1 ολοκληρωμένο → B.6)
- CHECK 3.17 entity audit (19 αρχεία)
- i18n resolver reachability (13 αρχεία)

**Εκτίμηση:** **21 ώρες** (expected), εύρος **13,5-32 ώρες**
**Sessions:** 4-6 sessions των 4-5 ωρών
**Χρονικό παράθυρο:** 2-3 εβδομάδες με ρυθμό ~2 sessions/εβδομάδα

**Τι ΔΕΝ περιλαμβάνει:**
- Phase C των 74 pending collections (αλλά CI + CHECK 3.16 συνεχίζουν να απαιτούν tests από day 0 για **νέα** collections)
- Phase E storage rules (ξεχωριστό ADR όταν έρθει η ώρα)
- i18n missing keys 4.762 legacy (Boy Scout μέσω άλλων εργασιών)

### 5.2 Scenario B — Πλήρης ολοκλήρωση zero backlog

**Στόχος:** Zero pending violations σε κάθε ratchet, zero pending collections στο ADR-298.

**Scope:** Όλα του Scenario A + Phase C + Phase E + i18n missing keys full cleanup.

**Εκτίμηση:** **64 ώρες** (expected), εύρος **39,5-99 ώρες**
**Sessions:** 13-20 sessions των 4-5 ωρών
**Χρονικό παράθυρο:** 2-4 μήνες αν διατηρούμε άλλες εργασίες παράλληλα

**Trade-off:** Η παραγωγική αξία πέφτει απότομα μετά τις πρώτες ~25 ώρες. Phase C.5 system-global collections είναι κυρίως boilerplate tests — η καλυμμένη ευθύνη είναι μικρή σε σχέση με τον χρόνο.

### 5.3 Πρόταση (καταγεγραμμένη για μελλοντική αναφορά)

Το ADR αυτό **δεν επιβάλλει** Scenario A ή B — είναι απόφαση του Γιώργου. Ως καταγεγραμμένη πρόταση της assistant στη session 2026-04-11:

> **Scenario A + ratchet operate.** Ολοκλήρωσε Phase B + resolver reachability + CHECK 3.17 (21 ώρες). Άσε Phase C / Phase E / missing i18n keys να καθαρίζουν οργανικά μέσω Boy Scout. Οι υπάρχοντες ratchets εμποδίζουν regression. Το 100% zero-backlog είναι δυσανάλογο κόστος για marginal security benefit.

---

## 6. Bidirectional Cross-References

Κάθε per-check ADR πρέπει να αναφέρει αυτό το ADR ως master roadmap. Αντίστροφα, αυτό το ADR αναφέρει τα per-check ADRs ως authoritative descriptions.

| Per-check ADR | Scope | Reference εδώ |
|---------------|-------|---------------|
| **ADR-195** Entity Audit Trail | CHECK 3.14 (audit value catalogs), CHECK 3.15 (index coverage), CHECK 3.17 (entity audit write coverage) | §2.1, §2.2, §3.2 |
| **ADR-279** i18n Namespace Splitting | CHECK 3.13 (resolver reachability precursor) | §2.2, §3.4 |
| **ADR-280** Per-Namespace Locale Files | CHECK 3.8 (missing keys), CHECK 3.13 (resolver reachability) | §2.2, §3.3, §3.4 |
| **ADR-294** SSoT Ratchet Enforcement | CHECK 3.7 (SSoT centralized modules) | §2.1 |
| **ADR-296** i18n Hardcoded Greek Cleanup | CHECK 3.2 (hardcoded defaultValue), CHECK 3.9 (ICU interpolation) | §2.1 |
| **ADR-298** Firestore Rules Test Coverage | CHECK 3.16 (static manifest), Phase B/C/D/E runtime | §2.1, §2.2, §3.1, §5 |

Bidirectional link installation: Section «See also» προστίθεται στα ADR-195, ADR-294, ADR-296, ADR-298 με αναφορά σε αυτό το ADR (ADR-299). ADR-279 / ADR-280 ενημερώνονται αν / όταν ενημερωθούν στο μέλλον για άλλους λόγους (Boy Scout — δεν απαιτούμε touch τώρα).

---

## 7. Decision

1. **Αυτό το ADR υπάρχει ως SSoT** για τη συνολική progression των ratchets. Οποιαδήποτε νέα εκτίμηση ωρών ή νέα συζήτηση «πόσα μένουν» ξεκινά από εδώ.
2. **Update cadence:** Οι πίνακες §2 / §4 ενημερώνονται όταν:
   - Ένα master milestone ολοκληρώνεται (π.χ. Phase B complete)
   - Ένα νέο check εισάγεται (νέο baseline file)
   - Οι μετρήσεις αλλάζουν >10% από τις τελευταίες καταγεγραμμένες
3. **Canonical location:** `adrs/ADR-299-ratchet-backlog-master-roadmap.md` (μαζί με ADR-298, ADR-296, ADR-297 που ζουν επίσης στο `adrs/`)
4. **Registration:** `docs/centralized-systems/reference/adr-index.md` γραμμή αμέσως μετά από ADR-298
5. **Δεν αντικαθιστά** τα per-check ADRs. Είναι aggregator, όχι replacer.

---

## 8. Consequences

### 8.1 Θετικές

- **Ενιαία εικόνα:** Ένα μέρος για «πού είμαστε, πόσα μένουν». Τέλος στην ad-hoc εκτίμηση.
- **Εκπαίδευση scope:** Scenario A vs B σου επιτρέπει συνειδητή απόφαση με βάση actual numbers.
- **Drift protection:** Όταν μια εκτίμηση εδώ αποδεικνύεται λάθος (π.χ. Phase D.2 actual 8h vs estimate 3h), ενημερώνεται με post-mortem note — η διαφορά γίνεται data point για καλύτερη εκτίμηση επόμενων slices.

### 8.2 Αρνητικές

- **Maintenance burden:** Πρέπει να ενημερώνεται σε master milestones. Αν αγνοηθεί, γίνεται stale και παραπλανητικό.
- **Duplication risk:** Αν κάποιος γράψει «το ADR-299 λέει X» χωρίς να ελέγξει τα baselines, μπορεί να βασιστεί σε stale snapshot. Κανόνας: authoritative count είναι **πάντα** τα `.*-baseline.json` files.

### 8.3 Ουδέτερες

- **Δεν επιβάλλει scope** — ο Γιώργος αποφασίζει A vs B ανά session/εβδομάδα.
- **Δεν αντικαθιστά** τα task lists / plan mode / per-session scratchpads — είναι strategic, όχι tactical.

---

## 9. References

- **ADR-195** — Entity Audit Trail (`docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md`)
- **ADR-279** — i18n Namespace Splitting
- **ADR-280** — Per-Namespace Locale Files
- **ADR-294** — SSoT Ratchet Enforcement (`docs/centralized-systems/reference/adrs/ADR-294-ssot-ratchet-enforcement.md`)
- **ADR-296** — i18n Hardcoded Greek Strings Cleanup (`adrs/ADR-296-i18n-hardcoded-strings-cleanup.md`)
- **ADR-298** — Firestore Rules Test Coverage SSoT (`adrs/ADR-298-firestore-rules-test-coverage-ssot.md`)
- **Pre-commit hooks** — `scripts/git-hooks/pre-commit` + `scripts/check-*.{js,sh}` (canonical scanners)
- **Baselines** — repo root `.*-baseline.json` files (authoritative counts)
- **CLAUDE.md** — N.0.1 (ADR-driven workflow), N.7 (Google-level quality), N.(-1) (no push)

---

## 10. Changelog

| Ημερομηνία | Αλλαγή |
|------------|--------|
| 2026-04-11 | **Initial draft** — consolidated SSoT για όλα τα ratchets, §2 snapshot, §4 hour estimates, §5 scenarios A/B. Triggered από σύγχυση ad-hoc εκτίμησης 15h (παλιά, ADR-298 Phase B only) vs 55-75h (νέα, όλα τα ratchets μαζί). Ο Γιώργος ζήτησε SSoT για αποφυγή επαναλαμβανόμενης σύγχυσης. Bidirectional cross-refs εγκαταστάθηκαν στα ADR-195, ADR-294, ADR-296, ADR-298 στο ίδιο commit. |
| 2026-04-11 | **CHECK 3.17 baseline ratchet 20→19** (commit `56d95be4`) — production safety hardening commit (deletion του `properties/admin-link` destructive chain — super-admin button που θα κατέστρεφε silent τα identity fields 8 πραγματικών contacts ανά tenant). Δεν ήταν CHECK 3.17 cleanup target· ήταν security deletion που ως παρενέργεια μείωσε το baseline. Οι ώρες §4.2 για CHECK 3.17 παραμένουν (19 files × 15-30 min ≈ 4-10h). §2.2 row ενημερώθηκε. Καμία αλλαγή σε scenarios — το admin-link δεν ήταν ποτέ στα hour estimates. | Claude Agent |
| 2026-04-13 | **ADR-298 Phase B.4 COMPLETED** — properties, storage_units, parking_spots, floors (4 collections). adminWriteOnlyMatrix() base for 3 of them; properties overrideCells for update allow (super_admin + isCompanyAdminOfProject). 4 new seeders, 4 new suites, 365 tests green. Pending list 80 → 76. Coverage 14 → 18. B.4 row moved to done. |
| 2026-04-13 | **ADR-298 Phase B.5 COMPLETED** — conversations, external_identities (2 collections). crmDirectMatrix() for both; conversations adds isValidConversationData enum validation. New seed-helpers-messaging.ts module. 405 tests green. Pending list 76→74. Coverage 18→20. |
