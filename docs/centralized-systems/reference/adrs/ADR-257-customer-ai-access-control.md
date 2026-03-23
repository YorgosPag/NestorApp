# ADR-257: Customer AI Access Control (Buyer/Owner/Tenant)

| Field | Value |
|-------|-------|
| **Status** | DRAFT |
| **Date** | 2026-03-23 |
| **Author** | Georgios Pagonis + Claude AI |
| **Category** | AI Architecture / RBAC / Security |
| **Depends On** | ADR-171 (Agentic AI), ADR-032 (Linking Model), ADR-244 (Multi-Buyer), ADR-197 (Sales) |
| **SSoT Config** | `src/config/ai-role-access-matrix.ts` |

---

## 1. Context

Η εφαρμογή χρησιμοποιεί AI agent (Telegram/WhatsApp/Email) που απαντά σε ερωτήσεις χρηστών. Υλοποιήθηκε RBAC (Role-Based Access Control) για μηχανικούς/εργολάβους μέσω `ai-role-access-matrix.ts`.

Τώρα πρέπει να καλύψουμε τους **πελάτες** — φυσικά ή νομικά πρόσωπα που:
- Αγόρασαν unit (buyer)
- Κατέχουν unit (owner)
- Νοικιάζουν unit (tenant)

**Ερώτημα:** Τι πληροφορίες δικαιούται κάθε ρόλος πελάτη μέσω AI agent;

---

## 2. Decisions (Αποφάσεις Γιώργου — 2026-03-23)

### 2.1 Πληρωμές
- Buyer βλέπει: **επόμενη δόση + ληξιπρόθεσμες + συνολικό υπόλοιπο**
- Buyer ΔΕΝ βλέπει: αναλυτικά ποσά πληρωμών, ιστορικό πληρωμών, αποδείξεις
- ΟΧΙ export PDF / email με οικονομικά στοιχεία
- ΟΧΙ αυτόματες ειδοποιήσεις πληρωμών (future consideration)
- Μορφή απάντησης: "Η επόμενη δόση σου είναι €10.000 στις 30/04. Συνολικό υπόλοιπο: €55.000"

### 2.2 Κατασκευή
- Buyer ΔΕΝ βλέπει φάσεις κατασκευής, πρόοδο, ή % ολοκλήρωσης
- Τίποτα από construction_phases/construction_tasks

### 2.3 Τιμές
- Buyer ΔΕΝ βλέπει asking price (τιμή λίστας)
- Owner βλέπει final price (τελική τιμή — ξέρει τι πλήρωσε)

### 2.4 Unit Links
- Δημιουργούνται **αυτόματα** κατά την κράτηση (reservation)
- Co-buyers: **ίδια πρόσβαση** — δεν υπάρχει primary/secondary διάκριση

### 2.5 Στοιχεία Επικοινωνίας
- Buyer μπορεί να **ΠΡΟΣΘΕΣΕΙ** νέα στοιχεία (τηλέφωνο, email, social media)
- Buyer ΔΕΝ μπορεί να **ΔΙΑΓΡΑΨΕΙ ή ΤΡΟΠΟΠΟΙΗΣΕΙ** υπάρχοντα στοιχεία
- Λογική: **append-only** — μόνο ο admin κάνει delete/edit
- Γιατί: Αποφυγή σεναρίου "οφειλέτης αλλάζει τηλέφωνο για να αποφύγει επικοινωνία"

### 2.6 Blocked Information — AI Behavior
- Όταν ρωτάει κάτι που δεν δικαιούται: **"Δεν έχω αυτή την πληροφορία"**
- ΟΧΙ "δεν έχετε δικαίωμα" — δεν αποκαλύπτουμε ότι η πληροφορία υπάρχει
- Pattern: Google Assistant style

