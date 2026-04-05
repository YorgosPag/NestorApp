---
name: ADR-233 Building Code — 3 Pending Items (2026-04-05)
description: Pending items from Building code split implementation — uniqueness validation, BuildingsList UI, unit tests. For next session.
type: project
---

## Context
Σε συνεδρία 2026-04-05 υλοποιήθηκε το **"Locked building `code` field"** (ADR-233 §3.4 Changelog 2026-04-05). Ο χρήστης βλέπει πλέον auto-suggested "Κτήριο Α", "Κτήριο Β"... στο AddBuildingDialog και τα unit codes (A-DI-1.01) παράγονται deterministic από το locked `code` πεδίο αντί regex στο free-text `name`.

**Why:** Ο Γιώργος εντόπισε ότι η `extractBuildingLetter()` αποτύγχανε όταν το `Building.name` ήταν αυθαίρετο (π.χ. "TestBuildingOK" → fallback σε "T"). Splits σε `code` (locked) + `name` (label) = ISO 19650 / BIM pattern.

## 3 Pending Items (για νέα συνεδρία — /clear first)

### 1. [HIGH] Server-side uniqueness validation
- **Αρχείο:** `src/app/api/buildings/route.ts` POST handler (πριν `createEntity()`)
- **Τι:** query `buildings.where(projectId==X).where(code==body.code)` → αν match, `throw ApiError(409, ...)`
- **Επίσης:** `building-update.handler.ts` PATCH όταν αλλάζει `code`
- **Γιατί:** race condition protection (2 users → same auto-suggested code)

### 2. [MEDIUM] BuildingsList.tsx UI display
- **Αρχείο:** `src/components/building-management/BuildingsList.tsx:66`
- **Από:** `building.name`
- **Σε:** pattern `"${code} — ${name}"` (ίδιο με BuildingCardTitle/BuildingListCard/BuildingGridCard)

### 3. [LOW] Unit tests
- **Νέο αρχείο:** `src/config/__tests__/entity-code-config.test.ts`
- **Tests:** `suggestNextBuildingCode()` (empty, sequential, gap-filling, beyond Ω), `extractBuildingLetter()` object+string signatures

## How to apply
Στη νέα συνεδρία:
1. Διάβασε αυτό το memory + ADR-233 §Changelog 2026-04-05 (περιέχει πλήρη spec).
2. Υλοποίησε με σειρά: #1 (HIGH) → #2 (MEDIUM) → #3 (LOW).
3. Migration endpoint `POST /api/admin/backfill-building-code` είναι ΕΤΟΙΜΟ — ο Γιώργος θα τρέξει όποτε θέλει (dry-run: GET, execute: POST).
