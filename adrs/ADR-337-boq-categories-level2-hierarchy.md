# ADR-337 — BOQ Categories Level 2 Hierarchy (Curated Sub-Categories)

**Status:** ACCEPTED
**Date:** 2026-05-01
**Author:** Giorgio Pagonis
**Related:** ADR-175 (Quantity Surveying / BOQ), ADR-329 (Scope Granularity), `src/config/boq-categories.ts`, `src/types/boq/units.ts`

---

## 1. Context

The BOQ drawer (`BOQItemEditor`) currently asks the user to:

1. Pick a Level-1 category from 12 master groups (OIK-1 … OIK-12).
2. Type a **free-text** title (e.g. "Οπλισμένο σκυρόδεμα C20/25 για θεμέλια").

This is flexible but offers **no contextual narrowing** after step 1. The user has to remember canonical Greek terminology and re-type it for every BOQ item. Two builders working on the same project will produce inconsistent titles ("Πλάκα οροφής C25" vs "Σκυρόδεμα πλάκας C25/30") that are hard to roll up across buildings or compare across vendors.

The official ΑΤΟΕ (Αναλυτικό Τιμολόγιο Οικοδομικών Εργασιών) catalog has hundreds of articles per chapter and is designed for **public-procurement** projects, not private construction management. Replicating it (~600+ articles) is overkill for Nestor's scope.

This ADR proposes a **curated Level-2 hierarchy** — 5–7 sub-categories per master group, ~78 entries total — that captures the most-used sub-divisions of Greek construction work.

## 2. What already exists (reuse — do not duplicate)

| Building block | File / Module |
|---|---|
| 12 master categories (OIK-1 … OIK-12) | `src/config/boq-categories.ts` (`MASTER_BOQ_CATEGORIES`) |
| `MasterBOQCategory` interface (code/nameEL/nameEN/level/sortOrder/defaultWasteFactor/allowedUnits) | same file |
| `CategoryLevel = 'group' | 'subgroup' | 'item'` already typed | `src/types/boq/units.ts` |
| Firestore collection `boq_categories` with `parentId` field for hierarchy | `src/types/boq/boq.ts` (`BOQCategory` interface) |
| Single-dropdown picker | `BOQItemEditor.tsx` → `BasicInfoFieldset` |

The architecture **already supports 3 levels** (group → subgroup → item). Only the Level-2 data and the cascading UI are missing.

## 3. Gap

| Item | State |
|---|---|
| Level-2 sub-category data (canonical Greek terminology) | ❌ no seed |
| Cascading dropdown in `BOQItemEditor` (sub-category appears after category) | ❌ absent |
| i18n keys for sub-category names (el + en) | ❌ absent |
| Firestore seed script for sub-categories | ❌ absent |
| Backward compatibility for existing BOQ items (no `subCategoryCode`) | ❌ undefined |

## 4. Decision

Introduce a **curated Level-2** for all 12 master categories. Sub-categories are **optional** (BOQ items can still be created with only Level-1 + free-text title), but when chosen they enforce a canonical Greek term and enable rollup analytics.

### 4.1 Schema change

**No type changes** — reuse the existing `BOQCategory` interface and Firestore collection. New documents are written with:

```typescript
{
  id: 'boq-cat-OIK-1.1',
  code: 'OIK-1.1',
  level: 'subgroup',
  parentId: 'boq-cat-OIK-1',
  nameEL: 'Εκσκαφές θεμελίων',
  nameEN: 'Foundation excavations',
  sortOrder: 1,
  defaultWasteFactor: <inherits from parent>,
  allowedUnits: <inherits from parent unless overridden>,
}
```

`BOQItem` schema gains **one optional field**:

```typescript
interface BOQItem {
  // ... existing fields
  subCategoryCode?: string;  // e.g. 'OIK-1.1'  (nullable for backward compat)
}
```

### 4.2 Full Level-2 specification (12 × 5–7 = ~78 entries)

#### OIK-1 — Χωματουργικά / Earthworks

| Code | nameEL | nameEN |
|---|---|---|
| OIK-1.1 | Εκσκαφές θεμελίων | Foundation excavations |
| OIK-1.2 | Εκσκαφές γενικές | General excavations |
| OIK-1.3 | Εκβραχισμοί | Rock excavation |
| OIK-1.4 | Επιχώσεις - Συμπυκνώσεις | Backfills & compaction |
| OIK-1.5 | Κατεδαφίσεις | Demolitions |
| OIK-1.6 | Καθαιρέσεις - Αποξηλώσεις | Removals & dismantling |
| OIK-1.7 | Μεταφορές γαιών | Soil transport |