### 2.7 Παράπονα / Προβλήματα
- Buyer μπορεί να αναφέρει πρόβλημα μέσω AI
- AI κατηγοριοποιεί αυτόματα σοβαρότητα:
  - **Urgent** (υγρασία, πλημμύρα, ρωγμή) → δημιουργεί task + ειδοποιεί admin
  - **Normal** (μικρό πρόβλημα) → καταγράφει, admin βλέπει στη λίστα
  - **Low/Noise** (ανοησίες, εκτός αρμοδιότητας) → καταγράφει χωρίς ειδοποίηση
- Ο admin αποφασίζει τι αξίζει ενέργεια

### 2.7.1 Αποστολή Αρχείων από Buyer (Upload → Approval Flow)
- Buyer μπορεί να στείλει φωτογραφία/αρχείο μέσω Telegram/Email/Messenger
- Ροή:
  1. AI αναλύει τι είναι (από λεκτικά + vision analysis εικόνας)
  2. AI χρησιμοποιεί κεντρικοποιημένο file system για σωστό path + ονομασία
  3. AI ειδοποιεί admin: "Ο [Buyer] έστειλε [περιγραφή]. Προτείνω καταχώρηση: [φάκελος] / [όνομα αρχείου]. Θέλεις να καταχωρήσω;"
  4. Admin εγκρίνει → AI καταχωρεί αυτόματα στο σωστό path
  5. Admin απορρίπτει → αρχείο δεν καταχωρείται (παραμένει στο chat history)
- **ΚΡΙΣΙΜΟ:** Κανένα αρχείο buyer ΔΕΝ καταχωρείται χωρίς έγκριση admin
- Ο AI κάνει τη δουλειά (ανάλυση, ονομασία, τοποθέτηση) — ο admin κάνει μόνο approve/reject

### 2.7.2 Ασαφές Αρχείο — AI ζητάει διευκρινίσεις
- Αν ο AI δεν μπορεί να αξιολογήσει τι είναι το αρχείο (ασαφής φωτογραφία, χωρίς context):
  1. AI ρωτάει τον buyer: "Τι αφορά αυτή η φωτογραφία; Σε ποιο χώρο του ακινήτου;"
  2. Buyer απαντάει: "Υγρασία στο μπάνιο, δεύτερο μπάνιο"
  3. AI τώρα έχει αρκετές πληροφορίες → προτείνει path + ονομασία στον admin
  4. Πάντα χρησιμοποιεί τα κεντρικοποιημένα συστήματα file system + ονοματοδοσίας
- Στόχος: σαφής καθοδήγηση στον admin με πλήρη πληροφορία πριν approve/reject

### 2.7.3 Ενημέρωση Buyer μετά Approve/Reject
- Admin εγκρίνει → buyer λαμβάνει: "✅ Η φωτογραφία σου καταχωρήθηκε"
- Admin απορρίπτει → buyer λαμβάνει: "ℹ️ Λάβαμε το αρχείο σου, ευχαριστούμε"
- Σε κάθε περίπτωση ο buyer ενημερώνεται — δεν μένει χωρίς απάντηση

### 2.8 Φωτογραφίες, Κατόψεις & Συνημμένα
- Buyer βλέπει φωτογραφίες του unit του
- Buyer βλέπει κάτοψη (floorplan) του ορόφου — ο AI στέλνει εικόνα
- Buyer λαμβάνει συνημμένα (PDF, εικόνες, αρχεία) σε ΟΛΑ τα κανάλια που τα υποστηρίζουν:

| Κανάλι | Φωτογραφίες | PDF/Αρχεία | Όριο |
|--------|------------|------------|------|
| Telegram | ✅ | ✅ | 50MB |
| Email | ✅ | ✅ | Mailgun limits |
| Messenger | ✅ | ✅ | 25MB |
| Instagram | ✅ | ❌ (περιορισμός Meta API) | — |

### 2.9 Νομικά Πρόσωπα (Future Phase)
- Αν εταιρεία αγοράσει unit, ο νόμιμος εκπρόσωπος = ίδια πρόσβαση
- Εκπρόσωπος αναγνωρίζεται μέσω contact relationship (representative)
- Δεν υλοποιείται τώρα — τεκμηριώνεται μόνο

