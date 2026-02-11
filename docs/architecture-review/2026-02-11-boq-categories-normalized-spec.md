# Normalized Spec: `boq-categories` (Nestor)

**Date:** 2026-02-11
**Status:** Draft Specification
**Scope:** Master catalog design only (no implementation)
**Based on:** `docs/architecture-review/2026-02-11-boq-parallel-research.md`

---

## 1. Στόχος

Να οριστεί ένα ενιαίο, versioned, machine-readable master catalog για κατηγορίες/υποκατηγορίες BOQ, συμβατό:

1. με ελληνική πρακτική τιμολογίων (ΑΤΟΕ/ΟΙΚ οικογένεια)
2. με IFC quantity dimensions (count/length/area/volume/weight/time)
3. με manual + DXF-auto workflows

---

## 2. Design Αρχές

1. **Category-first**: πρώτα κατηγορία/υποκατηγορία, μετά άρθρα/items.
2. **Unit-safe**: κάθε category έχει επιτρεπτές μονάδες και default unit.
3. **IFC-aligned**: κάθε category χαρτογραφείται σε IFC quantity type.
4. **Waste configurable**: no hardcoded θεσμικό waste table, μόνο defaults με override.
5. **Versioned**: το catalog αλλάζει μόνο με version bump + changelog.
6. **Locale-ready**: EL/EN labels + synonyms για import normalization.

---

## 3. Canonical Entity: BOQ Category

## 3.1 Required Fields

1. `id`: stable UUID-like identifier (internal)
2. `code`: human/business code (π.χ. `OIK-EPI-001`)
3. `legacyCode`: optional code από legacy/ΑΤΟΕ mapping
4. `nameEl`: ελληνική ονομασία
5. `nameEn`: αγγλική ονομασία
6. `level`: `group | category | subcategory`
7. `parentCode`: nullable (για root groups = null)
8. `ifcQuantityType`: `count | length | area | volume | weight | time`
9. `defaultUnit`: βασική μονάδα μέτρησης
10. `allowedUnits`: λίστα επιτρεπτών μονάδων
11. `defaultWastePct`: προεπιλεγμένο ποσοστό φύρας
12. `wastePolicy`: `none | optional | required`
13. `active`: boolean
14. `sortOrder`: integer
15. `tags`: λίστα βοηθητικών tags
16. `sourceAuthority`: πηγή (GGDE/SATE/INTERNAL)
17. `sourceVersion`: έκδοση πηγής
18. `createdAt`
19. `updatedAt`

## 3.2 Optional Fields

1. `descriptionEl`
2. `descriptionEn`
3. `validationRules` (π.χ. min/max qty)
4. `synonymsEl` (για import matching)
5. `synonymsEn`
6. `deprecated` + `replacementCode`

---

## 4. Units & Quantity Model

## 4.1 Canonical Units

1. `pcs`
2. `m`
3. `m2`
4. `m3`
5. `kg`
6. `ton`
7. `h`
8. `day`
9. `set`
10. `lump`

## 4.2 IFC Mapping Constraints

1. `count` -> `pcs`, `set`
2. `length` -> `m`
3. `area` -> `m2`
4. `volume` -> `m3`
5. `weight` -> `kg`, `ton`
6. `time` -> `h`, `day`

Validation rule: `defaultUnit` MUST belong to the IFC-compatible unit set.

---

## 5. Proposed Top-Level Group Taxonomy

Συνθετική ταξινόμηση για αρχικό master catalog (v1), συμβατή με ελληνική πρακτική:

1. `EARTHWORKS_DEMOLITIONS` (χωματουργικά/καθαιρέσεις)
2. `CONCRETE_REINFORCEMENT` (σκυροδέματα/οπλισμοί)
3. `MASONRY_PARTITIONS` (τοιχοποιίες/χωρίσματα)
4. `PLASTER_INSULATION` (επιχρίσματα/μονώσεις)
5. `FLOOR_WALL_FINISHES` (επενδύσεις/επιστρώσεις)
6. `CARPENTRY_METALWORK` (ξύλινα/μεταλλικά)
7. `OPENINGS_FRAMES` (πόρτες/παράθυρα/κουφώματα)
8. `PAINTINGS_COATINGS` (χρωματισμοί/επιστρώσεις προστασίας)
9. `PLUMBING_SANITARY` (υδραυλικά/είδη υγιεινής)
10. `ELECTRICAL_LOW_CURRENT` (ηλεκτρολογικά/ασθενή)
11. `EXTERNAL_WORKS` (περιβάλλων χώρος/διαμορφώσεις)
12. `TEMPORARY_SITE_COSTS` (εργοταξιακά/χρονικές επιβαρύνσεις)

