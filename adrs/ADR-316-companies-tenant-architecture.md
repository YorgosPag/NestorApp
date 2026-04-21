# ADR-316: Companies Collection — Tenant/Workspace Architecture

| Field | Value |
|-------|-------|
| **Status** | ✅ IMPLEMENTED (2026-04-21) |
| **Category** | Architecture / Multi-Tenancy |
| **Author** | Γιώργος Παγώνης + Claude Code |
| **Related ADRs** | ADR-017, ADR-210, ADR-294 |

---

## 1. Σκοπός

Τεκμηρίωση της αρχιτεκτονικής της `companies` collection στο Firestore και
της σχέσης της με τη `contacts` collection. Αποσαφήνιση ορολογίας για
αποφυγή σύγχυσης μεταξύ "εταιρεία ως tenant" και "εταιρεία ως CRM contact".

---

## 2. Αρχιτεκτονική

### 2.1 Δύο ξεχωριστές έννοιες "εταιρεία"

| Συλλογή | Σκοπός | Παράδειγμα |
|---------|--------|------------|
| `companies/{companyId}` | **Tenant/Workspace** — ο οργανισμός που χρησιμοποιεί την πλατφόρμα | `"Pagonis TEK"` |
| `contacts` (type=company) | **CRM contact** — εταιρεία-πελάτης διαχειριζόμενη εντός workspace | `"ALFA ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ"`, `"BETA CONSTRUCTIONS"` |

### 2.2 Πεδία `companies` document

```typescript
interface CompanyDocument {
  id: string;           // comp_xxxx — από generateCompanyId()
  name: string;         // Workspace display name (π.χ. "Pagonis TEK")
  contactId: string | null; // null — tenant δεν έχει self-profile CRM contact
  status: 'active' | 'inactive' | 'suspended';
  plan: 'free' | 'pro' | 'enterprise';
  settings: CompanySettings;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;    // Firebase UID
}
```

### 2.3 Tenant isolation

Κάθε Firestore document που ανήκει σε ένα workspace έχει `companyId` field
που δείχνει στο αντίστοιχο `companies` document. Αυτό ισχύει και για τα
CRM contacts: `contacts[*].companyId = companies.id`.

---

## 3. Name Resolution (SSoT)

`companies.name` = το workspace name. Επιλύεται ως εξής:

| Σειρά | Πηγή | Πότε χρησιμοποιείται |
|-------|------|----------------------|
| 1 | `contactData.name` (explicit) | Καλών περνά δεδομένα ρητά |
| 2 | `users/{createdBy}.displayName` | Materialization χωρίς explicit data |
| 3 | `Company #<idPrefix>` | Fallback (χωρίς user ή displayName) |

**Implementation:** `ensureCompanyDocument()` — `src/services/company-document.service.ts`

---

## 4. Materialization Flow

Το `companies` document **ΔΕΝ δημιουργείται** κατά τη δημιουργία CRM contacts.
Δημιουργείται lazily όταν:

1. Το audit system ανιχνεύει ότι `companies/{companyId}` δεν υπάρχει
2. Καλεί `ensureCompanyDocument(companyId, undefined, uid)`
3. Το service κάνει lookup `users/{uid}.displayName` → θέτει `name`

**Γνωστό limitation:** Race condition αν το πρώτο audit event φτάσει πριν
το user document γραφεί (απίθανο — users γράφονται κατά login).

**Repair:** `PATCH /api/admin/bootstrap-company` → `repairCompanyDocument()`

---

## 5. contactId = null

`companies.contactId` είναι πάντα `null` στην τρέχουσα αρχιτεκτονική.
Ο tenant/workspace δεν έχει αντίστοιχο self-profile CRM contact.

Αν μελλοντικά θελήσουμε "company profile" (πχ για τιμολόγηση, λογότυπο
workspace), θα δημιουργηθεί ένα special contact με `isWorkspaceProfile: true`
και το `contactId` θα ενημερωθεί.

---

## 6. Changelog

| Date | Change |
|------|--------|
| 2026-04-21 | Initial ADR — bug fix: `name` από `users.displayName` αντί από client contacts. `contactId` = null. |

