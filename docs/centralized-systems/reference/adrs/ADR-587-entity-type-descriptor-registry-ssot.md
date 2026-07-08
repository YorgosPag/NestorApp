# ADR-587 — Entity Type Descriptor Registry (SSoT για την καταχώρηση νέας οντότητας)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **Φ1 + Φ2 + Φ2b + Φ2c + Φ3a + Φ3b-1 + Φ3b-2 + Φ4 IMPLEMENTED (UNCOMMITTED)** — 2026-07-08, Opus 4.8. Φ1 = declarative foundation (`EntityTypeDescriptor` + `category`). Φ2 = `dxfExportType` (απορρόφηση `ENTITY_TYPE_MAPPING`) + roadmap correction (§5.1: tool/ribbon = ToolType-keyed). **Φ2b = tool→entity back-link** — `ToolInfo.createsEntityType` **DERIVED** από συμπαγή SSoT `TOOL_CREATES_ENTITY` (ToolType-keyed §5.1· ~75 tools→RenderableEntityType, ΚΑΘΕ τιμή επαληθευμένη από τον creation κώδικα). Φ2c = `dxfWrappedField` (απορρόφηση `DXF_WRAPPED_SUBENTITY_FIELD`). Φ3a = entity-keyed selection→contextual-tab resolver dedup (23 `if (type==='x')` → ΕΝΑ `ENTITY_CONTEXTUAL_TRIGGER` map). Φ3b-1 = command-keys guard factory (Seam 1) — ~111 predicate-boilerplate guards σε 40 `*-command-keys.ts` → ΕΝΑ `makeKeySetGuard` factory (adapter· named exports αμετάβλητα). **Φ3b-2 = tool-trigger dedup (Seam 2)** — το tool-active if-chain (~30 branches) του `useActiveContextualTrigger` → `TOOL_ACTIVE_TRIGGER` map + predicate/prefix/sticky escape-hatch, extract σε καθαρό `app/resolve-tool-active-trigger.ts` (ToolType-keyed §5.1· disjoint map/predicate domains → behavior-preserving). **Φ4 = TIER-3 bridge dispatch** — οι 4 if-chains (~210 branches) του `useRibbonCommands` → δηλωτικοί ordered route tables + generic runners (`useRibbonCommands-dispatch.ts`, pure/testable)· ενιαίος combobox route → write/read δεν αποκλίνουν (λύνει ADR-449 bug class)· readout ασυμμετρία ρητή· perf-preserving (ADR-547). Design + roadmap εγκεκριμένα (Giorgio). Φ5+ αναμονή. Μηδέν αλλαγή συμπεριφοράς. jest: descriptor 14/14 + tool-creates-entity 13/13 + selection-trigger 11/11 + tool-active-trigger 10/10 + bridge command-keys 172/172 + ribbon-dispatch 10/10 (ribbon sweep 573/573) πράσινα· jscpd καθαρό. |
| **Date** | 2026-07-08 |
| **Category** | Canvas & Rendering / Entity Systems |
| **Location** | `src/subapps/dxf-viewer/rendering/contract/` |
| **Author** | Claude (Opus 4.8), κατόπιν εντολής Giorgio |
| **Related ADRs** | **ADR-549** (census render mechanisms), **ADR-550** (Unified Entity Render Contract — το άμεσο precedent που ΕΠΕΚΤΕΙΝΕΤΑΙ, όχι διπλασιάζεται), **ADR-561** (move/rotate grips primitives — 5-θέσεων template), **ADR-583** (Annotation Symbol Library / Βορράς — reference implementation· τα ~40 σημεία του = ο χάρτης), ADR-294 (SSoT ratchet), ADR-584/N.18 (jscpd anti-clone) |

---

## 1. Context — το πρόβλημα (shotgun surgery)

Για να προστεθεί **οποιαδήποτε** νέα οντότητα (Βορράς, κλίμακα, νέο BIM στοιχείο) γράφεται **το ίδιο μοτίβο** σε **~40 διάσπαρτα** `switch (entity.type)` / `Record<EntityType>` / union σε όλο το `src/subapps/dxf-viewer`. Αυτό είναι κλασικό **shotgun surgery** (Fowler): μία λογική αλλαγή = ~40 edits, με ρίσκο να ξεχαστεί κάποιο (π.χ. οντότητα που φαίνεται 2D αλλά όχι 3D, ή που δεν επιλέγεται γιατί ξεχάστηκε το hit-test).

Ο πλήρης χάρτης των ~40 σημείων τεκμηριώθηκε στο ADR-583 §5 (τι άγγιξε ο Βορράς). Ζητούμενο (Giorgio): **ΕΝΑ descriptor ανά οντότητα** ώστε νέος τύπος = **1 αρχείο descriptor**, όχι 40 edits.

---

## 2. Research — πώς το κάνουν οι μεγάλοι παίκτες (web, 2026-07-08)

Ερευνήθηκαν **Maxon Cinema 4D**, **Autodesk Revit**, **Figma** (επίσημα SDK docs). Εύρημα (με πηγές):

