# 🚰 HANDOFF — Αποχέτευση (ADR-408 Φ14): Drainage Fittings — V/G + χρώμα consistency (STEP 2)

> **Σύνταξη:** Opus, 2026-06-07. Session σε **Plan Mode** — έγινε ΜΟΝΟ research, **ΚΑΜΙΑ αλλαγή κώδικα**.
> **Ρόλος επόμενου agent:** agent της ΑΠΟΧΕΤΕΥΣΗΣ (ADR-408 Φ14). ΟΧΙ καλοριφέρ/θέρμανση (codex agent, ίδιο tree).
> **Πηγή:** συνέχεια του `C:\Nestor_Pagonis\HANDOFFS\handoff-drainage-fittings-vg-2026-06-07.md`.

---

## ⚠️ ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (αμετάβλητοι)
- **SHARED working tree** με codex (heating) → `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **ΟΧΙ commit / ΟΧΙ push** — ο Giorgio κάνει commit (N.(-1)). Εσύ μόνο προετοιμάζεις + αναφέρεις.
- Απαντάς **στα Ελληνικά**. Quality: **FULL ENTERPRISE + FULL SSOT, Revit-grade**.
- N.14: Plan Mode + Opus, δήλωσε μοντέλο + περίμενε «ok».

---

## 1) CONTEXT — γιατί γίνεται αυτό

Τα **auto-fittings** (`mep-fitting`: γωνίες/ταυ/συστολές/καπάκια που παράγει αυτόματα ο reconciler στους
κόμβους σωλήνων, ADR-408 Φ11) **δεν ξέρουν ότι ανήκουν σε δίκτυο αποχέτευσης**. Δύο συμπτώματα, **μία ρίζα**:

1. **V/G**: παίρνουν `BimCategory = fitting.params.domain = 'pipe'` → ένα drainage elbow **ΔΕΝ κρύβεται** με
   το νέο toggle «Αποχέτευση» (`'drain-pipe'`), ενώ ο σωλήνας δίπλα του κρύβεται → ασυνέπεια.
2. **Χρώμα**: render-άρονται amber/copper (domain palette), **ΟΧΙ καφέ** σαν τον σωλήνα αποχέτευσης.

**Ρίζα:** το fitting δεν φέρει `classification`. Είναι όμως **παραγώγιμη** από τα incident pipes
(`incidents[].entityId` = FK στα γειτονικά `mep-segment`). Revit: «το fitting ανήκει στο Pipe System των
σωλήνων που ενώνει — source/system owns, fitting inherits».

**Επιθυμητό αποτέλεσμα:** drainage fitting → κρύβεται με το toggle «Αποχέτευση» + καφέ στο 2D, ίδιο με τον
σωλήνα. Idempotency του reconciler (diff BY `junctionKey`) **ΑΝΕΠΑΦΟ**.

---

## 2) ΤΙ ΕΓΙΝΕ ΣΕ ΑΥΤΗ ΤΗ SESSION (research μόνο)

Διαβάστηκαν & κατανοήθηκαν πλήρως τα εξής (καμία αλλαγή):

| Αρχείο | Τι μάθαμε |
|---|---|
| `bim/types/mep-fitting-types.ts` | `MepFittingParams` (ΔΕΝ έχει `classification`). `MepFittingIncident.entityId` + helper `incidentEntityId()`. |
| `bim/types/mep-segment-types.ts` | **ΠΡΟΤΥΠΟ:** `resolveSegmentBimCategory(params)` (γρ.361) — `domain==='pipe' && classification==='sanitary-drainage' → 'drain-pipe'`, αλλιώς `domain`. `MepSegmentParams.classification?: PlumbingSystemClassification` (γρ.110). |
| `bim/mep-systems/mep-system-color.ts` | **ΠΡΟΤΥΠΟ χρώματος:** `resolveSegmentClassificationColor(classification)` (γρ.92) → drainage `#b45309` καφέ, αλλιώς `null`. |
| `bim/renderers/MepSegmentRenderer.ts` | **ΠΡΟΤΥΠΟ precedence (γρ.142-149):** `systemColor ?? resolveSegmentClassificationColor(params.classification) ?? DOMAIN_STROKE[domain]`. category μέσω `resolveSegmentBimCategory` (γρ.112). |
| `bim/renderers/MepFittingRenderer.ts` | **TARGET 2D.** Σήμερα: `category: fitting.params.domain` (γρ.90)· χρώμα `systemColor ?? DOMAIN_STROKE[domain]` (γρ.115-116). `DOMAIN_STROKE.pipe='#b45309'` ήδη (αλλά μέσω domain, όχι classification). |
| `bim-3d/scene/sync-mep-elements.ts` | **TARGET 3D.** `syncFittings` (γρ.89): `const category = fitting.params.domain as BimCategory`. `syncMepSegments` (γρ.55) ήδη χρησιμοποιεί `resolveSegmentBimCategory`. **3D χρώμα segment = ΜΟΝΟ systemColor** (όχι classification) → για parity, το 3D fitting αλλάζει **ΜΟΝΟ category**, ΟΧΙ χρώμα/material. |
| `bim/mep-fittings/mep-fitting-resolve.ts` | **TARGET inheritance.** `resolveDesiredFittings(entities)` → `derivePipeJunctions` → `toDraft` → `buildParams`. Έχει πρόσβαση σε ΟΛΑ τα `entities`. Εδώ χτίζεται το `MepFittingParams`. |
| `bim/mep-systems/mep-pipe-junctions.ts` | `PipeJunction.incidents[].entityId` = FK στο segment. `junctionKey` quantized θέση — ΔΕΝ περιέχει classification (καλό για idempotency). |
| `bim/mep-fittings/mep-fitting-classify.ts` | Καθαρή τοπολογία (kind). Host incidents → `kind:null` (no fitting). |
| `hooks/data/useMepFittingAutoReconciliation.ts` | Reconcile diff BY `junctionKey`. Update όταν `!dequal(doc.params, draft.params)`. → Η προσθήκη `classification` στα params προκαλεί **ένα one-time update** των persisted fittings (αναμενόμενο migration), **χωρίς create/delete churn** (το `junctionKey` δεν αλλάζει). `desiredSignature` = junctionKey→params (no-op short-circuit παραμένει σωστό). |
| `bim/types/mep-fitting.schemas.ts` | zod `MepFittingParamsSchema` `.strict()` — **πρέπει** να προστεθεί `classification` αλλιώς strict validation κόβει το νέο πεδίο. |
| `bim/types/mep-segment.schemas.ts` | **ΠΡΟΤΥΠΟ zod:** `classification: PlumbingSystemClassificationSchema.optional()` (import από `./mep-connector.schemas`). |
| `bim/mep-fittings/mep-fitting-firestore-service.ts` | `params: input.params` passthrough → το `classification` αποθηκεύεται. **Conditional attach μόνο όταν defined** (Firestore απορρίπτει `undefined`). |
| `bim/types/__tests__/mep-segment-category.test.ts` | **ΠΡΟΤΥΠΟ test placement** για `resolveSegmentBimCategory`. |

