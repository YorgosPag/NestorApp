# ADR-326: Tenant Org Structure & Departmental Routing SSoT

| Field | Value |
|-------|-------|
| **Status** | ✅ v2.0 — FULLY IMPLEMENTED (2026-04-26) |
| **Category** | Architecture / Multi-Tenancy / Notifications / Contacts |
| **Author** | Γιώργος Παγώνης + Claude Code |
| **Related ADRs** | ADR-145 (Property Types SSoT), ADR-177 (Employer Picker), ADR-198 (Sales-Accounting Bridge), ADR-210 (Enterprise IDs), ADR-244 (Multi-buyer), ADR-282 (Persona Refactor), ADR-291 (Notification Pattern), ADR-294 (SSoT Ratchet), ADR-316 (Companies Tenant Architecture), ADR-318 (Workplace Toggle), ADR-319 (Address Type Registry), ACC-019 (Invoice Email Sending) |

> ✅ **APPROVED — v1.0 (2026-04-25)** — Tutte le 11 Open Questions + 8 implementation gaps risolte con Γιώργος. Pronto per Phase 0 implementation in nuova sessione (vedi `ADR-326-HANDOFF.md`).

---

## 1. Σκοπός

Definire una **Single Source of Truth** per la **struttura organizzativa interna** di un'entità business (tenant L1 + CompanyContact L2 — full hierarchy; ServiceContact L3 — `responsiblePersons[]` enriched only), composta da:

1. **Τμήματα** (departments) — λογιστήριο, μηχανικοί, μελέτες, νομικό, πωλήσεις, …
2. **Υπεύθυνοι ανά τμήμα** (department responsibles) — uno o più per dipartimento
3. **Επικοινωνίες ανά υπεύθυνο** (per-responsible communications) — email, telefono fisso, mobile, εσωτερικός (PBX extension), preferred channel
4. **Routing notifiche email** — l'app deve sapere a chi mandare ogni tipo di notifica del proprio tenant (es. ricevuta prenotazione → email contabile del tenant; assegnazione studio → email responsabile studi)

Il problema concreto da cui partiamo: oggi l'email contabile è `process.env.ACCOUNTING_NOTIFY_EMAIL` (single global env var). In multi-tenant produzione = bloccante: tutti i tenant manderebbero al suo λογιστήριο.

---

## 2. Stato attuale (codebase audit, 2026-04-25)

### 2.1 Modello contatti — 3 tipi

| Tipo | Discriminator | File | Mapping naturale |
|------|---------------|------|------------------|
| `IndividualContact` | `type: 'individual'` | `src/types/contacts/contracts.ts:91` | Φυσικά πρόσωπα |
| `CompanyContact` | `type: 'company'` | `src/types/contacts/contracts.ts:173` | Νομικά πρόσωπα |
| `ServiceContact` | `type: 'service'` | `src/types/contacts/contracts.ts:210` | Δημόσιες υπηρεσίες |

### 2.2 Persone embedded oggi

| Tipo persona | Su quale entità | Campi disponibili |
|--------------|-----------------|-------------------|
| `ContactPerson` (`contracts.ts:313-320`) | `CompanyContact.contactPersons[]` | `name`, `position?`, `department?`, `email?: string`, `phone?: string`, `isPrimary` |
| `ResponsiblePerson` (`contracts.ts:322-325`) | `ServiceContact.responsiblePersons[]` | extends ContactPerson + `responsibilities[]`, `availableHours?` |

**Limiti critici:**
- `email` e `phone` sono **single string**, non array `EmailInfo[]` / `PhoneInfo[]`
- nessun PBX `extension` strutturato
- nessuna UI dedicata per editare questi array (sono audit-tracked ma orfani UI)

### 2.3 ContactRelationship (collection separata)

Modello ricco a parte, in `contact_relationships`:
- `RelationshipType` enum 35 valori (employee/manager/director/ceo/civil_servant/department_head/…)
- `department: string` libero
- `position?`
- `responsibilities[]`, `authorityLevel`, `signingAuthorityLimit`, `priority`
- `contactInfo: ProfessionalContactInfo` con `businessPhone`, `businessMobile`, `businessEmail`, `extension`, `extensionNumber`, `officeNumber`, `availableHours`, `preferredContactMethod`
- File: `src/types/contacts/relationships/interfaces/relationship.ts`

**Questo è il modello più ricco oggi**, ma collega *full contact records*, non persone embedded.

### 2.4 Departments oggi

- Campo `department: string` libero in 4+ posti (Individual, Service, ContactPerson, ContactRelationship)
- 8 preset session-only in `relationship-form-presets.ts:84-93`: `management, finance, hr, sales, engineering, operations, legal, it`
- **Nessun enum globale**, nessun registry Firestore, nessuna i18n SSoT delle dipartimenti

### 2.5 Multi-tenant primitives

| Cosa | Dove | Pattern |
|------|------|---------|
| Tenant ID | JWT custom claim `companyId` | enforced via middleware + Firestore rules |
| Tenant doc | `companies/{companyId}` (ADR-316) | name + plan + `settings: CompanySettings` + status |
| Workspace runtime config | `system/company` singleton + `EnterpriseCompanySettingsService` | 15min in-memory cache + RealtimeService broadcast |
| Per-module per-tenant settings | `accounting_settings/{docId}` flat coll, `companyId` field stamped | `FirestoreAccountingRepository` + `TenantContext` |
| Firestore rules helpers | `belongsToCompany`, `isInternalUserOfCompany`, `canWriteAccountingSingleton` | `firestore.rules:3344-3452` |
| Hook ratchet | `scripts/check-firestore-companyid.sh` (CHECK 3.10) | baseline 0 violations |

### 2.6 Email routing — sito per sito

| Sender | File | Recipient source | Department logica |
|--------|------|------------------|-------------------|
| `notifyAccountingOffice` | `src/services/sales-accounting/accounting-office-notify.ts:287` | `process.env.ACCOUNTING_NOTIFY_EMAIL` | accounting |
| `notifyBuyer*` | `src/services/sales-accounting/buyer-notify.ts:30+` | caller-passed CRM contact email | customer-facing |
| Invoice/APY cert email | `src/app/api/accounting/invoices/[id]/send-email/route.ts` | cascading: contact → snapshot → manual (ACC-019) | accounting outbound |
| PO email supplier | `src/services/procurement/po-email-service.ts:65+` | caller-passed (supplier contact) | procurement |
| Professional assigned | `src/app/api/notifications/professional-assigned/route.ts:92-106` | Firestore contact `extractPrimaryEmail` | legal/engineering |
| Showcase share | `src/services/showcase-core/api/create-email-route.ts` | user types at share time | sales |
| AI admin send-email | UC-012 `admin-send-email-module.ts` | CRM contact lookup by name | admin-initiated |

**Zero routing Firestore-backed per dipartimento del tenant. Solo 1 env var globale.**

### 2.7 EnterpriseCompanySettings — campi email già tipizzati ma MAI letti

`src/services/company/company-settings-types.ts`:
- `contactInfo.salesEmail` (line 43) — popolato da env, mai usato per routing
- `contactInfo.supportEmail` (line 44) — idem
- `communicationSettings.defaultFromEmail` (line 75) — idem

Gap: tipo esiste, popolato ma scollegato dai sender. Codice morto.

### 2.8 ADRs vicini

- **ADR-198** Sales-Accounting Bridge — pattern `notifyAccountingOffice` da superare
- **ADR-316** Companies Tenant Architecture — `CompanySettings` natural extension point
- **ACC-019** Invoice Email Sending — cascading resolver da estendere
- **ADR-291** Notification Pattern Selection — UI compliance per settings page
- **ADR-294** SSoT Ratchet — registry slot da aggiungere

---

## 3. Decisione architetturale (proposta)

### 3.1 Scope: tre livelli orthogonali

Distinguiamo nettamente:

| Livello | Cosa | Dove vive | Chi modifica |
|---------|------|-----------|--------------|
| **L1 — Tenant Self** | Org del tenant proprietario del workspace | `companies/{companyId}.settings.orgStructure` | tenant `company_admin` |
| **L2 — External Company Contact** | Org di un CompanyContact CRM | `contacts/{id}.orgStructure` (sostituisce `contactPersons[]`) | qualsiasi `internal_user` autorizzato sul contact |
| **L3 — Public Service Contact** | ⚠️ **SIMPLIFIED — `responsiblePersons[]` ENRICHED** (no orgStructure) | `contacts/{id}.responsiblePersons[]` (esistente, schema upgrade in Phase 4) | come L2 |

**ServiceContact (L3): trattamento semplificato (decisione Γιώργου 2026-04-25).** Use case mismatch: i tenant costruttori non gestiscono l'org chart interno dei pubblici servizi (εφορία, πολεοδομία, ΥΔΟΜ). Si manda 1-2 email/anno → ierarchia 4 livelli = overkill. ServiceContact mantiene `responsiblePersons[]` esistente con UPGRADE solo dei comms (EmailInfo[]/PhoneInfo[] in Phase 4). NO hierarchy. NO orgStructure aggregate. NO «Δομή Οργανισμού» tab. Riapribile in ADR successivo se cambiano use cases.

**IndividualContact: NESSUN orgStructure.** Una persona fisica non ha dipartimenti. Ha già `department: string` (within employer) — manteniamo così, eventualmente upgrade a riferimento al `OrgDepartment` dell'employer (se employer ha L2 settato).

### 3.2 Schema dati condiviso (SSoT type)

Type unico riusato sui 3 livelli, in nuovo file `src/types/org/org-structure.ts`:

```typescript
// SSoT — applicabile a Tenant (L1) e CompanyContact (L2). ServiceContact (L3) NON usa orgStructure (vedi §3.1).
export interface OrgStructure {
  /** ID enterprise (org_xxx) per audit/diff stability */
  id: string;
  departments: OrgDepartment[];
  /** Routing rules: map evento → dipartimento target */
  notificationRouting?: NotificationRoutingRule[];
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface OrgDepartment {
  /** Enterprise ID — odep_xxx */
  id: string;
  /** Codice canonico (vedi §3.3) */
  code: DepartmentCode;
  /** Display label override (i18n key OR free string per code='custom') */
  label?: string;
  /** Telefoni a livello dipartimento (centralino, fax dept) */
  phones?: PhoneInfo[];
  /** Email a livello dipartimento (es. accounting@tenant.gr) */
  emails?: EmailInfo[];
  members: OrgMember[];
  /** Soft-delete + audit (ADR-191) */
  status: 'active' | 'archived';
  createdAt: Timestamp;
}

export interface OrgMember {
  /** Enterprise ID — omem_xxx */
  id: string;
  displayName: string;
  /** 3-mode declaration (§3.10): Linked/Created→contactId; Plain→null */
  contactId?: string | null;
  /** Link opzionale a Firebase Auth user (L1 tenant — dipendente che fa login) */
  userId?: string | null;
  /** Etichetta libera della posizione (es. "Senior λογιστής", "Ασκούμενη", "Site foreman") */
  positionLabel?: string;
  /** Ruolo gerarchico nel department */
  role: OrgMemberRole;
  /** ⭐ MANAGER POINTER — id di un altro OrgMember nello stesso department (null = department head) */
  reportsTo: string | null;
  /** Esattamente 1 per department deve avere true (corrisponde a reportsTo === null) */
  isDepartmentHead: boolean;
  /** Riceve email department-routed di default? Default: true se isDepartmentHead, false altrimenti. UI lascia override */
  receivesNotifications: boolean;
  /** Comms ricche (sostituiscono single-string di ContactPerson) */
  emails: EmailInfo[];
  phones: PhoneInfo[];
  /** Preferred channel per routing automatico */
  preferredChannel?: 'email' | 'mobile' | 'landline' | 'extension';
  availableHours?: string;
  notes?: string;
  status: 'active' | 'archived';
}

export type OrgMemberRole =
  | 'head'      // Επικεφαλής τμήματος (max 1, reportsTo === null)
  | 'manager'   // Προϊστάμενος υπο-ομάδας
  | 'senior'    // Senior εργαζόμενος
  | 'employee'  // Εργαζόμενος
  | 'intern'    // Ασκούμενος / Stagiaire
  | 'custom';   // User-defined role (positionLabel obbligatorio)

export interface NotificationRoutingRule {
  /** Evento riconosciuto dall'app — vedi §3.4 */
  event: NotificationEventCode;
  /** Department code da chiamare per quell'evento */
  targetDepartmentCode: DepartmentCode;
  /** Override esplicito di destinatario (bypassa primary) */
  overrideEmail?: string;
}
```

`PhoneInfo` e `EmailInfo` riusati da `src/types/contacts/contracts.ts` con **estensione type literals**:

```typescript
// EmailInfo.type EXTENDED
type: 'personal' | 'work' | 'invoice' | 'notification' | 'support' | 'other';

// PhoneInfo.type EXTENDED (extension già free string in PhoneInfo.extension)
type: 'mobile' | 'home' | 'work' | 'fax' | 'internal' | 'other';
```

### 3.3 Department taxonomy — flexible & extensible (✅ απαίτηση Γιώργου, 2026-04-25)

**Two-layer model** per coniugare struttura SSoT + flessibilità totale per-tenant. Nessuna lista fissa di N dipartimenti — il tenant può crescere/cambiare org senza modifiche al codice.

**Strato 1 — Canonical codes (system-wide, deploy-time)**

