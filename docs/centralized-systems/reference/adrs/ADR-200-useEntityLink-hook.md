# ADR-200: useEntityLink Hook — Centralized Entity Linking

| Field | Value |
|-------|-------|
| **ID** | ADR-200 |
| **Status** | Accepted |
| **Date** | 2026-03-12 |
| **Author** | Claude (AI) + Γιώργος Παγώνης |
| **Relates to** | EntityLinkCard, ADR-001 (Radix Select), ADR-199 (Unit hierarchy) |

## Context

5 GeneralTab components (Storage, Parking, Building, Project, Unit) copy-pasted identical entity linking logic: state management, entity-switch reset, cascading floor reset, save payload assembly, and key isolation. This caused 4 bugs in a single session because each fix required changes in N files instead of 1.

## Decision

Extract a **single `useEntityLink` hook** (`src/hooks/useEntityLink.ts`) that encapsulates all entity linking state and behavior. Each consumer calls the hook and spreads its `linkCardProps` on `<EntityLinkCard>`.

## API

```typescript
const link = useEntityLink(config: UseEntityLinkConfig, isEditing: boolean): UseEntityLinkReturn;
```

### Config

| Prop | Type | Description |
|------|------|-------------|
| `relation` | `EntityLinkRelation` | Determines foreign key name |
| `entityId` | `string` | Used for reset detection + key generation |
| `initialParentId` | `string \| null` | Current linked parent ID |
| `loadOptions` | `() => Promise<EntityLinkOption[]>` | Async option loader |
| `saveMode` | `'immediate' \| 'form' \| 'local'` | How save is handled |
| `onSave?` | `(id, name) => Promise<{success, error?}>` | For immediate mode |
| `cascadingResets?` | `CascadingResetDef[]` | Fields to reset on parent change |
| `onCascadingReset?` | `(resets) => void` | Callback for cascading resets |
| `labels` | `EntityLinkLabels` | UI labels |
| `icon` | `LucideIcon` | Card header icon |
| `cardId` | `string` | Accessibility ID |

### Return

| Prop | Type | Description |
|------|------|-------------|
| `linkedId` | `string \| null` | Current linked ID |
| `linkCardProps` | `EntityLinkCardProps & { key }` | Spread on EntityLinkCard |
| `getPayload()` | `Record<string, string \| null>` | For form/local save merge |
| `isDirty` | `boolean` | Changed from initial? |
| `reset()` | `void` | Reset to initial |

## 3 Save Modes

| Mode | Used by | Behavior |
|------|---------|----------|
| `'form'` | Storage, Parking | Changes local → merged into PATCH payload via `getPayload()` |
| `'immediate'` | Unit, Building (edit), Project (edit) | Auto-saves on selection via `onSave` |
| `'local'` | Building (create), Project (create) | Holds locally → merged into creation payload |

## Foreign Key Map

```typescript
{
  'storage-building': 'buildingId',
  'parking-building': 'buildingId',
  'unit-building': 'buildingId',
  'building-project': 'projectId',
  'project-company': 'companyId',
}
```

## Files Affected

| File | Change |
|------|--------|
| `src/hooks/useEntityLink.ts` | **NEW** — hook implementation |
| `StorageGeneralTab.tsx` | Migrated to useEntityLink |
| `ParkingGeneralTab.tsx` | Migrated to useEntityLink |
| `UnitEntityLinks.tsx` | Migrated to useEntityLink |
| `GeneralTabContent.tsx` (Building) | Migrated to useEntityLink |
| `GeneralProjectTab.tsx` (Project) | Migrated to useEntityLink |

## Key Behaviors

1. **Cross-entity isolation**: Key = `${relation}-${entityId}` prevents state leaking between entities
2. **Entity switch reset**: `useEffect([entityId])` resets `linkedId` when user navigates to different entity
3. **Cascading resets**: Building change → floor field reset (Storage, Parking)
4. **Dirty tracking**: `isDirty = linkedId !== initialParentId`

## Changelog

| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — hook + 5 component migrations |