### 2.10 Parking & Αποθήκη
- Buyer βλέπει αν έχει parking/αποθήκη συνδεδεμένη (μέσω entity_links)

### 2.11 Τοποθεσία Unit
- Buyer βλέπει όροφο + θέση (π.χ. "2ος όροφος, Α-2")

### 2.12 Tenant (Ενοικιαστής)
- Μόνο γενικά ραντεβού — ΟΧΙ ειδικά για προβλήματα/επισκευές
- Βασικά στοιχεία unit (εμβαδά, χαρακτηριστικά)
- ΟΧΙ τιμές, πληρωμές, legal, κατασκευή

---

## 3. Audit Findings — 10 Κρίσιμα Κενά

### 3.1 Security Gaps

#### GAP-1: No Unit-Level Scoping (HIGH)
**Πρόβλημα:** Ο buyer μπορεί να κάνει query ΟΛΑ τα units του project, όχι μόνο το δικό του.
**Τρέχων κώδικας:** `enforceRoleAccess()` φιλτράρει μόνο κατά `projectId`, όχι κατά unit.
**Κίνδυνος:** Buyer unit A-1 βλέπει τιμές/στοιχεία unit B-3.
**Λύση:** Unit-level contact link (`targetEntityType: "unit"`) + filter στο executor.

#### GAP-2: Document Leakage (HIGH)
**Πρόβλημα:** Buyer μπορεί να κάνει query `documents` collection χωρίς unit filter.
**Κίνδυνος:** Πρόσβαση σε εμπιστευτικά αρχεία (νομικά, οικονομικά, εσωτερικά).
**Λύση:** Scope documents query σε `unitId` ή `contactId` του buyer.

#### GAP-3: Owner Role Unverified (MEDIUM)
**Πρόβλημα:** Owner role δεν ελέγχεται σε unit level — μόνο σε project level.
**Κίνδυνος:** Contact linked ως "owner" στο project βλέπει ΟΛΑ τα units.
**Λύση:** Ίδιο με GAP-1 — unit-level links.

### 3.2 Functionality Gaps

#### GAP-4: Payment Status Invisible
**Πρόβλημα:** `blockedFields` μπλοκάρει ΟΛΑ τα `commercial.paymentSummary.*` πεδία.
**Αποτέλεσμα:** Buyer ρωτάει "πόσα χρωστάω;" → AI: "Δεν έχω αυτή την πληροφορία".
**Απόφαση:** Buyer βλέπει ΜΟΝΟ: nextInstallmentAmount, nextInstallmentDate, remainingAmount, overdueInstallments.

#### GAP-5: Construction Progress — ΑΠΟΦΑΣΗ: BLOCKED
**Απόφαση Γιώργου:** Buyer ΔΕΝ βλέπει τίποτα από κατασκευή.
**Status:** CLOSED — δεν χρειάζεται υλοποίηση.

#### GAP-6: Co-Buyers Not Modeled
**Πρόβλημα:** `contact_links` δεν υποστηρίζει πολλαπλούς αγοραστές σε 1 unit στο RBAC.
**Απόφαση:** Ίδια πρόσβαση για όλους τους co-buyers.
**Λύση:** Unit-level links δημιουργούνται για ΟΛΟΥΣ τους owners[] στην κράτηση.

#### GAP-7: AI Guidance Missing
**Πρόβλημα:** Όταν ο buyer δεν έχει πρόσβαση, λαμβάνει generic error.
**Απόφαση:** AI λέει "Δεν έχω αυτή την πληροφορία" — Google style, χωρίς εξήγηση.

### 3.3 Architectural Gaps

#### GAP-8: Project-Level Links vs Unit-Level Needs
**Πρόβλημα:** `contact_links.targetEntityType` = "project" πάντα. Δεν υπάρχει "unit" link.
**Λύση:** Επέκταση contact_links: `targetEntityType: "unit"`, `targetEntityId: "unit_xxx"`.
**Trigger:** Αυτόματα κατά την κράτηση.

