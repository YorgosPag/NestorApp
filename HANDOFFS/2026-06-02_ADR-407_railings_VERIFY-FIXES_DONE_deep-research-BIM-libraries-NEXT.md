# HANDOFF — ADR-407 Railings VERIFY-SESSION (3 bugs fixed) · NEXT = deep-research «δωρεάν BIM βιβλιοθήκες»

**Ημερομηνία:** 2026-06-02
**Συντάκτης:** Opus 4.8 (browser-verify session του Φ1 railings)
**Γλώσσα:** Ελληνικά πάντα. **Commit/push:** ΜΟΝΟ ο Giorgio (N.-1) — ο agent ΔΕΝ κάνει commit.
**⚠️ SHARED working tree** με άλλον agent → `git add` **μόνο specific αρχεία**, ΠΟΤΕ `git add -A`. Verify `git diff --cached` πριν commit.

---

## 🎯 ΤΟ ΕΠΟΜΕΝΟ TASK (νέα συνεδρία) — DEEP RESEARCH

**Ερώτημα Giorgio (refined):** Υπάρχουν **εντελώς δωρεάν** βιβλιοθήκες BIM που:
1. **ΔΕΝ** απαιτούν να δημοσιεύσει τον κώδικά του (→ permissive license: **MIT / Apache-2.0 / BSD / CC0 / public-domain**· ΟΧΙ GPL/LGPL/AGPL)
2. **ΔΕΝ** θέλουν αγορά ή συνδρομή
3. Μπορούμε να τις **εγκαταστήσουμε/ενσωματώσουμε στην εφαρμογή** (κλειστό εμπορικό app) **με δικαίωμα αναδιανομής (redistribution)**
4. Ώστε **ο χρήστης να επιλέγει** στοιχεία (catalog μέσα στο app)

**Η κρίσιμη παγίδα που εντοπίστηκε:** «δωρεάν να κατεβάσω» ≠ «ελεύθερο να αναδιανείμω μέσα στο app μου». Οι content πλατφόρμες (BIMobject, NBS, Polantis, MEPcontent) είναι δωρεάν για **δικά σου έργα**, αλλά το **ToS τους σχεδόν πάντα απαγορεύει bundling/redistribution** σε δικό σου προϊόν.

**Framing που δόθηκε ήδη στον Giorgio (επιβεβαίωσε/εμβάθυνε με research):**
- **(1) Κώδικας/engines (MIT):** `web-ifc` / **ThatOpen** (MIT) → import IFC, ο χρήστης φέρνει δικό του περιεχόμενο. Ταιριάζει με το υπάρχον **three.js** stack. ❌ απόφυγε: **xeokit** (AGPL), **IfcOpenShell** (LGPL-3), **Open CASCADE** (LGPL+exception).
- **(2) Public-domain ΔΕΔΟΜΕΝΑ → παραμετρικοί κατάλογοι (ο ισχυρότερος δρόμος):** πρότυπα προφίλ (χάλυβας HEA/HEB/IPE, Eurocode/DIN/ANSI διαστάσεις) = δημόσια μηχανική γνώση, κωδικοποιούνται ως params (ΕΙΝΑΙ ήδη η αρχιτεκτονική: ADR-407 RailingType, columns/beams parametric). «Ο χρήστης επιλέγει» = presets/types, μηδέν νομικό ρίσκο.
- **(3) CC0 / public-domain content repos:** λίγα, κυρίως generic 3D (όχι BIM-grade με IFC properties).

**Παραδοτέο research:** cited λίστα «ποιες πηγές μπορεί ΝΟΜΙΜΑ να ενσωματώσει» + τρέχοντα redistribution terms (άδειες/ToS αλλάζουν — verify up-to-date), χωρισμένη σε (code engines) / (content sets) / (public-domain data catalogs). N.5 license compliance.

**Πώς:** τρέξε `/deep-research` με το παραπάνω ερώτημα. Αυτό είναι **νέο θέμα** — ΟΧΙ συνέχεια του railing code.

---

## ✅ RAILING VERIFY SESSION — 3 BUGS FIXED (pending commit, ο Giorgio κάνει commit)

Το Φ1 vertical slice (Φ1.A–G) είχε ολοκληρωθεί σε προηγούμενη session (βλ. `2026-06-02_ADR-407_railings_PHASE1_D-G_DONE_PHASE2_next.md`). Σε ΑΥΤΗ τη session έγινε browser-verify και βρέθηκαν+διορθώθηκαν **3 bugs**:

### 🐛 Bug 1 — Railing ΑΟΡΑΤΟ στον 2Δ καμβά (ADR-407 v0.4)
**Root cause:** το railing έλειπε από το **canvas-v2 render pipeline** (ροή: `SceneEntity → convertEntity → DxfEntityUnion → DxfRenderer → EntityRendererComposite → RailingRenderer`). Wiráρονταν μόνο στο τελευταίο στάδιο· στα 3 πρώτα έπεφτε στο `default` του `convertEntity` → `return null` → πετιόταν.
**Fix (πιστό mirror του `mep-fixture`):**
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types.ts` — `+'railing'` στο `DxfEntity.type` union + νέο `DxfRailing` interface + `DxfEntityUnion += DxfRailing` + import `RailingEntity`
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` — `case 'railing'` (υποχρεωτικό· `exhaustiveCheck: never`)
- `src/subapps/dxf-viewer/hooks/canvas/dxf-scene-entity-converter.ts` — `case 'railing'` + import `isRailingEntity`+`RailingEntity`
**✅ browser-verified: κάγκελο εμφανίζεται στα 2Δ.** Bonus: ξεκλείδωσε 2Δ hit-test/selection/grips.

