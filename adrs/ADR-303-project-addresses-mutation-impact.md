# ADR-303 — Project Addresses Tab Mutation Impact Guard

**Status:** Draft
**Data:** 2026-04-14
**Autori:** YorgosPag
**Correlati:** ADR-302 (Project Field Mutation Impact System), ADR-167 (Multi-Address System), ADR-090 (Attendance Geofence)

---

## 1. Contesto

La scheda "Indirizzi" di un progetto consente di gestire N indirizzi, ciascuno con
tipo classificato (`site`, `delivery`, `billing`, ecc.) e un flag `isPrimary`.

Questa ADR estende il sistema ADR-302 alla tab Indirizzi, seguendo lo stesso pattern:
registry dichiarativo + engine di query centralizzato + guard UI nel dialog.

### 1.1 Operazioni possibili nella tab

| Operazione | Descrizione |
|-----------|-------------|
| **ADD** | Aggiunge nuovo indirizzo al progetto |
| **EDIT** | Modifica i campi di un indirizzo esistente |
| **DELETE** | Rimuove un indirizzo |
| **SET_PRIMARY** | Cambia quale indirizzo è `isPrimary` |

---

## 2. Struttura dati — `ProjectAddress`

**File:** `src/types/project/addresses.ts`

```typescript
interface ProjectAddress {
  id: string;
  // Campi core
  street: string;
  number?: string;
  postalCode: string;
  city: string;              // οικισμός/πόλη
  // Divisione amministrativa greca
  community?: string;        // κοινότητα (da geo-canvas enrichment)
  municipalUnit?: string;    // δημοτική ενότητα (da geo-canvas enrichment)
  municipality?: string;     // δήμος
  regionalUnit?: string;     // περιφερειακή ενότητα
  region?: string;           // περιφέρεια
  country: string;           // χώρα
  // Classificazione
  type: ProjectAddressType;  // τύπος διεύθυνσης
  blockSide?: BlockSideDirection;  // πλευρά Ο.Τ.
  label?: string;            // ετικέτα (προαιρετικό)
  isPrimary: boolean;        // κύρια διεύθυνση ✓
  // Geo
  coordinates?: { lat: number; lng: number };
}
```

**Tipi address (`ProjectAddressType`):**
`site | entrance | delivery | legal | postal | billing | correspondence | other`

---

## 3. Analisi denormalizzazione — Ricerca codebase (2026-04-14)

### 3.1 Mappa denormalizzazione

| Collection | Campo | Valore stored | Auto-cascade? |
|-----------|-------|--------------|---------------|
| `purchase_orders` | `deliveryAddress: string\|null` | Snapshot testo al momento creazione PO | ❌ NO |
| `projects` | `address: string`, `city: string` | Derivato da `addresses[isPrimary]` | ✅ Sì (automatico, legacy) |
| `buildings` | `BuildingAddressReference` | Riferimento + override opzionale | ⚠️ Parziale (ADR-167 inheritance) |

### 3.2 Cosa NON è denormalizzato

| Collection | Motivo |
|-----------|--------|
| `legal_contracts` | Nessun campo address trovato nel codice |
| `accounting_invoices` | Nessun campo address trovato nel codice |
| `attendance_events` | Usa coordinate GPS da `geofenceConfig`, NON testo indirizzo |
| `obligations` | Campo `address` trovato in alcuni tipi ma non popolato da project addresses |
| `communications` | Nessuna denormalizzazione indirizzo |
| `contact_links` | Solo riferimento ID |

### 3.3 Cascade automatica (legacy fields)

Quando cambia l'indirizzo `isPrimary`, il sistema aggiorna automaticamente:
- `project.address` (string) → `${street} ${number}`
- `project.city` (string) → `city`

Questi campi legacy sono derivati — **non richiedono guard** (update automatico).

### 3.4 Building inheritance (ADR-167)

I buildings configurati con `inheritFromProject: true` leggono l'indirizzo del progetto
via `BuildingAddressReference`. Non è una copia ma un riferimento runtime.
**Impatto:** cambiare l'indirizzo primary cambia come i buildings vengono visualizzati
e come vengono esportati in report/documenti.

---

## 4. Decisioni — Matrice impatto per operazione

### 4.1 Operazione ADD (aggiunta nuovo indirizzo)

**→ Allow sempre.** Aggiungere un indirizzo non invalida dati preesistenti.

Eccezione: se l'utente aggiunge con `isPrimary = true` → vedi §4.4 (SET_PRIMARY).

---

### 4.2 Operazione EDIT — analisi per campo

#### Gruppo A — Campi LIBERI (allow diretto)

| Campo | Razionale |
|-------|-----------|
| `community` | Solo display amministrativo + geo-canvas |
| `municipalUnit` | Idem |
| `municipality` | Idem |
| `regionalUnit` | Idem |
| `region` | Idem |
| `country` | Idem |
| `blockSide` | Metadata costruzione, nessun consumatore downstream |
| `label` | Solo UI, nessun consumatore downstream |
| `coordinates` | Geofence usa `project.geofenceConfig`, non `addresses[].coordinates` |

**7 campi → allow diretto, nessun dialog.**

#### Gruppo B — Campi CORE (street / number / postalCode / city)

Impatto dipende dal **tipo** dell'indirizzo modificato:

| Tipo indirizzo | Dipendenza | Mode | Messaggio |
|---------------|-----------|------|----------|
| `delivery` | `purchaseOrders` | **warn** | "X παραγγελίες έχουν την παλιά διεύθυνση παράδοσης. Δεν ενημερώνονται αυτόματα." |
| `billing` | — | **info** | "Ελέγξτε τα τιμολόγια που αναφέρουν αυτή τη διεύθυνση." *(precauzione)* |
| `isPrimary == true` (qualsiasi tipo) | `buildings` | **info** | "X κτίρια κληρονομούν την κύρια διεύθυνση. Θα λάβουν τη νέα διεύθυνση." |
| Tutti gli altri tipi, non-primary | — | allow | — |

