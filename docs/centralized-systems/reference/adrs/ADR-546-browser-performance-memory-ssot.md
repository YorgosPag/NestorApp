# ADR-546 — Cross-subapp SSoT για το Chrome `performance.memory`

**Status:** ✅ IMPLEMENTED (UNCOMMITTED)
**Date:** 2026-06-27
**Domain:** Platform / Performance SSoT
**Related:** ADR-366 §B.5.U (Unified 2D+3D Performance HUD), ADR-065 (perf manager SRP splits)

---

## Context

Το non-standard browser API `performance.memory` (Chrome-only· απουσιάζει σε Firefox/Safari)
ήταν σκορπισμένο σε όλη την εφαρμογή:

- **4 πανομοιότυπα type διπλότυπα** `PerformanceMemory` + `PerformanceWithMemory`:
  - `core/performance/core/enterprise-perf-types.ts`
  - `subapps/geo-canvas/profiling/performance-profiler-types.ts`
  - `subapps/geo-canvas/performance/monitoring/performance-monitor-types.ts`
  - `subapps/geo-canvas/optimization/memory-leak-detector-types.ts`
- **12 reader call-sites** με copy-paste `(performance as PerformanceWithMemory).memory` ή
  ανώνυμα inline casts (`performance as unknown as { memory: ... }`), με **ασυνεπείς μονάδες**
  (άλλα raw bytes, άλλα MB) και άλλα **μη ασφαλή** (non-optional cast → πιθανό crash σε
  non-Chrome, π.χ. `analytics-bridge-monitoring.ts`).

Το dxf-viewer είχε ήδη μερικώς καθαριστεί στο ADR-366 §B.5.U (`utils/cpu-memory.ts`), αλλά
κρατούσε δικό του minimal `ChromePerformance` type → ακόμη ένα μικρο-διπλότυπο.

## Decision — big-player τεκμηρίωση

Ο Giorgio ζήτησε full enterprise + full SSoT «όπως Revit/Maxon», αλλά να ακολουθηθεί η πρακτική
των μεγάλων παικτών αν αυτοί δεν προτείνουν app-wide unification.

- Revit/Maxon (C++ desktop) **δεν έχουν** `performance.memory` → δεν μεταφέρεται άμεσα.
- ΟΜΩΣ η αρχιτεκτονική τους αρχή είναι: **ένα Platform/System abstraction layer** που τυλίγει
  OS/runtime υπηρεσίες (memory, threading, IO) μία φορά — ΠΟΤΕ σκόρπια raw OS calls.
- Web ισοδύναμο (πρακτική TS/`@types`): μια non-standard browser-API δήλωση μπαίνει **ΜΙΑ φορά**
  σε platform layer.

➡️ **Απόφαση:** ΝΑΙ ενοποίηση, ως **lightweight platform abstraction** (όχι heavy "manager"):
ΕΝΑΣ canonical type + ΕΝΑΣ reader. Ικανοποιεί ΚΑΙ full-SSoT ΚΑΙ την platform-layer αρχή των
μεγάλων παικτών.

## Solution

**NEW canonical SSoT:** `src/lib/platform/browser-performance-memory.ts`
- `interface PerformanceMemory` (bytes) + `interface PerformanceWithMemory extends Performance`
- `readPerformanceMemory(): PerformanceMemory | null` — **ΜΙΑ** πηγή cast, raw bytes, SSR-safe
- `readCpuMemoryMb(): number | null` — thin helper (used→MB, 1 δεκαδικό) για HUD/απλούς consumers

**Rollout (μηδέν αλλαγή συμπεριφοράς/μονάδων):**
- Τα 4 type αρχεία → `export type { ... } from '@/lib/platform/browser-performance-memory'`
  (backward-compatible re-export· οι local importers δουλεύουν αμετάβλητοι).
- `subapps/dxf-viewer/utils/cpu-memory.ts` → thin re-export του `readCpuMemoryMb` (διαγραφή local type).
- Όλοι οι readers → `readPerformanceMemory()`, κρατώντας ο καθένας τις δικές του μονάδες:
  - `core/performance/core/enterprise-perf-utils.ts::getSystemInfo()` (bytes)
  - `core/performance/core/EnterprisePerformanceManager.ts::collectSystemMetrics()` (bytes)
  - `geo-canvas/performance/monitoring/PerformanceMonitor.ts` (4 σημεία: baseline/runtime-MB/leak/detect)
  - `geo-canvas/profiling/performance-profiler-collectors.ts` (bytes)
  - `geo-canvas/optimization/MemoryLeakDetector.ts` (bytes)
  - `services/analytics-bridge-monitoring.ts` (bytes — **τώρα null-safe**)
  - `subapps/dxf-viewer/utils/performance.ts` (MB)
  - `subapps/dxf-viewer/testing/performance-test.ts` (MB, used+limit)
  - `core/canvas/infrastructure/CanvasRegistry.ts::estimateMemoryUsage()` (bytes)

**SSoT registry:** νέο module `browser-performance-memory` στο `.ssot-registry.json` που μπλοκάρει
νέες inline δηλώσεις του type ή inline casts εκτός του canonical.

## Tests

- NEW `src/lib/platform/__tests__/browser-performance-memory.test.ts` (6 tests: present→bytes,
  absent→null, MB rounding, null passthrough).
- Sanity GREEN: dxf-viewer `Performance2DCollector` (path/συμπεριφορά `cpu-memory.ts` αμετάβλητη).

## Consequences

- ΜΙΑ πηγή για τον unsafe cast → ασφάλεια + συνέπεια σε όλα τα subapps.
- Νέοι consumers: `import { readPerformanceMemory } from '@/lib/platform/browser-performance-memory'`.

## Follow-up (Boy-Scout, εκτός scope)

- `WindowWithGC` (Chrome `window.gc()`) διπλότυπο σε 2 αρχεία (`enterprise-perf-types.ts` +
  `memory-leak-detector-types.ts`) — ξεχωριστό concern, να ενοποιηθεί όμοια σε επόμενο pass.
- `subapps/geo-canvas/docs/SNAP_SYSTEM_IMPLEMENTATION.md` αναφέρει inline το παλιό type ως
  παράδειγμα τεκμηρίωσης (doc, όχι κώδικας) — προαιρετική ενημέρωση.

## Changelog

- **2026-06-27** — Δημιουργία canonical `src/lib/platform/browser-performance-memory.ts`·
  ενοποίηση 4 type διπλοτύπων (re-export) + 12 reader call-sites· νέο registry module· 6 tests.
  UNCOMMITTED — commit από Giorgio.
