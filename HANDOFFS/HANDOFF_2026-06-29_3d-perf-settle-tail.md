# HANDOFF 2026-06-29 — 3D perf: η ΟΥΡΑ (p95 ~75ms) του settle render — ΕΠΑΝΑ-ΔΙΑΓΝΩΣΗ

> Γράφτηκε για **ΚΑΘΑΡΟ session** (το προηγούμενο γέμισε context). Διάβασέ το ΠΡΩΤΟ.
> **Commit/push τα κάνει ο Giorgio — ΟΧΙ ο agent** (N.(-1)). **Working tree SHARED** με ≥1 άλλον agent.
> Doctrine: **big-player (Revit / Maxon Cinema4D)** + FULL ENTERPRISE + FULL SSOT. Αν οι big players
> δεν προτείνουν κάτι → ακολούθησε **τη δική τους** πρακτική.
> **ΠΡΙΝ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** για υπάρχοντα μηχανισμό· reuse, ΜΗΔΕΝ διπλότυπα.

---

## 0. ΠΟΥ ΕΙΜΑΣΤΕ (production-verified)

Το 3D perf overhaul ολοκληρώθηκε & **έγινε push** (Netcup production):
- `fc552897` — texture cap (DXF text 340MB→2048px), crosshair 1:1, snap-suspend στην πλοήγηση, refine-on-settle hover, MSAA on, SSAO warm-up skip.
- `6feef2c0` — adaptive shadows (ShadowModulator: OFF στην πλοήγηση, ON σε ηρεμία).

**Production μετρήσεις (`dxf-perf-trace`, Netcup):**
| metric | avg | p95 | max |
|---|---|---|---|
| `cursor.totalLag` | **~15ms** ✅ (≈66fps) | **~75ms** 🔴 | ~90ms |
| `cursor.inputLatency` | ~2.8ms ✅ | ~7.8ms | ~12ms |
| `cursor.coalesced` | ~1.2 ✅ | 2 | 3 |

➡️ **avg εξαιρετικό** (το dev φούσκωνε ~86% — αγνόησε όλα τα dev νούμερα). **ΜΕΝΕΙ συστηματική ουρά** p95 ~75ms / max ~90ms σε **κάθε** report → ο χρήστης νιώθει **περιστασιακό hitch** σε αργό exploratory σάρωμα (~1 στα 20 frames «σκαλώνει»). **ΑΥΤΟ είναι ο στόχος.**

## 1. 🔴 ΚΡΙΣΙΜΗ ΕΠΑΝΑ-ΔΙΑΓΝΩΣΗ (νέο εύρημα 2026-06-29 — αλλάζει το πλάνο)

Το προηγούμενο πλάνο υπέθεσε «η ουρά = σκιές». **ΛΑΘΟΣ (εν μέρει).** Production A/B:
- `localStorage.setItem('dxf-no-shadows','1')` (σκιές OFF) → `totalLag` **avg ~70ms, p95 ~100-141ms**.
- Αναμενόταν ~40ms ή ~14ms (από το dev). **Αντ' αυτού ΠΑΡΕΜΕΙΝΕ ~70ms.**

**Συμπέρασμα:** η ουρά **ΔΕΝ είναι (μόνο) οι σκιές**. Το **full-scene WebGL render (hover-highlight settle frame) είναι ~70ms ΚΑΙ χωρίς σκιές** σε production — fullscreen **fill-rate** (PBR + envMap PMREM sampling + MSAA + DoubleSide? + shadows) σε αδύναμη GPU. Το settle render (που εφαρμόζει το deferred hover-highlight + γυρίζει σκιές ON) κοστίζει ~70ms **είτε με είτε χωρίς σκιές**.

⚠️ **Η νέα session ΠΡΕΠΕΙ να επανα-διαγνώσει** ποιο per-fragment κόστος κυριαρχεί στο full-scene render (όχι μόνο σκιές): envMap (PMREM), MSAA, PBR BRDF, DoubleSide overdraw (MaterialCatalog3D), resolution. **A/B το καθένα** πριν γράψεις κώδικα (μάθημα ΑΝΑΦΟΡΑ_5: το dev πλανά — μέτρα σε production).