#### OIK-2 — Σκυροδέματα / Concrete works

| Code | nameEL | nameEN |
|---|---|---|
| OIK-2.1 | Θεμελιώσεις | Foundations |
| OIK-2.2 | Πλάκες δαπέδου | Floor slabs |
| OIK-2.3 | Δοκοί | Beams |
| OIK-2.4 | Υποστυλώματα | Columns |
| OIK-2.5 | Τοιχώματα | Concrete walls (shear walls) |
| OIK-2.6 | Σκάλες σκυροδέματος | Concrete stairs |
| OIK-2.7 | Σιδηρός οπλισμός | Reinforcement steel |

#### OIK-3 — Τοιχοποιίες / Masonry

| Code | nameEL | nameEN |
|---|---|---|
| OIK-3.1 | Οπτοπλινθοδομές μπατικές | Brick masonry (full thickness) |
| OIK-3.2 | Οπτοπλινθοδομές δρομικές | Brick masonry (half thickness) |
| OIK-3.3 | Λιθοδομές | Stone masonry |
| OIK-3.4 | Τοιχοποιίες γυψοσανίδας | Drywall partitions |
| OIK-3.5 | Τσιμεντόλιθοι | Cement-block masonry |
| OIK-3.6 | Πορομπετόν / Ytong | Aerated concrete blocks |

#### OIK-4 — Επιχρίσματα / Plastering

| Code | nameEL | nameEN |
|---|---|---|
| OIK-4.1 | Ασβεστοκονίαμα | Lime plaster |
| OIK-4.2 | Τσιμεντοκονίαμα | Cement plaster |
| OIK-4.3 | Ασβεστοτσιμεντοκονίαμα | Lime-cement plaster |
| OIK-4.4 | Γυψοκονίαμα | Gypsum plaster |
| OIK-4.5 | Μαρμαροκονίαμα | Marble dust finish |
| OIK-4.6 | Έτοιμα επιχρίσματα | Ready-mix plasters |

#### OIK-5 — Πατώματα / Δάπεδα / Flooring

| Code | nameEL | nameEN |
|---|---|---|
| OIK-5.1 | Μάρμαρα | Marble |
| OIK-5.2 | Γρανίτες | Granite |
| OIK-5.3 | Κεραμικά πλακάκια | Ceramic tiles |
| OIK-5.4 | Πορσελανάτα (Gres) | Porcelain stoneware |
| OIK-5.5 | Ξύλινα δάπεδα (παρκέ) | Wooden parquet |
| OIK-5.6 | Laminate / Πολυστρωματικά | Laminate flooring |
| OIK-5.7 | Βιομηχανικά δάπεδα | Industrial floors (epoxy/concrete) |

#### OIK-6 — Κουφώματα / Doors & Windows

| Code | nameEL | nameEN |
|---|---|---|
| OIK-6.1 | Αλουμινίου | Aluminum frames |
| OIK-6.2 | Συνθετικά (PVC) | PVC synthetic frames |
| OIK-6.3 | Ξύλινα | Wooden frames |
| OIK-6.4 | Μεταλλικά / Πυρασφαλείας | Metal / fire-rated |
| OIK-6.5 | Υαλοπίνακες ενεργειακοί | Thermal glazing |
| OIK-6.6 | Ρολά / Παντζούρια | Roller shutters / shutters |

#### OIK-7 — Χρωματισμοί / Painting

| Code | nameEL | nameEN |
|---|---|---|
| OIK-7.1 | Σπατουλαρίσματα / Στοκαρίσματα | Spackling / surface prep |
| OIK-7.2 | Αστάρια | Primers |
| OIK-7.3 | Πλαστικά χρώματα (εσωτερικά) | Plastic paints (interior) |
| OIK-7.4 | Ακρυλικά χρώματα (εξωτερικά) | Acrylic paints (exterior) |
| OIK-7.5 | Ριπολίνες / Ντουκοχρώματα | Enamel / lacquer |
| OIK-7.6 | Βερνίκια | Varnishes |

#### OIK-8 — Υδραυλικά / Plumbing & HVAC

