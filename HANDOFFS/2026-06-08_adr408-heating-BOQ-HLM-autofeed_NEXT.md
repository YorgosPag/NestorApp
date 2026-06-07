# HANDOFF — ADR-408 ΘΕΡΜΑΝΣΗ: BOQ AUTO-FEED ΜΕ ΗΛΜ ΑΡΘΡΑ (MEP → Προμετρήσεις)

**Ημερομηνία:** 2026-06-08
**Εντολή Giorgio:** «ΟΠΩΣ Η REVIT — FULL ENTERPRISE + FULL SSOT»
**Μοντέλο:** Opus 4.8
**⚠️ COMMIT/PUSH: ΜΟΝΟ ο Giorgio.** Working tree **SHARED** με άλλον agent (roof/IfcCovering + opening Family/Type WIP).
**⚠️ `git add` ΜΟΝΟ δικά σου αρχεία — ΠΟΤΕ `-A`. ΜΗΝ adr-index. ΜΗΝ `--no-verify`.**
**⚠️ N.17:** ΕΝΑ tsc τη φορά — έλεγξε διεργασία πριν τρέξεις.

---

## 0) ΤΙ ΕΚΛΕΙΣΕ ΠΡΙΝ (context — μην το ξανακάνεις)

Το **Εύρος Β θέρμανσης** ολοκληρώθηκε **πλήρως σε γεωμετρία/τοποθέτηση/δίκτυο** (όλα 🔴 pending browser verify + commit από Giorgio):
- ✅ **Εύρος Α** — hydronic network activation (supply/return classification picker + inheritance).
- ✅ **#1 Καλοριφέρ** (`mep-radiator`) — entity + contextual tab + **3D click-placement** (2026-06-08).
- ✅ **#2 Λέβητας** (`mep-boiler`) — entity + tab + **3D click-placement** (2026-06-08).
- ✅ **#3 Ενδοδαπέδια** (`mep-underfloor`) — area entity + serpentine geometry (`totalLengthM`).
- ✅ Δίκτυο σωλήνων (`mep-segment` domain `pipe`) + συλλέκτης (`mep-manifold`) + auto-fittings (`mep-fitting`).

**Το ΜΟΝΟ εκκρεμές της θέρμανσης = BOQ (Προμετρήσεις).** Αυτό είναι το παρόν task.

---

## 1) ΤΟ ΠΡΟΒΛΗΜΑ (γιατί κανένα MEP entity δεν τροφοδοτεί σήμερα BOQ)

Σήμερα το auto-feed BIM → BOQ καλύπτει **ΜΟΝΟ δομικά (OIK)**. Δες code = source of truth:

**`src/subapps/dxf-viewer/bim/config/bim-to-atoe-mapping.ts`**
- `export type BimEntityType = 'wall' | 'opening' | 'slab' | 'column' | 'beam' | 'stair' | 'railing' | 'furniture' | 'roof';` — **ΚΑΝΕΝΑ `mep-*`.**
- Όλα τα mapping tables (`WALL_MAPPING`, `COLUMN_MAPPING`, …) δίνουν **OIK-x.xx** codes (Οικοδομικά).
- `resolveAtoeMapping(entityType, kind, category?, sectionKind?)` → επιστρέφει `AtoeMappingEntry { categoryCode, unit, titleEL }` ή `null`.
- `deriveAtoeQuantity(unit, geometry)` → **ΗΔΗ υποστηρίζει** `pcs`→1, `m2`→`geometry.area`, `m3`→`geometry.volume`, `m`→`geometry.lengthM`, `kg`→`volume×STEEL_DENSITY_KGM3`. **Αρκεί για θέρμανση** (καλοριφέρ/λέβητας = pcs, σωλήνας = m, ενδοδαπέδια = m ή m²).

**`src/subapps/dxf-viewer/bim/services/BimToBoqBridge.ts`** (singleton `bimToBoqBridge`)
- `upsertBoqItemForBim(entityType, entity: BimEntityForBoq, context, action)` + `deleteBoqItemForBim(entityId, companyId)`.
- `BimEntityForBoq = { id, kind, params?, geometry?: { area?, volume?, lengthM? } }`.
- Deterministic id `boq_bim_${entity.id}`, `source: 'bim-auto'`, detach-guard (user override), fire-and-forget.