`src/config/department-codes.ts` definisce i `DEPARTMENT_CODES` che l'app "comprende" — usati per default event routing (es. `RESERVATION_CREATED` → cerca dept con `code=ACCOUNTING`) e per i18n labels traduzioni.

Initial set (espandibile via deploy quando una nuova categoria diventa cross-tenant):

| Code | Λαβέλι (el) | Note |
|------|-------------|------|
| `ACCOUNTING` | Λογιστήριο | default per eventi reservation/sale/invoice |
| `ENGINEERING` | Μηχανικοί | μηχανικοί στατικά / Η-Μ / πολιτικοί |
| `ARCHITECTURE_STUDIES` | Μελέτες αρχιτεκτονικές | μελέτες έργων αρχιτεκτονικά |
| `CONSTRUCTION` | Κατασκευή / Εργοτάξιο | site management |
| `SALES` | Πωλήσεις | πωλήσεις ακινήτων |
| `LEGAL` | Νομικό | συμβόλαια, contracts |
| `HR` | Ανθρώπινο δυναμικό | personnel |
| `IT` | Πληροφορική | technical |
| `PROCUREMENT` | Προμήθειες | suppliers |
| `OPERATIONS` | Λειτουργίες | operations |
| `MANAGEMENT` | Διοίκηση | C-level |
| `CUSTOMER_SERVICE` | Εξυπηρέτηση πελατών | post-sale |
| `CUSTOM` | (user-defined label) | wildcard per qualunque dept user-defined |

```typescript
export const DEPARTMENT_CODES = {
  ACCOUNTING:           'accounting',
  ENGINEERING:          'engineering',
  ARCHITECTURE_STUDIES: 'architecture_studies',
  CONSTRUCTION:         'construction',
  SALES:                'sales',
  LEGAL:                'legal',
  HR:                   'hr',
  IT:                   'it',
  PROCUREMENT:          'procurement',
  OPERATIONS:           'operations',
  MANAGEMENT:           'management',
  CUSTOMER_SERVICE:     'customer_service',
  CUSTOM:               'custom',
} as const;

export type DepartmentCode = typeof DEPARTMENT_CODES[keyof typeof DEPARTMENT_CODES];
```

**Strato 2 — Per-tenant custom departments (runtime-extensible, ZERO deploy)**

Ogni tenant può aggiungere illimitati departments con `code: 'custom'` + `label` free-text (es. «Marketing & PR», «Τμήμα Καινοτομίας», «Συντήρηση», «Customer Support EU», «R&D»). Senza touch al codice, senza deploy, senza ADR update.

**UX:**
- Dropdown "Επιλογή τμήματος" mostra:
  1. I 12 canonical (i18n-translated)
  2. Tutti i custom già creati dal tenant (sortati alphabeticamente)
  3. Option **"➕ Προσθήκη νέου τμήματος"** → input free-text + (opt.) icon picker + (opt.) suggested canonical match
- Quando l'utente digita un custom label che è semanticamente vicino a un canonical (es. "Νομικό Τμήμα" → `LEGAL`), l'app suggerisce: «Match: Νομικό — να ενοποιηθεί;» (smart match — post-MVP feature, non bloccante).

**Routing:**
- I canonical codes hanno default routing rules in `DEFAULT_EVENT_TO_DEPARTMENT` (vedi §3.4)
- I custom hanno **routing solo se l'utente lo configura esplicitamente** in `NotificationRoutingRule` per quel `customLabel`

**i18n:**
- Canonical labels in `src/i18n/locales/{el,en}/org-structure.json`. Καμία hardcoded string σε .ts/.tsx (rule N.11).
- Custom labels = user data → mostrati raw, non coperti da i18n. La rule N.11 NON si applica al label custom perché è user-typed runtime data, non literal in code.

**Promotion path (cross-tenant insight):**
Se monitor analytics mostra che N tenant hanno creato un custom "Marketing" → diventa candidato per promozione a canonical in deploy successivo (deploy-time, additive — backward compatible).

**Rationale per il two-layer:**
- ✅ Canonical permettono **smart default routing** out-of-the-box per i casi comuni
- ✅ Custom permettono **flessibilità infinita** senza touching del codice
- ✅ Il `CUSTOM` code è il "tetto" — qualsiasi cosa fuori canonical entra lì
- ✅ Audit trail uniforme via `useEntityAudit` per entrambi gli strati

### 3.4 NotificationEventCode — enum eventi routabili

Estensione del modulo `notification-events` esistente (già in `.ssot-registry.json`). File: `src/config/notification-events.ts` — aggiungere i nuovi event codes routables. Modulo confermato presente da audit codebase 2026-04-25.

```typescript
export const NOTIFICATION_EVENTS = {
  RESERVATION_CREATED:       'reservation.created',       // → accounting
  RESERVATION_CANCELLED:     'reservation.cancelled',     // → accounting
  SALE_DEPOSIT_INVOICE:      'sale.deposit_invoice',      // → accounting
  SALE_FINAL_INVOICE:        'sale.final_invoice',        // → accounting
  SALE_CREDIT_INVOICE:       'sale.credit_invoice',       // → accounting
  PROFESSIONAL_ASSIGNED:     'professional.assigned',     // → legal/engineering
  PROJECT_STUDY_DELIVERED:   'project.study_delivered',   // → studies/architecture
  PROCUREMENT_PO_APPROVED:   'procurement.po_approved',   // → procurement
  HR_ATTENDANCE_ANOMALY:     'hr.attendance_anomaly',     // → hr
  CONTRACT_READY_TO_SIGN:    'contract.ready_to_sign',    // → legal
  // … expandable
} as const;
```

Default routing in code (fallback se tenant non ha override):

```typescript
const DEFAULT_EVENT_TO_DEPARTMENT: Record<NotificationEventCode, DepartmentCode> = {
  [NOTIFICATION_EVENTS.RESERVATION_CREATED]: DEPARTMENT_CODES.ACCOUNTING,
  [NOTIFICATION_EVENTS.SALE_DEPOSIT_INVOICE]: DEPARTMENT_CODES.ACCOUNTING,
  [NOTIFICATION_EVENTS.PROFESSIONAL_ASSIGNED]: DEPARTMENT_CODES.LEGAL,
  // …
};
```

### 3.5 Resolver service (SSoT)

Nuovo file `src/services/org-structure/org-routing-resolver.ts`:

```typescript
/**
 * Risolve l'email destinataria per un evento notifica del tenant corrente.
 * Cascade 4-step (NO env var fallback — decisione enterprise 2026-04-25):
 *   1. NotificationRoutingRule.overrideEmail (esplicito per evento)
 *   2. Department head primary email (isDepartmentHead === true && status === 'active')
 *      Se head è archived → step 2.5: prossimo membro con receivesNotifications=true && status='active'
 *   3. Department-level emails[0] (centralino — fallback se nessun head/active member ON)
 *   4. null → skip email + structured warn log + audit trail
 *
 * Backup fallback semantics (G3 decision 2026-04-25):
 *   `receivesNotifications=true` su non-head member NON significa CC list nel MVP.
 *   Significa: candidato per backup quando head è archived. Il primo (per ordine
 *   di reportsTo proximity al head) viene scelto. CC list multi-recipient = post-MVP.
 */
export async function resolveTenantNotificationEmail(
  companyId: string,
  event: NotificationEventCode,
): Promise<{ email: string; source: 'override' | 'head' | 'backup' | 'dept' } | null>;

/** Cache 5min in-memory + RealtimeService invalidate on write (pattern ADR-316). */
```

Per L2 (CompanyContact con orgStructure) — stesso pattern, simmetrico a L1 (input = id, NON entity):

```typescript
export interface ResolveContactResult {
  email: string;
  phone?: string;
  displayName?: string;
  source: 'head' | 'backup' | 'dept';
  departmentCode: DepartmentCode;
}

/**
 * L2 contact resolver. Reads CompanyContact.orgStructure (userId always null per G8).
 * Cascade: head → backup → dept-level. NO override (overrides L1-only, per-event).
 */
export async function resolveContactDepartmentEmail(
  contactId: string,
  departmentCode: DepartmentCode,
): Promise<ResolveContactResult | null>;

/** Pure variant per testing — accetta orgStructure in-memory. */
export function resolveEmailFromContactOrgStructure(
  orgStructure: OrgStructure,
  departmentCode: DepartmentCode,
): ResolveContactResult | null;
```

> **Implementation note (Phase 6.0)**: in v1.0 ADR la signature era `(contact: CompanyContact, departmentCode)`. Refined in v1.7-PLANNED a `(contactId, departmentCode)` per simmetria con L1 + caching keyed by id. Caller fornisce solo l'id; resolver legge contact + orgStructure internamente con caching 5min.

Per L3 (ServiceContact) — code path diverso (legge `responsiblePersons[]` direttamente, no orgStructure):

```typescript
export async function resolveServicePersonContact(
  contact: ServiceContact,
  options?: { departmentLabel?: string; preferIsPrimary?: boolean },
): Promise<{ email: string; phone?: string; displayName: string } | null>;
```

### 3.6 Storage Firestore

| Livello | Path | Firestore rules |
|---------|------|-----------------|
| L1 | `companies/{companyId}.settings.orgStructure` (estende ADR-316 `CompanySettings`) | `isCompanyAdminOfCompany(companyId)` write, `isInternalUserOfCompany(companyId)` read |
| L2 | inline su `contacts/{id}.orgStructure` (solo `type='company'`) | helpers contatti esistenti (companyId-scoped) |
| L3 | inline su `contacts/{id}.responsiblePersons[]` (esistente, schema upgrade Phase 4) | helpers contatti esistenti |

**Niente collection separata** — embedded sub-doc su entità owner. Razionale:
- L1: 1 doc per tenant, naturalmente sub-document di `companies/{id}`
- L2/L3: cardinality bassa per contatto (decine, non migliaia di departments) → embedded fits ADR-191 soft-delete + audit
- Audit trail (ADR-195/N.13) automaticamente coperto se aggiungiamo path a `audit-tracked-fields.ts`

### 3.7 SSoT registry slot

Nuovo modulo in `.ssot-registry.json` (Tier 2 — Configuration):