| Code | nameEL | nameEN |
|---|---|---|
| OIK-8.1 | Ύδρευση | Water supply |
| OIK-8.2 | Αποχέτευση | Drainage / sewerage |
| OIK-8.3 | Είδη υγιεινής | Sanitary fixtures |
| OIK-8.4 | Θέρμανση | Heating (radiators / underfloor) |
| OIK-8.5 | Κλιματισμός | Air conditioning |
| OIK-8.6 | Πυρόσβεση | Fire suppression |

#### OIK-9 — Ηλεκτρολογικά / Electrical

| Code | nameEL | nameEN |
|---|---|---|
| OIK-9.1 | Ισχυρά ρεύματα | Power circuits (outlets / switches) |
| OIK-9.2 | Φωτισμός | Lighting |
| OIK-9.3 | Πίνακες διανομής | Distribution panels |
| OIK-9.4 | Ασθενή ρεύματα | Low-voltage (data / telecom / TV) |
| OIK-9.5 | Γείωση & αντικεραυνική προστασία | Grounding & lightning protection |
| OIK-9.6 | Συστήματα ασφαλείας / πυρανίχνευσης | Security / fire-detection systems |

#### OIK-10 — Μονώσεις / Insulation

| Code | nameEL | nameEN |
|---|---|---|
| OIK-10.1 | Θερμομόνωση τοίχων | Wall thermal insulation |
| OIK-10.2 | Θερμομόνωση οροφής | Roof thermal insulation |
| OIK-10.3 | Στεγανοποίηση δωμάτων | Roof waterproofing |
| OIK-10.4 | Στεγανοποίηση υπογείων | Basement waterproofing |
| OIK-10.5 | Ηχομόνωση | Acoustic insulation |
| OIK-10.6 | Πυροπροστασία | Fire protection |

#### OIK-11 — Σοβατεπί / Ποδιές / Baseboards & Sills

| Code | nameEL | nameEN |
|---|---|---|
| OIK-11.1 | Μαρμάρινες ποδιές | Marble window sills |
| OIK-11.2 | Μαρμάρινα σοβατεπί | Marble baseboards |
| OIK-11.3 | Ξύλινα σοβατεπί | Wooden baseboards |
| OIK-11.4 | PVC / Συνθετικά σοβατεπί | PVC baseboards |
| OIK-11.5 | Πατήματα σκάλας | Stair treads |
| OIK-11.6 | Κορνίζες | Cornices |

#### OIK-12 — Μεταλλικά / Metalwork

| Code | nameEL | nameEN |
|---|---|---|
| OIK-12.1 | Κάγκελα μπαλκονιού | Balcony railings |
| OIK-12.2 | Κάγκελα σκάλας | Stair railings |
| OIK-12.3 | Σιδερένιες κατασκευές | Iron structures |
| OIK-12.4 | Μεταλλικές σκάλες | Metal staircases |
| OIK-12.5 | Πέργκολες & στέγαστρα | Pergolas & canopies |
| OIK-12.6 | Γκαραζόπορτες & ρολά | Garage doors & shutters |
| OIK-12.7 | Εξώπορτες ασφαλείας | Security doors |

#### OIK-13 — Ανελκυστήρες / Elevators & Lifts

| Code | nameEL | nameEN |
|---|---|---|
| OIK-13.1 | Υδραυλικοί ανελκυστήρες | Hydraulic elevators |
| OIK-13.2 | Ηλεκτροκίνητοι ανελκυστήρες (με μηχανοστάσιο) | Electric traction elevators (with machine room) |
| OIK-13.3 | Ανελκυστήρες χωρίς μηχανοστάσιο (MRL) | Machine-room-less (MRL) elevators |
| OIK-13.4 | Ανυψωτικές πλατφόρμες ΑΜΕΑ | Accessibility platform lifts |
| OIK-13.5 | Συντήρηση & πιστοποίηση | Maintenance & certification |

#### OIK-14 — Πισίνες / Swimming Pools

| Code | nameEL | nameEN |
|---|---|---|
| OIK-14.1 | Κατασκευή λεκάνης | Pool basin construction |
| OIK-14.2 | Επένδυση & αδιαβροχοποίηση | Lining & waterproofing |
| OIK-14.3 | Υδραυλικές εγκαταστάσεις | Pool plumbing & filtration |
| OIK-14.4 | Φωτισμός πισίνας | Pool lighting |
| OIK-14.5 | Εξοπλισμός (αντλίες, φίλτρα) | Equipment (pumps, filters) |
| OIK-14.6 | Περίφραξη & κάλυμμα | Fencing & cover |

