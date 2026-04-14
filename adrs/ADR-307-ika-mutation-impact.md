# ADR-307 — IKA/ΕΦΚΑ Tab Mutation Impact Guards

**Status:** Implemented
**Data:** 2026-04-14
**Autori:** YorgosPag
**Correlati:** ADR-090 (IKA/EFKA Labor Compliance System), ADR-302 (General Tab), ADR-303 (Addresses), ADR-304 (Ownership), ADR-305 (Landowners/Engineers), ADR-306 (Brokers)

---

## 1. Contesto

Questa ADR estende il sistema impact-guard (ADR-302→306) alle sotto-schede IKA del progetto.

Le sotto-schede IKA gestiscono il sistema di conformità lavoro (ADR-090): lavoratori, presenze,
ένσημα (contributi), ΑΠΔ (dichiarazioni periodiche) e configurazione ΕΦΚΑ globale.

L'analisi identifica 3 operazioni che necessitano di guard, con architettura proporzionale
al livello di rischio di ciascuna.

---

## 2. Analisi per sotto-scheda

### 2.1 Εργατοτεχνίτες (Workers) — già protetta ✅

- `linkContactToEntityWithPolicy` → additivo, nessun guard necessario
- `unlinkContactWithPolicy` → già protetto da `useConfirmDialog` + `useLinkRemovalGuard`

### 2.2 Παρουσιολόγιο (Timesheet) — nessun guard necessario ✅

- `createAttendanceEventWithPolicy` → eventi immutabili (pattern Procore), nessuna cascata downstream
- `saveGeofenceConfigWithPolicy` → sovrascrive config geofence locale al progetto, rischio basso
- `generateAttendanceQrCodeWithPolicy` → additivo

### 2.3 Αναγγελία ΕΦΚΑ (EFKA Declaration) — nessun guard necessario ✅

- `saveDeclaration` → aggiorna sub-doc `efkaDeclaration` sul progetto, nessuna cascata
- `initializeDeclaration` → crea sub-doc (additivo)

### 2.4 Υπολογισμός Ενσήμων (Stamps Calculation) — guard condizionale ⚠️

**Operazione**: `saveRecords` in `StampsCalculationTabContent.tsx`

**Rischio**: sovrascrive `employment_records` per il mese/anno selezionato. Se alcuni record
hanno già `apdStatus = 'submitted'` o `'accepted'`, la sovrascrittura cancella dati già
dichiarati all'ΕΦΚΑ.

**Rule engine** (client-side, nessuna query server):
| Condizione | Mode |
|---|---|
| `records.some(r => r.apdStatus ∈ {submitted, accepted})` | **destructive confirm** |
| nessun record submitted | allow diretto |

**Implementazione**: `useConfirmDialog` (hook già esistente, SSoT).

### 2.5 ΑΠΔ & Πληρωμές (APD Payments) — confirm obbligatorio ⚠️

**Operazione**: `handleMarkSubmitted` in `ApdPaymentsTabContent.tsx`

**Rischio**: marcare come "υποβεβλημένη" è un'azione con valenza legale-compliance.
In pratica irreversibile: indica che la dichiarazione è stata effettivamente presentata all'ΕΦΚΑ.

**Rule engine** (puro confirm, nessuna query):
| Condizione | Mode |
|---|---|
| sempre (azione compliance) | **destructive confirm** |

**Implementazione**: `useConfirmDialog` (hook esistente, SSoT).

### 2.6 Ρυθμίσεις ΕΦΚΑ (Settings) — full impact guard 🔴

**Operazione**: `saveLaborComplianceConfigWithPolicy` in `LaborComplianceSettingsTabContent.tsx`

**Rischio ALTO**: questa configurazione è **GLOBALE** (non per-progetto). Modifica le 28 classi
assicurative (KPK 781) e i ποσοστά εισφορών per l'intera azienda. Qualsiasi cambiamento
influenza il calcolo degli ένσημα di TUTTI i progetti attivi.

**Rule engine** (query server-side su `employment_records`):
| Condizione | Mode | Message key |
|---|---|---|
| `total == 0` | **allow** | — |
| `total > 0` | **warn** | `impactGuard.ikaSettingsSave.withActiveRecords` |

> Nota: non esiste mai `block` per questa operazione — il ragioniere deve poter aggiornare
> la configurazione annualmente quando l'ΕΦΚΑ emette una nuova circolare.

---

## 3. Architettura implementazione

### 3.1 Schede Stamps + APD (pattern leggero)

Usano `useConfirmDialog` (SSoT, già in uso in WorkersTabContent) — nessun nuovo file.
Nessuna query server, nessun impact preview endpoint. Decisione puramente client-side.

### 3.2 Scheda Settings (full guard pattern)

Pattern identico a ADR-302→306 (service + API + hook + wrapper):

