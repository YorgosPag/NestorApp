# ADR-308 — Projects Soft-Delete Trash (Κάδος Ανακύκλωσης)

**Status:** Implemented  
**Date:** 2026-04-14  
**Authors:** YorgosPag  
**Related:** ADR-281 (SSOT Soft-Delete System), ADR-308 pattern from ADR-191 (Files Trash), ADR-226 (Dependency Guard)

---

## 1. Context

Il pulsante "Διαγραφή" sui progetti eseguiva già un soft-delete internamente (il DELETE endpoint
chiama `softDelete()` di ADR-281). Tuttavia, l'UI non esponeva nessun modo per vedere o
recuperare i progetti cestinati.

Un progetto ha dipendenze downstream massicce (edifici, proprietà, contratti legali, presenze
cantiere, dipendenti, fatture, ecc.). Hard delete su questa entità è architetturalmente sbagliato
— Google non cancella mai permanentemente entità di questo peso senza un percorso esplicito di
recupero.

**Obiettivo:** Esporre la trash view completa — stile Google Drive — identica al pattern già
implementato per Properties e Contacts (ADR-281).

---

## 2. Decision

### SSOT Massimo — Riuso di infrastruttura esistente

| Componente | Riusato da |
|-----------|------------|
| `TrashActionsBar` (shared) | `src/components/shared/trash/TrashActionsBar.tsx` |
| `TrashService` | `src/services/trash.service.ts` |
| `trash.json` i18n | `src/i18n/locales/{el,en}/trash.json` |
| Generic restore endpoint | `src/app/api/trash/[entityType]/[entityId]/restore/route.ts` |
| Generic permanent-delete endpoint | `src/app/api/trash/[entityType]/[entityId]/permanent-delete/route.ts` |
| `SoftDeletableFields` mixin | `src/types/soft-deletable.ts` |
| Soft-delete engine 'project' config | `src/lib/firestore/soft-delete-config.ts` |

### Cosa è stato aggiunto

1. **`Project` interface** ora estende `SoftDeletableFields` (deletedAt, deletedBy, previousStatus, restoredAt, restoredBy)
2. **`API_ROUTES.PROJECTS.TRASH`** aggiunto a domain-constants
3. **`GET /api/projects/trash`** — lista progetti soft-deleted per il tenant
4. **`useProjectsTrashState`** — hook state management per trash view (pattern identico a `usePropertiesTrashState`)
5. **`ProjectsHeader`** — pulsante Κάδος (Trash2 icon) con `aria-pressed`
6. **`ProjectsTabContent`** — pulsante "Μεταφορά στον κάδο" (variant outline) invece di "Διαγραφή" (variant destructive)
7. **`ProjectsPageContent`** — integrazione completa trash view + permanent delete dialog

---

## 3. Implementation

### UX Flow

```
[Lista Progetti]
  Toolbar → "Μεταφορά στον κάδο" (outline button)
    ↓ useDeletionGuard (dependency check)
    → se bloccato: DeletionBlockedDialog
    → se permesso: DELETE /api/projects/{id} → softDelete()
      → progetto sparisce dalla lista attiva
      → toast confirm via DeleteConfirmDialog

[Header → icona Κάδος]
  Click → handleToggleTrash() → fetch GET /api/projects/trash
    → Lista progetti con status='deleted'
    → TrashActionsBar sopra lista:
        Restore: TrashService.bulkRestore('project', ids)
        Permanent Delete: confirm dialog → TrashService.bulkPermanentDelete('project', ids)
```

### File modificati

| File | Modifica |
|------|---------|
| `src/types/project.ts` | `Project extends SoftDeletableFields` |
| `src/config/domain-constants.ts` | `PROJECTS.TRASH` route added |
| `src/components/projects/ProjectsHeader.tsx` | Props `showTrash`, `onToggleTrash`, pulsante Κάδος |
| `src/components/projects/ProjectsTabContent.tsx` | Button rename + variant outline |
| `src/components/projects/projects-page-content.tsx` | Integrazione trash state + TrashActionsBar + dialog |

### File creati

| File | Ruolo |
|------|-------|
| `src/app/api/projects/trash/route.ts` | GET endpoint — lista progetti nel trash |
| `src/hooks/useProjectsTrashState.ts` | Hook state management trash view |

---

## 4. Notes

- **Permanent delete di progetti con dipendenze** è bloccato da `permanentDelete()` in ADR-281 (dependency check via ADR-226). Questo è il comportamento corretto: un progetto con edifici/contratti non può essere eliminato permanentemente.
- **30-day auto-purge** è in scope V2 (cron job). Per ora i progetti nel trash rimangono indefinitamente finché non si fa permanent delete manuale.
- **Trash view** è read-only: `onNewProject`, `onDeleteProject`, `startInEditMode`, `isCreateMode` vengono passati come `undefined` a `ProjectViewSwitch` quando `showTrash=true`.

---

## 5. Changelog

| Date | Change |
|------|--------|
| 2026-04-14 | Initial implementation — ADR-308 |