```json
"org-structure": {
  "tier": 2,
  "ssotFile": "src/types/org/org-structure.ts",
  "configFile": "src/config/department-codes.ts",
  "resolverFile": "src/services/org-structure/org-routing-resolver.ts",
  "forbiddenPatterns": [
    "process\\.env\\.ACCOUNTING_NOTIFY_EMAIL",
    "process\\.env\\.SALES_NOTIFY_EMAIL",
    "process\\.env\\.LEGAL_NOTIFY_EMAIL",
    "department:\\s*['\"`](?!.*DEPARTMENT_CODES)"
  ],
  "purpose": "Tenant org structure + departmental email routing — supersedes ACCOUNTING_NOTIFY_EMAIL env var pattern"
}
```

### 3.8 UI

UI unificata sotto `src/app/(app)/settings/company/` (decisione Q10 — vedi §8):

- **Tab «Στοιχεία»** — legal name, ΑΦΜ, address (da EnterpriseCompanySettings)
- **Tab «Φορολογικά»** — ΚΑΔ, ΔΟΥ, regime ΦΠΑ (da ACC-000 accounting_settings/company_profile)
- **Tab «Δομή Οργανισμού»** — list department + add/edit + tree view + 3-mode member editor (§3.10) + manager picker
- **Tab «Routing Eventi»** — `event → department code` con override email opzionale per riga (Q5)

Tab in ContactDetailPage:
- **«Δομή Οργανισμού»** — visibile **SOLO su CompanyContact (L2)**. NON su ServiceContact (L3) — vedi §3.1 e §3.13.
- L3 (ServiceContact) usa form esistente con `responsiblePersons[]` enriched (Phase 4 upgrade comms).

Componenti riusano: `Radix Select` (ADR-001), `useEntityAudit` (ADR-195), pattern `DynamicContactArrays` per phones/emails arrays. NO `EnterpriseComboBox` (ADR-001 forbids new uses).

**G8 decision (2026-04-25)**: Il campo `userId` (Σύνδεση με χρήστη εφαρμογής) nel `MemberEditor`:
- Visibile su **L1 only** (tenant own settings)
- **Nascosto** su L2 (CompanyContact org structure tab) — i membri esterni non hanno user account interno
- Server-side guard: Firestore rules rifiutano write con `userId !== null` se path è `contacts/{id}.orgStructure`

### 3.10 Member declaration — 3-mode UX (✅ decisione Γιώργου, 2026-04-25)

Si applica a **qualsiasi** `OrgMember` (head, manager, senior, employee, intern, custom). Quando l'utente aggiunge un membro a un department, l'UI offre **3 modalità esplicite** (l'utente sceglie ogni volta):

| Modo | UI Action | `contactId` settato? | Crea `IndividualContact`? | Use case |
|------|-----------|----------------------|---------------------------|----------|
| **Link** ("Επιλογή από επαφές") | Contact picker (filtro `type='individual'`); selezione persona esistente; campi pre-popolati | ✅ Sì → ID dell'individual contact | ❌ No | Persona già nel CRM (es. cliente che è anche dipendente) |
| **Create** ("Δημιουργία νέας επαφής") | Form inline `IndividualContact` create; al submit crea contatto + linka | ✅ Sì → nuovo contact ID | ✅ Sì (nuovo `contacts/{id}` con `type='individual'`) | Nuovo dipendente da aggiungere ovunque |
| **Plain** ("Απλό όνομα") | Solo input liberi (displayName, emails[], phones[]); nessun link | ❌ No (`null`) | ❌ No | Email generiche tipo `info@accounting.gr` o `λογιστήριο@tenant.gr` senza persona reale dietro |

**Promotion path:** Un membro in modalità Plain può essere promosso a Linked in seguito via bottone "➕ Προσθήκη στις επαφές" → crea `IndividualContact` dai dati esistenti + setta `contactId`.

**Sync model (Linked mode):** Pattern Google-like (Contacts ↔ Calendar ↔ Drive)
- **Read-through**: il membro mostra sempre i dati live del contact (nome, telefono, email primari) — SSoT è `contacts/{contactId}`
- **Override per-department**: l'utente può overridare nome/email/telefono *a livello del membro per quel dipartimento* (es. il Παπαδόπουλος ha email personale, ma come membro λογιστηρίου usa `accounting@tenant.gr`) — l'override è memorizzato sul `OrgMember` ed ha precedenza in lettura
- **Update propagation**: edit del contact → tutti i `OrgMember.contactId === id` vedono il nuovo valore automaticamente. Niente double-write, niente sync job.

**Esempio concreto** (3 membri sullo stesso department λογιστηρίο):

| Membro | Mode | Razionale |
|--------|------|-----------|
| Παπαδόπουλος (esiste già come cliente CRM) | **Link** | Riusa contact esistente, no duplicato |
| Γεωργίου (nuova assunta) | **Create** | Crea contact + linka in un'azione |
| `info@nestor.gr` (mailbox generica) | **Plain** | Non è una persona reale, nessun bisogno di contact |

### 3.11 Hierarchy support — Google manager-pointer pattern (✅ απαίτηση Γιώργου GOL, 2026-04-25)

**Pattern**: flat list di `OrgMember[]` + `reportsTo: string | null` per ogni membro. NESSUNA struttura nidificata in storage. L'albero è derivato dinamicamente al render.

**Razionale (perché manager-pointer e non nested tree)**:
- ✅ Apertura illimitata di livelli senza schema change
- ✅ Spostamento di sotto-rami = single-field update (no deep restructure)
- ✅ Cycle detection è O(n)
- ✅ Query "tutti i discendenti di X" = traversal lineare
- ✅ Audit trail per riassegnazione = diff su 1 campo
- ✅ Il pattern è quello di Google Workspace Admin / Google People API / LDAP

**Invariants enforcement** (server-side validation + UI):

| Invariant | Enforcement |
|-----------|-------------|
| Esattamente 1 head per department | `isDepartmentHead === true` && `reportsTo === null` per esattamente 1 membro |
| Head ha `reportsTo === null` | UI grays out il selector quando `role === 'head'` |
| Non-head ha `reportsTo !== null` | UI obbliga selezione del manager |
| `reportsTo` punta a un membro nello **stesso department** | Validation: lookup in `members[]` |
| No cicli (A→B→A) | DFS check pre-write, throws on cycle |
| No self-reference | `reportsTo !== id` |
| Profondità max 10 livelli | Safety net, throws su tentativi pathological |
| **Department code uniqueness (G6, 2026-04-25)** | Per canonical codes: max 1 department per code per tenant. Per `code='custom'`: illimitati con label diversi |

**Algoritmo build-tree** (read-side, no storage change):

```typescript
// File: src/services/org-structure/utils/build-org-tree.ts
// Funzione attesa ≤40 righe (rule N.7.1)
// Coverage target: ≥95% (cycle, orphan, depth, single-node, empty cases)
function buildOrgTree(members: OrgMember[]): OrgNode {
  const head = members.find(m => m.isDepartmentHead && m.reportsTo === null);
  if (!head) throw new OrgStructureError('No head found');
  const childrenByParent = new Map<string, OrgMember[]>();
  for (const m of members) {
    if (m.reportsTo) {
      const arr = childrenByParent.get(m.reportsTo) ?? [];
      arr.push(m);
      childrenByParent.set(m.reportsTo, arr);
    }
  }
  return assembleNode(head, childrenByParent, /* depth */ 0);
}
```

**Reassignment flow — quando rimuovi un node con subordinati**:

UI flow (ESEMPIO con Παπαδόπουλος che ha 2 juniors sotto):
1. User clicca "Διαγραφή" sul Παπαδόπουλος
2. App detect: ha 2 subordinati (Νικολάου, Δημητρίου)
3. Modal warning Google-level:
   ```
   ⚠️ Ο Παπαδόπουλος έχει 2 άτομα υπό την ευθύνη του.
   Τι να γίνει με τους Νικολάου, Δημητρίου;
   
   ◯ Μετάθεση σε νέο προϊστάμενο  →  [επιλογή για κάθε junior]
   ◯ Ανάθεση στον επικεφαλής (Γεωργίου)  ← default
   ◯ Ακύρωση
   ```
4. Audit trail (ADR-195): `recordChange()` per ogni subordinato con `oldReportsTo` + `newReportsTo`

**Email routing default**: va al membro con `isDepartmentHead === true`. Override per-event possibili (vedi §3.4 `NotificationRoutingRule.overrideEmail`).

**UI views**:
1. **Tree view** (default) — gerarchia visiva con expand/collapse, indent per level
2. **Table view** — flat list con colonne: Όνομα, Ρόλος, Θέση, Προϊστάμενος, Email πρωτεύον, Ενεργός
3. **Member editor** — form con manager picker (dropdown filtrato a membri stesso dept, escluso self-ref e descendants)
4. **Org chart export PDF/PNG** — post-MVP (future ADR)

**Performance considerations (GOL)**:
- Caso limite: 500 membri/department × 10 livelli — albero costruito client-side O(n) singolo pass
- Cache 5min in-memory + RealtimeService invalidate (pattern ADR-316)
- Soft-cap raccomandato: 500 membri/department. Se superato → consigliare split in sub-departments con custom code

**N.7.2 GOL checklist (hierarchy-specific)**:
| # | Domanda | Risposta |
|---|---------|----------|
| 1 | Proattivo? | ✅ Tree built al page-render, no lazy load |
| 2 | Race condition? | ✅ Server-side cycle check + transactional bulk reassignment |
| 3 | Idempotente? | ✅ Set-based update (members array), no incremental ops |
| 4 | Belt-and-suspenders? | ✅ Cycle detection + orphan handling + depth cap + UI confirmation modals |
| 5 | SSoT? | ✅ Single `reportsTo` pointer, no redundant tree storage |
| 6 | Await? | ✅ Tree build sync (data already loaded); reassignment write awaited |
| 7 | Owner? | ✅ `companies/{id}.settings.orgStructure` (L1) / `contacts/{id}.orgStructure` (L2 only) |

✅ **Hierarchy GOL: YES** — pattern Google-tested, invariant-enforced, audit-tracked, performance-bounded.

### 3.12 AI Agent integration (✅ απαίτηση Γιώργου enterprise, 2026-04-25)

**Context**: l'app ha già un agentic AI agent (gpt-4o-mini) con tool calling (ADR-171, Phase 1 IMPLEMENTED). I 25 schemas in `firestore-schema-map.ts` permettono al super admin (Γιώργος via Telegram) di interrogare l'app via natural language. La nuova org structure **DEVE** essere esposta all'AI altrimenti l'agent rimane "cieco" alla struttura organizzativa.

**Use cases sbloccati per l'AI** (esempi reali da Telegram):

| Comando user | Senza orgStructure (oggi) | Con orgStructure (post-impl) |
|--------------|---------------------------|------------------------------|
| "Στείλε email στο λογιστήριο" | UC-012 cerca contact con nome "Λογιστήριο" → fail | resolver L1 → primary head email → send |
| "Ποιος είναι ο υπεύθυνος μελετών;" | nessuna risposta possibile | query orgStructure → return head |
| "Δείξε το οργανόγραμμα" | nessuna risposta possibile | build-org-tree → format ASCII tree |
| "Ποιοι δουλεύουν κάτω από τον Παπαδόπουλο;" | nessuna risposta possibile | traverse manager pointer → return descendants |
| "Πόσους εργαζόμενους έχω στο λογιστήριο;" | nessuna risposta possibile | count members in dept (whole subtree) |
| "Στείλε στο λογιστήριο της ΑΛΦΑ ΣΙΔΗΡΟΣ" | trova ΑΛΦΑ ma single email | L2 contact → `resolveContactDepartmentEmail(αlfa, ACCOUNTING)` → send to that dept |
| "Στείλε στον υπεύθυνο της εφορίας" | single email response | L3 contact → `resolveServicePersonContact(εφορία)` → primary responsible from `responsiblePersons[]` |

**Componenti da aggiungere** (in Phase 7):

1. **5 nuovi agentic tools** in `src/services/ai-pipeline/agentic-tools/`:
   - `query_org_structure(scope, contactId?)` → JSON dell'orgStructure (depth-limited)
   - `get_department_head(scope, contactId?, departmentCode | label)` → member info del head
   - `find_department_member(scope, contactId?, displayNameOrPosition)` → fuzzy search
   - `traverse_hierarchy(scope, contactId?, memberId, direction, maxDepth=5)` → ascendants/descendants
   - `resolve_routing_email(scope, contactId?, eventOrDepartment)` → wrapper su resolver

2. **Estensione `firestore-schema-map.ts`** (da 25 a 27 schemas):
   - Schema entry per `companies/{companyId}.settings.orgStructure`
   - Schema entry per `contacts/{contactId}.orgStructure`
   - Pattern descrittivi per AI ("usa questo path quando l'user menziona dipartimenti / responsabili / org chart...")

3. **Aggiornamento UC-012 (admin send email)** in `admin-send-email-module.ts`:
   - Pre-send: prova `resolve_routing_email` se input contiene parole-chiave dipartimento (λογιστήριο, μηχανικοί, …)
   - Fallback: contact-by-name come oggi

4. **Aggiornamento `ADMIN_COMMAND_SYSTEM` prompt** in `ai-analysis-config.ts`:
   - "L'utente ha un'org structure con departments e hierarchy. Per email routing prova prima `resolve_routing_email`. Per query strutturali usa `query_org_structure`. Per descendants/ancestors usa `traverse_hierarchy`."

5. **Safety limits per AI**:
   - Max depth traversal: 10 (allineato con hierarchy depth cap)
   - Max members in single response: 100 (paginated se più)
   - Tenant isolation: tool implementations leggono solo `companyId`-scoped data del super admin

6. **Test coverage** (rule N.10):
   - Unit tests per ogni tool — `npm run test:ai-pipeline:all`
   - Integration test: simulazione comando Telegram "στείλε στο λογιστήριο" → verifica routing corretto
   - Tutti i tool tested con mock orgStructure (single dept, multi-level hierarchy, empty, custom departments)

**Forward-looking** (per ADRs futuri, NON in MVP):
- 🔮 Per-department permissions per AI (es. accounting head vede AI tools accounting-only via `userId` link)
- 🔮 AI-generated org reports (PDF "Stato organizzativo Q1 2026")
- 🔮 AI suggestions ("Il dept Studies ha 1 manager con 8 direct reports — Google span recommendation è 5-7. Considera split.")
- 🔮 AI-detected anomalies (orphan members, multiple heads, deep nesting >7)

**Forbidden patterns** (registrati in `.ssot-registry.json` Phase 7):
- AI tools che bypassano `resolveTenantNotificationEmail` per accounting routing (must use resolver as canonical entry point)
- AI tools che leggono `orgStructure` da Firestore senza tenant-scope check (bypass `companyId` claim)
- Hardcoded department names nei prompts AI (deve usare i `DEPARTMENT_CODES` constants)

### 3.13 «Δομή Οργανισμού» tab vs «Σχέσεις» tab — separation of concerns (✅ chiarimento Γιώργου, 2026-04-25)

I 2 tab risolvono problemi distinti e devono restare separati. L'org structure **NON va inclusa** nel tab Σχέσεις esistente.

**Σχέσεις tab (esistente, `ContactRelationshipManager`)**:
- View **persona-→-azienda** (1 record per ogni link person-org)
- 35 RelationshipTypes (employee, manager, ceo, shareholder, board_member, partner, vendor, client, civil_servant, ministry_official, property_buyer, …)
- Storage: collection `contact_relationships` separata
- Use case: «chi sono tutti i tipi di persone collegate a questa azienda?»

**Δομή Οργανισμού tab (NUOVA, `ContactOrgStructureTab`)** — **SOLO su CompanyContact (L2)**:
- View **azienda-internal-hierarchy** (1 documento aggregato con tutto l'org chart)
- 6 OrgMemberRoles (head, manager, senior, employee, intern, custom)
- Storage: embedded `contacts/{id}.orgStructure` (JSON sub-doc)
- Use case: «com'è strutturata internamente questa azienda?»

⚠️ **Su ServiceContact (L3) il tab NON viene mostrato.** L3 mantiene il pattern esistente con `responsiblePersons[]` enriched (vedi §3.1 e §3.14).

**Bridge logic** (read-only inferenze, no double-write):

| Operazione | Side effect su Σχέσεις tab | Side effect su Δομή Οργανισμού |
|------------|----------------------------|-------------------------------|
| Aggiungi `OrgMember` con `contactId` (Linked) | OPZIONALE: prompt utente «vuoi creare anche un ContactRelationship `employee`?» (UI checkbox) | n/a (è la fonte) |
| Aggiungi `ContactRelationship` di tipo `employee/manager/director` | n/a (è la fonte) | NESSUN side effect (manca info su `departmentCode` e `reportsTo`) |
| Edit `OrgMember` (cambia ruolo) | NESSUN side effect (le 2 sono ortogonali) | n/a |
| Delete `OrgMember` | NESSUN side effect su ContactRelationship | n/a |

**Razionale per non auto-sincronizzare**:
- ContactRelationship ha types che non mappano a OrgMember (shareholder, client, vendor, …) — sync solo per employment-types creerebbe regole speciali fragili
- OrgMember richiede `departmentCode + reportsTo + role` — info mancante nel ContactRelationship, non auto-derivabile
- Mantenere le 2 indipendenti garantisce che ognuna sia complete + correct nel proprio dominio

**Smart import prompt (G7 decision, 2026-04-25)**:
Quando l'utente apre per la **prima volta** il tab «Δομή Οργανισμού» di un CompanyContact (L2) che ha già N ContactRelationships di tipo employment (`employee`/`manager`/`director`/`ceo`/`executive`/etc.):

1. App mostra banner one-time: «📋 Βρήκα N εργασιακές σχέσεις στην καρτέλα. Να τις εισάγω σαν μέλη τμημάτων;»
2. User click "Ναι":
   - App auto-match `relationship.department` (free string) → canonical code (case-insensitive su EL+EN), fallback a `code='custom'` con label originale
   - Crea `OrgMember` Linked (con `contactId` dalla relationship's linked person)
   - Tutti membri inizialmente in modalità **flat** (placeholder head temporaneo, `reportsTo: null` per il primo, poi tutti pointing a quel primo)
   - User poi tactiona ierarchia (chi è head, chi reportsTo chi)
3. User click "Όχι": tab rimane vuoto, user inizia da zero
4. Banner non si ripresenta dopo prima decisione (one-time)
5. ContactRelationship records **non vengono toccati** (solo letti per la suggestion)

**Migration strategy** (Phase 5):
- `CompanyContact.contactPersons[]` esistenti → diventano `OrgMember` con `code='custom'`, `label = person.department || 'Default'`. Le ContactRelationship esistenti **NON vengono toccate**.
- `ServiceContact.responsiblePersons[]` **NON migrato** — rimane in-place. Solo Phase 4 estende i comms (single-string → array). Vedi §3.1.

### 3.14 Migration path

⚠️ **Sezione semplificata (G2 decision 2026-04-25)**: Database in stato pre-production, dati esistenti sono test/draft che verranno wipe-ati prima del launch. **Nessuno script di migration richiesto**.

Vedi §7 (Roadmap) per l'effettiva sequenza di implementazione phase-by-phase. Questa sezione è mantenuta solo come riferimento.

| Cosa | Rischio | Note |
|------|---------|------|
| Tutti i nuovi tenant da Day 1 usano `OrgMember[]` directly | Zero | Nessuna conversion da legacy |
| Test data esistenti (CompanyContact.contactPersons[], ServiceContact.responsiblePersons[] con single-string email/phone) | Zero | Wipe pre-launch |
| Schema upgrade `ResponsiblePerson.email/phone` → `EmailInfo[]/PhoneInfo[]` | Basso | Phase 4, mapper backward-compat per lettura test data residue |
| `ACCOUNTING_NOTIFY_EMAIL` env var | Zero | Nessun fallback nel nuovo resolver. Vercel removal Phase 9 (G1 decision) |

---

## 4. Applicabilità per tipo entità (risposta diretta alle domande di Γιώργος)

| Tipo | Ha orgStructure? | Razionale |
|------|------------------|-----------|
| **Tenant company (L1)** | ✅ **SÌ — obbligatorio in produzione** | Ogni tenant deve dichiarare almeno il dipartimento accounting per ricevere notifiche di vendita |
| **CompanyContact (L2)** | ✅ **SÌ — opzionale** | Νομικά πρόσωπα *possono* avere struttura interna. Es. un fornitore con dipartimenti vendite/contabilità → utile per email automatiche al loro contabile |
| **ServiceContact (L3)** | ⚠️ **SIMPLIFIED** — `responsiblePersons[]` enriched (NO orgStructure, NO hierarchy, NO new tab) | Use case mismatch: construction tenants non gestiscono org pubblici servizi. Schema upgrade solo per comms (EmailInfo[]/PhoneInfo[]). Decisione 2026-04-25. |
| **IndividualContact** | ❌ **NO** | Una persona fisica = singolo individuo. NON ha dipartimenti. Mantiene `department: string` (= dipartimento *presso il datore di lavoro*, non *propria* struttura). Eventuale upgrade futuro: linkare a `employer.orgStructure.departments[].id` invece che free string |

---

## 5. Google-level checklist (N.7.2)

| # | Domanda | Risposta |
|---|---------|----------|
| 1 | Proattivo o reattivo? | **Proattivo** — `orgStructure` creata al setup tenant (post-onboarding wizard) |
| 2 | Race condition? | **No** — read-then-write con server timestamp, audit via `useEntityAudit` |
| 3 | Idempotente? | **Sì** — enterprise IDs (`org_xxx`, `odep_xxx`, `ores_xxx`) per ogni nodo, no duplicati |
| 4 | Belt-and-suspenders? | **Sì** — 4-step cascade: override → head → backup member (G3) → dept-level. NO env var fallback (G1/Q8) |
| 5 | Single Source of Truth? | **Sì** — un solo type, un solo resolver, un solo registry SSoT |
| 6 | Fire-and-forget o await? | **Await** — email send conta come correttezza business |
| 7 | Lifecycle owner? | **Esplicito** — `companies/{id}.settings.orgStructure` per L1; `contacts/{id}.orgStructure` per L2 only; L3 mantiene `responsiblePersons[]` |

✅ **Google-level: YES** — pattern ADR-316 esteso, no race conditions, fallback chain pulita, audit nativo, deprecation graduata. Hierarchy via manager-pointer pattern (§3.11) supera anche la GOL N.7.2 specifica per tree structures (cycle detection, depth cap, orphan handling, audit per riassegnazioni).

---

## 6. Conseguenze

### Positive
- ✅ Multi-tenant produzione sbloccato (no più env var globale per accounting)
- ✅ **Zero dead code path** — no env var fallback (decisione enterprise pre-prod, 2026-04-25)
- ✅ **L3 simplification** — focus on real use case (construction tenants), no over-engineering for unused public service hierarchy
- ✅ SSoT unificata per "organizzazione interna di entità business"
- ✅ Eliminato il campo orfano `CompanyContact.contactPersons[]` (sostituito da `orgStructure`); `ServiceContact.responsiblePersons[]` mantenuto + arricchito comms
- ✅ Routing email estendibile a tutti i dipartimenti senza nuovo codice
- ✅ Coerenza tipo `EmailInfo` / `PhoneInfo` finalmente con type literals utili (`invoice`, `notification`, `internal`)
- ✅ Audit trail e diff updates già coperti (ADR-195, ADR-323)
- ✅ **Org hierarchy completa** con manager-pointer pattern (Google-style) — apertura illimitata di livelli, no schema change per crescita aziendale
- ✅ Riassegnazione di sotto-rami = single-field update con audit + UI confirmation flow

### Negative
- ❌ Schema migration su `contacts/*` (Fase 3) — script richiesto, test database wipe-friendly visto che siamo pre-prod
- ❌ Pre-commit ratchet update (forbidden patterns + i18n missing keys)
- ❌ Adozione: ogni tenant deve completare setup post-onboarding o le email skippano (acceptable: warn loud + dashboard banner)
- ❌ Estensione `EmailInfo.type` / `PhoneInfo.type` literals = breaking solo se altrove c'è exhaustive switch — verificare
- ❌ UI tree view richiede componente dedicato (non esiste oggi) — work item Phase 1
- ❌ Cycle detection + orphan handling + depth-cap logic richiesti (server validation + UI flows) — coperto da unit tests al ≥95%

### Neutrali
- 🔵 Aumento dimensione doc `companies/{id}` — trascurabile (max ~30KB stimato per tenant medio con 10 dept × 3 responsibles)
- 🔵 Aumento dimensione `contacts/{id}` — idem, soft-cap raccomandato 20 dept × 5 members per contatto (L2 only)

---

## 7. Roadmap (post-approvazione) — Phase-by-phase con clean context

Ogni fase è progettata per essere **eseguibile in isolamento** con un solo prompt: «Implementa Phase X di ADR-326». Nessuna fase ha dipendenze su unfinished work di altre fasi (le dipendenze sono dichiarate esplicitamente e verificabili via git status).

### Phase 0 — SSoT primitives (1.5 giorni)

**Goal**: definire types, config, validation utilities, resolver. **Zero UI.**

**Inputs**: codebase corrente + ADR-326 v1.0 (APPROVED).

**Outputs**:
- `src/types/org/org-structure.ts` — interfacce `OrgStructure`, `OrgDepartment`, `OrgMember`, `OrgMemberRole`, `NotificationRoutingRule`
- `src/config/department-codes.ts` — 12 canonical + CUSTOM (§3.3)
- `src/config/notification-events.ts` — 10 eventi initial + `DEFAULT_EVENT_TO_DEPARTMENT` map (§3.4)
- `src/services/org-structure/utils/build-org-tree.ts` — algoritmo build-tree (≤40 righe)
- `src/services/org-structure/utils/validate-org-hierarchy.ts` — cycle/orphan/depth check
- `src/services/org-structure/org-routing-resolver.ts` — resolver con 4-step cascade + backup-member fallback (§3.5)
- `src/i18n/locales/{el,en}/org-structure.json` — labels canonical (13 keys × 2 locale)
- `.ssot-registry.json` — modulo `org-structure` aggiunto (Tier 2)
- Tests: `__tests__/build-org-tree.test.ts` (5+ scenari), `validate-org-hierarchy.test.ts` (cycle/orphan/depth/edge + canonical uniqueness G6), `org-routing-resolver.test.ts` (4-step cascade + backup member G3)

**Acceptance**:
- `npm run typecheck` ✅
- `npm test src/services/org-structure` coverage ≥95% ✅
- `npm run ssot:audit` non aumenta violations ✅
- Pre-commit hook ✅

**Dependencies**: nessuna.

---

### Phase 1 — Server write path L1 + Firestore rules (1 giorno)

**Goal**: persistere `orgStructure` per il tenant. **Niente UI.**

**Inputs**: Phase 0 completata.

**Outputs**:
- `src/services/org-structure/org-structure-repository.ts` — TenantContext-scoped CRUD
- `src/services/company/company-settings-types.ts` (mod) — extend `CompanySettings.orgStructure?: OrgStructure`
- `src/app/api/org-structure/route.ts` — `GET` + `PUT` con `withAuth`
- `firestore.rules` (mod) — block per `companies/{id}.settings.orgStructure` (write `isCompanyAdminOfCompany`, read `isInternalUserOfCompany`)
- Tests: rules tests (ADR-298), repository unit tests, API route integration tests

**Acceptance**:
- Phase 0 acceptance ✅
- Firestore rules deploy a `pagonis-87766` testato ✅
- API GET/PUT testato manualmente via cURL ✅
- `companyId` immutability check su update ✅

**Dependencies**: Phase 0.

---

### Phase 2 — Tenant settings UI L1 unificata `Settings → Εταιρεία` (3 giorni)

**Goal**: pagina unificata `/settings/company` con 4 tabs (Q10): Στοιχεία / Φορολογικά / Δομή Οργανισμού / Routing Eventi. Δομή Οργανισμού tab include tree view + 3-mode member editor + manager picker.

**Inputs**: Phase 1 completata.

**Outputs**:
- `src/app/(app)/settings/company/page.tsx` — container con Radix Tabs (4 tabs)
- `src/app/(app)/settings/company/components/CompanyInfoTab.tsx` — wrapper su EnterpriseCompanySettings UI
- `src/app/(app)/settings/company/components/TaxSettingsTab.tsx` — wrapper su ACC-000 setup UI
- `src/app/(app)/settings/company/components/OrgStructureTab.tsx` — orchestratore Department list + Tree view
- `src/app/(app)/settings/company/components/RoutingEventsTab.tsx` — tabella event → dept + override email
- `src/app/(app)/settings/company/components/DepartmentEditor.tsx`
- `src/app/(app)/settings/company/components/OrgTreeView.tsx`
- `src/app/(app)/settings/company/components/MemberEditor.tsx` — 3-mode form (§3.10) + userId picker (visibile solo L1, G8)
- `src/app/(app)/settings/company/components/ManagerPicker.tsx` — dropdown filtrato (escludi self + descendants)
- i18n keys completi in `src/i18n/locales/{el,en}/org-structure.json` (~50 keys)
- Tests: UI smoke tests

**Acceptance**:
- UI testata in `localhost:3000/settings/company` (4 tabs render) ✅
- Tab Δομή Οργανισμού: golden path + edge cases ✅
- Reassignment flow testato (delete con subordinati → modal warning) ✅
- Cycle detection error UI shown su tentativo invalid ✅
- Canonical uniqueness validation (G6) UI shown ✅
- i18n keys baseline ratchet OK (CHECK 3.8) ✅
- 0 hardcoded strings (CHECK 3.7 SSoT) ✅

**Dependencies**: Phase 1.

---

### Phase 3 — Connect `notifyAccountingOffice` to resolver (0.5 giorno)

**Goal**: la prima vendita reale che usa il nuovo routing.

**Inputs**: Phase 2 completata + tenant test ha settato accounting dept.

**Outputs**:
- `src/services/sales-accounting/notification-helpers.ts` (mod) — `getAccountingEmail()` chiama `resolveTenantNotificationEmail(companyId, RESERVATION_CREATED)`. **Rimuove read di `process.env.ACCOUNTING_NOTIFY_EMAIL`** (G1).
- `src/services/sales-accounting/accounting-office-notify.ts` (mod) — usa nuovo helper
- Integration test: simulazione reservation → email a tenant accounting head

**Acceptance**:
- Test reservation flow end-to-end ✅
- Quando orgStructure mancante → email skipped + structured warn log + dashboard banner attivo (NO fallback, G1) ✅
- Log structured con `source: 'override' | 'head' | 'backup' | 'dept'` ✅

**Dependencies**: Phase 2.

---

### Phase 4 — `EmailInfo` / `PhoneInfo` type extension + `ResponsiblePerson` upgrade + ratchet (1 giorno, ridotto)

**Goal**: estendere literals + aggiornare `ResponsiblePerson` per L3 enrichment.

**Inputs**: Phase 0 completata.

**Outputs**:
- `src/types/contacts/contracts.ts` (mod):
  - `EmailInfo.type` includes `'invoice' | 'notification' | 'support'`
  - `PhoneInfo.type` includes `'internal'`
  - `ResponsiblePerson.email: string` → **`emails: EmailInfo[]`**
  - `ResponsiblePerson.phone: string` → **`phones: PhoneInfo[]`**
  - Lascia invariati: `department?`, `responsibilities?`, `availableHours?`
- Mapper backward-compat: leggere data esistente in single-string → wrap in array silently
- Audit: tutti gli `switch (info.type)` exhaustive (probabili 4-6) + tutti i consumer di `ResponsiblePerson.email/phone` (UI ServiceContact form)
- Pre-commit ratchet aggiornato

**Acceptance**:
- `npm run typecheck` ✅
- Tutti gli switch exhaustive coperti ✅
- ServiceContact form mostra correttamente arrays ✅
- Lettura dati pre-esistenti (single-string) funziona via mapper ✅

**Dependencies**: Phase 0 (può essere parallelo con Phase 1-3).

---

### Phase 5 — L2 contact org structure UI (1 giorno, ridotto da 1.5) — ✅ IMPLEMENTED 2026-04-26 (v1.6)

**Goal**: «Δομή Οργανισμού» tab **SOLO su CompanyContact** + smart import prompt da ContactRelationships (G7). NO migration script (G2 — DB pre-prod, wipe before launch). ServiceContact (L3) **fuori scope**.

**Inputs**: Phase 2 completata (componenti riusabili).

**Outputs**:
- `src/components/contacts/tabs/ContactOrgStructureTab.tsx` — riusa `OrgTreeView`, `MemberEditor`, `ManagerPicker` da Phase 2 (`MemberEditor` con `userId` field NASCOSTO per L2 — G8)
- `src/config/contact-tabs-config.ts` (mod) — aggiungere tab nei `tabsByType` **solo per `company`** (NO `service`)
- `src/components/contacts/tabs/orgStructure/ImportFromRelationshipsBanner.tsx` — banner G7 (one-time, prompt smart import da employment-typed ContactRelationships)
- Tests: tab UI smoke, banner one-time logic, auto-match canonical (employment dept → DEPARTMENT_CODES)
- Σχέσεις ↔ Δομή Οργανισμού bridge UI: prompt opzionale «vuoi creare ContactRelationship?» quando si aggiunge OrgMember Linked (§3.13)

**Acceptance**:
- UI tab funziona su CompanyContact ✅
- UI tab **NON visibile** su ServiceContact ✅
- `userId` field nascosto in member editor (G8) ✅
- Smart import banner appare se N>0 employment ContactRelationships e tab è vuoto (G7) ✅
- Banner non si ripresenta dopo prima decisione (one-time) ✅
- ContactRelationship records pre-esistenti **non toccati** dall'import (read-only) ✅
- ServiceContact data **non toccata** (verifica esplicita) ✅

**Dependencies**: Phase 2.

---

### Phase 6 — Other senders incremental (1.5 giorni, esteso da 1) — ✅ IMPLEMENTED 2026-04-26 (v1.7)

**Goal**: estendere resolver routing a 3 sender oggi non-org-structure-aware (PO supplier, professional assignment, invoice email).

**Inputs**: Phase 3 completata + Phase 5 completata (L2 contact UI presente).

#### 6.0 — Prerequisite: implementare resolver L2 (CRITICO, mancava in Phase 0/1)

**Discovered 2026-04-26 durante Phase 6 RECOGNITION**: §3.5 specifica `resolveContactDepartmentEmail()` ma la funzione **non esiste** in `org-routing-resolver.ts`. Phase 0/1 hanno implementato solo L1 (`resolveTenantNotificationEmail`). Phase 5 ha messo l'UI L2 ma nessun consumer server-side. Phase 6 senza resolver L2 = blocked.

**Output 6.0**:
- `src/services/org-structure/org-routing-resolver.ts` (mod) — aggiungere:

```typescript
export interface ResolveContactResult {
  email: string;
  phone?: string;
  displayName?: string;
  source: 'head' | 'backup' | 'dept';
  departmentCode: DepartmentCode;
}

/**
 * L2 contact resolver (ADR-326 §3.5 + Phase 6.0).
 * Reads CompanyContact.orgStructure (L2-scoped, userId always null per G8).
 * Cascade: head → backup → dept-level. NO override (overrides sono solo L1 per-event).
 * Returns null se contact non ha orgStructure o dept non trovato.
 */