**Συμπέρασμα:** Approach A (stamp classification στο fitting κατά το auto-reconciliation) επικυρώθηκε ως ο
καθαρός/SSOT/Revit-true δρόμος. Approach B (render-time scene lookup) απορρίφθηκε (οι renderers δεν έχουν εύκολο scene access).

---

## 3) ⛔ ΑΝΟΙΧΤΗ ΑΠΟΦΑΣΗ (ο Giorgio ΔΕΝ απάντησε — ζήτησε αυτό το handoff αντ' αυτού)

**Εύρος inheritance του classification στο fitting:**

- **Επιλογή A — Μόνο αποχέτευση** (handoff-faithful, χαμηλό ρίσκο): αν ≥1 incident είναι `sanitary-drainage`
  → fitting drainage. Τα υπόλοιπα fittings μένουν amber. **ΣΥΝΙΣΤΩΜΕΝΟ default** (το αρχικό handoff αυτό ζητά).
- **Επιλογή B — Γενικό** (πιο Revit-true/SSOT): το fitting κληρονομεί ΟΠΟΙΑΔΗΠΟΤΕ classification (κρύο→μπλε,
  ζεστό→κόκκινο, drainage→καφέ). Αλλάζει & το χρώμα standalone fittings ύδρευσης/θέρμανσης (παρενέργεια εκτός scope).