**Πώς το καλούν τα δομικά** (template — δες `hooks/data/useRailingPersistence.ts:~256`):
```ts
if (companyId && projectId && buildingId) {
  void bimToBoqBridge.upsertBoqItemForBim(
    'railing',
    { id: entity.id, kind: entity.kind, geometry: entity.geometry },
    { companyId, projectId, buildingId, floorId: floorId ?? undefined },
    isNew ? 'created' : 'updated',
  );
}
```
Τα MEP persistence hooks (`useMepRadiatorPersistence`, `useMepBoilerPersistence`, `useMepUnderfloorPersistence`, `useMepSegmentPersistence`, `useMepManifoldPersistence`) **ΔΕΝ** καλούν τον bridge.

---

## 2) 🔴 BLOCKER — ΗΛΜ ΚΩΔΙΚΟΙ ΑΡΘΡΩΝ (απόφαση Giorgio ΣΤΗΝ ΑΡΧΗ ΤΟΥ SESSION)

Τα δομικά χρησιμοποιούν πρόθεμα **OIK-** (Οικοδομικά). Τα θερμαντικά είναι **Ηλεκτρομηχανολογικά (Η/Μ)** → χρειάζονται **ΗΛΜ-** κωδικούς. Ο ΑΤΟΕ master δεν έχει ΗΛΜ άρθρα προς το παρόν.

**⚠️ ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ: ρώτησε τον Giorgio (AskUserQuestion) ΠΟΙΑ από τις 2 επιλογές:**
- **(Α) Πραγματικοί ΗΛΜ κωδικοί** — ο Giorgio δίνει τους κωδικούς άρθρων ΗΛΜ ανά στοιχείο (καλοριφέρ, λέβητας, σωλήνας, ενδοδαπέδια, συλλέκτης). Τότε τους βάζεις στο νέο `MEP_*_MAPPING` table 1:1.
- **(Β) Placeholder ΗΛΜ κωδικοί** — εγκεκριμένο schema `ΗΛΜ-x.xx` (π.χ. `ΗΛΜ-25.xx` θερμαντικά σώματα/λέβητες, `ΗΛΜ-26.xx` δίκτυα σωλήνων) ώστε η αρχιτεκτονική να ολοκληρωθεί ΤΩΡΑ· οι πραγματικοί κωδικοί συμπληρώνονται αργότερα σε ΕΝΑ αρχείο (το mapping table).

**ΧΩΡΙΣ απόφαση → ΜΗΝ ξεκινήσεις το mapping table.** Όλη η υπόλοιπη αρχιτεκτονική (§3) είναι code-side και δεν εξαρτάται από τους ίδιους τους αριθμούς — αλλά το mapping χρειάζεται την απόφαση.

**Επίσης απόφανση Giorgio (γρήγορες ερωτήσεις):**
- Μονάδα **ενδοδαπέδιας**: `m` (μήκος σερπαντίνας `totalLengthM`, Revit pipe length) **ή** `m²` (επιφάνεια θερμαινόμενου δαπέδου `geometry.area`); → προτεινόμενο `m` (συνεπές με σωλήνες· Revit μετρά pipe length).
- **Auto-fittings** (`mep-fitting`) στο BOQ; → προτεινόμενο **DEFERRED** v1 (η Revit τα μετρά αλλά συχνά ανά project· ξεκίνα χωρίς αυτά).
- **Σωλήνας**: μέτρηση ανά `classification` (hydronic-supply vs hydronic-return χωριστές γραμμές) **ή** ενιαία; → προτεινόμενο ανά classification (Revit System-based takeoff).

---

## 3) Η ΑΡΧΙΤΕΚΤΟΝΙΚΗ (FULL ENTERPRISE + FULL SSOT — Revit Material/System Takeoff)