- **Service** (server-only, Admin SDK): query su `employment_records` con `companyId`
- **API route**: POST `/api/ika/labor-compliance-save-preview`
- **Guard hook**: `useIkaLaborComplianceSaveImpactGuard` (Google INP pattern)
- **Wrapper**: `useGuardedLaborComplianceSave` (thin composer)

**Dependency ID**: `employmentRecordsGlobal` (nuovo — specifico per contesto globale,
distinto da `employmentRecords` usato nei guard per-progetto).

---

## 4. File coinvolti

### File CREATI

| File | Ruolo | Righe |
|---|---|---|
| `src/lib/firestore/ika-labor-compliance-save-impact.service.ts` | Query `employment_records` company-wide, rule engine | ~115 |
| `src/app/api/ika/labor-compliance-save-preview/route.ts` | POST endpoint — withAuth, withStandardRateLimit | ~35 |
| `src/hooks/useIkaLaborComplianceSaveImpactGuard.tsx` | Base guard hook (Google INP pattern) | ~105 |
| `src/hooks/useGuardedLaborComplianceSave.tsx` | Thin wrapper | ~35 |
| `adrs/ADR-307-ika-mutation-impact.md` | Questa ADR | — |

### File MODIFICATI

| File | Modifica |
|---|---|
| `src/config/domain-constants.ts` | `IKA.LABOR_COMPLIANCE_SAVE_PREVIEW` route constant |
| `src/config/project-mutation-impact.ts` | `'employmentRecordsGlobal'` aggiunto a `PROJECT_MUTATION_DEPENDENCY_IDS` |
| `src/components/projects/ika/LaborComplianceSettingsTabContent.tsx` | `useGuardedLaborComplianceSave` montato; `handleSave` chiama `runSaveOperation`; `ImpactDialog` renderizzato |
| `src/components/projects/ika/ApdPaymentsTabContent.tsx` | `useConfirmDialog` aggiunto; `handleMarkSubmitted` wrappato con confirm |
| `src/components/projects/ika/StampsCalculationTabContent.tsx` | `useConfirmDialog` aggiunto; `handleSaveRecords` verifica record submitted prima di salvare |
| `src/i18n/locales/el/projects.json` | `impactGuard.ikaSettingsSave.*` + `impactGuard.dependencies.employmentRecordsGlobal.*` |
| `src/i18n/locales/en/projects.json` | Idem |
| `src/i18n/locales/el/projects-ika.json` | `ika.stampsTab.confirm.overwriteSubmitted.*` + `ika.apdTab.confirm.markSubmitted.*` |
| `src/i18n/locales/en/projects-ika.json` | Idem |

### File NON toccati (riutilizzati as-is)

- `src/components/projects/dialogs/ProjectMutationImpactDialog.tsx` ✓
- `src/types/project-mutation-impact.ts` ✓
- `src/hooks/useConfirmDialog.ts` ✓

---

## 5. Chiavi i18n

### In `projects.json` (impactGuard namespace):

| Chiave | Trigger |
|---|---|
| `impactGuard.ikaSettingsSave.withActiveRecords` | Settings save con `employmentRecords.total > 0` |
| `impactGuard.dependencies.employmentRecordsGlobal.label` | Label nel dialog dependencies |
| `impactGuard.dependencies.employmentRecordsGlobal.remediation` | Testo remediation |

### In `projects-ika.json`:

| Chiave | Trigger |
|---|---|
| `ika.stampsTab.confirm.overwriteSubmitted.title` | Stamps save con record submitted esistenti |
| `ika.stampsTab.confirm.overwriteSubmitted.description` | Idem |
| `ika.apdTab.confirm.markSubmitted.title` | APD markSubmitted |
| `ika.apdTab.confirm.markSubmitted.description` | Idem |

---

## 6. Scenari di test

### Settings (full guard):
1. Nessun `employment_records` → save → allow diretto, nessun dialog ✓
2. `employment_records` esistenti → save → dialog WARN con count ✓
3. Utente annulla → save non avviene ✓
4. Utente conferma → save procede, dialog chiuso via Google INP pattern ✓
5. Preview endpoint non disponibile → dialog BLOCK con messaggio unavailable ✓

### APD (confirm):
1. Click "Σημείωση Υποβολής" → confirm dialog appare ✓
2. Annulla → nessun aggiornamento status ✓
3. Conferma → `updateApdStatus` per ogni record pending ✓

### Stamps (condizionale):
1. Nessun record submitted → save → diretto, nessun dialog ✓
2. Record con `apdStatus = 'submitted'` presenti → save → confirm dialog ✓
3. Annulla → save non avviene ✓
4. Conferma → `saveRecords` procede ✓

---

## 7. Changelog

| Data | Versione | Cambiamento |
|---|---|---|
| 2026-04-14 | 1.0.0 | ADR creata. Analisi 6 sotto-schede IKA. 3 guard implementati. Status: Implemented. |