> **Ο επόμενος agent ΠΡΕΠΕΙ να ρωτήσει τον Giorgio** (AskUserQuestion) ποια επιλογή πριν υλοποιήσει.
> Το design παρακάτω γράφεται **γενικευμένο** (helper `resolveFittingClassification`) ώστε A & B να διαφέρουν
> σε **1 γραμμή** (drainage-only φίλτρο vs «πρώτη classification»). Σε mixed κόμβο: **drainage υπερισχύει** (είναι η
> μόνη με ξεχωριστό V/G bucket). Default υλοποίησης αν ο Giorgio δεν διευκρινίσει: **A (μόνο αποχέτευση)**.

---

## 4) DESIGN — βήμα-βήμα (Approach A, FULL SSOT)

### (α) Types — `bim/types/mep-fitting-types.ts`
1. `import type { PlumbingSystemClassification } from './mep-connector-types';` + `import type { BimCategory } from '../../config/bim-object-styles';` (mirror segment-types).
2. Πρόσθεσε στο `MepFittingParams` (μετά το `secondaryDiameterMm`):
   ```ts
   /** Plumbing classification inherited from the incident pipes (ADR-408 Φ14). Mirror of
    * MepSegmentParams.classification — drives V/G category + standalone colour. */
   readonly classification?: PlumbingSystemClassification;
   ```
3. NEW SSoT (mirror `resolveSegmentBimCategory`):
   ```ts
   export function resolveFittingBimCategory(params: MepFittingParams): BimCategory {
     if (params.domain === 'pipe' && params.classification === 'sanitary-drainage') return 'drain-pipe';
     return params.domain;
   }
   ```

### (β) Zod — `bim/types/mep-fitting.schemas.ts`
- `import { MepConnectorSchema, PlumbingSystemClassificationSchema } from './mep-connector.schemas';`
- Στο `MepFittingParamsSchema` πρόσθεσε: `classification: PlumbingSystemClassificationSchema.optional(),`

### (γ) Inheritance στον resolver — `bim/mep-fittings/mep-fitting-resolve.ts`
- NEW pure helper `buildPipeClassificationIndex(entities): Map<string, PlumbingSystemClassification>`
  (segment.id → classification, μόνο pipe segments με defined classification).
- NEW pure SSoT helper:
  ```ts
  export function resolveFittingClassification(
    incidents: readonly MepFittingIncident[],
    index: ReadonlyMap<string, PlumbingSystemClassification>,
  ): PlumbingSystemClassification | undefined {
    const classes = incidents
      .filter((i) => !i.host)
      .map((i) => index.get(incidentEntityId(i)))
      .filter((c): c is PlumbingSystemClassification => c !== undefined);
    if (classes.length === 0) return undefined;
    if (classes.includes('sanitary-drainage')) return 'sanitary-drainage'; // drainage wins
    // ── Επιλογή A: επίστρεψε undefined εδώ (μόνο αποχέτευση).
    // ── Επιλογή B: return classes[0]; (γενικό inheritance).
    return undefined; // DEFAULT = A
  }
  ```
- Στο `resolveDesiredFittings`: χτίσε το index μία φορά, πέρασέ το `toDraft → buildParams`.
- Στο `buildParams`: υπολόγισε `const classification = resolveFittingClassification(junction.incidents, classByEntityId);`
  και **conditional attach** (exactOptionalPropertyTypes-safe, όπως ήδη γίνεται με `secondaryDiameterMm`/`elbowStyle`):
  `classification !== undefined ? { ...p, classification } : p`.
- ⚠️ **ΜΗΝ** βάλεις το classification στο `junctionKey` (idempotency).

### (δ) 2D renderer — `bim/renderers/MepFittingRenderer.ts`  ← **STAGE ADR-040 (CHECK 6D)**
- import `resolveFittingBimCategory` (από mep-fitting-types) + `resolveSegmentClassificationColor` (από mep-system-color).
- γρ.90: `category: fitting.params.domain` → `category: resolveFittingBimCategory(fitting.params)`.
- Χρώμα (mirror segment precedence γρ.115-116):
  ```ts
  const baseColor = systemColor ?? resolveSegmentClassificationColor(fitting.params.classification ?? undefined);
  const strokeColor = baseColor ?? DOMAIN_STROKE[domain];
  const fillColor = baseColor ? hexToRgba(baseColor, SYSTEM_FILL_ALPHA) : DOMAIN_FILL[domain];
  ```