Σημείωση: τα group codes είναι εσωτερικά Nestor. Το `legacyCode` θα φιλοξενεί αντιστοιχία σε επίσημα άρθρα όπου απαιτείται.

---

## 6. Normalized JSON Shape (Specification)

```json
{
  "catalogVersion": "2026.02.v1",
  "localeDefault": "el-GR",
  "generatedAt": "ISO-8601",
  "groups": [
    {
      "id": "grp-earthworks",
      "code": "EARTHWORKS_DEMOLITIONS",
      "nameEl": "Χωματουργικά και Καθαιρέσεις",
      "nameEn": "Earthworks and Demolitions",
      "level": "group",
      "parentCode": null,
      "ifcQuantityType": "volume",
      "defaultUnit": "m3",
      "allowedUnits": ["m3", "m2", "m"],
      "defaultWastePct": 0,
      "wastePolicy": "optional",
      "active": true,
      "sortOrder": 10,
      "tags": ["site", "excavation"],
      "sourceAuthority": "GGDE/SATE",
      "sourceVersion": "mapped-v1"
    }
  ],
  "categories": [],
  "subcategories": []
}
```

---

## 7. Waste Model (Φύρα)

## 7.1 Rules

1. `defaultWastePct` applies only as template suggestion.
2. Project/building/item μπορούν να κάνουν override.
3. Import pipeline πρέπει να αποδέχεται είτε `%` είτε factor (`0.05`) με normalization.
4. Για categories με αμελητέα φύρα (`none`), τιμή always `0` unless forced waiver.

## 7.2 Why

Η θεσμική πηγή δεν δίνει ενιαίο public machine-readable waste table ανά category για όλα τα άρθρα. Άρα το ασφαλές μοντέλο είναι configurable defaults + audit trail.

---

## 8. Linking with BOQ Items

Κάθε `BoqItem` πρέπει να κρατά:

1. `categoryCode`
2. `ifcQuantityType`
3. `unit`
4. `wastePctApplied`
5. `catalogVersion`

Έτσι μελλοντικά δεν «σπάει» ιστορικό κόστος όταν αλλάζει το master catalog.

---

## 9. Import Normalization Rules

1. Αν έρθει μόνο περιγραφή χωρίς code: attempt match με `synonymsEl/synonymsEn`.
2. Αν έρθει code αλλά λάθος unit: hard validation error.
3. Αν λείπει IFC type: derive από category και γράψε warning.
4. Αν category deprecated: map σε `replacementCode` και γράψε migration note.

---

## 10. Governance

1. Owner: `Tech Lead + Domain Engineer`
2. Change process: proposal -> review -> version bump -> publish
3. Change log required με:
- added categories
- renamed labels
- unit changes
- deprecated/replaced codes

---

## 11. Recommended Files (Documentation Layer)

1. `docs/boq/catalog/boq-categories-spec.md`
2. `docs/boq/catalog/boq-categories-changelog.md`
3. `docs/boq/catalog/ifc-mapping-table.md`
4. `docs/boq/catalog/import-normalization-rules.md`

---

## 12. Initial Rollout Plan

1. v1: 12 top groups + βασικές κατηγορίες + IFC mapping + units
2. v1.1: synonyms expansion για ελληνικά Excel imports
3. v1.2: category-level waste defaults (validated by pilot projects)
4. v2: article-level enrichment με verified official mappings

---

## 13. Acceptance Criteria (Spec Complete)

1. Κάθε category έχει IFC type + default/allowed units.
2. Κάθε category έχει stable code + EL/EN name.
3. Catalog version αποθηκεύεται σε κάθε BoqItem.
4. Import normalization behavior είναι πλήρως τεκμηριωμένο.
5. Υπάρχει documented process για deprecation/replacement.

---

## 14. Final Note

Το παρόν είναι **normalized specification** για master data architecture. Δεν αποτελεί πλήρη θεσμική αναπαραγωγή όλου του article-level ΑΤΟΕ catalog. Η πλήρης article-level βάση απαιτεί controlled ETL από πιο αξιόπιστο structured source.