#### OIK-15 — Φωτοβολταϊκά / Photovoltaics

| Code | nameEL | nameEN |
|---|---|---|
| OIK-15.1 | Φωτοβολταϊκά πάνελ | PV panels |
| OIK-15.2 | Inverter & ηλεκτρολογικά | Inverter & electrical |
| OIK-15.3 | Σύστημα στήριξης | Mounting structure |
| OIK-15.4 | Αποθήκευση ενέργειας (μπαταρίες) | Battery storage |
| OIK-15.5 | Σύνδεση δικτύου & net metering | Grid connection & net metering |

**Total: 94 sub-categories (15 groups).**

### 4.3 i18n keys

New nested key set under each existing namespace:

```jsonc
// src/i18n/locales/{el,en}/building-tabs.json
{
  "tabs": {
    "measurements": {
      "editor": {
        "fields": {
          "subCategory": "..."  // "Υποκατηγορία" / "Sub-category"
        },
        "tooltips": {
          "subCategory": "..."  // "Specify the type of work within the chosen category."
        }
      },
      "subCategories": {
        "OIK-1.1": "Εκσκαφές θεμελίων",
        "OIK-1.2": "Εκσκαφές γενικές",
        // ... all 78 entries (el)
      }
    }
  }
}
```

### 4.4 UI changes (BOQItemEditor.tsx)

In `BasicInfoFieldset`, after the existing category `<Select>`:

```tsx
{form.categoryCode && subCategoriesFor(form.categoryCode).length > 0 && (
  <section className="space-y-1.5">
    <div className="flex items-center gap-1">
      <Label>{t('tabs.measurements.editor.fields.subCategory')}</Label>
      <InfoTooltip content={t('tabs.measurements.editor.tooltips.subCategory')} />
    </div>
    <Select value={form.subCategoryCode ?? ''} onValueChange={(v) => onUpdateField('subCategoryCode', v)}>
      <SelectTrigger><SelectValue placeholder={t('tabs.measurements.editor.fields.subCategoryPlaceholder')} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="">— {t('tabs.measurements.editor.fields.subCategoryNone')} —</SelectItem>
        {subCategoriesFor(form.categoryCode).map((sc) => (
          <SelectItem key={sc.code} value={sc.code}>{sc.nameEL}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </section>
)}
```

Sub-category dropdown:
- **Conditionally rendered** only after Level-1 is chosen.
- **Optional** (a "— Καμία —" / "— None —" entry is always available).
- **Always editable** — even in edit mode. Sub-category is enrichment metadata; blocking it would punish users who created items without one (Progressive Detail pattern — Procore/Primavera/SAP standard).
- Only `categoryCode` (Level-1) is locked in edit mode, because changing it would invalidate cost rollups and vendor quote comparisons.

### 4.5 Firestore seed

Sub-categories are a **global master catalog** — shared across all companies, seeded once per environment. New companies get them automatically with no extra step.

New script `scripts/seed-boq-subcategories.ts`:
- Reads the static array (companion file `src/config/boq-subcategories.ts`).
- Writes to a **system-level path** (no `companyId`) — e.g. `system/boq_subcategories/{code}`.
- Uses `setDoc()` + enterprise-id from `enterprise-id.service.ts` (per SOS N.6).
- Idempotent (skips if doc with same `code` already exists).
- Run once per environment (`npm run seed:boq-subcategories`).

> Rationale: sub-categories are canonical Greek construction terminology, not company-specific data. Storing them once avoids 78 × N duplicate documents as tenant count grows.

### 4.6 Backward compatibility