| Σύστημα | Μηχανισμός «νέος τύπος» | Τι ΔΕΝ ενοποιούν (engine-owned) |
|---|---|---|
| **Cinema 4D** | `RegisterObjectPlugin` (ΕΝΑ registration) + virtual-method polymorphism (`ObjectData`/`NodeData`) | **Cache/dirty/threading** του generator evaluation — ο πυρήνας το κατέχει, το plugin μόνο δηλώνει `GetVirtualObjects`/`GetAccessedObjects` |
| **Revit** | **Data-driven**: Category→Family→Type→Instance. Νέος τύπος = Family authoring (data), όχι κώδικας. Top-level Categories = **κλειστό** enum | **Regeneration engine** — ΠΟΤΕ per-element· `RegenerationAttribute` είναι μόνο command-level. Dependency propagation = proprietary κεντρικό |
| **Figma** | Uniform `SceneNode` discriminated union + **mixin composition**· κλειστό set node types | **Rendering/compositing pipeline** — ΠΟΤΕ ανοιχτό σε per-type plugin dispatch |

**Συμπέρασμα (τριπλά επιβεβαιωμένο — research + ADR-550 + audit):** Και οι τρεις συγκλίνουν σε **hybrid**:

> **Δηλωτικό/interface registry** για «ποιοι τύποι υπάρχουν + ποια hooks εκθέτουν», ενώ τα **cross-cutting, performance/correctness-critical engine passes** (regen, cache/dirty, rendering pipeline) **μένουν κεντρικά και ΔΕΝ ανατίθενται per-type**. Κανείς δεν δίνει σε per-type κώδικα πλήρη executable έλεγχο κάθε επιφάνειας.

**Απόφαση Giorgio (2026-07-08):** «FULL ENTERPRISE + FULL SSOT, αλλά αν οι μεγάλοι δεν το προτείνουν, ακολουθούμε την πρακτική τους.» → Άρα υιοθετούμε **ακριβώς** το big-player hybrid, ΟΧΙ «παχύ» descriptor που κατέχει τα πάντα.

---

## 3. Audit — τα ~40 σημεία σε 3 δομικά TIERS (4 parallel readers, 2026-07-08)

Το κρίσιμο εύρημα: τα ~40 σημεία **δεν** είναι ομοιογενή. Χωρίζονται σε 3 κατηγορίες με **θεμελιωδώς διαφορετική** δυνατότητα ενοποίησης:

### TIER 1 — Δηλωτικά / ήδη-registry → μπαίνουν σε ΕΝΑ descriptor (data, coverage-bound)
| Σημείο | Σημερινός μηχανισμός | Descriptor field |
|---|---|---|
| `EntityType` union (`base-entity.ts`) | union | key domain (παραμένει· TS exhaustiveness) |
| `isBimEntityType` (`entities.ts`) — OR-chain 22 τύπων | scattered OR-chain | `category: 'dxf-primitive'\|'bim'\|'annotation'` |
| `ENTITY_TYPE_MAPPING` (`dxf-export.types.ts`) | `Record` ✅ | `dxfExportType: EzdxfEntityType\|null` |
| `DXF_WRAPPED_SUBENTITY_FIELD` (`dxf-types.ts`) | registry ✅ | `dxfWrappedField?` (απορρόφηση) |
| `EntityRendererComposite` renderer `Map` | imperative Map | `rendererClass?` (ctor ref) |
| `ToolType` union + `TOOL_DEFINITIONS` | union + `Record` ✅ | `tool.{id,lifecycle}` (derived union) |
| `CommandAliasRegistry` | array→Map ✅ | `tool.aliases` |
| `insert-tab.ts` / `RibbonButtonIcon` | object literal + switch | `ribbonButton` / `icon` |
| **41× `*-command-keys.ts`** | 41 hand-rolled predicate pairs | `contextualTab.commandKeys` (**μεγαλύτερο dedup**) |
| contextual-tab data + `RIBBON_CONTEXTUAL_TABS` | object literals + array | `contextualTab` |
| `resolveActiveTrigger`/`resolveContextualTrigger` | 2× if-chains (65/35 branches) | `contextualTab.match{ToolIds,EntityTypes}` + escape-hatch για ~5-8 order-sensitive |
| i18n keys (`el`/`en` shell json) | JSON | `i18nKeys` (**refs μόνο**· οι μεταφράσεις μένουν στα locale JSON, N.11) |

### TIER 2 — Καθαρά per-type pure functions → co-location στον descriptor, το switch κάνει delegate (adapter)
| Σημείο | Μηχανισμός | Default (⚠️ διατήρησέ το ρητά) | Descriptor field |
|---|---|---|---|
| `convertEntity` (`dxf-scene-entity-converter`) | switch | warn+null | `toDxf?` |
| `buildEntityModelFromDxf` | switch (exhaustive `never`) | compile-time | `toEntityModel?` |
| `computeBounds` + `calculateEntityBounds` | **διπλότυπο ζεύγος** | `EMPTY` vs warn+`null` (**ασύμμετρα!**) | `bounds?` |
| `performDetailedHitTest` | switch | **optimistic hit** (⚠️ ΟΧΙ null) | `hitTest?` |
| `convertDxfEntityToEntityModel` | switch (delegates `buildBimEntityModel` ✅) | silent minimal (2-layer drop) | `recomputeGeometry?` |
| `rotateEntity` | switch | `{}` no-op | `rotate?` |
| `calculateMovedGeometry` | if-chain + BIM early-return | `{}` no-op | `move?` |
| grips (`computeDxfEntityGrips` + `previewGhost` + `commit`) | switch + if-chains | silent-empty / generic-stretch | `grips?` / `previewGhost?` / `gripCommit?` |

