# HANDOFF — BUG #5: Floor search result deep-link (Revit-grade Option B)

> **Ημερομηνία:** 2026-06-07
> **Απόφαση Giorgio:** Επιλογή **Β** (Revit-grade). Κλικ σε όροφο από την αναζήτηση → ανοίγει το κτίριο **ΚΑΙ** εστιάζει/τονίζει τον συγκεκριμένο όροφο.
> **Γλώσσα:** Πάντα Ελληνικά. **Commit κάνει ΜΟΝΟ ο Giorgio.** Working tree μπορεί να είναι κοινό — μόνο σχετικά αρχεία.
> **Μοντέλο:** Opus (5+ αρχεία, 2 domains — N.8 Orchestrator/Plan Mode).

---

## ΤΟ ΠΡΟΒΛΗΜΑ (επιβεβαιωμένο σε live data)
Το `search_documents` ενός ορόφου έχει **ασυνέπεια**:
```
links.href      = "/buildings/bldg_…"   ← δείχνει στο ΚΤΙΡΙΟ
routeParams.id  = "flr_…"               ← το id του ορόφου
```
Δεν υπάρχει standalone route ορόφου (μόνο `/api/floors`). Ο όροφος ζει μέσα στη σελίδα κτιρίου
(`/buildings/[id]/page.tsx` → redirect → `/buildings?buildingId=:id`, λίστα-detail pattern).
Άρα η πλοήγηση στο κτίριο είναι σωστή — λείπει η **εστίαση στον όροφο**.

## ΣΤΟΧΟΣ (Revit-grade)
Κλικ σε «1ος Όροφος» → σελίδα κτιρίου ανοίγει στο **tab Όροφοι** + scroll/highlight στον σωστό όροφο
(όπως διπλό-κλικ σε «Στάθμη» στο Revit Project Browser).

## ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΠΟΥ ΗΔΗ ΥΠΑΡΧΕΙ (καλό νέο — δεν χτίζουμε από μηδέν)
- **`src/hooks/useEntityPageState.ts`** — SSoT hook. Διαβάζει `urlParamName` (=`buildingId`) και
  auto-selects το κτίριο (γρ. 116, 144-161). Υποστηρίζει **`extraUrlParams`** (γρ. 107, 118-124)
  → εδώ προσθέτουμε `floor` ώστε να διαβάζεται το `?floor=` από το URL.
- **`src/components/building-management/BuildingDetails.tsx`** — έχει `activeTab` state (γρ. 57)
  + `BuildingTabs` με `onActiveTabChange` (γρ. 144). Το tab value ζει μέσα στο `BuildingTabs`.

## ΑΡΧΕΙΑ ΠΡΟΣ ΑΛΛΑΓΗ (~7, 2 domains)
**Domain A — Search indexing (SSoT + mirror, ADR-029):**
1. `src/config/search-index-config.ts` (γρ. 84) — FLOOR `routeTemplate`:
   `/buildings/{buildingId}` → `/buildings?buildingId={buildingId}&floor={id}`
   (απευθείας query form ώστε να ΜΗΝ χαθεί το `?floor=` στο redirect του `[id]/page.tsx`).
2. `functions/src/search/search-config.mirror.ts` (γρ. 112) — ΙΔΙΑ αλλαγή (parity· pre-commit
   `npm run test:search-config-sync` το ελέγχει).
   - ⚠️ Έλεγξε `functions/src/search/indexBuilder.ts` `buildHref` (γρ. 162-166): κάνει
     `.replace('{id}', entityId)` ΠΡΩΤΑ, μετά regex `\{(\w+)\}` → `{buildingId}` από `data.buildingId`.
     Το template με `&floor={id}` δουλεύει: `{id}`→floorId, `{buildingId}`→buildingId. ✅
   - Το main-app `buildSearchResultHref` (search-index-config.ts γρ. 314-319) κάνει ΜΟΝΟ
     `.replace('{id}', …)` — ΔΕΝ resolve-άρει `{buildingId}`! Δες ποιο path γράφει το floor doc
     (live indexer `src/lib/search/search-indexer.ts` vs Functions CDC). Το live data δείχνει
     resolved `{buildingId}` → γράφτηκε από **Functions** (indexBuilder). Επιβεβαίωσε & ίσως
     χρειαστεί ευθυγράμμιση του main-app builder για παράλληλη συνέπεια.

**Domain B — Building UI (focus floor):**
3. Όπου ρυθμίζεται το `useEntityPageState` config για buildings (ψάξε
   `urlParamName: 'buildingId'` — πιθανόν σε `BuildingsList.tsx` ή hook): πρόσθεσε
   `extraUrlParams: ['floor']` + expose το `extraParams.floor`.
4. `src/components/building-management/BuildingsPageContent.tsx` — prop-drill το `focusFloorId`.
5. `src/components/building-management/BuildingDetails.tsx` — δέξου `focusFloorId`, αρχικό
   `activeTab='floors'` όταν υπάρχει, πέρασέ το στο `BuildingTabs`.
6. `src/components/building-management/BuildingDetails/BuildingTabs.tsx` — set active tab='floors'
   από prop (controlled initial).
7. `src/components/building-management/tabs/FloorsTabContent.tsx` (+ `useFloorsTabState.ts`) —
   scroll-into-view + highlight του `focusFloorId`. **← το μόνο κομμάτι που θέλει browser verify.**

## ΜΕΘΟΔΟΣ
- Plan Mode (N.8). ADR-029 changelog update (Domain A). 
- Test: `npm run test:search-config-sync` + νέο test για το floor href με `?floor=`.
- Browser verify: αναζήτηση «όροφος» → κλικ → πρέπει να ανοίξει κτίριο στο tab Όροφοι + highlight.
- N.15: ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (BUG #5 → ✅) + ADR-029/236 αν χρειαστεί.

## ΤΙ ΕΓΙΝΕ ΗΔΗ ΣΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (ΜΗΝ ξανακάνεις)
- ✅ **Garden fix (cosmetic, ADR-236 Round 2):** `normalizeLevelData` στο `multi-level.service.ts`
  γεμίζει missing `areas`/`layout` sub-keys (π.χ. `garden`) διατηρώντας values + `finishes`. 9/9 tests.
  ADR-236 changelog ενημερωμένο. **Pending Giorgio commit.**
- ✅ **Cloud Function `onPropertyWriteFloorUnits` DEPLOYED** (project pagonis-87766, us-central1).
  Το `floors.units` πλέον ενημερώνεται live (επιβεβαιώθηκε: μεζονέτα → units=1 σε ΚΑΙ τους 2 ορόφους).
- ✅ Ιεραρχία Round 2 (Επαφή→Έργο→Κτίριο→Όροφος→Μονάδα) ελέγχθηκε πλήρως — όλα καθαρά,
  οι 4 διορθώσεις Round 1 επιβεβαιωμένες.

## ΕΠΟΜΕΝΑ ΜΕΤΑ ΤΟ BUG #5 (§6 του Round 2 handoff)
Storage uploads (company-scoped paths, `files` collection, ref-counting) + BIM entities από DXF
viewer (floor-scoped persistence, floorId, companyId).