- Existing BOQ items have no `subCategoryCode`. They display in lists/reports with the Level-1 category name only — no "(no sub)" suffix. Absent optional metadata is silent (Procore/Primavera/SAP standard).
- Boy Scout migration is **manual / opportunistic**: when a user opens an old item in edit mode, the form prefills `subCategoryCode = ''` and they can optionally select one before saving.
- No bulk migration script. No mandatory backfill.
- Sub-category is **always optional** — never required per category type. Hard-coded required fields cause premature validation (blocks users who don't have all info yet).
- When sending a quote to a contractor (ADR-327): show a **non-blocking warning** if any line items have no sub-category — «⚠️ X εργασίες δεν έχουν υποκατηγορία. Θέλεις να συνεχίσεις;» — user can proceed or go back to fill them in.

## 5. Consequences

**Positive:**
- Canonical terminology — eliminates spelling/synonym drift across users and projects.
- Rollup analytics — "all foundation excavations across all buildings" becomes a Firestore query, not a regex on free-text titles.
- Better DXF auto-extraction (Phase 2 — ADR-175 §6) — AI can map detected elements to a fixed sub-category code with high confidence.
- Vendor quote comparison (ADR-327) — quotes can be normalized by sub-category, not by free text.

**ADR-327 integration (vendor quotes):**
Sub-category name appears as a **group header** in exported quote documents — e.g. «Θεμελιώσεις» above the line items. The internal code (OIK-2.1) is never shown to contractors. Items without sub-category are grouped under the Level-1 category name only.

**Negative:**
- ~78 new Firestore system docs on first seed (~one-time cost, not per-company).
- New i18n keys (~80 EL + 80 EN entries).
- Boy Scout migration adds one extra click for existing items.
- The curated list is a **local convention**, not the official ΑΤΟΕ — explicitly stated to users to avoid public-procurement misuse.

## 6. Sources

The Level-2 list was **NOT** transcribed from any single official document — the ΑΤΟΕ PDFs are FlateDecode-compressed binaries that cannot be parsed automatically. Instead the list was assembled from:

- **Greek civil-engineering practice glossaries** — common section headers used in private construction:
  - [Michanikos.gr — ΑΤΟΕ thread](https://www.michanikos.gr/forums/topic/45193-%CE%B1%CF%84%CE%BF%CE%B5/)
  - [BuildingHow — Δοκοί / Υποστυλώματα](https://buildinghow.com/el-gr/)
  - [HellasKKS — Δομικά Υλικά / Επιχρίσματα](http://www.hellaskks.gr/min_requirements/docs/PE1/DGTSY/5Ktiriaka/TD-D-1080.0.htm)
  - [TEE — Περιγραφικό Τιμολόγιο OIK 2024 (PDF, 3.3 MB)](https://tkm.tee.gr/wp-content/uploads/2024/02/04.%CE%91.-%CE%95%CE%A1%CE%93%CE%91-OIK-%CE%A0%CE%B5%CF%81%CE%B9%CE%B3%CF%81%CE%B1%CF%86%CE%B9%CE%BA%CF%8C-%CE%A4%CE%B9%CE%BC%CE%BF%CE%BB%CF%8C%CE%B3%CE%B9%CE%BF.pdf)

- **Greek contractor / supplier websites** (canonical product/service categorization):
  - HM Construction, Stone Group, Durostick, Fenestral, Alunet, Fragoulakis, Sidirokataskeves, Smart Building, MVP Construction, Douleutaras
- **Wikipedia (el)** for terminology cross-checks (μόνωση, σιδηρός οπλισμός, σκυρόδεμα).

The list reflects **common private-construction usage**, not the formal ΑΤΟΕ catalog. The catalog is a **starting point, not a prison** (Procore/Primavera/SAP standard):

- **Phase 1 (now)**: admin UI in Settings (step f) — user adds/edits sub-categories directly, zero developer dependency. Data belongs to the user, not the codebase.
- Seed script (step b) populates the initial 83 entries; all subsequent changes go through the UI.

Schema is designed for open-ended additions: open-set codes, `parentId` already in schema, no hard-coded enum on `BOQItem.subCategoryCode`.

## 7. Implementation plan (separate ticket)

This ADR documents the design **only**. Implementation is broken into:

| Step | Effort | Owner |
|---|---|---|
| (a) Static array `boq-subcategories.ts` (94 entries, 15 groups) | ~30 min | dev |
| (b) Firestore seed script + npm script (system-level, no companyId) | ~1 h | dev |
| (c) `subCategoryCode` optional field on `BOQItem` + helpers in `useBOQEditorState` | ~30 min | dev |
| (d) `BasicInfoFieldset` cascading dropdown + i18n keys (el + en) | ~1 h | dev |
| (e) Display sub-category as second smaller line in `BOQItemList` (Procore/Primavera pattern). `BOQSummaryCards` rollup by sub-category. | ~1 h | dev |
| (f) Admin UI in Settings — «Ρυθμίσεις → Κατηγορίες Εργασιών» — add/edit/delete sub-categories without developer. User owns their catalog data. | ~3 h | dev |
| (g) Non-blocking warning on quote send (ADR-327) if line items missing sub-category | ~30 min | dev |
| (h) Manual Boy Scout test on 5 sample items | ~30 min | QA |

Total: ~8 hours dev time. To be filed as a separate task after Giorgio's approval of this ADR.

## Changelog

| Date | Change |
|------|--------|
| 2026-05-01 | Initial draft. Status PROPOSED. 12 categories × 5–7 subgroups = 78 entries. |
| 2026-05-01 | §4.4 corrected: `subCategoryCode` always editable in edit mode (Progressive Detail pattern). Only `categoryCode` locked. |
| 2026-05-01 | §4.6 corrected: items without sub-category show Level-1 name only — no "(no sub)" suffix. Silent absence is enterprise standard. |
| 2026-05-01 | §7(e) confirmed: sub-category displays as second smaller line in BOQItemList (Procore/Primavera two-line pattern). Not a badge/chip. |
| 2026-05-01 | §4.5 confirmed: global master catalog — no companyId, seeded once, shared across all tenants automatically. |
| 2026-05-01 | §5 ADR-327 integration: sub-category shown as group header in quotes (name only, never OIK-x.x code). |
| 2026-05-01 | §4.6 confirmed: sub-category always optional everywhere. Non-blocking warning on quote send if items missing sub-category. |
| 2026-05-01 | §6 extensibility: admin UI (step f) moved to main plan — user owns catalog data, zero developer dependency. |
| 2026-05-01 | OIK-13 Ανελκυστήρες (5), OIK-14 Πισίνες (6), OIK-15 Φωτοβολταϊκά (5) added. Total: 94. `boq-categories.ts` updated. |
| 2026-05-01 | OIK-9.7 "Αυτοματισμοί Smart Home (KNX / BUS)" added. OIK-16 "Ξυλουργικά / Κουζίνες" added (5 subs). Total: **98 sub-categories, 16 groups**. |
| 2026-05-01 | IMPLEMENTED — Step (a): `src/config/boq-subcategories.ts` (98 subs, helpers `subCategoriesFor` + `findSubCategory`). |
| 2026-05-01 | IMPLEMENTED — Step (b): `scripts/seed-boq-subcategories.ts` + `npm run seed:boq-subcategories`. Idempotent, uses `setDoc()`. |
| 2026-05-01 | IMPLEMENTED — Step (c): `subCategoryCode: string \| null` on `BOQItem` / `CreateBOQItemInput` / `UpdateBOQItemInput`. `useBOQEditorState.ts` updated (init, save, category-change reset). |
| 2026-05-01 | IMPLEMENTED — Step (d): `BasicInfoFieldset` cascading Select in `BOQItemEditor.tsx`. File size exceeded 500 lines → `BOQEditorFieldsets.tsx` extracted. i18n keys added to `building-tabs.json` (el + en). Sub-category Select always editable per Progressive Detail pattern. |
| 2026-05-01 | IMPLEMENTED — Step (e): `BOQCategoryAccordion.tsx` shows sub-category name as second smaller line (Procore two-line pattern). `findSubCategory()` used for lookup. |
| 2026-05-01 | IMPLEMENTED — Step (f): Admin UI `src/components/settings/company/BOQCategoriesTab.tsx` + API `src/app/api/settings/boq-subcategories/route.ts` (GET/POST/PATCH/DELETE). Tab "Κατηγορίες Εργασιών" added to `CompanySettingsPageContent.tsx`. i18n keys added to `org-structure.json` (el + en). |
| 2026-05-01 | IMPLEMENTED — Step (g): `MeasurementsTabContent.tsx` — non-blocking confirm dialog on "Δημιουργία RFQ" if BOQ items missing `subCategoryCode`. |
| 2026-05-01 | `boq-service.ts` — `subCategoryCode` added to `allowedFieldsForCertified` (certified items can still get sub-category assigned per Progressive Detail). |
| 2026-05-01 | COLLECTIONS.BOQ_SYSTEM_SUBCATEGORIES added to `firestore-collections.ts`. |