### TIER 3 — React hooks (Rules of Hooks) → ΔΕΝ γίνονται plain data
| Σημείο | Γιατί όχι registry | Ρεαλιστικός στόχος |
|---|---|---|
| `useRibbonXBridge` (~35 hooks) | Hooks καλούνται **άνευ όρων, σταθερή σειρά** — δεν αποθηκεύονται σε data object για conditional invoke | **hooks-array σε ΕΝΑ aggregator** (`useDxfBimBridges`) |
| 4-file threading chain + **~210 if-branches** (`useRibbonCommands`) | glue hook-layer ↔ dispatch | dispatch **data-driven** με `bridgeKey`· τα hook calls μένουν |

**Αυτή η TIER-3 «άρνηση ενοποίησης» είναι ΑΚΡΙΒΩΣ το big-player pattern** (Revit regen / C4D cache / Figma renderer μένουν κεντρικά). Δεν είναι συμβιβασμός — είναι η σωστή αρχιτεκτονική.

### ⚠️ Prerequisite (grip field-bag)
Το ~25-πεδίο optional-bag διπλασιάζεται **4×** (`GripInfo`/`UnifiedGripInfo`/`DxfGripDragPreview`/`EntityPreviewTransform`) + forwarding ceremony → **~8 από τα 18 grip αρχεία υπάρχουν ΜΟΝΟ γι' αυτό**. Κατάρρευση σε **ΕΝΑ generic `gripKind?: string`** = ο μεγαλύτερος, **χαμηλότερου ρίσκου** win — προηγείται των executable grip fields (Φ6).

---

## 4. Decision — το `EntityTypeDescriptor`

**ΕΝΑ `EntityTypeDescriptor`**, **επέκταση** του υπάρχοντος `ENTITY_RENDER_CONTRACTS` (ADR-550), keyed σε `EntityType`. **ΟΧΙ παράλληλο registry.**

```ts
interface EntityTypeDescriptor {
  readonly type: EntityType;                 // canonical key
  readonly category: EntityCategory;         // 'dxf-primitive' | 'bim' | 'annotation'
  readonly render: EntityRenderContract;     // ← ΤΟ ΥΠΑΡΧΟΝ contract (d2/d3/d3Builder/ghost)

  // TIER 2 — optional executable capabilities (adapter σε υπάρχουσες per-type functions).
  // Απόντα ⇒ ο τύπος χρησιμοποιεί την κεντρική/generic engine (όπως d3Builder:'bespoke').
  readonly shapeFamily?: 'centred-box' | 'axis-primitive' | 'footprint-polygon' | 'single-anchor';
  readonly toDxf?: (entity, base) => DxfEntityUnion | null;
  readonly bounds?: (entity) => SpatialBounds;
  readonly rotate?: (entity, pivot, deg) => Partial<Entity>;
  readonly move?: (entity, delta) => Partial<Entity>;
  readonly grips?: (entity) => GripInfo[];
  // ... hitTest?, toEntityModel?, previewGhost?, gripCommit? ...

  // TIER 3 — pointer μόνο (τα hooks μένουν hand-wired hooks-array).
  readonly bridgeKey?: string;

  // TIER 1 — δηλωτικά.
  readonly tool?: { id: ToolType; aliases: readonly string[]; /* … */ };
  readonly ribbonButton?: { panelId; labelKey; icon; commandKey; /* … */ };
  readonly contextualTab?: { commandKeys; matchToolIds; matchEntityTypes; bridgeKey };
  readonly i18nKeys?: { /* key references */ };
}
```

**Αρχές (big-player-faithful, μη διαπραγματεύσιμες):**
1. **Adapter, όχι rewrite** — τα υπάρχοντα switch/functions μένουν· γίνονται οι υλοποιήσεις πίσω από τον descriptor. Το switch κάνει `registry[type].capability(entity)`.
2. **Capability στο descriptor ΜΟΝΟ όπου υπάρχει introspectable seam** (ζωντανός keyed dispatcher). Όπου το dispatch είναι σκόρπιο χωρίς seam (2D ghost, React hooks) → **δεν** μοντελοποιείται ως executable field («θα σάπιζε» — ADR-550).
3. **Optional capabilities + `shapeFamily`** — οι κοινές οικογένειες (centred-box/axis-primitive/…) εξυπηρετούνται από **κεντρικές engines**· μόνο οι bespoke τύποι δίνουν δική τους function. Ίδιο pattern με το `point`/`bespoke` split του ADR-550.
4. **Coverage test ανά capability** (mirror `entity-render-coverage.test.ts`) — δένει τον δηλωτικό descriptor με τα ζωντανά dispatchers· drift → σπάει το build.
5. **Incremental, ένα subsystem τη φορά** — κράτα το switch, δρομολόγησέ το να διαβάζει από το registry, coverage test πράσινο, προχώρα. **ΠΟΤΕ big-bang.**
6. **Per-site defaults κωδικοποιούνται ρητά** — τα ασύμμετρα defaults (optimistic-hit, EMPTY vs null, never-guard) διατηρούνται· ΔΕΝ ομογενοποιούνται σιωπηλά.

---

## 5. Roadmap (φάσεις — έγκριση Giorgio ανά φάση)

