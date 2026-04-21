# Pending Work: Notification SSoT — Boy Scout Migration

**STATUS: ACTIVE**
**Last updated:** 2026-04-22

## Cosa manca

~100 file usano ancora `useNotifications()` direttamente invece del domain hook.
Non sono violazioni (usano `t('key')` corretto), ma il sistema SSoT vuole
che ogni dominio esprima INTENT attraverso il proprio domain hook.

## Regola per ogni agente

Quando tocchi un file che importa `useNotifications` da `@/providers/NotificationProvider`:
→ **Menziona brevemente** che esiste lavoro pendente per migrare al domain hook.
→ **Non chiedere** a Giorgio — lui decide se farlo ora o dopo.
→ Se Giorgio dice "fallo" → segui il pattern sotto.

## Come migrare (pattern)

1. Grep file → vedi quali chiavi t() usa nelle notifiche
2. Le chiavi esistono già in `NOTIFICATION_KEYS`? → usa il domain hook esistente
3. Le chiavi NON esistono → aggiungile a `src/config/notification-keys.ts` + domain hook
4. Sostituisci `useNotifications()` con `useXxxNotifications()`
5. Aggiorna deps `useCallback`
6. Esegui: `npx jest "registry-exhaustiveness"` → 7/7 verdi
7. Commit: `refactor(notifications): migrate <file> to domain hook (Phase 3.N)`

## Domain hook esistenti (SSoT)

| Hook | File | Domini coperti |
|------|------|----------------|
| `useContactNotifications` | `src/hooks/notifications/useContactNotifications.ts` | contacts form, validation |
| `useProjectNotifications` | `src/hooks/notifications/useProjectNotifications.ts` | projects, locations/address |
| `useFilesNotifications` | `src/hooks/notifications/useFilesNotifications.ts` | upload, list, technical, trash, archived, batch |

## Prossimi domini da creare (in ordine)

1. **BUILDING-MANAGEMENT** (~5 file):
   - `src/components/building-management/tabs/useFloorsTabState.ts`
   - `src/components/building-management/tabs/usePropertyInlineEdit.ts`
   - `src/components/building-management/tabs/GeneralTabContent/building-addresses-card/useBuildingAddressesCardState.ts`
   - `src/components/building-management/dialogs/LinkBuildingToProjectDialog.tsx`

2. **CONTACTS rimanenti** (~5 file):
   - `src/components/contacts/dialogs/DeleteContactDialog.tsx`
   - `src/components/contacts/list/ContactsList.tsx`
   - `src/components/contacts/trash/TrashActionsBar.tsx`
   - `src/components/contacts/dynamic/ContactKadSection.tsx`
   - `src/components/contacts/tabs/ContactBankingTab.tsx`

3. **FILES — showArchiveResultFeedback** (Phase 3.6):
   - `src/components/file-manager/file-manager-handlers.ts`
   - Attualmente usa callbacks raw + t() — migrare al domain hook

## Architettura di riferimento

- **Registro chiavi**: `src/config/notification-keys.ts` (NOTIFICATION_KEYS)
- **Registry SSoT**: `.ssot-registry.json` → modulo `notification-keys`
- **Test exhaustiveness**: `src/hooks/notifications/__tests__/registry-exhaustiveness.test.ts` (7 test)
- **CHECK 3.20**: ratchet pre-commit sulle violazioni (0 violazioni attuali)
- **CHECK 3.21**: ogni foglia NOTIFICATION_KEYS deve esistere in el+en locale

## Changelog

| Data | Completato |
|------|-----------|
| 2026-04-21 | Phase 1+2: infrastruttura (notification-keys.ts + useContactNotifications + useProjectNotifications + SSoT registry) |
| 2026-04-21 | Phase 3.1: migrazione contactForm utils |
| 2026-04-21 | Phase 3.2-3.4: hardcoded strings dxf-viewer |
| 2026-04-22 | Phase 3.5: useFilesNotifications + 6 file migrati |