**Αρχή SSoT (μην fork-άρεις):** το auto-feed περνά **ΑΠΟΚΛΕΙΣΤΙΚΑ** από `bim-to-atoe-mapping.ts` (mapping) + `BimToBoqBridge` (upsert/delete). Επεκτείνεις, δεν αντιγράφεις.

### Βήμα Α — επέκταση `bim-to-atoe-mapping.ts`
1. `BimEntityType` += `'mep-radiator' | 'mep-boiler' | 'mep-segment' | 'mep-underfloor' | 'mep-manifold'` (όσα αποφασιστούν).
2. NEW mapping tables (μετά την §2 απόφαση), π.χ.:
   - `MEP_RADIATOR_MAPPING: Record<MepRadiatorKind, AtoeMappingEntry>` → `unit: 'pcs'`, ΗΛΜ code, titleEL «Θερμαντικό σώμα (BIM)».
   - `MEP_BOILER_MAPPING` → `pcs`, ΗΛΜ, «Λέβητας (BIM)».
   - `MEP_SEGMENT_MAPPING` → `m` (διαχωριστής = `classification`/`domain`, ΟΧΙ `kind` — δες beam `sectionKind` pattern για override εκτός kind-table).
   - `MEP_UNDERFLOOR_MAPPING` → `m` ή `m²` (απόφαση §2).
   - `MEP_MANIFOLD_MAPPING` → `pcs`, ΗΛΜ, «Συλλέκτης (BIM)».
3. `resolveAtoeMapping` — πρόσθεσε branches για τα mep types (το segment θέλει classification override όπως το `sectionKind === 'I-shape'` του beam).
4. **ΠΡΟΣΟΧΗ:** ο σωλήνας μετριέται σε `m` → βεβαιώσου ότι το `mep-segment` geometry εκθέτει **`lengthM`** (audit `bim/mep-segments/*-geometry.ts`· αν λέγεται αλλιώς, normalize στο call site όπως το railing). Το underfloor έχει `totalLengthM` (όχι `lengthM`) → map στο σωστό πεδίο του `BimEntityForBoq.geometry`.

### Βήμα Β — wiring των MEP persistence hooks στον bridge
Σε **κάθε** MEP persistence hook (radiator/boiler/underfloor/segment/manifold), στο save effect (μετά το επιτυχές Firestore write, mirror railing):
```ts
if (companyId && projectId && buildingId) {
  void bimToBoqBridge.upsertBoqItemForBim(
    'mep-radiator',
    { id: entity.id, kind: entity.kind, params: entity.params, geometry: entity.geometry },
    { companyId, projectId, buildingId, floorId: floorId ?? undefined },
    isNew ? 'created' : 'updated',
  );
}
```
+ στο delete path → `void bimToBoqBridge.deleteBoqItemForBim(entityId, companyId)` (αν δεν υπάρχει ήδη cascade).
**Audit:** βεβαιώσου ότι κάθε hook έχει `buildingId`/`floorId` στα params (το railing/beam τα έχουν· αν λείπει από MEP hook → πρόσθεσέ το από τον caller, μην το εφεύρεις).

### Βήμα Γ — `deriveAtoeQuantity` (πιθανότατα ΚΑΜΙΑ αλλαγή)
Υποστηρίζει ήδη pcs/m/m²/m³. **Μην** το αγγίξεις εκτός αν προκύψει νέα μονάδα (π.χ. kW για θερμική ισχύ — ΟΧΙ στο v1).

### Βήμα Δ — tests (Google presubmit-grade)
- `bim-to-atoe-mapping.test.ts` — νέα cases ανά mep type (resolve → σωστό ΗΛΜ code/unit· segment classification override· unknown kind → null).
- `BimToBoqBridge.test.ts` — upsert/delete για ένα mep type (pcs + m).
- Τρέξε τα υπάρχοντα suites (μην σπάσεις OIK).

---

