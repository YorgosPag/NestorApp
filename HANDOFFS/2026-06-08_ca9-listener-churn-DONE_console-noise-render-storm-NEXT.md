# Handoff — ca9 listener-churn fix DONE · console-noise cleanup partial · render-storm NEXT

**Date:** 2026-06-08
**Model:** Opus 4.8
**Branch:** main
**Status:** code DONE, 🔴 pending tsc + browser-verify + commit (ΟΧΙ commit χωρίς εντολή — N.(-1))

---

## 1. ΤΙ ΕΓΙΝΕ ΑΥΤΟ ΤΟ SESSION (όλα uncommitted, στο working tree)

### A. ca9 Firestore assertion fix (το αρχικό report) — ✅ code DONE
**Σύμπτωμα:** Με σωλήνες MEP στον καμβά → flood `INTERNAL ASSERTION FAILED (ID: ca9) {ve:-1}` + `b815`. Stack: `useWallPersistence` cleanup → `firestore-query.service.ts:313 innerUnsub()`.

**Ρίζα:** Τα BIM persistence hooks κλείδωναν το `onSnapshot` subscription effect στο **`levelManager` object** (return του `useLevels`, fresh memo κάθε render). Με σωλήνες, οι reconcilers (`useMepFittingAutoReconciliation`, `useMepConnectorReconciliation`) κάνουν `setLevelScene` σε ριπές → render storm → κάθε subscription unsubscribe+re-subscribe σχεδόν κάθε render → watch target removed πριν το ack (`{ve:-1}`) = ca9.

**Fix (αποδεδειγμένο pattern από `useMepFittingAutoReconciliation.ts:135-208`, 2026-06-04):** subscription effect κλειδώνει σε `currentLevelId` + scope primitives, διαβάζει `levelManager` μέσω `levelManagerRef`. Εφαρμόστηκε σε **20 persistence hooks** στο `src/subapps/dxf-viewer/hooks/data/` (wall, mep-segment, manifold, fixture, electrical-panel, column, beam, opening, slab, slab-opening, roof, floor-finish, furniture, floorplan-symbol, railing, thermal-space, radiator, boiler, water-heater, underfloor). Μηδέν αλλαγή συμπεριφοράς. Marker στον κώδικα: `ca9 fix 2026-06-08`.
- **ADR:** `ADR-367` §2.4 + changelog (νέα δεύτερη αιτία, διακριτή από το multi-tab race).
- ΕΚΤΟΣ ADR-040 (persistence hooks δεν είναι στη CHECK 6B/6D λίστα).

### B. mep-fitting audit 400 — ✅ DONE (1 γραμμή)
`/api/audit-trail/record` → `400 "No collection mapping for entity type: mep-fitting"` σε ριπές με σωλήνες. Το `mep-fitting` ήταν στα `VALID_ENTITY_TYPES` αλλά έλειπε από `ENTITY_COLLECTION_MAP` στο `src/app/api/audit-trail/record/route.ts`. Πρόσθεσα `'mep-fitting': COLLECTIONS.FLOORPLAN_MEP_FITTINGS`. (Functional gap: fitting audits ΠΟΤΕ δεν καταγράφονταν.)

### C. Render-trace debug removal — ✅ DONE
Το `[RENDER] ...` flood ήταν από `debug/useRenderTrace.ts` (TEMP DEBUG 2026-06-04, unconditional log κάθε render). Διέγραψα **2 αρχεία** (`debug/useRenderTrace.ts` + dead `debug/render-loop-trace.ts`) + αφαίρεσα **4 call sites** (`DxfViewerContent`, `RibbonRoot`, `RibbonLargeButton`, `useDxfViewerState`). ADR-040 §Phase XX probe disposition → marked DONE.
- ⚠️ ΑΓΓΙΖΕΙ ADR-040 αρχεία (DxfViewerContent) → ADR-040 ΠΡΕΠΕΙ να γίνει co-staged στο commit (CHECK 6D), έγινε.

### D. enterprise-id logging → opt-in — ✅ DONE
`Generated enterprise ID: ...` τύπωνε σε ΚΑΘΕ id (default `NODE_ENV==='development'`). Άλλαξα σε `NEXT_PUBLIC_DEBUG_ENTERPRISE_ID==='true'` (default σιωπηλό) σε `enterprise-id-singleton.ts` + `enterprise-id-class.ts`.

---

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ (priority order, εντολή Giorgio)