#### Gruppo C — `addressType` (cambio tipo)

| Cambio | Dipendenza | Mode | Messaggio |
|--------|-----------|------|----------|
| DA `delivery` → qualsiasi | `purchaseOrders` | **warn** | "X παραγγελίες αναφέρουν αυτή ως διεύθυνση παράδοσης. Η αλλαγή τύπου δεν ενημερώνει τις παραγγελίες." |
| DA `billing` → qualsiasi | — | info | Precauzione |
| Qualsiasi → `delivery` (già esiste delivery) | — | info | "Υπάρχει ήδη διεύθυνση παράδοσης. Βεβαιωθείτε ότι οι νέες παραγγελίες θα χρησιμοποιούν την σωστή." |

---

### 4.3 Operazione DELETE (elimina indirizzo)

| Condizione | Dipendenza | Mode | Messaggio |
|-----------|-----------|------|----------|
| Tipo `delivery` + `purchaseOrders > 0` | `purchaseOrders` | **warn** | "X παραγγελίες αναφέρουν αυτή τη διεύθυνση παράδοσης." |
| `isPrimary == true` | — | **block** | "Δεν μπορείτε να διαγράψετε την κύρια διεύθυνση. Ορίστε πρώτα άλλη ως κύρια." |
| Tipo `billing` + invoices > 0 | — | info | Precauzione *(se invoices denormalizzano in futuro)* |
| Tutti gli altri casi | — | allow | — |

---

### 4.4 Operazione SET_PRIMARY (cambio `isPrimary`)

**Always INFO/WARN se buildings > 0.**

| Dipendenza | Mode | Messaggio |
|-----------|------|----------|
| `buildings` | **warn** | "X κτίρια κληρονομούν την κύρια διεύθυνση. Η αλλαγή θα επηρεάσει την εμφάνισή τους σε αναφορές και έγγραφα." |
| `legalContracts` | **info** | "Τα συμβόλαια αναφέρουν την κύρια διεύθυνση ως τόπο. Επιβεβαιώστε την ορθότητα." |

---

## 5. Dipendenze da aggiungere al registry (ADR-302 estensione)

Le query esistenti in `collectDependencyCounts()` coprono già `purchaseOrders` e `buildings`.
**Nessuna nuova query necessaria** per il guard della tab Indirizzi.

---

## 6. Architettura implementazione

### 6.1 Differenza rispetto alla scheda Generale

La scheda Generale ha UN guard per l'intero form save.
La tab Indirizzi ha operazioni **per-address** (add, edit, delete, set-primary).
Il guard deve operare **a livello di singola operazione**, non di form.

### 6.2 Approccio raccomandato

**Opzione A — Guard per-operazione separato (nuovo service)**

Nuovo service: `src/lib/firestore/project-address-mutation-impact.service.ts`

Input: `{ projectId, operation: 'add'|'edit'|'delete'|'set-primary', address: ProjectAddress, changedFields?: (keyof ProjectAddress)[] }`

Output: `ProjectMutationImpactPreview` (stesso tipo del guard generale)

Vantaggi: riusa dialog, hook, tipo esistente. Solo la logica query cambia.

**Opzione B — Estendere il guard generale**

Aggiungere `addressMutation` come nuovo `ProjectMutationKind` nel registry esistente.

Svantaggi: il kind `addressMutation` porta informazioni context (quale tipo di indirizzo, quale operazione) che non si mappano bene sul modello a `changes[]` del guard generale.

**→ Decisione: Opzione A** — service separato, stesso dialog/hook/tipo output.

### 6.3 Hook

Nuovo hook: `useGuardedProjectAddressMutation` (pattern identico a `useGuardedProjectMutation`).

---

## 7. File da creare/modificare

### Da CREARE
- `src/lib/firestore/project-address-mutation-impact.service.ts` — query engine
- `src/hooks/useGuardedProjectAddressMutation.tsx` — hook React

### Da MODIFICARE
- `src/i18n/locales/el/projects.json` — chiavi `impactGuard.addressMutation.*`
- `src/i18n/locales/en/projects.json` — idem

### NON toccare
- `src/app/api/projects/[projectId]/impact-preview/route.ts` — esistente, o nuovo endpoint dedicato
- `src/components/projects/dialogs/ProjectMutationImpactDialog.tsx` — riutilizzato as-is
- `src/hooks/useProjectMutationImpactGuard.tsx` — non toccato

> ⚠️ **Da decidere con Giorgio:** serve una nuova API route
> (`/api/projects/[projectId]/address-impact-preview`) o si estende quella esistente?

---

## 8. Scenari di test (Fase D)

1. Progetto con `purchaseOrders > 0` → modifica street di indirizzo `delivery` → WARN
2. Progetto con `purchaseOrders > 0` → cambia tipo DA `delivery` → WARN
3. Progetto con `buildings > 0` → SET_PRIMARY su altro indirizzo → WARN
4. Eliminazione indirizzo `isPrimary` → BLOCK
5. Eliminazione indirizzo non-primary, non-delivery → allow
6. Aggiunta nuovo indirizzo → allow sempre
7. Modifica `region` / `municipality` / `blockSide` → allow sempre

---

## 9. Changelog

| Data | Versione | Cambiamento |
|------|---------|-------------|
| 2026-04-14 | 1.0.0 | ADR creata. Analisi denormalizzazione completa. Matrice impatto per 4 operazioni (add/edit/delete/set-primary). Architettura: service separato, stesso dialog/hook/tipo ADR-302. Status: Draft. |