#### GAP-9: Field Redaction = All-or-Nothing
**Πρόβλημα:** `blockedFields` μπλοκάρει ΟΛΑ τα payment fields ή ΚΑΝΕΝΑ.
**Λύση:** Νέο concept: `buyerVisiblePaymentFields` — buyer βλέπει ΜΟΝΟ συγκεκριμένα πεδία στο δικό του unit.

#### GAP-10: Nested Field Query Impossible
**Πρόβλημα:** Firestore δεν μπορεί να φιλτράρει σε nested πεδία (`commercial.buyerContactId`).
**Υπάρχουσα λύση:** Τα units ήδη flatten σε `_buyerContactId`. Αυτό μπορεί να χρησιμοποιηθεί.

---

## 4. Access Matrix (Τελική — Βάσει Αποφάσεων)

### 4.1 Buyer (Αγοραστής)

| Δεδομένο | Πρόσβαση | Scoping | Σημειώσεις |
|----------|----------|---------|-----------|
| Unit βασικά (εμβαδά, δωμάτια, όροφος, θέση) | ✅ READ | Δικό unit μόνο | Ενεργειακή κλάση, χαρακτηριστικά, orientation |
| Unit φωτογραφίες | ✅ READ | Δικό unit μόνο | AI στέλνει εικόνες |
| Φωτογραφίες έργου | ✅ READ | Parent project | Γενικές φωτογραφίες (εξωτερικά, κοινόχρηστα) |
| Κάτοψη ορόφου unit | ✅ READ | Όροφος unit | Κάτοψη ορόφου όπου βρίσκεται το ακίνητο |
| Κάτοψη ορόφου αποθήκης | ✅ READ | Όροφος αποθήκης | Αν έχει linked αποθήκη |
| Κάτοψη ορόφου parking | ✅ READ | Όροφος parking | Αν έχει linked θέση στάθμευσης |
| Γενική κάτοψη έργου | ✅ READ | Parent project | Site plan, γενική διάταξη |
| Διεύθυνση κτηρίου | ✅ READ | Parent building | Πλήρης διεύθυνση |
| Διεύθυνση έργου | ✅ READ | Parent project | Τοποθεσία έργου |
| Επόμενη δόση + υπόλοιπο | ✅ READ | Δικό unit μόνο | nextInstallmentAmount, nextInstallmentDate, remainingAmount |
| Ληξιπρόθεσμες δόσεις | ✅ READ | Δικό unit μόνο | overdueInstallments (αριθμός μόνο) |
| Legal phase | ✅ READ | Δικό unit μόνο | Προσύμφωνο/Οριστικό/Εξοφλητήριο — ΜΟΝΟ δικά του συμβόλαια |
| Πίνακας ποσοστών | ✅ READ | Ολόκληρος | Κωδικός unit + ποσοστό/χιλιοστά — ΧΩΡΙΣ ονόματα τρίτων, ΧΩΡΙΣ συμβόλαια τρίτων |
| Building info | ✅ READ | Parent building | Όνομα, διεύθυνση, κοινόχρηστοι χώροι (γυμναστήριο, πισίνα, αίθουσα κλπ) |
| Parking/Αποθήκη | ✅ READ | Δικά linked | Μέσω entity_links |
| Documents | ✅ READ + SEND | Δικά μόνο | Ενεργειακό, κατόψεις, Συγγραφή Υποχρεώσεων, άδεια έργου, τοπογραφικό, δικά του συμβόλαια. Μπορεί να τα λάβει ως συνημμένα για αποστολή σε δικηγόρο/συμβολαιογράφο. |
| Λίστες δικαιολογητικών | ✅ READ | Ανά διαδικασία | AI εξηγεί τι έγγραφα απαιτούνται (πώληση, μεταβίβαση, δάνειο κλπ) + στέλνει όσα υπάρχουν ήδη στο σύστημα |
| Ραντεβού (κλείσιμο/αλλαγή) | ✅ REQUEST | Δικά μόνο | Αίτημα → pending → admin εγκρίνει. AI ελέγχει πρόγραμμα + προτείνει εναλλακτικές. |
| Ραντεβού (ακύρωση) | ✅ DIRECT | Δικά μόνο | Αυτόματη ακύρωση + ειδοποίηση admin. ΔΕΝ χρειάζεται έγκριση. |
| Παράπονο/πρόβλημα | ✅ WRITE | — | AI κατηγοριοποιεί urgent/normal/low |
| Προσθήκη στοιχείων | ✅ APPEND | Δικά μόνο | Νέο τηλέφωνο, email, social — ΟΧΙ delete/edit |
| Ημ/νίες κράτησης & πώλησης | ✅ READ | Δικό unit μόνο | reservationDate, saleDate |
| Συμβολαιογράφος | ✅ READ | Δικό unit μόνο | Όνομα, τηλέφωνο — δημόσιο πρόσωπο |
| Δικηγόρος πωλητή | ✅ READ | Δικό unit μόνο | Όνομα, τηλέφωνο — εμπλέκεται στη συναλλαγή |
| Δικηγόρος αγοραστή | ✅ READ | Δικό unit μόνο | Όνομα, τηλέφωνο — εμπλέκεται στη συναλλαγή |
| Στοιχεία εταιρείας | ✅ READ | — | Τηλέφωνο, email, ωράριο, διεύθυνση (δημόσια πληροφορία) |
| Στοιχεία λογιστηρίου | ✅ READ (επικοινωνία μόνο) | — | Τηλέφωνο, email, ωράριο λογιστηρίου. ❌ ΟΧΙ φορολογικά/οικονομικά δεδομένα |
| Ιστορικό επικοινωνίας | ❌ (buyer) / ✅ (admin) | — | Buyer βλέπει ΜΟΝΟ τρέχουσα συζήτηση. Admin βλέπει πλήρες ιστορικό ΟΛΩΝ των αγοραστών. ΟΛΑ καταγράφονται. |
| Asking price | ❌ | — | Τιμή λίστας κρυφή |
| Αναλυτικές πληρωμές | ❌ | — | Ιστορικό, αποδείξεις, PDF |
| Κατασκευή | ❌ | — | Φάσεις, πρόοδος, % |
| Άλλα units | ❌ | — | Μόνο δικό |
| Άλλοι αγοραστές | ❌ | — | Ονόματα, πληρωμές τρίτων |
| Contacts / Leads | ❌ | — | Εσωτερικά CRM |
| Κόστη / Budget | ❌ | — | Εργολάβοι, margins |
| Δάνειο | ❌ | — | Κατάσταση, τράπεζα, ποσό |