## 4) FULL SSOT — ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ φτιάξεις ξεχωριστό «MEP BOQ service» — επέκτεινε `bim-to-atoe-mapping.ts` + `BimToBoqBridge` (είναι το SSoT, στο `.ssot-registry.json` module `bim-to-boq-bridge`).
- ΜΗΝ persist-άρεις quantity ως truth — geometry = SSoT (ADR-395 §4.6· το `deriveAtoeQuantity` το παράγει).
- ΜΗΝ βάλεις OIK code σε θερμαντικό (λάθος discipline group στις Επιμετρήσεις).
- ΜΗΝ commit/push/`git add -A`. ΜΗΝ adr-index. ΜΗΝ `--no-verify`. ΜΗΝ revert/αγγίξεις δουλειά άλλου agent (roof/opening Family-Type).

---

## 5) ΕΠΑΛΗΘΕΥΣΗ (πριν παραδώσεις)
1. `tsc --noEmit` (N.17 — ένας τη φορά) → 0 δικά σου. Pre-existing (ΜΗΝ κυνηγήσεις): `mesh-to-object3d.ts:124`, `apply-entity-preview.ts:316`, `DeleteEntityCommand.ts:54` (roof), `useOpeningFamilyTypeController.ts`.
2. Jest: νέα + υπάρχοντα BOQ suites PASS.
3. Browser: δημιούργησε καλοριφέρ/σωλήνα → άνοιξε Επιμετρήσεις κτιρίου → εμφανίζεται γραμμή ΗΛΜ με σωστή ποσότητα (pcs/m)· διέγραψε → φεύγει η γραμμή (εκτός detached).
4. **N.15 docs (ΙΔΙΟ commit, ο Giorgio):** ADR-408 changelog + ADR-363 §6 (BIM→BOQ) ή ADR-395 αν αγγίξεις quantities + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (radiator/boiler/underfloor entries: BOQ ❌→✅) + memory. **ΟΧΙ adr-index** (shared).

---

## 6) ΚΡΙΣΙΜΑ ΑΡΧΕΙΑ (code = source of truth — διάβασέ τα ΠΡΩΤΑ)
- `src/subapps/dxf-viewer/bim/config/bim-to-atoe-mapping.ts` — SSoT mapping + resolver + `deriveAtoeQuantity`.
- `src/subapps/dxf-viewer/bim/services/BimToBoqBridge.ts` — SSoT upsert/delete bridge + `BimEntityForBoq`.
- `src/subapps/dxf-viewer/bim/config/material-to-atoe-mapping.ts` — material→ΑΤΟΕ (Phase 6.2 — δες αν βοηθά για ΗΛΜ derive από material).
- `src/subapps/dxf-viewer/hooks/data/useRailingPersistence.ts` (~256) — **template** call προς bridge (`m` unit, πιο κοντά στους σωλήνες).
- `src/subapps/dxf-viewer/hooks/data/column-boq-feed.ts` / `wall-boq-feed.ts` — επιπλέον feed patterns.
- MEP persistence hooks: `useMep{Radiator,Boiler,Underfloor,Segment,Manifold}Persistence.ts` (`hooks/data/`) — εδώ μπαίνει το wiring.
- MEP geometry: `bim/mep-{radiators,boilers,segments,underfloors,manifolds}/*-geometry.ts` — audit για `lengthM`/`area`/`totalLengthM`/qty.
- ADR-363 §6 (BIM→BOQ auto-feed) + ADR-395 (quantities) + ADR-175 (QS system).

---

## 7) ΣΕΙΡΑ ΕΡΓΑΣΙΑΣ (προτεινόμενη)
1. **AskUserQuestion** για §2 (ΗΛΜ codes Α/Β + ενδοδαπέδια unit + fittings + per-classification).
2. Audit MEP geometry (ποια πεδία υπάρχουν για quantity).
3. Επέκτεινε `bim-to-atoe-mapping.ts` (types + tables + resolver).
4. Wire τα MEP persistence hooks → `bimToBoqBridge` (upsert + delete).
5. Tests.
6. tsc + browser verify.
7. N.15 docs. **STOP — commit ο Giorgio.**

**Με αυτό κλείνει 100% το Εύρος Β θέρμανσης** (γεωμετρία + δίκτυο + 3D placement + **BOQ**).