### 🐛 Bug 2 — Railing ΔΕΝ persistάρει (`floorplan_railings` = 0 docs) (ADR-407 v0.4)
**Root cause:** έλειπε **security-rules match block** για `floorplan_railings` → default-deny → writes σιωπηλά rejected (persist hook πιάνει error σε try/catch). (Ο service/host/hook/broadcast ήταν ΟΛΑ σωστά — mirror MEP που δουλεύει με 5 docs.)
**Fix:**
- `firestore.rules` — `+ floorplan_railings` block (πιστό mirror `floorplan_mep_fixtures`, hasAll keys: companyId/projectId/floorplanId/kind/params)
- `tests/firestore-rules/_registry/coverage-manifest.ts` — `FIRESTORE_RULES_PENDING += 'floorplan_railings'` (CHECK 3.16 ✅ OK)
- **✅ DEPLOYED:** `firebase deploy --only firestore:rules --project pagonis-87766` → compiled + released OK (additive, χωρίς `--force`).
**🔴 RE-VERIFY:** ξανα-σχεδίασε κάγκελο → να δημιουργηθεί doc `ral_*` (query: collection `floorplan_railings`).

### 🐛 Bug 3 — 3Δ ένωση κουπαστής↔ορθοστάτη (ADR-407 v0.5)
**Root cause (Giorgio 3Δ feedback):** (α) η κουπαστή τελείωνε στο **κέντρο** του ακραίου ορθοστάτη (rail path endpoint = post centre)· (β) ο κούφιος `TubeGeometry (closed=false)` **δεν είχε τάπες** → ανοιχτός σωλήνας.
**Fix (μόνο `railing-to-three.ts` — μηδέν αλλαγή σε geometry SSoT / 2Δ / BOQ):**
- `src/subapps/dxf-viewer/bim-3d/converters/railing-to-three.ts` — NEW `extendRailEndsToPosts` (προέκταση ελεύθερων άκρων κατά μισό βάθος ορθοστάτη → εξωτερική παρειά, gated σε `posts.atStart/atEnd`) + NEW `buildTubeCap` (δίσκος `CircleGeometry`, normal εξωτερικά → κλείνει ο σωλήνας) + `buildRailTube` επιστρέφει `THREE.Group` (tube + 2 caps, όλα tagged 'rail').
**railing-mesh 5/5 PASS, tsc 0.** 🔴 RE-VERIFY 3Δ: κουπαστή ως την άκρη + κλειστές τάπες.

### Κατάσταση
- **tsc --noEmit: exit 0** (μετά και τα 3 fixes)
- railing-mesh: **5/5 PASS** · CHECK 3.16: **OK**
- ⚠️ MEP fixture (ADR-406) ΕΛΕΓΧΘΗΚΕ → **σωστό** (render + rules + 5 persisted docs)· μην το πειράξεις.

---

## 📋 ΑΡΧΕΙΑ ΓΙΑ `git add` (ΑΥΤΗΣ της session — specific, ΠΟΤΕ -A)
```
src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types.ts
src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts
src/subapps/dxf-viewer/hooks/canvas/dxf-scene-entity-converter.ts
src/subapps/dxf-viewer/bim-3d/converters/railing-to-three.ts
firestore.rules
tests/firestore-rules/_registry/coverage-manifest.ts
docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md   (changelog v0.4 + v0.5)
```
**ΣΗΜ:** Τα Φ1.A–G railing αρχεία (NEW core + wiring) είναι ΕΠΙΣΗΣ ακόμη pending commit από την προηγούμενη session — βλ. τη λίστα στο `2026-06-02_ADR-407_railings_PHASE1_D-G_DONE_PHASE2_next.md`. Ο Giorgio αποφασίζει αν τα commit-άρει όλα μαζί (Φ1 + 3 fixes).

---

## 🔴 PENDING BROWSER VERIFY (railing Φ1 DoD — Giorgio's side)
1. ✅ 2Δ draw (verified)
2. 🔴 Persistence: ξανα-draw → `ral_*` doc στο `floorplan_railings` + audit (rules deployed τώρα)
3. 🔴 3Δ: κουπαστή ως την άκρη + τάπες (Bug 3 fix)· units-safety σε meter-scale σχέδιο
4. 🔴 Discipline toggle «Αρχιτεκτονικά» κρύβει/δείχνει (2Δ+3Δ)
5. 🔴 BOQ: γραμμή «Κιγκλίδωμα μεταλλικό» OIK-12.01 με μήκος (m)

---

## ❌ DEFERRED Φ1 / Φ2+ (όπως πριν)
- 3Δ-viewport raycast placement hook + ghost (EventBus `bim:place-railing-3d` + listener έτοιμα)· property panel· ORTHO/POLAR 2Δ.
- Φ2 stair hosting → Φ7 migration (βλ. ADR-407 §Implementation Phases).