export async function resolveContactDepartmentEmail(
  contactId: string,
  departmentCode: DepartmentCode,
): Promise<ResolveContactResult | null>;

/** Pure variant per testing — accetta orgStructure in-memory. */
export function resolveEmailFromContactOrgStructure(
  orgStructure: OrgStructure,
  departmentCode: DepartmentCode,
): ResolveContactResult | null;
```

- Caching: 5-min in-memory keyed by `contactId` (pattern identico al repo L1)
- Reuse: estrae le funzioni `resolveFromMembers` e `resolveDeptLevel` esistenti — single source of cascade logic (SSoT)
- Tests: `__tests__/contact-routing-resolver.test.ts` (head priority, archived head→backup, dept fallback, missing orgStructure→null, missing dept→null)

#### 6.1 — PO email service (L2 supplier accounting)

**Output**:
- `src/services/procurement/po-email-service.ts` (mod) — aggiungere helper `resolveSupplierAccountingEmail(supplierContactId): Promise<string | null>` che chiama `resolveContactDepartmentEmail(id, 'ACCOUNTING')`. NON modificare la signature di `sendPurchaseOrderEmail` — il caller (route handler PO send) chiama prima il resolver, poi passa il `recipientEmail` risolto. Fallback: caller mantiene il behavior attuale (recipient da form/contact primary email) se resolver ritorna null.
- `src/app/api/procurement/purchase-orders/[id]/send/route.ts` (mod, se esiste) — invoca resolver prima di `sendPurchaseOrderEmail`. Log structured della source (head/backup/dept/manual).

#### 6.2 — Professional assignment (L2 contact orgStructure-aware)

**Clarificazione (Discovered 2026-04-26)**: il sender comunica con un **professionista esterno** (avvocato, ingegnere). Il routing è verso il **contatto stesso**, NON un dept del tenant. Logica corretta:

- Se contact (es. studio legale) ha `orgStructure` con dept che matcha il role → risolvi dept (es. role=`legal_advisor` → `LEGAL` dept del professionista)
- Altrimenti fallback a primary email (behavior attuale)
- ENG/ARCH roles → `ENGINEERING` dept se presente

**Output**:
- `src/app/api/notifications/professional-assigned/route.ts` (mod) — dopo `extractPrimaryEmail`, se contact ha `orgStructure`, prova `resolveContactDepartmentEmail(contactId, mapRoleToDept(role))`. Se ritorna risultato, usa quello; altrimenti fallback a primary email.
- `src/app/api/notifications/professional-assigned/role-to-dept-map.ts` (nuovo) — SSoT mapping role → DepartmentCode (legal_advisor→LEGAL, civil_engineer→ENGINEERING, architect→ENGINEERING, accountant→ACCOUNTING, ...). Ratchet: registrare in `.ssot-registry.json` come modulo `professional-role-routing`.

#### 6.3 — Invoice send-email (cascade resolver per customer)

**Clarificazione**: oggi `recipientEmail` è **mandatory** in body. Estendere a opt-out: se body omette `recipientEmail` MA include `customerContactId`, risolvi via L2 con event=`ACCOUNTING_RECEIPT` (default per evento).

**Output**:
- `src/app/api/accounting/invoices/[id]/send-email/route.ts` (mod) — body schema esteso:
  ```typescript
  interface SendEmailRequestBody {
    recipientEmail?: string;          // se omesso, richiede customerContactId
    customerContactId?: string;       // L2 cascade source
    subject?: string;
    language?: 'el' | 'en';
  }
  ```
  Cascade: `body.recipientEmail` → (se omesso) `resolveContactDepartmentEmail(customerContactId, 'ACCOUNTING')` → 422 se entrambi assenti / nessuna email risolta. La risposta include `resolvedSource: 'manual' | 'head' | 'backup' | 'dept'` per audit.
- `EmailSendRecord` (mod, se esiste — `src/subapps/accounting/types`) — aggiungere campo `resolvedSource` opzionale.

#### 6.4 — Tests

- `src/services/org-structure/__tests__/contact-routing-resolver.test.ts` — pure resolver L2 (5 cases)
- `src/services/procurement/__tests__/po-email-service.resolver.test.ts` — integrazione PO + resolver
- `src/app/api/notifications/professional-assigned/__tests__/route.resolver.test.ts` — role→dept mapping + fallback
- `src/app/api/accounting/invoices/[id]/send-email/__tests__/route.cascade.test.ts` — cascade body→resolver→422

**Acceptance**:
- 6.0: resolver L2 disponibile, cache funzionante, tests verdi (5/5) ✅
- 6.1: PO send → log structured source resolver L2 ✅
- 6.2: Professional assigned → contact con orgStructure routing per dept; senza orgStructure → primary email ✅
- 6.3: Invoice send-email → opzione body customerContactId funziona, cascade testata ✅
- Nessuna regressione: tutti i test esistenti passano ✅
- ADR-326 §3.5 aggiornato con signature `resolveContactDepartmentEmail` allineata all'implementazione ✅
- `.ssot-registry.json` aggiornato con modulo `professional-role-routing` ✅

**Dependencies**: Phase 3 + Phase 5.

**Note Google+SSoT**:
- Single resolver canonico in `org-routing-resolver.ts` — NO duplicazione cascade in caller
- Role→Dept mapping centralizzato (SSoT) — NON inline in route
- Audit trail: `resolvedSource` propagata fino a `EmailSendRecord` per tracing
- Idempotenza: resolver è puro + side-effect-free, safe per chiamate ripetute

---

### Phase 7 — 🆕 AI agent integration (1.5 giorni) — ✅ IMPLEMENTED 2026-04-26 (v1.8)

**Goal**: esporre orgStructure all'AI agent via 5 nuovi agentic tools (§3.12).

**Inputs**: Phase 0 + Phase 1 completate (Phase 2 UI **non** necessaria — l'AI agisce server-side).

**🔧 Path divergence vs original spec**: l'ADR originale prevedeva una nuova directory `src/services/ai-pipeline/agentic-tools/` con 5 file separati. La **codebase reale** (ADR-171, ADR-065 Phase 6) usa il pattern Strategy con handler files in `src/services/ai-pipeline/tools/handlers/`. Per coerenza con tutti gli altri 14 handlers (firestore, contact, messaging, banking, …) la Phase 7 IMPLEMENTED è un **singolo handler** con 5 tools dispatchati internamente. Code = Source of Truth (Rule N.0.1).

**Outputs (effettivi 2026-04-26)**:
- `src/services/ai-pipeline/tools/handlers/org-structure-handler.ts` — NUOVO: `OrgStructureHandler` con 5 tools dispatch `query_org_structure`, `get_department_head`, `find_department_member`, `traverse_hierarchy`, `resolve_routing_email`. Safety limits: `MAX_TRAVERSAL_DEPTH=10`, `MAX_MEMBERS_RESPONSE=100`. Tenant isolation: ogni accesso L2 verifica `contacts/{contactId}.companyId === ctx.companyId` via `verifyContactBelongsToTenant`.
- `src/services/ai-pipeline/tools/agentic-tool-executor.ts` — registrazione `new OrgStructureHandler()` nel registry.
- `src/services/ai-pipeline/tools/agentic-tool-definitions.ts` — +5 OpenAI tool definitions (strict mode), all required-array compliant.
- `src/config/firestore-schema-map.ts` — +2 schemas: `companies.settings.orgStructure` (L1) + `contacts.orgStructure` (L2). Direzionano l'AI verso i tool dedicated invece di `firestore_query`.
- `src/services/ai-pipeline/modules/uc-012-admin-send-email/department-keyword-resolver.ts` — NUOVO: helper Greek-first regex (λογιστήριο/μηχανικοί/μελέτες/νομικό/HR/IT/προμήθειες/…) → `DepartmentCode`, poi cascade L1 (head → backup → dept centralino).
- `src/services/ai-pipeline/modules/uc-012-admin-send-email/admin-send-email-module.ts` — integrato `tryResolveDepartmentEmail` nel `lookup` (BEFORE contact-by-name fallback): se messaggio contiene keyword dipartimento e nessun explicit email + nessun targetContact, override email da L1 head/backup/dept.
- `src/config/ai-analysis-config.ts` — `ADMIN_COMMAND_SYSTEM` prompt esteso con sezione "ORG STRUCTURE TOOLS" (5 use cases + scope L1/L2 mapping).
- `.ssot-registry.json` — modulo `ai-org-structure-tools` Tier 3 (forbidden pattern: read di `settings.orgStructure` fuori da OrgStructureHandler/repo).
- Tests:
  - `src/services/ai-pipeline/tools/__tests__/handlers/org-structure-handler.test.ts` — 19 unit tests (admin-only, query L1/L2, tenant isolation, dept-head by code/label, fuzzy member search, traversal descendants/ascendants/depth-cap/cycle-safety, routing L1 event/L2 dept/cross-tenant rejection).
  - `src/services/ai-pipeline/modules/uc-012-admin-send-email/__tests__/department-keyword-resolver.test.ts` — keyword detection (7 cases) + cascade head/backup/dept-level + archived guard.

**Acceptance**:
- Telegram comando "στείλε email στο λογιστήριο" → routing via head primary email (cascade head→backup→centralino) ✅
- Telegram comando "ποιος είναι ο υπεύθυνος μελετών" → AI invoca `get_department_head(label='Μελέτες'|code='architecture_studies')` ✅
- AI tools rispettano tenant isolation: read L1 auto-scoped a `ctx.companyId`, read L2 verifica ownership prima ✅
- Cycle prevention nel traversal (visited Set) ✅
- Department keyword resolver supporta tutti i 12 canonical codes con alias greci ✅

**Dependencies**: Phase 0 + Phase 1 + Phase 6 (resolvers L1/L2 reused).

---

### Phase 8 — Onboarding wizard + default departments (1 giorno) — ✅ IMPLEMENTED 2026-04-26 (v1.9)

**Goal**: nuovi tenant guidati a settare orgStructure post-registration.

**Inputs**: Phase 2 completata.

**Outputs** (implementati):
- `src/app/onboarding/organization/page.tsx` — wizard step (flat path, nessun `(app)` group)
- `src/services/onboarding/onboarding-state-service.ts` — getOnboardingState / markSkipped / markCompleted / findCompaniesNeedingReminder
- `src/services/onboarding/onboarding-types.ts` — OnboardingState, isRemindEligible, isBannerEligible (client-safe, no server-only)
- `src/app/api/onboarding/organization/route.ts` — GET (stato per company_admin) + POST (complete/skip)
- `src/app/api/cron/onboarding-reminder/route.ts` — daily scan 05:00 UTC + email reminder Mailgun
- `src/components/dashboard/OnboardingBanner.tsx` — banner amber dismissible (sessionStorage), solo se 7-day elapsed
- `vercel.json` — cron entry `0 5 * * *`
- `.ssot-registry.json` — modulo `onboarding-flow` Tier 3
- `src/i18n/locales/{el,en}/onboarding.json` + namespace registrato

**Implementazione diverge dall'ADR §7**:
- Nessun `(app)` route group → path flat `/onboarding/organization`
- OrgStructure embrionale creata via `saveOrgStructure` esistente (no schema separato)
- Banner dismissibile solo via sessionStorage (no Firestore persist per dismiss)

**Acceptance**:
- Nuovo tenant → visita `/onboarding/organization` → configura dept → redirect `/` ✅
- Skip → `settings.onboarding.skippedAt` set → banner appare su dashboard dopo 7 giorni ✅
- Cron daily 05:00 UTC → email reminder via Mailgun a company_admin ✅
- 4 toggles: Accounting ✅, Sales ✅ preselezionati; Engineering ◻️, Legal ◻️ opzionali ✅

**Dependencies**: Phase 2 (saveOrgStructure, enterprise IDs).

---

### Phase 9 — Vercel env var removal + docs final (0.5 giorno) — ✅ IMPLEMENTED 2026-04-26 (v2.0)

**Goal**: rimozione effettiva dell'env var da production + chiusura loop documentale.

**Outputs** (implementati):
- `docs/centralized-systems/README.md` — sezione `🏢 TENANT ORG STRUCTURE & ROUTING` aggiunta ✅
- Changelog finale ADR-326 v2.0 — FULLY IMPLEMENTED ✅

**Divergenze dall'ADR originale**:
- `ACCOUNTING_NOTIFY_EMAIL` NON era in `.env.example` (già pulita in sessione precedente)
- ADR-198 non esiste come file standalone (era pattern inline) → nessun file da marcare SUPERSEDED
- Vercel env var da rimuovere manualmente: `! npx vercel env rm ACCOUNTING_NOTIFY_EMAIL production`

**Acceptance**:
- README centralized-systems updated ✅
- ADR-326 status: FULLY IMPLEMENTED ✅
- Vercel production: rimuovere manualmente (vedi sopra)

**Dependencies**: Phase 3 + Phase 6 + Phase 8.

---

**Totale: ~10.5 giorni di lavoro** (ridotto a v1.0 dopo G2 = no migration script), 45-55 file impattati. **Territorio Orchestrator** (CLAUDE.md N.8: 5+ files, 2+ domains, 3+ services). **GOL apply** (rule N.7 + N.7.1 + N.7.2): funzioni ≤40 righe, file ≤500 righe; tree builder + cycle detection + reassignment flow + backup-fallback + AI tools unit-tested al coverage ≥95%.

**Parallelism**: Phase 4 può girare in parallelo con Phase 1-3. Phase 7 (AI) può girare in parallelo con Phase 2-6 dopo Phase 1.

---

## 8. Open Questions (RICHIEDONO DECISIONE DI ΓΙΩΡΓΟΣ)

### Q1 — Scope L2/L3 ✅ ΑΠΑΝΤΗΘΗΚΕ (2026-04-25, REFINED v0.12)
**Αρχική απόφαση Γιώργου: Επιλογή Β — L1 + L2 + L3 ταυτόχρονα.**
**Refinement v0.12 (Q6 + analisi use case)**: L1 + L2 full hierarchy. **L3 simplified** — `responsiblePersons[]` enriched only, no orgStructure aggregate, no hierarchy, no tab. Vedi §3.1 + Q6.

Αιτιολογία αρχική: εφαρμογή "πιο έξυπνη" στις σχέσεις με εξωτερικούς (πελάτες, προμηθευτές, δημόσιες υπηρεσίες).
Αιτιολογία refinement: use case mismatch — οι κατασκευαστικοί tenant δεν διαχειρίζονται org chart δημόσιων υπηρεσιών εσωτερικά. Simplification = focused scope.

Συνέπεια: implementation Phase 0-5 (~10.5 giorni). Schema είναι ήδη unico — αποφεύγουμε δεύτερο ADR cycle.

**Επιπλέον απαίτηση Γιώργου**: το σύστημα τμημάτων πρέπει να είναι **ευέλικτο και επεκτάσιμο**. Σήμερα μια επιχείρηση μπορεί να μην έχει νομικό τμήμα — αύριο να αποκτήσει. Δεν θέλει σταθερή λίστα 5 τμημάτων. Βλ. §3.3 (two-layer model: canonical codes + per-tenant custom).

### Q2 — Department codes ✅ AUTO-RISOLTA (2026-04-25)

Risolta dalla decisione su Q1 + §3.3 (two-layer flexible model). Concretamente:
- 2 codes canonical separati per la richiesta originale di Γιώργος: `ENGINEERING` (Μηχανικοί) + `ARCHITECTURE_STUDIES` (Μελέτες αρχιτεκτονικές)
- Lista canonical iniziale: 12 codes + `CUSTOM` (vedi §3.3 tabella)
- Tenant può aggiungere illimitati custom codes a runtime senza deploy

Future review: se un department canonical mancante è frequentemente creato come `custom` su molti tenant → promotion a canonical in deploy successivo (additivo, backward compatible).

### Q3 — Multi-responsabile per dipartimento ✅ ΑΠΑΝΤΗΘΗΚΕ + REFRAMED (2026-04-25, GOL)

**Decisione Γιώργου: Επιλογή Γ — Ιεραρχία πλήρης (Google-style manager-pointer pattern).**

La domanda originale ("1 vs N responsibles") è stata reformulata durante la discussione GOL in "che profondità di organizzazione?". La risposta supera la domanda originale: l'app modella TUTTO il personale del department (επικεφαλής + managers + seniors + employees + interns) con apertura illimitata di livelli.

**Conseguenze sullo schema** (vedi §3.2 + §3.11):
- `OrgResponsible` rinominato → `OrgMember`
- `responsibles[]` → `members[]`
- Aggiunto `reportsTo: string | null` (manager pointer)
- Aggiunto `role: OrgMemberRole` ('head' | 'manager' | 'senior' | 'employee' | 'intern' | 'custom')
- Aggiunto `isDepartmentHead: boolean` (sostituisce `isPrimary`)
- Aggiunto `receivesNotifications: boolean` (controllo email per-membro)
- Aggiunto `positionLabel?: string` (etichetta libera "Senior λογιστής", "Ασκούμενη", ecc.)

**Architettura completa**: §3.11 (Hierarchy support — Google manager-pointer pattern).

### Q4 — Link Member ↔ Firebase Auth User ✅ ΑΠΑΝΤΗΘΗΚΕ (2026-04-25, ENTERPRISE)

**Decisione Γιώργου: Α — Sì, link opzionale sempre disponibile per L1.**

**Rationale enterprise** (allineato con Google Workspace, Salesforce, SAP SuccessFactors, Workday, Microsoft Azure AD, Oracle HCM):
- L'employee record è la **single source of truth**; il user account è la sua proiezione runtime per login + permessi.
- Pattern UNIVERSALE in enterprise SaaS: separare `Employee` da `User` è un anti-pattern — genera dati duplicati, inconsistencies, blocca permission scoping per dipartimento.
- Il nostro modello hybrid (Member ↔ Contact ↔ User, tutti opzionali) è una **estensione** del pattern Google, non una alternativa: aggiunge il caso "external CRM contact" (L2/L3) che Google Workspace non ha (perché Workspace non è un CRM multi-tenant).

**Schema impact**: campo `OrgMember.userId?: string | null` già presente in §3.2 — nessun cambiamento schema. UI deve esporre picker "Σύνδεση με χρήστη εφαρμογής" come campo opzionale nel member editor (accanto a Link/Create/Plain mode + manager pointer).

**Validation invariants** (server-side enforcement):
- `userId` deve appartenere a un user dello **STESSO tenant** (`companyId`-scoped check al write)
- 1 user può essere member in **N department** (es. il CFO è head di Accounting + member di Management)
- Lookup: `users/{userId}.companyId === currentTenantId` — altrimenti throw

**Scope**: solo L1 (tenant proprio). L2/L3 (CompanyContact, ServiceContact) NON hanno `userId` — i loro "membri" sono persone esterne al nostro sistema, non users.

**Forward-looking unlocks** (per ADRs successivi, NON in MVP):
- 🔮 Per-department dashboards basati su `userId → member.departmentId`
- 🔮 Per-department permissions (ABAC/RBAC scoping fine-grained)
- 🔮 In-app notifications instradate a `userId` invece che solo email
- 🔮 Audit "who did what" arricchito con department context
- 🔮 Compliance reporting (SOC 2, GDPR, ISO 27001) — chi ha accesso a cosa, per quale ragione organizzativa

### Q5 — Override per evento singolo ✅ ΑΠΑΝΤΗΘΗΚΕ (2026-04-25)

**Decisione Γιώργου: Β — Sì, single email override per event abilitato da MVP.**

Schema invariato: `NotificationRoutingRule.overrideEmail` già in §3.2. Step 1 della cascade resolver (§3.5).

UI: pannello «Routing Eventi» nelle settings organization mostra tabella `event → default department` con campo `Override email` opzionale per riga.

**Limite MVP**: single email override (sostituzione totale del default, non CC). CC list multi-recipient = post-MVP feature.

### Q6 — Public services migration ✅ ΑΠΑΝΤΗΘΗΚΕ + REFRAMED (2026-04-25)

**Decisione Γιώργου: NO migration. L3 simplified out of full org structure scope.**

Razionale: use case mismatch — costruction tenants non gestiscono org chart pubblici servizi. ServiceContact mantiene `responsiblePersons[]` con upgrade comms-only (Phase 4):
- `email: string` → `emails: EmailInfo[]`
- `phone: string` → `phones: PhoneInfo[]`
- Lasciati invariati: `department?`, `responsibilities?`, `availableHours?`

Nessuna ricostruzione in orgStructure. Nessun tab «Δομή Οργανισμού» su ServiceContact. Riapribile in ADR successivo se cambia uso reale.

### Q7 — Email/phone a livello dipartimento E a livello membro ✅ ΑΠΑΝΤΗΘΗΚΕ (2026-04-25, ENTERPRISE)

**Decisione Γιώργου: Β — Entrambi i livelli, per enterprise resilience.**

Rationale: «να μην χάνονται emails όταν λείπει 1 άτομο». Pattern centralino + persona allineato con realtà aziendale (λογιστήριο@nestor.gr + γεωργίου@nestor.gr).

**Schema impact**: nessun cambio — già presente in §3.2 (`OrgDepartment.emails?` + `OrgDepartment.phones?` + `OrgMember.emails` + `OrgMember.phones`).

**Resolver cascade** (§3.5) confermata 4-step (v0.12: env var fallback rimosso, G1):
1. `NotificationRoutingRule.overrideEmail` (event-specific explicit)
2. Department head's primary email (`isDepartmentHead === true && status === 'active'`)
   - 2.5 backup (G3): se head archived → primo membro con `receivesNotifications=true && status='active'`
3. Department-level emails[0] (centralino — fallback finale)
4. `null` → skip + structured warn log + audit trail

**Stesso pattern per L2 contacts** (`resolveContactDepartmentEmail`, NO L3):
1. Contact dept head's primary email (con backup G3)
2. Contact dept-level emails[0]
3. `null` → caller decide

**Per L3 ServiceContact**: code path diverso — `resolveServicePersonContact()` legge `responsiblePersons[]` (no orgStructure).

### Q8 — Backward compat env var ✅ ΑΠΑΝΤΗΘΗΚΕ (2026-04-25, ENTERPRISE)

**Decisione Γιώργου: Δ (nuova) — NESSUN env var fallback. Pure UI-driven da Phase 0.**

**Razionale**: pre-production state (memory: «test data wiped before production»). Nessun legacy tenant. Aggiungere fallback env var = dead code path che non si attiverà mai in production + complica resolver senza beneficio.

**Impacts**:
- Resolver §3.5 cascade: **4-step** (era 5-step). Source enum: `'override' | 'head' | 'dept'` (rimosso `'envFallback'`)
- `ACCOUNTING_NOTIFY_EMAIL` rimosso da Vercel + `.env.example` in **Phase 0** (era Phase 9)
- Phase 9 **ridotta a 0.25 giorni** (solo docs cross-references)
- ADR-198 status: SUPERSEDED da ADR-326
- Pre-launch tenants devono completare onboarding wizard (Q9 banner + Q11 default toggles guidano flow)
- Caso «no setup, email skipped»: log structured warn + dashboard banner persistente + email reminder cron 7-day

### Q9 — Onboarding obbligatorio? ✅ ΑΠΑΝΤΗΘΗΚΕ (2026-04-25)

**Decisione Γιώργου: Β — Skippable con persistent banner.**

UX flow:
- Wizard skippable senza friction (single click)
- Persistent banner su dashboard: «⚠️ Δεν έχεις ορίσει τμήμα Λογιστηρίου. Setup τώρα»
- Cron daily check: dopo 7 giorni senza setup accounting → email warning a `company_admin`
- Quando event necessita routing e dept manca → log warning + skip email + audit trail
- Pattern allineato Google (skippable, banner-driven, never-block)

**Implementazione**: Phase 8 (onboarding wizard + dashboard banner + cron reminder).

### Q10 — UI unification con accounting setup ✅ ΑΠΑΝΤΗΘΗΚΕ (2026-04-25)

**Decisione Γιώργου: Β — Ενοποιημένη σελίδα `Settings → Εταιρεία` con 4 tabs.**

Layout:
```
Settings → 🏢 Εταιρεία
├── Tab «Στοιχεία» (legal name, ΑΦΜ, address — από EnterpriseCompanySettings)
├── Tab «Φορολογικά» (ΚΑΔ, ΔΟΥ, regime ΦΠΑ — da ACC-000 accounting_settings/company_profile)
├── Tab «Δομή Οργανισμού» (departments + members + hierarchy — από ADR-326)
└── Tab «Routing Eventi» (event → department overrides — από ADR-326)
```

**Data layer**: NO data migration — i 4 tab leggono/scrivono dai loro path Firestore canonical:
- Tab Στοιχεία → `system/company` (EnterpriseCompanySettingsService)
- Tab Φορολογικά → `accounting_settings/company_profile` (FirestoreAccountingRepository)
- Tab Δομή Οργανισμού → `companies/{id}.settings.orgStructure` (nuovo, ADR-326)
- Tab Routing Eventi → `companies/{id}.settings.orgStructure.notificationRouting` (sub-document)

**UI layer**: 1 sola page `src/app/(app)/settings/company/page.tsx` con `Tabs` di Radix. Ogni tab è un componente dedicato che incapsula la sua logica.

**Razionale enterprise**: pattern Salesforce / SAP / Google Workspace Admin — tutto ciò che definisce «l'identità della tua azienda» in un menu, separato da preferenze utente individuali.

**Implementazione**: Phase 2 estesa — invece di `src/app/(app)/settings/organization/page.tsx` standalone, diventa `src/app/(app)/settings/company/page.tsx` con tabs. ACC-000 setup wizard riusato come tab content (nessun cambio data).

### Q11 — Dipartimenti predefiniti al setup ✅ ΑΠΑΝΤΗΘΗΚΕ (2026-04-25)

**Decisione Γιώργου: Β — Wizard onboarding con 4 toggles.**

Pre-selezionati: ✅ ACCOUNTING, ✅ SALES (coperti da flow attivi).
Opzionali: ◻️ ENGINEERING, ◻️ LEGAL.

User pattern: Google-style sensible defaults + user customization. Riduce time-to-first-value senza imporre struttura rigida.

**Implementazione**: Phase 8 (onboarding wizard).

---

## 9. Changelog

| Data | Versione | Cambio | Autore |
|------|----------|--------|--------|
| 2026-04-25 | v0.1 — PROPOSED | Prima stesura per discussione | Γιώργος + Claude Code |
| 2026-04-25 | v0.2 — Q1 risolta | Decisione Γιώργου: scope = L1+L2+L3 (Επιλογή Β). Department taxonomy two-layer (canonical codes + per-tenant custom, runtime-extensible). | Γιώργος + Claude Code |
| 2026-04-25 | v0.3 — Responsible UX | Decisione Γιώργου: 3-mode declaration (Link/Create/Plain). `contactId?: string \| null` rimane opzionale. Pattern Google-like read-through con override per-department. §3.10 aggiunta. | Γιώργος + Claude Code |
| 2026-04-25 | v0.4 — Q3 risolta GOL | Decisione Γιώργου: hierarchy completa (Επιλογή Γ + GOL). `OrgResponsible` → `OrgMember` con `reportsTo` (manager pointer), `role`, `isDepartmentHead`, `receivesNotifications`, `positionLabel`. §3.11 Hierarchy support aggiunta (algoritmo build-tree, invariants, reassignment flow, GOL checklist). Q2 auto-risolta. Roadmap esteso a ~9 giorni. | Γιώργος + Claude Code |
| 2026-04-25 | v0.5 — Q4 risolta ENTERPRISE | Decisione Γιώργου: Member ↔ User link opzionale per L1 (ευθυγραμμισμένο con Google Workspace, Salesforce, SAP, Workday, Azure AD). Anti-pattern di separare Employee da User chiarito. Schema invariato (userId già presente). Forward unlocks documentati (per-dept dashboards/permissions/notifications/audit/compliance). | Γιώργος + Claude Code |
| 2026-04-25 | v0.6 — AI + UI tab + Phasing | Γιώργος chiarimenti: (1) AI integration richiesta — nuova §3.12 + Phase 7 (5 agentic tools, schema map ext, prompt update). (2) Org tab separato dal tab Σχέσεις — nuova §3.13 (separation of concerns + bridge logic). (3) Roadmap riorganizzato in 10 phases self-contained con clean context per ognuna (Goal/Inputs/Outputs/Acceptance/Dependencies). Total ~12.5 giorni, 50-65 file. | Γιώργος + Claude Code |
| 2026-04-25 | v0.7 — Q7 risolta ENTERPRISE | Decisione Γιώργου: dept-level + member-level comms entrambi (Επιλογή Β). Resilience pattern centralino + persona. Schema invariato. Resolver cascade 5-step confermata. | Γιώργος + Claude Code |
| 2026-04-25 | v0.8 — Q5 risolta | Decisione Γιώργου: per-event override email abilitato da MVP (Β). Schema invariato (`NotificationRoutingRule.overrideEmail` già presente). | Γιώργος + Claude Code |
| 2026-04-25 | v0.9 — Q11 risolta | Decisione Γιώργου: onboarding wizard con 4 toggles (Β) — ACCOUNTING+SALES pre-selezionati, ENGINEERING+LEGAL opzionali. Phase 8 implementation. | Γιώργος + Claude Code |
| 2026-04-25 | v0.10 — Q9 risolta | Decisione Γιώργου: onboarding skippable con persistent banner (Β). Cron 7-day email reminder. Pattern Google-style never-block. | Γιώργος + Claude Code |
| 2026-04-25 | v0.11 — Q10 risolta | Decisione Γιώργου: UI unificata `Settings → Εταιρεία` con 4 tabs (Β) — Στοιχεία/Φορολογικά/Δομή Οργανισμού/Routing Eventi. NO data migration (i tab leggono dai canonical path). Phase 2 path adjusted da `/settings/organization` → `/settings/company` con tabs. | Γιώργος + Claude Code |
| 2026-04-25 | v0.12 — Q6 + Q8 risolte ENTERPRISE | Decisioni Γιώργου: (1) NESSUN env var fallback — pure UI-driven da Phase 0 (resolver 4-step, ADR-198 SUPERSEDED in Phase 0 invece di Phase 9). (2) L3 simplified — ServiceContact mantiene `responsiblePersons[]` con upgrade solo comms (EmailInfo[]/PhoneInfo[]), NO orgStructure, NO hierarchy, NO tab. Update §3.1, §3.5, §3.13, §3.14, §4, Phase 4, Phase 5, Phase 9. Roadmap ridotto a ~11 giorni. | Γιώργος + Claude Code |
| 2026-04-25 | **v1.0 — APPROVED** | Audit pre-implementation: 25 inconsistencies sistemate + 7 implementation gaps risolti (G5 deleted as redundant). Decisioni: G1 Vercel removal Phase 9; G2 NO migration script (DB pre-prod, wipe); G3 backup-fallback semantics (`receivesNotifications=true` su non-head = backup quando head archived, NO CC list MVP); G4 auto-resolved by G3; G6 canonical max 1 + custom unlimited; G7 smart import banner one-time da ContactRelationships; G8 `userId` hidden per L2 + Firestore rules reject. Roadmap ~10.5 giorni. **Status: APPROVED, ready for Phase 0 implementation in nuova sessione**. | Γιώργος + Claude Code |
| 2026-04-26 | v1.6 — Phase 5 IMPLEMENTED | L2 contact org structure UI embedded in CompanyContact tab. SSoT reuse OrgStructureTab. G8 sanitizer userId=null. Bridge banner via ContactRelationshipService. Registro solo COMPANY_GEMI_SECTIONS. v1.7-deferred: banner dismiss persistence, auto-match per relationship type, reverse bridge, unit tests. | Γιώργος + Claude Code |
| 2026-04-26 | **v1.7 — Phase 6 IMPLEMENTED** | Phase 6 completata: (1) **6.0** `resolveContactDepartmentEmail` + `resolveEmailFromContactOrgStructure` aggiunte a `org-routing-resolver.ts` — L2 resolver con cache 5-min keyed by `contactId:deptCode`. `getContactOrgStructure` aggiunta a `org-structure-repository.ts`. (2) **6.1** `resolveSupplierAccountingEmail` helper in `po-email-service.ts`; PO email route usa `resolveContactDepartmentEmail(po.supplierId, 'accounting')` con log structured source. (3) **6.2** `role-to-dept-map.ts` creato (SSoT mapRoleToDept); `professional-assigned/route.ts` usa L2 resolver post-extractPrimaryEmail con fallback. (4) **6.3** `EmailSendRecord.resolvedSource` aggiunto; invoice send-email route cascade: `recipientEmail` → `customerContactId` L2 resolver → 422. `.ssot-registry.json` aggiornato con modulo `professional-role-routing` (Tier 3). 4 test file creati. | Claude Code (Phase 6 IMPL) |
| 2026-04-26 | **v1.8 — Phase 7 IMPLEMENTED** | AI agent integration completata: 5 agentic tools esposti al super admin via `OrgStructureHandler` (Strategy pattern, NON nuova directory `agentic-tools/` — code-as-SSoT divergence dall'ADR originale). Tools: `query_org_structure`, `get_department_head`, `find_department_member`, `traverse_hierarchy`, `resolve_routing_email`. Safety: max depth 10, max members 100, tenant isolation L2 via `verifyContactBelongsToTenant`. UC-012 esteso con `department-keyword-resolver.ts` (Greek regex → DepartmentCode → L1 head/backup/dept cascade) integrato pre-contact-by-name. `firestore-schema-map.ts` esteso con 2 schemas (`companies.settings.orgStructure`, `contacts.orgStructure`) che redirigono l'AI verso i dedicated tools. `ADMIN_COMMAND_SYSTEM` prompt esteso. `.ssot-registry.json` +modulo `ai-org-structure-tools` (Tier 3). 2 test file (handler + keyword resolver). | Claude Code (Phase 7 IMPL) |
| 2026-04-26 | **v1.9 — Phase 8 IMPLEMENTED** | Onboarding wizard completato: `src/app/onboarding/organization/page.tsx` (flat path, nessun `(app)` group), `src/services/onboarding/onboarding-state-service.ts` (getOnboardingState/markSkipped/markCompleted/findCompaniesNeedingReminder), `src/services/onboarding/onboarding-types.ts` (pure helpers client-safe: isRemindEligible/isBannerEligible), `src/app/api/onboarding/organization/route.ts` (GET+POST, company_admin only per POST), `src/app/api/cron/onboarding-reminder/route.ts` (daily 05:00 UTC, Mailgun reminder), `src/components/dashboard/OnboardingBanner.tsx` (amber dismissible via sessionStorage). Wizard: 4 toggles Accounting✅/Sales✅/Engineering◻/Legal◻ → POST complete → saveOrgStructure embryonic + markCompleted. Skip → markSkipped → banner 7-day. Cron scans all companies, finds admins via users collection, sends email. vercel.json +cron `0 5 * * *`. `.ssot-registry.json` +modulo `onboarding-flow` Tier 3. i18n `onboarding` namespace el+en. 9/9 unit test (pure helpers). | Claude Code (Phase 8 IMPL) |
| 2026-04-26 | **v2.0 — FULLY IMPLEMENTED** | Phase 9 completata: `docs/centralized-systems/README.md` +sezione `🏢 TENANT ORG STRUCTURE & ROUTING`. ADR-198 non aveva file standalone (pattern inline). ACCOUNTING_NOTIFY_EMAIL non in .env.example (già rimossa). Rimozione Vercel production env var da fare manualmente: `npx vercel env rm ACCOUNTING_NOTIFY_EMAIL production`. Tutte le Phases 0-9 completate. ADR-326 chiuso. | Claude Code (Phase 9 IMPL) | Onboarding wizard completato: `src/app/onboarding/organization/page.tsx` (flat path, nessun `(app)` group), `src/services/onboarding/onboarding-state-service.ts` (getOnboardingState/markSkipped/markCompleted/findCompaniesNeedingReminder), `src/services/onboarding/onboarding-types.ts` (pure helpers client-safe: isRemindEligible/isBannerEligible), `src/app/api/onboarding/organization/route.ts` (GET+POST, company_admin only per POST), `src/app/api/cron/onboarding-reminder/route.ts` (daily 05:00 UTC, Mailgun reminder), `src/components/dashboard/OnboardingBanner.tsx` (amber dismissible via sessionStorage). Wizard: 4 toggles Accounting✅/Sales✅/Engineering◻/Legal◻ → POST complete → saveOrgStructure embryonic + markCompleted. Skip → markSkipped → banner 7-day. Cron scans all companies, finds admins via users collection, sends email. vercel.json +cron `0 5 * * *`. `.ssot-registry.json` +modulo `onboarding-flow` Tier 3. i18n `onboarding` namespace el+en. 2 test file (pure helpers). | Claude Code (Phase 8 IMPL) |

---

## 10. Appendice — File impattati (v1.0)

**Nuovi (Phase 0-1):**
- `src/types/org/org-structure.ts`
- `src/config/department-codes.ts`
- `src/services/org-structure/org-routing-resolver.ts`
- `src/services/org-structure/org-structure-repository.ts`
- `src/services/org-structure/utils/build-org-tree.ts` (≤40 righe)
- `src/services/org-structure/utils/validate-org-hierarchy.ts` (cycle + orphan + depth + canonical uniqueness)
- `src/app/api/org-structure/route.ts` — GET/PUT con withAuth
- `src/i18n/locales/{el,en}/org-structure.json` (~50 keys)
- Test files in `__tests__/`

**Nuovi (Phase 2 — UI unificata Settings → Εταιρεία):**
- `src/app/(app)/settings/company/page.tsx` (4 tabs)
- `src/app/(app)/settings/company/components/CompanyInfoTab.tsx`
- `src/app/(app)/settings/company/components/TaxSettingsTab.tsx`
- `src/app/(app)/settings/company/components/OrgStructureTab.tsx`
- `src/app/(app)/settings/company/components/RoutingEventsTab.tsx`
- `src/app/(app)/settings/company/components/DepartmentEditor.tsx`
- `src/app/(app)/settings/company/components/OrgTreeView.tsx`
- `src/app/(app)/settings/company/components/MemberEditor.tsx` (`userId` hidden per L2 — G8)
- `src/app/(app)/settings/company/components/ManagerPicker.tsx`

**Nuovi (Phase 5 — L2 contact tab):**
- `src/components/contacts/tabs/ContactOrgStructureTab.tsx`
- `src/components/contacts/tabs/orgStructure/ImportFromRelationshipsBanner.tsx` (G7)

**Nuovi (Phase 7 — AI tools):**
- ⚠️ Path effettivo (v1.8): `src/services/ai-pipeline/tools/handlers/org-structure-handler.ts` (singolo handler con 5 tools). Vedi nota path divergence in §Phase 7.
- `src/services/ai-pipeline/modules/uc-012-admin-send-email/department-keyword-resolver.ts`
- `src/services/ai-pipeline/tools/__tests__/handlers/org-structure-handler.test.ts`
- `src/services/ai-pipeline/modules/uc-012-admin-send-email/__tests__/department-keyword-resolver.test.ts`

**Nuovi (Phase 8 — Onboarding):**
- `src/app/(app)/onboarding/organization/page.tsx`

**Modificati:**
- `src/types/contacts/contracts.ts` — extend `EmailInfo.type` + `PhoneInfo.type` literals; `ResponsiblePerson.email/phone` → `EmailInfo[]/PhoneInfo[]` (Phase 4); deprecate `CompanyContact.contactPersons[]` (sostituito da orgStructure)
- `src/services/sales-accounting/notification-helpers.ts` — usa resolver, **rimuove** read di `process.env.ACCOUNTING_NOTIFY_EMAIL` (G1)
- `src/services/sales-accounting/accounting-office-notify.ts` — usa nuovo helper
- `src/services/procurement/po-email-service.ts` — usa `resolveContactDepartmentEmail` per L2 supplier (Phase 6)
- `src/app/api/notifications/professional-assigned/route.ts` — usa resolver L1 (Phase 6)
- `src/app/api/accounting/invoices/[id]/send-email/route.ts` — extend ACC-019 con resolver (Phase 6)
- `src/services/company/company-settings-types.ts` — `CompanySettings.orgStructure?: OrgStructure`
- `firestore.rules` — block per `companies/{id}.settings.orgStructure` + `contacts/{id}.orgStructure` (L2 only) + reject `userId !== null` su L2 (G8)
- `.ssot-registry.json` — modulo `org-structure` Tier 2
- `notification-events` registry — extend con nuovi codes (modulo esistente)
- `audit-tracked-fields.ts` — campi `orgStructure.*`
- `src/services/ai-pipeline/firestore-schema-map.ts` — extend con orgStructure (25 → 27)
- `src/services/ai-pipeline/modules/uc-012-admin-send-email/admin-send-email-module.ts` — pre-send routing check
- `src/services/ai-pipeline/config/ai-analysis-config.ts` — `ADMIN_COMMAND_SYSTEM` prompt update
- `src/config/contact-tabs-config.ts` — aggiungere tab solo per `type='company'`
- `.env.example` — **rimossa** linea `ACCOUNTING_NOTIFY_EMAIL` (Phase 9, G1)
- Vercel production — `npx vercel env rm ACCOUNTING_NOTIFY_EMAIL production` (Phase 9)
- `adrs/ADR-198` — status: SUPERSEDED by ADR-326
- `docs/centralized-systems/README.md` — riferimento ADR-326

---

---

## Changelog

| Version | Date | Description |
|---------|------|-------------|
| v1.0 | 2026-04-25 | APPROVED — All 11 open questions + 8 gaps resolved with Giorgio. Design finalized. |
| v1.1 | 2026-04-25 | Phase 0 IMPLEMENTED — SSoT primitives: types, config, utils, resolver, i18n, tests (32 tests, 98.74% coverage). Files: `src/types/org/org-structure.ts`, `src/config/department-codes.ts`, `src/services/org-structure/utils/build-org-tree.ts`, `src/services/org-structure/utils/validate-org-hierarchy.ts`, `src/services/org-structure/org-routing-resolver.ts`, `src/i18n/locales/{el,en}/org-structure.json`. Modified: `notification-events.ts` (+NOTIFICATION_EVENTS + DEFAULT_EVENT_TO_DEPARTMENT), `enterprise-id-prefixes.ts` (+ORG_STRUCTURE/DEPARTMENT/MEMBER), `.ssot-registry.json` (+org-structure Tier 2). |
| v1.2 | 2026-04-25 | Phase 1 IMPLEMENTED — Server write path L1 + Firestore rules note. New: `org-structure-repository.ts` (Admin SDK CRUD, 5-min cache), `api/org-structure/route.ts` (GET + PUT, company_admin guard, hierarchy validation). Modified: `types/company.ts` (+orgStructure to CompanySettings), `org-routing-resolver.ts` (resolveTenantNotificationEmail wired to repository), `firestore.rules` (comment). Tests: 33 passing (33/33). |
| v1.3 | 2026-04-25 | Phase 2 IMPLEMENTED — Tenant settings UI `/settings/company` with 4 Radix tabs. New: `src/app/settings/company/page.tsx`, `src/components/settings/company/` (7 components: CompanySettingsPageContent, CompanyInfoTab, TaxSettingsTab, OrgStructureTab, RoutingEventsTab, DepartmentEditor, OrgTreeView, MemberEditor, ManagerPicker). Modified: `lazyRoutesAdr294.tsx` (+CompanySettings), `domain-constants.ts` (+API_ROUTES.ORG_STRUCTURE), `smart-navigation-factory.ts` (+/settings/company nav entry), `org-structure.json` (+Phase 2 i18n keys). |
| v1.4 | 2026-04-25 | Phase 3 IMPLEMENTED — `notifyAccountingOffice` connected to OrgStructure resolver. Removed `process.env.ACCOUNTING_NOTIFY_EMAIL` read (G1). Added `resolveAccountingEmail(companyId, event)` in `notification-helpers.ts`. Updated `notifyAccountingOffice(event, result, companyId)` signature + structured logging with `source` field. Fixed pre-existing `formatNotificationDate` broken re-export → proper `formatDate` function. `SalesAccountingBridge` stores `companyId` + passes to notify calls. Files: `notification-helpers.ts`, `accounting-office-notify.ts`, `sales-accounting-bridge.ts`. Tests: 5/5 new integration tests passing. |
| v1.5 | 2026-04-26 | Phase 4 IMPLEMENTED — `EmailInfo.type` extended with `'invoice' \| 'notification' \| 'support'`; `PhoneInfo.type` extended with `'internal'`. `ResponsiblePerson` upgraded: `email: string → emails: EmailInfo[]`, `phone: string → phones: PhoneInfo[]`. Backward-compat mapper `normalizeResponsiblePersonComms()` exported from `contracts.ts`. `PHONE_TYPE_LABELS` + `EMAIL_TYPE_LABELS` updated. i18n keys added to `contacts-relationships.json` (el + en). No switch statements on EmailInfo/PhoneInfo type found (object-lookup pattern only). |
| v1.8 | 2026-04-26 | Phase 7 IMPLEMENTED — AI agent integration via `OrgStructureHandler` (Strategy pattern, in `src/services/ai-pipeline/tools/handlers/`). 5 tools: `query_org_structure`, `get_department_head`, `find_department_member`, `traverse_hierarchy`, `resolve_routing_email`. Tenant isolation enforced for L2 (verifyContactBelongsToTenant). UC-012 extended with Greek-keyword department routing (`department-keyword-resolver.ts`). `firestore-schema-map.ts` +2 schemas, `.ssot-registry.json` +`ai-org-structure-tools` Tier 3 module, `ADMIN_COMMAND_SYSTEM` prompt extended. Tests: 19 handler + 11 keyword-resolver. |
| v1.6 | 2026-04-26 | Phase 5 IMPLEMENTED — L2 contact-embedded org structure UI. New: `src/components/contacts/tabs/ContactOrgStructureTab.tsx` (thin wrapper over L1 `OrgStructureTab` with in-memory `formData.orgStructure` save + G8 userId-stripping sanitizer), `src/components/contacts/tabs/ImportFromRelationshipsBanner.tsx` (bridge: queries existing employee/manager/director relationships via `ContactRelationshipService.getOrganizationEmployees()`, dedupes by `contactId`, imports as `mode='linked'` `OrgMember`s with `userId=null`). Modified: `src/types/contacts/contracts.ts` (+`CompanyContact.orgStructure?`), `src/types/ContactFormTypes.ts` (+`ContactFormData.orgStructure?`), `src/config/company-gemi/core/section-registry.ts` (+`orgStructureSection` order=8, icon=`network`, registered in `COMPANY_GEMI_SECTIONS`), `src/components/generic/utils/IconMapping.ts` (+`Network` lucide alias), `src/components/ContactFormSections/contactRenderersCore.tsx` (+`orgStructure` custom renderer in `buildCoreRenderers`), `src/i18n/locales/{el,en}/forms.json` (+`sections.orgStructure` + description), `src/i18n/locales/{el,en}/org-structure.json` (+`orgStructure.l2.contactScopedNote`, +`importBanner.dismissAria`, +`importBanner.needDepartmentFirst`). Acceptance: ✅ tab visible only on company contacts (registry-scoped), ✅ SSoT zero-duplication (reuses L1 `OrgStructureTab` + `DepartmentEditor` + `MemberEditor`), ✅ G8 enforced by sanitizer (`userId: null` on every member pre-save), ✅ bridge banner self-hides when no candidates / dismissed / all imported, ✅ import requires existing dept (UI-guard via disabled CTA). |

**FINE ADR-326 v1.0 (APPROVED).** Tutte le decisioni di design risolte. Pronto per Phase 0 implementation in nuova sessione (vedi `ADR-326-HANDOFF.md` per context ancora).