| Φ | Τίτλος | Περιεχόμενο | Ρίσκο |
|---|---|---|---|
| **Φ1** ✅ | **Declarative foundation** | `entity-type-descriptor.ts` (`EntityTypeDescriptor` + `ENTITY_DESCRIPTORS` derived από contract + `category`) + coverage test. **Μηδέν αλλαγή dispatcher.** | 🟢 Μηδέν |
| **Φ2** ✅ | **DXF export fact (entity-keyed)** | Απορρόφηση `ENTITY_TYPE_MAPPING` → `descriptor.dxfExportType` (DERIVED, coverage-bound). **Μηδέν αλλαγή συμπεριφοράς.** *(Re-scope: βλ. §5.1 — το tool/ribbon ΔΕΝ είναι entity-keyed.)* | 🟢 Μηδέν |
| **Φ2c** ✅ | **DXF wrapped-field fact** | Απορρόφηση `DXF_WRAPPED_SUBENTITY_FIELD` → `descriptor.dxfWrappedField` (DERIVED, coverage-bound). Ολοκληρώνει τα entity-keyed DXF-serialization facts. **Μηδέν αλλαγή συμπεριφοράς.** | 🟢 Μηδέν |
| **Φ2b** ✅ | **Tool→entity back-link (ToolType-keyed)** | `ToolInfo.createsEntityType?` **DERIVED** από συμπαγή SSoT `TOOL_CREATES_ENTITY` (grouped ανά entity type ώστε το §5.1 fan-out να φαίνεται με μια ματιά· mirror Revit command→category). ~75 tools· ΚΑΘΕ τιμή επαληθευμένη από τον creation κώδικα (factory `type:` literal / drawing-hook commit — ΟΧΙ από όνομα). Deliberate absences (editing/measurement/guide/dim/finish-paint) + surfaced asymmetries (`floorplan-symbol`, `thermal-space`/`space-separator`) καρφωμένα σε coverage. Additive optional field → μηδέν runtime regression. | 🟢 Χαμηλό |
| **Φ3a** ✅ | **Selection-trigger dedup (entity-keyed)** | `resolveContextualTrigger` selection-side: 23× πανομοιότυπα `if (entity.type==='x') return X` → ΕΝΑ δηλωτικό `ENTITY_CONTEXTUAL_TRIGGER` map. Extract σε καθαρό `app/resolve-contextual-trigger.ts` (testable χωρίς stores)· τα kind-refined (mep-fixture/mep-manifold/array) + style-editable fallback μένουν ρητά (escape-hatch, §5). Coverage test partitions τον descriptor domain. **Μηδέν αλλαγή συμπεριφοράς** (type-equality branches αμοιβαία ξένα). | 🟢 Μηδέν |
| **Φ3b-1** ✅ | **Command-keys guard factory (Seam 1)** | 42× `*-command-keys.ts` predicate boilerplate (`const X_KEY_SET = new Set(keys); export function isX(k){ return X_KEY_SET.has(k); }`) → ΕΝΑ shared `makeKeySetGuard` factory. ~111 guards σε 40 αρχεία γίνονται `export const isX = makeKeySetGuard(SOURCE)` (adapter — κάθε named export διατηρείται, ο `useRibbonCommands` τα καλεί ονομαστικά αμετάβλητα). **Μηδέν αλλαγή συμπεριφοράς** (ταυτόσημο Set membership). | 🟢 Χαμηλό |
| **Φ3b-2** ✅ | **Tool-trigger dedup (Seam 2, ToolType-keyed)** | Το tool-active μισό του `useActiveContextualTrigger` (~30 σειριακά `if (activeTool==='x') return X`) → ΕΝΑ `TOOL_ACTIVE_TRIGGER: Map<string, string>` lookup + **escape-hatch** για τα μη-εκφράσιμα (predicates `isWallDrawingTool`/`isColumnRegionTool`, prefixes `guide-`/`dim-`, sticky line-modify). Extract σε καθαρό `app/resolve-tool-active-trigger.ts` (ToolType-keyed SSoT, §5.1)· το hook κρατά ΜΟΝΟ τις stateful pre-rules (animation/selection/multi-select) + τα subscriptions (Rules of Hooks). **Behavior-preserving:** map keys **disjoint** από τα predicate domains → «map-first» ≡ αρχικό interleaved chain (καρφωμένο σε coverage test). | 🟢 Χαμηλό |
| **Φ4** ✅ | **TIER-3 bridge dispatch (data-driven route tables)** | Οι **4 παράλληλες if-chains** (~210 branches) του `useRibbonCommands` (`onComboboxChange`/`getComboboxState`/`getBadgeState`/`getPanelVisibility`) → δηλωτικοί **ordered route tables** + generic runners σε καθαρό `useRibbonCommands-dispatch.ts`. **Ενιαίος combobox route** (matchWrite+matchRead σε ΕΝΑ entry) → write/read **δεν μπορούν να αποκλίνουν** (λύνει το documented ADR-449 bug class). Hook calls μένουν (TIER-3). *Reality correction: το hooks-array aggregator (`useDxfBimBridges`) ΗΔΗ υπήρχε.* | 🟡 Μεσαίο |
| Φ5 | TIER-2 cheap seams | `toDxf`/`toEntityModel`/`bounds`/`rotate`/`move` ως optional executable fields· τα switch κάνουν delegate. Dedupe C1/C2 bounds twins. | 🟡 Μεσαίο |
| Φ6 | Grip field-bag prerequisite | 4× optional-bag → ΕΝΑ generic `gripKind?`. | 🟠 Μεσαίο-υψηλό |
| Φ7 | TIER-2 grips | `grips`/`previewGhost`/`gripCommit` (μετά το Φ6). Τα entity-agnostic `GRIP_GLYPH_REGISTRY`/`HOT_GRIP_OP_REGISTRY` **μένουν ως έχουν** (σωστά agnostic). | 🟠 Υψηλό |
| Φ8 | Proof + cleanup | Dummy type μέσω **μόνο** descriptor → render+select. Αφαίρεση όσων switch έγιναν pure-delegate. | 🟢 Χαμηλό |

