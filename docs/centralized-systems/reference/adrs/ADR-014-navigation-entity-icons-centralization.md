# ADR-014: Navigation Entity Icons Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | UI Components |
| **Canonical Location** | `NAVIGATION_ENTITIES` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `NAVIGATION_ENTITIES` from `@/components/navigation/config`
- **Prohibition**: Hardcoded Lucide icons for entities

---

## Decision Log

### 2026-03-15: Enforcement Sweep — 14 violations fixed

**Context**: Full audit revealed 14 files using hardcoded entity icons/colors instead of `NAVIGATION_ENTITIES` SSoT.

**Files corrected**:

| File | Violation | Fix |
|------|-----------|-----|
| `CompanyFileTree.tsx` | Hardcoded `ENTITY_ICONS` map (5 wrong icons/colors) | Rewired to `NAVIGATION_ENTITIES` |
| `BasicProjectInfoTab.tsx` | `Briefcase` + `text-primary` | `NAVIGATION_ENTITIES.project.icon` + `.color` |
| `HeaderTitle.tsx` | `Briefcase` | `NAVIGATION_ENTITIES.project.icon` |
| `ProjectDetailsHeader.tsx` | `Briefcase` | `NAVIGATION_ENTITIES.project.icon` |
| `ProjectCard.tsx` | `Briefcase` | `NAVIGATION_ENTITIES.project.icon` |
| `project-details.tsx` | `Briefcase` | `NAVIGATION_ENTITIES.project.icon` |
| `projects-page-content.tsx` | `Briefcase` (3 usages) | `NAVIGATION_ENTITIES.project.icon` |
| `projects-list.tsx` | `Briefcase` | `NAVIGATION_ENTITIES.project.icon` |
| `ProjectListItem_old.tsx` | `Briefcase` | `NAVIGATION_ENTITIES.project.icon` |
| `available-storage/page.tsx` | `Warehouse` (3 usages) | `NAVIGATION_ENTITIES.storage.icon` |
| `StorageGeneralTab.tsx` | `Warehouse` + `text-blue-500` | `NAVIGATION_ENTITIES.storage.icon` + `.color` |
| `RelationshipsSummary.tsx` | `Building2` + `text-blue-600` | `NAVIGATION_ENTITIES.building.icon` + `.color` |
| `units/page.tsx` | `Building2` (2 usages) | `NAVIGATION_ENTITIES.unit.icon` |
| `contacts.ts` | `Building2` for company contact | `Factory` (= `NAVIGATION_ENTITIES.contactCompany.icon`) |

**Exceptions (NOT violations)**:
- `IBANInput.tsx` — `Building2` = bank icon, not entity
- `ContactBankingTab.tsx` — `Building2` = bank icon
- `WorkerCard.tsx` — `Briefcase` = job/specialty icon, not project entity
- `Legend.tsx` — Connection visualization colors, not entity colors

**Rule reinforcement**: ALL entity icons/colors MUST come from `NAVIGATION_ENTITIES`. Zero hardcoded exceptions.