### 🔴 (1) RENDER STORM — το μεγάλο, δικό του Plan Mode
**Σύμπτωμα:** `useDxfViewerState.detail` ξανα-render-άρει ~37 φορές σε ~35 δευτ. στο idle/load· γεννά `[Violation] handler took …ms`, `FPS below threshold 30<45` (DxfPerformanceOptimizer), `'click' took 1036ms`, **duplicate `Loading from Storage` για ίδιο fileId**.
- **Σήμα:** στα logs το `Δprops=[canvasOps, toolbarState, sceneState, drawingHandlers, gripSettings, ...]` αλλάζει ref σχεδόν κάθε render → κάποια από αυτά τα hook-outputs είναι unstable (νέο object κάθε render).
- **Είναι η ίδια ανοιχτή έρευνα ADR-040 hover-lag** (γι' αυτό υπήρχε ο tracer που μόλις αφαίρεσα).
- **Πρώτο βήμα:** Plan Mode → βρες ποιο από `canvasOps`/`toolbarState`/`sceneState`/`drawingHandlers` δεν είναι memoized στο `useDxfViewerState` (`src/subapps/dxf-viewer/hooks/useDxfViewerState.ts`). Πιθανός κοινός παράγοντας: το `levelManager`/scene churn (ίδια ρίζα με ca9) ή unstable callbacks.
- Το ca9 fix μείωσε το **subscription** churn αλλά ΟΧΙ τους render drivers.

### 🟡 (2) 404 `.scene.json` elimination — ΠΡΟΑΙΡΕΤΙΚΟ (ακίνδυνο)
**ΔΕΝ είναι bug.** `dxf-firestore-storage.impl.ts` έχει 3-tier fallback: δοκιμάζει `.scene.json` (404 αν αρχείο από wizard που δεν ξανα-σώθηκε client-side) → πέφτει σε `.processed.json` (φορτώνει κανονικά, 1169 entities). Το 404 το τυπώνει ΜΟΝΟ το browser network console (δεν σβήνεται από JS). Fix = νέο `sceneTier` field στο `FileRecord` ώστε ο loader να πάει κατευθείαν στο σωστό tier. **Caveat:** legacy records δεν θα το έχουν → 404 μένει μέχρι re-save. Χαμηλό value/effort.

### 🟡 (3) API contract warnings — ΠΡΟΣΟΧΗ production risk
`[WARN] [API Contract] /api/companies (& /api/floorplan-backgrounds) returned 200 but not canonical format`. Fix = αλλαγή response shape σε canonical envelope. **Consumers εξαρτώνται από keys `companies/count`/`background/polygonState/fileRecord`** → audit ΟΛΩΝ των callers ΠΡΙΝ αλλάξεις shape, αλλιώς σπάει production.

### 🟢 (4) dev logs — μένει μόνο config (κάνει ο Giorgio)
Βάλε στο `.env.local`: `NEXT_PUBLIC_LOG_LEVEL=warn` (κόβει DEBUG/INFO του Logger). Προαιρετικά gate τα 15 `console.debug` στα 3 tool hooks (`useCircleTTT`/`useLinePerpendicular`/`useLineParallel`).

---

## 3. ΚΡΙΣΙΜΟ CONTEXT

- **`levelManager` = αστάθεια**: το `useLevels` (`LevelsSystem.tsx:353` useMemo) αλλάζει ref· `setLevelScene` γράφει σε ref (δεν bump-άρει state), αλλά άλλα deps του memo αλλάζουν. ΟΠΟΙΟ effect/subscription εξαρτάται από `levelManager` → churn. Pattern λύσης: `levelManagerRef` + stable primitives.
- **ca9 = firebase-js-sdk bug (ADR-367)**: υπάρχει safety-net (`firestore-recovery.ts` full reload + single-tab cache). Το νέο fix σταματά την πηγή (churn). `useWallPersistence` έχει ΚΑΙ grace-period guard (`useBimFirestoreWriteGrace`) — μην το πειράξεις.
- **MEMORY.md** έχει σχετικά: ADR-399 (phantom sceneFileId — ΟΧΙ σχετικό με το 404 εδώ, το 404 είναι benign fallback), ADR-426 (water-supply), ADR-408 (MEP).

## 4. ΜΗΝ ΚΑΝΕΙΣ
- ❌ ΟΧΙ `git commit`/`push` χωρίς ρητή εντολή Giorgio (N.(-1)).
- ❌ ΟΧΙ 2 ταυτόχρονα tsc (N.17). Ο process-check είναι PowerShell — τρέξε τον εσύ (`! npx tsc --noEmit`) ή Giorgio.
- ❌ ΟΧΙ βιαστική αλλαγή στο API response shape (#3) — σπάει production χωρίς caller audit.
- ❌ ΟΧΙ re-add του render tracer.

## 5. VERIFY ΠΡΙΝ COMMIT
1. **Browser:** δίκτυο σωλήνων → σχεδίασε/μετακίνησε/σβήσε σωλήνες+fittings, άλλαξε όροφο, hard refresh → κονσόλα καθαρή από `ca9/b815` + `mep-fitting 400` + `[RENDER]` + `Generated enterprise ID`. Σωλήνες παραμένουν.
2. **tsc:** `npx tsc --noEmit` (type-neutral changes, στατικά verified).
3. **jest:** persistence-hook tests (behaviour-neutral, πρέπει πράσινα).