### 4.2 Owner (Ιδιοκτήτης)

Ίδιο με Buyer + :
| Δεδομένο | Διαφορά |
|----------|---------|
| Final price | ✅ Βλέπει (ξέρει τι πλήρωσε) |

### 4.3 Tenant (Ενοικιαστής)

| Δεδομένο | Πρόσβαση | Σημειώσεις |
|----------|----------|-----------|
| Unit βασικά | ✅ READ | Εμβαδά, χαρακτηριστικά |
| Building info | ✅ READ | Όνομα, διεύθυνση |
| Ραντεβού (γενικά) | ✅ REQUEST | Αίτημα → pending → admin εγκρίνει. Μόνο γενικά, ΟΧΙ για προβλήματα |
| Τιμές | ❌ | — |
| Πληρωμές | ❌ | — |
| Legal | ❌ | — |
| Κατασκευή | ❌ | — |
| Documents | ❌ | — |

---

## 5. Implementation Approach (High-Level)

### Phase 1: Unit-Level Contact Links
- Επέκταση `contact_links`: `targetEntityType: "unit"` + `targetEntityId: "unit_xxx"`
- Αυτόματη δημιουργία κατά την κράτηση (reservation)
- Co-buyers: link για ΚΑΘΕ contact στο `owners[]`
- Ο admin μπορεί μέσω AI: "Σύνδεσε τον Γιάννη ως αγοραστή στο ΔΙΑΜΕΡΙΣΜΑ Α-1"

