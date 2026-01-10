# Real Estate Hierarchy — Implementation & Decisions Report (Handoff)

**Date:** 2026-01-10  
**Purpose:** This document is a single, repository-ready handoff report that captures what has been specified, approved, and produced across the referenced work artifacts, so that a developer can understand the design and current state as if they implemented it.

## Source artifacts (inputs)
- `REAL_ESTATE_HIERARCHY_DOCUMENTATION.md`
- `Summary.txt`

> Note: The SQL schemas shown in the hierarchy documentation are treated as **conceptual / reference schemas** unless your runtime persistence layer is explicitly SQL. The onboarding summary indicates a Firebase (Firestore + Auth) implementation snapshot.

---

## Table of contents
1. [What is approved and “locked”](#1-what-is-approved-and-locked)
2. [Core domain model: Physical Spaces vs Sellable Assets](#2-core-domain-model-physical-spaces-vs-sellable-assets)
3. [Hierarchy and navigation rules](#3-hierarchy-and-navigation-rules)
4. [Sidebar structure (final)](#4-sidebar-structure-final)
5. [User flows (end-to-end)](#5-user-flows-end-to-end)
6. [Data model reference](#6-data-model-reference)
7. [Invariants and validation rules](#7-invariants-and-validation-rules)
8. [Migration strategy (phased)](#8-migration-strategy-phased)
9. [Architecture audit mapping to current codebase](#9-architecture-audit-mapping-to-current-codebase)
10. [Refactor plan: Phase 1 type architecture redesign](#10-refactor-plan-phase-1-type-architecture-redesign)
11. [SOS safety checkpoint (implemented)](#11-sos-safety-checkpoint-implemented)
12. [Developer onboarding deliverable (implemented)](#12-developer-onboarding-deliverable-implemented)
13. [Security and production blockers (documented)](#13-security-and-production-blockers-documented)
14. [Immediate next steps (from the artifacts)](#14-immediate-next-steps-from-the-artifacts)
15. [Developer quick checklist](#15-developer-quick-checklist)
16. [Appendix: Verification principles used in the docs](#16-appendix-verification-principles-used-in-the-docs)

---

## 1) What is approved and “locked”
The Real Estate hierarchy document is presented as the **official architecture** for the Real Estate Management System, with an explicit approval status (**APPROVED**) and “next steps” indicating implementation.

This means the following are **non-negotiable architectural constraints** unless a new design/approval explicitly supersedes them:

- The domain split **Physical Spaces ≠ Sellable Assets**.
- The breadcrumb hierarchy **stops at Building**.
- There is **no 4th navigation column** for units/spaces.
- The final sidebar includes separate top-level entries for **Spaces** and **Sales**.
- Linking between apartment/storage/parking happens in **relationship views and sales bundling**, not via navigation hierarchy.

---

## 2) Core domain model: Physical Spaces vs Sellable Assets

### 2.1 Physical Spaces (what exists physically)
**Physical Spaces** represent real, physical elements of a building/site:
- Apartments, storages, parking spots, common spaces, maisonettes.
- They carry **physical attributes**: level/floor, square meters, location, building association, descriptions.
- They **do not** carry pricing, buyers, contract state, or sales lifecycle fields.

### 2.2 Sellable Assets (what is sold)
**Sellable Assets** represent the commercial “sellable” layer:
- They have a sales lifecycle and commercial data:
  - price, availability/reservation/sold status,
  - buyer link,
  - contract documents,
  - sale dates,
  - media/assets for listing.
- They reference a Physical Space (e.g., `physical_space_id`) so that the physical reality and the sellable item remain linked but separate.

### 2.3 Relationship rules (linking)
- A Sellable Asset references **one** Physical Space.
- A Physical Space may exist with **no** Sellable Asset (e.g., common spaces, non-sellable rooms).
- Parking/storages can be sold **independently** (e.g., to a neighbor), which is a key reason why these are not children of apartments in navigation.

---

## 3) Hierarchy and navigation rules

### 3.1 Structural hierarchy (data/structure)
The conceptual building structure is:

- Company
  - Project
    - Building
      - Levels (floors) *(structural grouping)*
        - Physical Spaces (apartment/storage/parking/common…)

**Important:** Floors/Levels are a **structural grouping** layer. They are not intended as a top-level navigation node for sales or breadcrumb expansion.

### 3.2 Breadcrumb / multi-column navigation (locked behavior)
The hierarchical navigation (breadcrumb columns) is locked as:

**Companies → Projects → Buildings**

Constraints:
- **Building is the last hierarchical node.**
- There is **no “Units” 4th column**.
- Units/parking/storage/common spaces are accessed through **tabs/sections** within the Building detail view.

---

## 4) Sidebar structure (final)
The final sidebar is:

- Dashboard  
- Contacts  
- Projects  
- Buildings  
- **Spaces** *(Physical layer)*  
- **Sales** *(Sellable layer)*  

Interpretation:
- “Spaces” is the entry point for managing physical inventory.
- “Sales” is the entry point for managing commercial inventory, availability, reservation, sold state, and contracts.

---

## 5) User flows (end-to-end)

### 5.1 Create building structure (Spaces)
1. Create or select a Project.
2. Create or select a Building.
3. Define Levels (floors) and register Physical Spaces per level:
   - Apartments, storages, parking spots, and common spaces.
4. Ensure physical attributes are complete (sqm, type, description, etc.).

### 5.2 Activate a space for sale (Spaces → Sales)
1. From **Spaces**, select a Physical Space.
2. Click **Activate Sale** (or equivalent action).
3. Provide sellable attributes:
   - price, listing media, description,
   - initial status = AVAILABLE.
4. The system creates a Sellable Asset linked to the Physical Space.
5. The asset becomes visible under **Sales**.

### 5.3 Sell to a buyer (Sales + Contacts)
1. In **Sales**, select an AVAILABLE asset.
2. Choose an existing buyer from **Contacts** or create a new Contact.
3. Create/attach contract record and documents.
4. Update status to SOLD and set sale metadata.
5. Buyer-to-asset relationship is established.

### 5.4 Independent sale (Parking to third party)
1. In **Sales**, filter by Parking.
2. Select a parking asset.
3. Choose/create buyer contact (can be external).
4. Execute contract and mark SOLD.

---

## 6) Data model reference
This section captures the **reference schema** presented in the hierarchy documentation.

### 6.1 Physical structure (reference tables)
- **Projects**
  - id, name, address, contractor_id (→ Contacts), plot_info, created_at
- **Buildings**
  - id, project_id (→ Projects), name, building_type [VERTICAL, OUTDOOR_AREA], created_at
- **Levels**
  - id, building_id (→ Buildings), name, order_index, created_at
- **Physical_Spaces**
  - id, level_id (→ Levels), name, space_type [APARTMENT, STORAGE, PARKING, COMMON, MAISONETTE],
  - square_meters, description, created_at

### 6.2 Sales layer (reference tables)
- **Sellable_Assets**
  - id, physical_space_id (→ Physical_Spaces), price,
  - status [AVAILABLE, RESERVED, SOLD],
  - buyer_id (→ Contacts, nullable), sale_date (nullable), created_at
- **Asset_Media**
  - id, sellable_asset_id (→ Sellable_Assets),
  - file_type [PHOTO, VIDEO, DXF, PDF], file_path, description, created_at
- **Contracts**
  - id, sellable_asset_id (→ Sellable_Assets),
  - buyer_id (→ Contacts),
  - contract_date, final_price, terms, document_path, created_at

### 6.3 Contacts (reference table)
- **Contacts**
  - id,
  - contact_type [INDIVIDUAL, COMPANY, PUBLIC_SERVICE],
  - name, email/phone/address/tax_number (nullable), created_at

---

## 7) Invariants and validation rules

### 7.1 Never rules (hard prohibitions)
- Physical Spaces must not contain sales fields (price/buyer/contract/status).
- Sellable Assets must not be the place where physical truth lives (sqm, location belongs to Physical Space).
- Do not delete a Physical Space if a linked Sellable Asset exists.
  - Required order: remove/void sale records first, then delete the physical record.

### 7.2 Always rules (required invariants)
- Every Sellable Asset must reference a Physical Space.
- A Physical Space may exist without a Sellable Asset.
- Structural order is enforced: Project → Building → Level → Space.

### 7.3 Example business validations (as documented)
- Parking sqm ≤ 50
- Apartment sqm ≥ 20
- Sellable price > 0

---

## 8) Migration strategy (phased)
The hierarchy document prescribes a 3-phase migration:

### Phase 1 — Database setup
- Introduce Physical_Spaces and Sellable_Assets structures.
- Build migration scripts.
- Support a period of dual operation (legacy + new).

### Phase 2 — UI transition
- Add new sidebar entries: Spaces and Sales.
- Introduce new forms and user training / transition support.
- Gradually move workflows from legacy screens to new separation model.

### Phase 3 — Full cutover
- Disable legacy paths.
- Perform cleanup (types, code paths, collections/tables).
- Operate fully on the new model.

---

## 9) Architecture audit mapping to current codebase
The hierarchy document includes an explicit instruction to run a full architecture audit and record mappings of the real-estate entities in the current codebase.

It also records a discovered mapping snapshot (paths/types) such as:
- Project: `src/types/project.ts`
- Building / Floor: `src/types/building/contracts.ts`
- Unit: `src/types/unit.ts`
- Storage: `src/types/storage/contracts.ts`
- Parking: `src/types/parking.ts`
- “Sellable” representations: `src/types/property.ts`, StorageUnitStub, and parking with sales attributes

**Primary problem highlighted:** legacy “physical” entities appear to carry “sales” attributes. The approved model requires these concerns to be separated into Physical vs Sellable.

---

## 10) Refactor plan: Phase 1 type architecture redesign
The hierarchy document proposes implementing the new model first as **parallel v2 types** to avoid breaking changes.

### 10.1 Proposed v2 type structure
- `src/types/real-estate-v2/physical-spaces/`
  - PhysicalSpace
  - UnitSpace
  - StorageSpace
  - ParkingSpace
- `src/types/real-estate-v2/sellable-assets/`
  - SellableAsset
  - UnitAsset
  - StorageAsset
  - ParkingAsset

### 10.2 Goals
- Clean, enforced separation of concerns.
- Type-safe references between Sellable and Physical (by IDs).
- Zero breaking changes initially (additive introduction).

---

## 11) SOS safety checkpoint (implemented)
Before commencing the real-estate refactor, an operational safety checkpoint was completed.

### 11.1 Git checkpoint
- A “last stable point” commit was created: **`7b826ba`**
- Rollback command:
  - `git revert 7b826ba`

### 11.2 Production deploy checkpoint
- A production deployment checkpoint exists at:
  - `https://nestor-app.vercel.app`

### 11.3 Backup artifact
- A zip backup was created (without node_modules), including CHANGELOG:
  - `20251221_2123 - [SOS_CRITICAL_CHECKPOINT] - Obligations Structure Editor Fix.zip`
- Location:
  - `C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2`

### 11.4 Rollback methods (3 levels)
1) Git revert to checkpoint commit  
2) Restore from backup zip  
3) Vercel rollback via dashboard  

---

## 12) Developer onboarding deliverable (implemented)
The onboarding work described in `Summary.txt` produced a developer handoff guide:

- File created: `src/docs/DEVELOPER_ONBOARDING.md`
- Positioned as an enterprise-grade onboarding guide for external developers/agents.

### 12.1 Content areas covered (as described)
- Architecture overview + diagram
- Routing & rendering model
- Firestore data model + security boundaries
- Auth & authorization enforcement (Expected vs Current)
- API inventory and contracts
- Verification appendix with reproducible commands
- CI/CD notes / evidence
- Known issues / tech debt / roadmap
- Operational security checklist
- Owner & contacts / triage
- Glossary

### 12.2 “Agent-proof” verification approach
The onboarding documentation was adjusted to avoid unverifiable absolute claims and instead:
- Provides commands and evidence outputs.
- Uses “strong indication” wording where only pattern-based checks exist.
- Expands the search patterns used for auth detection.
- Separates policy intent vs current implementation.

---

## 13) Security and production blockers (documented)
The onboarding summary explicitly flags critical security issues (P0/Critical), especially because Firestore rules are the effective security boundary when using client SDK access.

Examples documented:
- `isDevMode()` effectively always true in rules (dev mode enabled).
- Public read allowed for notifications.
- Hardcoded admin emails.
- Email verification not enforced.

These are treated as production blockers that must be addressed before widening exposure.

---

## 14) Immediate next steps (from the artifacts)
The artifacts indicate the immediate implementation direction as:

1) Proceed with **Phase 1** of the refactor:
   - Introduce v2 types (parallel to legacy).
2) Introduce/ensure UI entry points align with the approved sidebar:
   - Spaces + Sales (top-level).
3) Maintain the locked navigation model:
   - Breadcrumb stops at Building; use internal tabs for units/spaces.

Security blockers identified in onboarding should be scheduled as a high priority workstream when applicable.

---

## 15) Developer quick checklist
Use this as the “do not violate” checklist during implementation:

- Do not implement unit-centric navigation where parking/storage are nested under units.
- Breadcrumb hierarchy ends at Building.
- Sales fields belong only to Sellable Assets; physical fields belong only to Physical Spaces.
- Linking/bundling happens in relationship views, not in the sidebar hierarchy.
- Respect the SOS checkpoint: maintain rollback readiness while refactoring.
- Treat documented Firestore rules issues as security boundaries and production blockers.

---

## 16) Appendix: Verification principles used in the docs
The onboarding summary emphasizes a documentation standard:
- Prefer reproducible commands (e.g., `find`, `grep`) and record outputs.
- Avoid “ALL/ALWAYS” assertions unless proven by exhaustive analysis.
- When using pattern-based searches, label conclusions as indicators and document search patterns used and not used.