### 5.1 Διόρθωση (2026-07-08, βάσει πραγματικού κώδικα) — tool/ribbon = ToolType-keyed, ΟΧΙ entity-keyed

Το G-H audit υπέθεσε καθαρή αντιστοίχιση `entityType → tool`. Η ανάγνωση του `TOOL_DEFINITIONS` **το διέψευσε**: η σχέση είναι **μία οντότητα → ΠΟΛΛΑ tools** (`wall` → 6 · `foundation` → 4 · `mep-fixture` → ~15 · `column` → ~9), με ονόματα tools ≠ ονόματα τύπων (`annotation-symbol` → `north-arrow`). Άρα:

- **Το tool/ribbon/placement layer ΔΕΝ μπαίνει ως πεδίο στον entity descriptor** — θα έχανε πληροφορία ή θα διπλασίαζε. Ζει σωστά στο `TOOL_DEFINITIONS` (ToolType-keyed SSoT). Ο σύνδεσμος tool→οντότητα ανήκει εκεί ως `createsEntityType?` back-reference (Φ2b). Big-player-faithful: το Revit δεν διπλώνει «commands που φτιάχνουν Wall» μέσα στην Wall category.
- **Ο entity descriptor απορροφά μόνο entity-keyed facts**: `category` (Φ1), `dxfExportType` (Φ2), οι per-type functions (Φ5+), και το **selection-side** contextual tab / `bridgeKey` / command-keys (όταν επιλέγεις ΜΙΑ οντότητα → ΕΝΑ tab· entity-keyed — Φ3).

**Success criteria:** νέα οντότητα = 1 descriptor αρχείο (dummy proof)· coverage test σπάει αν subsystem ξεχάσει type· μηδέν regression στα υπάρχοντα (line/wall/annotation-symbol)· jscpd καθαρό.

### 5.2 Layering refinement (2026-07-08, Φ3a) — entity-keyed registry ≠ render-descriptor field

Το §4 sketch δείχνει `contextualTab?` **ως πεδίο μέσα** στο `EntityTypeDescriptor`. Η υλοποίηση της Φ3a το **προσαρμόζει** για λόγο layering (N.0.1 — ο κώδικας/οι περιορισμοί είναι source of truth):

- Ο `EntityTypeDescriptor` ζει στο **`rendering/contract/`** (render layer). Τα contextual-tab **trigger tokens** είναι **UI/ribbon artifacts** (`ui/ribbon/data/*`). Φύτεμά τους ως executable/data πεδίο μέσα στον render descriptor θα **αντέστρεφε** το dependency direction (rendering → UI) — αντι-πρότυπο.
- Άρα το entity-keyed selection-trigger SSoT (`ENTITY_CONTEXTUAL_TRIGGER`) ζει στο **app/ribbon layer** (`app/resolve-contextual-trigger.ts`), και **δένεται στον descriptor domain** (`RENDERABLE_ENTITY_TYPES`) μέσω **coverage test**, ΟΧΙ μέσω import μέσα στον descriptor. Είναι **ακριβώς** η σχέση που έχει ήδη το `category`: δένεται με τα `BIM_RENDERABLE_TYPES` χωρίς ο descriptor να «κατέχει» τη λίστα.
- **Big-player-faithful:** ίδια αρχή με §5.1 (tool/ribbon = ToolType-keyed, ζει στο `TOOL_DEFINITIONS`). Ο descriptor είναι το **σημείο αναφοράς domain + completeness**, όχι ο ιδιοκτήτης κάθε UI surface. Ο κανόνας «νέα οντότητα → coverage σε σπάει αν ξεχάσεις tab» διατηρείται πλήρως.

**Files (Φ3a):** NEW `app/resolve-contextual-trigger.ts` (`ENTITY_CONTEXTUAL_TRIGGER` + `resolveContextualTrigger` + `readParamsKind`, extracted pure) · NEW `app/__tests__/resolve-contextual-trigger-coverage.test.ts` (11 tests) · MOD `app/ribbon-contextual-config.ts` (−84 lines resolver + 23 branches → import/re-export· καθαρισμός resolver-only imports· 459 → ~360 lines).

---

## 6. Consequences

- ✅ **SSoT**: ένα σημείο ορίζει τι είναι μια οντότητα· completeness εγγυημένο σε presubmit.
- ✅ **Big-player-faithful**: δηλωτικό registry + κεντρικές engines, ακριβώς όπως Revit/C4D/Figma.
- ✅ **Incremental & test-guarded**: κάθε φάση ανεξάρτητα shippable, μηδέν big-bang.
- ⚠️ **TIER-3 δεν εξαλείφεται πλήρως** — τα hooks μένουν hand-wired (Rules of Hooks). Αυτό είναι **σωστό**, όχι έλλειψη.
- ⚠️ **Λανθάνουσες ασυμμετρίες** που το registry αναδεικνύει (π.χ. `isBimEntityType` δεν έχει `stair`· C1/C2 defaults ασύμμετρα) καρφώνονται σε coverage tests και διορθώνονται σε δικές τους φάσεις — **όχι** στη Φ1.

