# ADR-306 — Project Brokers Tab Mutation Impact Guard

**Status:** Implemented
**Data:** 2026-04-14
**Autori:** YorgosPag
**Correlati:** ADR-302 (General Tab), ADR-303 (Addresses Tab), ADR-304 (Ownership Table Tab), ADR-305 (Landowners & Engineers Tab), ADR-230 (Brokerage Contract Workflow)

---

## 1. Contesto

Questa ADR estende il sistema impact-guard (ADR-302/303/304/305) alla tab **Μεσίτες** del progetto.

La tab gestisce **brokerage agreements** (μεσιτικές συμφωνίες) tra il progetto e agenti immobiliari.
Ogni accordo può avere commissioni collegate (`commission_records`). Terminare un accordo con
commissioni `pending` significa che il denaro dovuto al mediatore non viene più tracciato —
l'utente deve essere avvertito prima di procedere.

---

## 2. Analisi denormalizzazione

### 2.1 Collection principale: `brokerage_agreements`

| Campo | Tipo | Denormalizzato dove? |
|---|---|---|
| `agentName` | COPY | `commission_records.agentName` (snapshot al momento della vendita) |
| `projectId` | FK | link diretto |
| `status` | enum | — |

> **Nota:** In edit mode il contatto agente non può essere cambiato — solo i termini
> dell'accordo (exclusivity, commission, date, notes). Quindi la modifica di `agentName`
> non è possibile tramite UI → nessun guard per EDIT.

### 2.2 Collection downstream: `commission_records`

| Campo | Tipo | Note |
|---|---|---|
| `brokerageAgreementId` | FK | riferimento all'accordo |
| `agentName` | SNAPSHOT | snapshot al momento della vendita, non aggiornato live |
| `paymentStatus` | enum | `pending` / `paid` / `cancelled` |

**Query rilevante per TERMINATE:**
```
commission_records
  where companyId == companyId
  where brokerageAgreementId == agreementId
  where paymentStatus == 'pending'
```

---

## 3. Operazioni e matrice impatto

### 3.1 TERMINATE agreement

| Condizione | Dipendenza | Mode | Messaggio chiave |
|---|---|---|---|
| `pendingCommissions > 0` | `commission_records` | **warn** | `impactGuard.brokerTerminate.withPendingCommissions` |
| `pendingCommissions == 0` | — | allow | — |

**Razionale:** Terminare un accordo con commissioni pending significa che il pagamento
dovuto al mediatore potrebbe andare perso o non tracciato. L'utente deve confermare
consapevolmente.

### 3.2 ADD new agreement

→ **allow sempre** (documento nuovo, nessuna dipendenza downstream).

### 3.3 EDIT agreement (update termini)

→ **allow sempre** (agente non cambia in edit mode, `agentName` snapshot in
`commission_records` non viene aggiornato — è un snapshot storico legittimo).

### 3.4 RENEW (update endDate)

→ **allow sempre** (nessuna dipendenza downstream).

---

## 4. Architettura implementazione

Pattern identico a ADR-305 (engineer remove): service separato, route dedicata, riuso
`ProjectMutationImpactDialog` + `ProjectMutationImpactPreview`.

**Intercept point:** `handleTerminate` in `useBrokerageAgreements.ts` viene sostituito
con `runTerminateOperation(agreementId, originalAction)` dal guard hook.

---

## 5. File coinvolti

### File CREATI

| File | Ruolo | Righe |
|---|---|---|
| `src/lib/firestore/project-broker-terminate-impact.service.ts` | Query `commission_records where paymentStatus==pending`, rule engine | ~100 |
| `src/app/api/projects/[projectId]/broker-terminate-preview/route.ts` | POST endpoint — Zod, withAuth, withStandardRateLimit | ~55 |
| `src/hooks/useProjectBrokerTerminateImpactGuard.tsx` | Base guard hook (Google INP pattern) | ~105 |
| `src/hooks/useGuardedBrokerTerminate.tsx` | Thin wrapper con `runTerminateOperation()` | ~25 |

### File MODIFICATI

| File | Modifica |
|---|---|
| `src/config/domain-constants.ts` | `BROKER_TERMINATE_PREVIEW` route constant |
| `src/components/projects/tabs/brokerage/useBrokerageAgreements.ts` | `handleTerminate` → `runTerminateOperation` via guard |
| `src/components/projects/tabs/ProjectBrokersTab.tsx` | `useGuardedBrokerTerminate` montato, `ImpactDialog` renderizzato |
| `src/i18n/locales/el/projects.json` | `impactGuard.brokerTerminate.*` (1 chiave) |
| `src/i18n/locales/en/projects.json` | Idem |

### File NON toccati (riutilizzati as-is)

- `src/components/projects/dialogs/ProjectMutationImpactDialog.tsx` ✓
- `src/types/project-mutation-impact.ts` ✓

---

## 6. Chiavi i18n (1 nuova chiave sotto `impactGuard.*`)

| Chiave | Trigger |
|---|---|
| `impactGuard.brokerTerminate.withPendingCommissions` | TERMINATE + pendingCommissions > 0 |

---

## 7. Scenari di test

1. Accordo con `commission_records` pending > 0 → TERMINATE → dialog WARN ✓
2. Accordo senza commissioni pending → TERMINATE → allow diretto ✓
3. ADD nuovo accordo → allow sempre ✓
4. EDIT accordo → allow sempre ✓
5. RENEW (update endDate) → allow sempre ✓

---

## 8. Changelog

| Data | Versione | Cambiamento |
|---|---|---|
| 2026-04-14 | 1.0.0 | ADR creata. Analisi denormalizzazione completa. Matrice impatto: solo TERMINATE con pendingCommissions → warn. Status: Draft. |
| 2026-04-14 | 2.0.0 | Implementazione completa. 4 file creati, 5 modificati. Draft → Implemented. |