## 2. ⚠️ ΤΙ ΕΙΝΑΙ ΗΔΗ UNCOMMITTED (άλλος agent + προηγ. session — ΜΗΝ τα ξαναγράψεις)

`git status` (2026-06-29):
| Αρχείο | Τι έγινε ΗΔΗ |
|---|---|
| `bim-3d/scene/scene-setup.ts` | **Fix A:** `renderer.shadowMap.autoUpdate = false` (γρ.110) — static shadow map |
| `bim-3d/lighting/shadow-modulator.ts` | ShadowModulator + προσαρμογή για autoUpdate=false (`needsUpdate` on toggle) |
| `bim-3d/lighting/__tests__/shadow-modulator.test.ts` (NEW ??) | test του modulator |
| `bim-3d/viewport/snap/bim3d-pointer-scheduler.ts` | **Fix B:** deferred hover coalesced σε **SHADOW_SETTLE** (γρ.108-124) — ΕΝΑ settle render αντί δύο |
| `bim-3d/scene/ThreeJsSceneManager.ts` | shadowModulator wiring + warmUp + dispose + comment-trims (≤500) |
| `config/dxf-timing.ts` | `gesture.SHADOW_SETTLE = 350` |
| `bim-3d/viewport/snap/__tests__/bim3d-pointer-scheduler.test.ts` | tests ενημερωμένα |
| `ADR-366` | §B.5 changelog entries |

➡️ **Fix A (autoUpdate=false) + Fix B (coalesce settle) ΕΙΝΑΙ ΗΔΗ ΕΚΕΙ** (uncommitted). **SSoT-audit το current state ΠΡΩΤΑ** — μην τα διπλασιάσεις. Ο Giorgio θα κάνει commit.

## 3. ΠΛΑΝΟ (αναθεωρημένο — αφού η ουρά είναι full-scene render, όχι μόνο σκιές)

**Βήμα 0 — Production A/B (ο Giorgio το τρέχει, ΠΡΙΝ κώδικα):** απομόνωσε τον κυρίαρχο per-fragment ένοχο του ~70ms settle render. Πρότεινε διαγνωστικά flags (mirror των `dxf-no-shadows`/`dxf-no-render`) για: envMap off, MSAA off (renderer recreate), resolution 0.5×. Δες ποιο ρίχνει το 70ms.
- Έλεγξε επίσης: `useViewMode3DStore.getState().autoPreviewEnabled` (αν `true` → παίζει SSAO composer path στο `scene-render-frame.ts:79-93`).

**Πιθανές λύσεις (big-player, αφού ξέρεις τον ένοχο):**
- **Α (πιο πιθανό big win):** το hover-highlight ΔΕΝ θα έπρεπε να απαιτεί **full-scene raster re-render** ~70ms. Big players (Revit/C4D) κάνουν το selection/hover outline ως **φθηνό composite pass** πάνω σε cached base, ΟΧΙ full re-raster. Δες `SelectionOutlinePass` / `renderOutlineOverlayToScreen` (`scene-render-frame.ts:89`) — μπορεί το hover να γίνει outline-only χωρίς να ξανα-raster-άρει όλη τη σκηνή; **SSoT audit πρώτα.**
- **Β:** μείωση per-fragment κόστους του raster (envMap downsize/off-during-motion, MSAA→FXAA, ή adaptive resolution στην κίνηση ΜΟΝΟ — με crisp instant restore· ΠΡΟΣΟΧΗ: ο Giorgio απέρριψε blurry-at-rest, οπότε restore ΑΚΑΡΙΑΙΟ).
- **Γ:** hysteresis ώστε μικρο-παύσεις σε αργό σάρωμα να μην πυροδοτούν επανειλημμένα το ακριβό settle render (cancel pending settle αν ξεκινήσει νέα κίνηση).