---

## 7. Changelog

| Ημ/νία | Model | Αλλαγή |
|---|---|---|
| 2026-07-08 | Opus 4.8 | **Φ1 recognition + design + roadmap.** SSoT audit (4 parallel readers στα ~40 σημεία) + web research (Maxon/Revit/Figma) → τριπλή επιβεβαίωση big-player hybrid. Ταξινόμηση σε 3 TIERS. ADR δημιουργήθηκε. Έγκριση Giorgio (ambition = big-player practice· scope = ADR + Φ1). |
| 2026-07-08 | Opus 4.8 | **Φ1 IMPLEMENTED (UNCOMMITTED).** NEW `rendering/contract/entity-type-descriptor.ts`: `EntityCategory`, `EntityTypeDescriptor` (Φ1 = `type`+`category`+`render`), `ENTITY_DESCRIPTORS` **derived** από `ENTITY_RENDER_CONTRACTS` (μηδέν νέο hand-maintained Record), `descriptorOf`/`entityCategoryOf`. NEW `__tests__/entity-descriptor-coverage.test.ts`: completeness + no-drift (render === contract) + category consistency (bim⟺`BIM_RENDERABLE_TYPES`) + **pinned `isBimEntityType` stair-gap** (documented latent asymmetry). Μηδέν αλλαγή dispatcher/συμπεριφοράς. jest 9/9 ✅. |
| 2026-07-08 | Opus 4.8 | **Φ2 IMPLEMENTED (UNCOMMITTED) + roadmap correction (§5.1).** `+dxfExportType` στο descriptor, **DERIVED** από `ENTITY_TYPE_MAPPING` (μηδέν αντίγραφο). Coverage +3: no-drift (=== mapping) + bim⟹null + annotation⟹null. **Διόρθωση βάσει κώδικα:** το tool/ribbon layer είναι **ToolType-keyed** (μία οντότητα→πολλά tools) → ΔΕΝ μπαίνει στον entity descriptor· ο σύνδεσμος πάει στο `TOOL_DEFINITIONS` ως `createsEntityType` (νέο Φ2b). Ο descriptor απορροφά μόνο entity-keyed facts. Μηδέν αλλαγή συμπεριφοράς. jest 12/12 ✅· render-coverage regression ✅· jscpd καθαρό. |
| 2026-07-08 | Opus 4.8 | **Φ2c IMPLEMENTED (UNCOMMITTED).** `+dxfWrappedField?` στο descriptor, **DERIVED** από `DXF_WRAPPED_SUBENTITY_FIELD` (5 wrapped variants· `undefined` για direct). Το `dxf-types.ts` έχει μόνο `import type` → μηδέν runtime coupling/cycle. Coverage +2: no-drift + wrapped-set === keys του SSoT. Ολοκληρώνει τα entity-keyed DXF-serialization facts (export+wrapped). Μηδέν αλλαγή συμπεριφοράς. jest 14/14 ✅· jscpd καθαρό. |
| 2026-07-08 | Opus 4.8 | **Φ3b-2 IMPLEMENTED (UNCOMMITTED) — tool-trigger dedup (Seam 2, ToolType-keyed).** Το **tool-active** μισό του `useActiveContextualTrigger` (~30 σειριακά `if (activeTool==='x'\|\|…) return X_TRIGGER`, ~103 γραμμές) → ΕΝΑ δηλωτικό `TOOL_ACTIVE_TRIGGER: ReadonlyMap<string,string>` lookup + **escape-hatch** για τα μη-εκφράσιμα-ως-πίνακα: predicates (`isWallDrawingTool`/`isColumnRegionTool`), prefixes (`guide-`/`dim-`), sticky line-modify (`isLineModifyTool` → `lastNonModifyTrigger`). SSoT audit (grep) επιβεβαίωσε τα υπάρχοντα `region-tool-ids` predicates → **επεκτάθηκαν, δεν διπλασιάστηκαν**. NEW `app/resolve-tool-active-trigger.ts` (ToolType-keyed pure module, mirror του Φ3a selection-side)· το `LINE_MODIFY_TOOLS` set + `isLineModifyTool` μετακόμισαν εκεί ως SSoT (τα διαβάζει ΚΑΙ ο resolver ΚΑΙ ο «record last-non-modify» effect του hook). `ribbon-contextual-config.ts`: το if-chain → `return resolveToolActiveTrigger(activeTool, lastNonModifyTriggerRef.current)`· καθαρισμός 22 resolver-only `*_TRIGGER` imports (split από τα shared tab imports) + `isColumnRegionTool`/`isWallDrawingTool`/`LINE_MODIFY_TOOLS`. **Layering (§5.2, mirror Φ3a):** ο πίνακας ζει στο app layer (trigger tokens = UI artifacts)· ο hook κρατά ΜΟΝΟ τις stateful pre-rules (animation/wire-circuit/mixed-electrical/mixed-plumbing/multi-BIM/selection-side) + τα store subscriptions/useMemo/useRef/useEffect (Rules of Hooks — §TIER3). **Behavior-preserving by construction:** τα static map keys είναι **disjoint** από τα predicate/prefix domains → το «map-first, μετά predicates» δίνει ΑΚΡΙΒΩΣ το ίδιο με το αρχικό interleaved chain (η disjointness + escape-hatch behavior καρφώνονται σε coverage test). NEW `__tests__/resolve-tool-active-trigger-coverage.test.ts` (10 tests: map entries + escape-hatch + **disjointness invariant** + golden pins + unknown→null). jest 10/10 ✅· Φ3a regression 11/11 ✅· structural-tab 14/14 ✅· jscpd καθαρό (3 files). **Seam 1 + Seam 2 του Φ3b ΟΛΟΚΛΗΡΩΘΗΚΑΝ.** |
| 2026-07-08 | Opus 4.8 | **Φ3b-1 IMPLEMENTED (UNCOMMITTED) — command-keys guard factory (Seam 1).** Το predicate boilerplate `const X_KEY_SET: ReadonlySet<string> = new Set<string>(SOURCE); export function isX(k){ return X_KEY_SET.has(k); }` επαναλαμβανόταν ~111× σε 42 `*-command-keys.ts` (name-blind jscpd structural clone· CHECK 3.18 τυφλό, N.18/jscpd το έπιανε). SSoT audit (grep) → **δεν υπήρχε** shared guard factory. NEW `ui/ribbon/hooks/bridge/make-key-set-guard.ts`: `makeKeySetGuard<K extends string>(keys: Iterable<K>): (key: string) => key is K` (type predicate → διατηρεί ΚΑΙ τα boolean guards ΚΑΙ τα ήδη narrowing guards π.χ. `isMepFixtureVisibilityKey`, χωρίς downgrade). 40 αρχεία (line-tool = `.includes()` όχι Set· stair = deprecated re-export barrel — σωστά ανέγγιχτα· `.includes()`/`===` single-key guards εκτός scope) → `export const isX = makeKeySetGuard(SOURCE)`. **Adapter: κάθε named export (`isXRibbonKey` κλπ) διατηρείται** ώστε ο `useRibbonCommands` composer να τα καλεί ονομαστικά αμετάβλητα. 1 εξαγόμενο `MEP_BOILER_STRING_KEY_SET` (μηδέν external importers) folded. **Μηδέν αλλαγή συμπεριφοράς** (ταυτόσημο Set membership by construction). NEW `__tests__/make-key-set-guard.test.ts` (factory semantics + table-driven ≡ Set membership για όλους τους pilot guards). Pilot (annotation-symbol + mep-fixture + wall) → 3 parallel sonnet subagents στα υπόλοιπα 39 (disjoint batches). jest: bridge command-keys **172/172 (19 suites)** πράσινα (beam/slab/roof regression ✅)· jscpd:diff **43 files καθαρά** (μηδέν νέα clones· τα προϋπάρχοντα cross-file boilerplate clones εξαλείφθηκαν → CI full-scan θα δει < baseline 4548). **Seam 2** (`resolveActiveTrigger` tool-path, ToolType-keyed §5.1) = Φ3b-2, αναμονή. |
| 2026-07-08 | Opus 4.8 | **Φ4 IMPLEMENTED (UNCOMMITTED) — TIER-3 bridge dispatch → data-driven route tables.** SSoT audit (code = source of truth) διόρθωσε την υπόθεση του roadmap: (α) το **hooks-array aggregator `useDxfBimBridges` ΗΔΗ υπάρχει** (Part A done)· (β) το `useRibbonCommands` **δεν καλεί** τα ~35 `useRibbonXBridge` hooks — τα δέχεται **ως props** (ήδη-resolved bridge objects, hooks καλούνται upstream — Rules of Hooks/TIER-3 ανέγγιχτα). Το πραγματικό Φ4 = οι **4 παράλληλες if-chains** (`onComboboxChange` ~31 branches, `getComboboxState` ~31, `getBadgeState` 9, `getPanelVisibility` 15) → δηλωτικοί **ordered route tables** + generic runners (`dispatchComboboxWrite`/`Read`/`dispatchSimple`) σε καθαρό `useRibbonCommands-dispatch.ts` (pure, testable χωρίς React — mirror Φ3a/Φ3b-2). **Κρίσιμο correctness win:** ο combobox route ενοποιεί write+read σε ΕΝΑ entry (`matchWrite`+`matchRead`) → οι δύο **δεν μπορούν να αποκλίνουν** — τα σχόλια ADR-449 στο ίδιο αρχείο τεκμηρίωναν ακριβώς το αντίθετο bug («ο composer ξεχνούσε key σε μία αλυσίδα»). Η μόνη νόμιμη ασυμμετρία (read-only **readout** keys: hatch/column-structural/radiator/boiler) κωδικοποιείται ρητά ως `matchRead ⊇ matchWrite` (per-site default). **Order-preserving** (route array = αρχική σειρά chain → first-match ≡ αρχικό). Perf: ΕΝΑ `bridges` bag → `routeTables` useMemo (deps = `Object.values`, τα 30 ids γραμμένα μία φορά → jscpd καθαρό)· `getComboboxState` ίδια churn cadence (30 bridges)· `getBadgeState`/`getPanelVisibility` καταναλώνονται μόνο στο layout-effect (ήδη churns σε 30) → μηδέν επιπλέον re-render (ADR-547 preserved). `onAction`/toggle/layout-effect/return **ανέγγιχτα**. NEW `useRibbonCommands-dispatch.ts` (335γρ) + `__tests__/useRibbonCommands-dispatch.test.ts` (10 tests: completeness 31/9/15 + no-drift invariant [27 same-ref, 4 readout] + runner semantics + real-key routing/readout-asymmetry/fallback). `useRibbonCommands.ts` 468→262γρ (−44%, οι ~40 guard imports μετακόμισαν στο dispatch module). jest: dispatch 10/10 + ribbon sweep **573/573 (48 suites)** πράσινα· jscpd:diff καθαρό (3 files). |
| 2026-07-08 | Opus 4.8 | **Φ2b IMPLEMENTED (UNCOMMITTED) — tool→entity back-link (ToolType-keyed §5.1).** SSoT audit (grep) επιβεβαίωσε ότι **δεν υπήρχε** tool→entityType map· ο `createEntityFromTool` καλύπτει μόνο CAD primitives, τα BIM/MEP δημιουργούνται από dedicated hooks/factories. **3 parallel read-only Explorers (haiku)** επαλήθευσαν το tool→`type` mapping από τον πραγματικό creation κώδικα (factory `type:` literal ή drawing-hook commit — ΟΧΙ από το όνομα): π.χ. `north-arrow`→`annotation-symbol`, `mep-drainage-collector`→`mep-manifold` (kind), `mep-comms-rack`→`electrical-panel` (kind), `mep-drain-riser`→`mep-segment`, 16 fixture tools→`mep-fixture`. NEW συμπαγής SSoT `TOOL_CREATES_ENTITY: Partial<Record<ToolType, RenderableEntityType>>` (~75 entries grouped ανά entity type ώστε το «μία οντότητα ⇐ πολλά tools» να φαίνεται με μια ματιά — mirror Revit command→category table, ΟΧΙ πεδίο σκορπισμένο σε 6 wall entries). `ToolInfo.createsEntityType?` **DERIVED** από τον χάρτη με module-load loop (mirror Φ2 `dxfExportType`⇐`ENTITY_TYPE_MAPPING`· η μία πηγή παράγει την άλλη → μηδέν drift· `import type` only → μηδέν runtime cycle). **Deliberate absences** (τεκμηριωμένες): editing/selection/zoom/utility/attach (τροποποιούν), `measurement` category (analysis artifacts), `guide-*` (construction guides όχι scene entities), `dim-*`/`auto-dim-cutline` (dimension subsystem· center-mark/centerline ΔΕΝ είναι RenderableEntityTypes), `finish-paint` (per-face override), `ellipse`/`arc`-dropdown (χωρίς verified creation). **Surfaced asymmetry (§6):** `floorplan-symbol` — έχει tool + `FloorplanSymbolRenderer` αλλά ο τύπος ΛΕΙΠΕΙ από το ADR-550 `RENDERABLE_ENTITY_TYPES` (αποδίδεται μέσω entity-model path)· εξαιρέθηκε + καρφώθηκε ως χωριστό ADR-550 follow-up (fix εδώ θα ripple-άριζε στο render-coverage contract). **Entity-side gaps:** `thermal-space`/`space-separator` δημιουργούνται από μη-`ToolType` hooks → χωρίς back-link (καρφωμένα). NEW `systems/tools/__tests__/tool-creates-entity-coverage.test.ts` (13 tests: validity + key-validity + derivation no-drift + §5.1 fan-out golden pins + deliberate absences + surfaced-asymmetry pins). Additive optional field → **μηδέν runtime regression**. jest 13/13 ✅· sibling descriptor 14/14 + tool-active-trigger 10/10 + selection-trigger 11/11 ✅· jscpd:diff καθαρό (2 files). |
| 2026-07-08 | Opus 4.8 | **Φ3a IMPLEMENTED (UNCOMMITTED) + layering refinement (§5.2).** Selection-side `resolveContextualTrigger`: **23 πανομοιότυπα** `if (entity.type==='x') return X` → ΕΝΑ δηλωτικό `ENTITY_CONTEXTUAL_TRIGGER` map (SSoT). **Extract** του resolver + map + `readParamsKind` σε **καθαρό** module `app/resolve-contextual-trigger.ts` (testable χωρίς React/zustand/stores)· `ribbon-contextual-config.ts` το κάνει import + re-export (public API σταθερό), −84 γραμμές, καθαρισμός 20 resolver-only imports. Τα **kind-refined** (mep-fixture/mep-manifold/array via `params.kind`) + **style-editable** primitives fallback μένουν ρητά (escape-hatch §5). **Μηδέν αλλαγή συμπεριφοράς** — τα type-equality branches είναι αμοιβαία ξένα, άρα το hoisting + map lookup είναι behavior-preserving by construction. **Layering (§5.2):** το registry ζει στο app/ribbon layer (τα trigger tokens είναι UI artifacts· render descriptor δεν κάνει import UI), δεμένο στον descriptor domain μέσω coverage — ίδια σχέση με το `category`↔`BIM_RENDERABLE_TYPES`. NEW `resolve-contextual-trigger-coverage.test.ts`: partition (union===domain + disjoint) + no-drift + golden pins + kind-refined behavior. jest 11/11 ✅· descriptor 14/14 ✅· structural-tab 14/14 ✅· jscpd καθαρό. |