### (ε) 3D sync — `bim-3d/scene/sync-mep-elements.ts`
- import `resolveFittingBimCategory`.
- `syncFittings` γρ.89: `const category = fitting.params.domain as BimCategory;` → `const category = resolveFittingBimCategory(fitting.params);`
- **ΧΩΡΙΣ αλλαγή χρώματος/material** — το 3D segment χρωματίζεται μόνο από systemColor (parity· επιβεβαιωμένο). Μόνο visibility/category.

---

## 5) TESTS
- **NEW** `bim/types/__tests__/mep-fitting-category.test.ts` (mirror `mep-segment-category.test.ts`):
  `resolveFittingBimCategory` → drainage→'drain-pipe', pipe→'pipe', duct→'duct'.
- **NEW/append** test για `resolveFittingClassification`: drainage όταν ≥1 incident drainage· `undefined` όταν κανένα·
  drainage precedence σε mixed· αγνοεί host incidents.
- **Append** στο `bim/mep-fittings/__tests__/mep-fitting-resolve.test.ts`: fitting σε κόμβο drainage pipes →
  `params.classification === 'sanitary-drainage'`· **idempotency**: ίδιο `junctionKey` set (αμετάβλητο).
- **Regression:** `npx jest src/subapps/dxf-viewer/bim/mep-fittings src/subapps/dxf-viewer/bim/mep-systems src/subapps/dxf-viewer/bim/types --silent`.

---

## 6) ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΑΓΓΙΞΕΙΣ (git add ΜΟΝΟ αυτά)
1. `src/subapps/dxf-viewer/bim/types/mep-fitting-types.ts`
2. `src/subapps/dxf-viewer/bim/types/mep-fitting.schemas.ts`
3. `src/subapps/dxf-viewer/bim/mep-fittings/mep-fitting-resolve.ts`
4. `src/subapps/dxf-viewer/bim/renderers/MepFittingRenderer.ts`  **+ STAGE ADR-040**
5. `src/subapps/dxf-viewer/bim-3d/scene/sync-mep-elements.ts`
6. `src/subapps/dxf-viewer/bim/types/__tests__/mep-fitting-category.test.ts` (NEW)
7. `src/subapps/dxf-viewer/bim/mep-fittings/__tests__/mep-fitting-resolve.test.ts` (append)
8. `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` (changelog 1 γρ. — για CHECK 6D)

> **CHECK 6D**: το `MepFittingRenderer.ts` είναι 2D entity renderer → απαιτεί staged ADR/doc. Πρόσθεσε σύντομη
> γραμμή changelog στο ADR-040 (ή stage ADR-408 ως doc — οποιοδήποτε ADR/doc αρκεί).

---

## 7) ΕΛΕΓΧΟΙ
- tsc (own): `npx tsc --noEmit 2>&1 | rg "mep-fitting|sync-mep-elements|MepFittingRenderer" ; echo done`
  (αγνόησε pre-existing: `mesh-to-object3d.ts:124` ADR-411· τυχόν `mep-radiator`/`mep-boiler` του codex).
- Browser verify: σχεδίασε 2 drainage pipes που ενώνονται σε γωνία → το auto elbow (α) **καφέ** στο 2D,
  (β) **κρύβεται** με toggle «Αποχέτευση», (γ) ίδια συμπεριφορά με τους σωλήνες· water/heating fittings αμετάβλητα (Επιλογή A).

## 8) TRACKERS @ commit boundary (N.15 — κάνει ο Giorgio)
`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-408 changelog (SHARED, additive) + memory `project_adr408_phi14_drainage.md`.
**ΟΧΙ** `adr-index.md` (shared tree).

## 9) Σχετικές μνήμες
`project_adr408_phi14_drainage` (master), `project_adr408_phi11_auto_fittings` (reconciler/idempotency),
`project_adr408_mep_connectors_systems` (color-by-system).

---

## 📌 ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΕΠΟΜΕΝΟΥ AGENT
1. Ρώτησε τον Giorgio: **Επιλογή A (μόνο αποχέτευση) ή B (γενικό);** πριν γράψεις τη γραμμή στο `resolveFittingClassification`.
2. Υλοποίησε §4 → §5 → έλεγχοι §7 → ανάφερε (ΟΧΙ commit).