## 4. DIAGNOSTIC FLAGS (production-safe, localStorage-gated, ΗΔΗ στο production)
```js
localStorage.setItem('dxf-perf-trace','1'); window.__dxfPerfRefresh?.()  // 60-sample report κάθε 60 moves
localStorage.setItem('dxf-no-render','1')      // κόψε ΟΛΟ το 3D render (το «δάπεδο» ~9-16ms)
localStorage.setItem('dxf-no-shadows','1')     // σκιές OFF (έδειξε ~70ms → ουρά ≠ σκιές)
// removeItem για επαναφορά
```
Μετρητής: `cursor.totalLag` = event→paint (έχει εγγενές ~16ms rAF floor)· `inputLatency` = event→handler (το αληθινό σήμα main-thread saturation)· `coalesced` = «κολύμπημα».
Κώδικας: `bim-3d/viewport/BimCrosshairOverlay3D.tsx` (probeCursorLag) + `systems/cursor/mouse-handler-perf.ts` (aggregator/report).

## 5. ΚΑΝΟΝΕΣ / CONSTRAINTS
- **Commit/push ΜΟΝΟ ο Giorgio** (N.(-1)). ❌ `--no-verify`. ❌ `git add -A`.
- **SHARED tree** — μικρά focused edits· SSoT-audit το current state (Fix A/B ήδη εκεί).
- **ΠΡΙΝ ΚΩΔΙΚΑ → grep SSoT audit** (settle/needsUpdate/outline-pass/geometry-mutation). Reuse, μηδέν διπλότυπα.
- Όλα σε `bim-3d/` → **ΔΕΝ** ενεργοποιούν ADR-040 CHECK 6B/6D. Stage μόνο **ADR-366 §B.5**.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε process)· προτίμησε targeted jest. ⚠️ tsc OOM-άρει σε αυτό το μηχάνημα (exit 134) — βασίσου σε ts-jest/dev-server compile.
- **File-size:** `ThreeJsSceneManager.ts` είναι στα **500/500** — κάθε προσθήκη θέλει comment-trim για να μείνει ≤500 (CHECK 4 blocks).
- **N.14 model:** Sonnet 4.6 (εστιασμένο 3D perf, 1-4 αρχεία, 1 domain).

## 6. ΚΡΙΣΙΜΑ ΑΡΧΕΙΑ
- `bim-3d/scene/scene-render-frame.ts` — render path (raster/SSAO/outline, γρ.56,79-93· `shadowModulator.update` γρ.~50)
- `bim-3d/scene/scene-setup.ts` — renderer/lights (antialias, shadowMap.autoUpdate=false, mapSize 1024, sun frustum ±60)
- `bim-3d/lighting/shadow-modulator.ts` — adaptive shadows (warmUp + update + settle-repaint gated σε `!enabled`)
- `bim-3d/materials/MaterialCatalog3D.ts` — `buildMat` (FrontSide, envMap, PBR — ο per-fragment ένοχος;)
- `bim-3d/viewport/snap/bim3d-pointer-scheduler.ts` — deferred hover (coalesced σε SHADOW_SETTLE)
- `bim-3d/systems/selection/SelectionOutlinePass.ts` — hover/selection outline (μπορεί να γίνει cheap composite;)
- `config/dxf-timing.ts` — `gesture.POINTER_SETTLE=100`, `gesture.SHADOW_SETTLE=350`
- `ADR-366 §B.5` — η fill-rate/shadow/cursor ιστορία (SSoT changelog)

## 7. VERIFICATION
1. targeted jest: `bim3d-pointer-scheduler.test.ts`, `shadow-modulator.test.ts`, `scene-idle-handlers.test.ts`.
2. tsc targeted (N.17· OOM-aware).
3. Production A/B (Giorgio): `dxf-perf-trace` 60-sample → στόχος **p95 totalLag 75→<40ms, max <60ms, avg ~15ms**. Καμία `[Violation]` σε πλοήγηση/hover. Σκιές crisp σε ηρεμία (όχι stale μετά geometry change — λόγω autoUpdate=false).