### Phase 2: Unit-Level Scoping στο Executor
- Νέο πεδίο στο `ContactMeta`: `linkedUnitIds: string[]`
- `enforceRoleAccess()`: αν buyer/owner/tenant → inject filter `id IN linkedUnitIds`
- Documents: filter by `unitId IN linkedUnitIds`

### Phase 3: Selective Payment Visibility
- Νέο concept στο `RoleAccessConfig`: `buyerVisiblePaymentFields`
- Buyer βλέπει ΜΟΝΟ: nextInstallmentAmount, nextInstallmentDate, remainingAmount, overdueInstallments
- ΜΟΝΟ στο δικό του unit — ΟΧΙ σε άλλα

### Phase 4: Complaint System (AI Triage)
- Buyer στέλνει παράπονο → AI κατηγοριοποιεί (urgent/normal/low)
- Urgent → `firestore_write("tasks", { priority: "critical", ... })` + ειδοποίηση admin
- Normal/Low → `firestore_write("tasks", { priority: "normal/low", ... })`

### Phase 5: Append-Only Contact Updates
- Buyer μπορεί να προσθέσει: τηλέφωνο, email, social
- Tool executor: append σε `phones[]`, `emails[]`, `socialMedia[]` arrays
- ΔΕΝ μπορεί να delete/edit — audit trail

### Phase 6: AI Prompt + Floorplan/Photo Delivery
- System prompt: buyer-specific guidance
- AI στέλνει φωτογραφίες/κατόψεις μέσω Telegram (send_photo tool)
- Blocked data: "Δεν έχω αυτή την πληροφορία"

### Future: Legal Entity Representative
- Εταιρεία αγοράζει → εκπρόσωπος = proxy access
- Αναγνώριση μέσω contact relationship (representative)

---

## 6. Data Flow (Post-Implementation)

```
Buyer στέλνει Telegram: "Πόσα χρωστάω;"
    ↓
handler.ts: resolveContactFromTelegram(userId)
    → ResolvedContact {
        contactId,
        projectRoles: [{role:"buyer", entityType:"unit", entityId:"unit_xxx"}],
        linkedUnitIds: ["unit_xxx"]
      }
    ↓
pipeline → agentic loop
    → System prompt: "Ρόλος ΑΓΟΡΑΣΤΗΣ. Linked unit: unit_xxx"
    ↓
AI calls: firestore_get_document("units", "unit_xxx")
    → enforceRoleAccess: buyer? ✅ unit is in linkedUnitIds
    → redactRoleBlockedFields: keep nextInstallment+remaining, block askingPrice+paidAmount
    ↓
AI responds: "✅ Η επόμενη δόση σου είναι €10.000 στις 30/04. Συνολικό υπόλοιπο: €55.000"
```

---

## 7. Existing Infrastructure to Reuse

| Σύστημα | Αρχείο | Τι κάνει |
|---------|--------|---------|
| `ai-role-access-matrix.ts` | `src/config/` | SSoT roles (extend, don't fork) |
| `contact-linker.ts` | `src/services/contact-recognition/` | Resolve contact (extend with unitIds) |
| `ENTITY_ASSOCIATION_ROLES` | `src/types/entity-associations.ts` | Unit roles: owner, tenant, buyer |
| `ContactMeta` | `src/types/ai-pipeline.ts` | Pipeline context (extend with linkedUnitIds) |
| `units.commercial.owners[]` | Firestore | Multi-owner data (ADR-244) |
| `units.commercial.buyerContactId` | Firestore | Single buyer ref |
| `entity_links` | Firestore | Parking/storage → unit connections |
| `GRANT_SCOPES` | `src/lib/auth/types.ts` | Unit-level delegation scopes |

---

## 8. Changelog

| Date | Change |
|------|--------|
| 2026-03-23 | Initial draft — 10 gaps identified, access matrix proposed |
| 2026-03-23 | Decisions finalized — payment (B), no construction, append-only contacts, complaint triage |
