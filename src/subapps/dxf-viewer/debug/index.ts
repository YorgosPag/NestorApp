/**
 * Debug System — ο **ΕΝΑΣ** barrel του `debug/`.
 *
 * ## 🔴 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ `index.tsx` ΔΙΠΛΑ — ΜΗΝ ΞΑΝΑΦΤΙΑΞΕΙΣ
 *
 * Μέχρι τις 2026-09-12 υπήρχαν **και τα δύο**: `index.ts` («Pure TypeScript exports for
 * non-React contexts») **και** `index.tsx` (React panels + QA runners). Το webpack του
 * Next.js επιλύει `.tsx` **πριν** `.ts`, άρα:
 *
 * - το `index.ts` **δεν φορτωνόταν ποτέ** — ήταν νεκρό από τη μέρα που γεννήθηκε το `.tsx`·
 * - και τα **52** αρχεία που γράφουν `from '../debug'` νομίζοντας ότι παίρνουν δύο
 *   συναρτήσεις logging, τραβούσαν `HierarchyDebugPanel`, `SnapDebugLogger` και τον
 *   γεωμετρικό γράφο πίσω τους.
 *
 * Αυτό **γέννησε κύκλο**: `storage-utils → (εδώ) → SnapDebugLogger → γεωμετρία → table-ink →
 * table-surface-mode → storage-utils`. Ο κύκλος έκλεινε πάνω στο `STORAGE_KEYS` και η
 * παραγωγή έσκαγε με `Cannot access 'o' before initialization` στο
 * `/sales/available-properties` — σελίδα που δεν ανοίγει καν τον viewer.
 *
 * ✅ Το φυλάει πλέον **πύλη**: `npm run test:shadowed-modules` (⛔ zero-tolerance). Δύο
 * αρχεία που λύνουν στο ίδιο specifier δεν φτάνουν στο commit.
 *
 * 📏 Μετρημένο πριν τη συγχώνευση: **κανένας** από τους 52 καταναλωτές δεν ζητούσε σύμβολο
 * που υπήρχε μόνο στο `.tsx`. Όλοι πλήρωναν, κανείς δεν ωφελούνταν.
 *
 * @see ADR-858 — Levelization & αρχή αξιολόγησης modules
 */

import type { Logger } from './core/types';
import { getDebugLogger } from './core/UnifiedDebugManager';

/** Window interface για τα debug globals (development only). */
interface DxfDebugAPI {
  enable: () => string;
  disable: () => string;
  manager: () => Window['dxfDebugManager'];
  canvas: () => Logger;
  rendering: () => Logger;
  snap: () => Logger;
  performance: () => Logger;
  testSettings: () => Promise<unknown> | undefined;
  help: () => void;
}

declare global {
  interface Window {
    __DXF_DEBUG__?: boolean;
    runEnterpriseSettingsTests?: () => Promise<unknown>;
    dxfDebug?: DxfDebugAPI;
  }
}

// ═══ CORE EXPORTS ═══
// Αυτά **και μόνο** αυτά ζητούν οι 52 καταναλωτές (μετρημένο).
export {
  UnifiedDebugManager,
  getDebugLogger,
  dlog,
  dwarn,
  derr,
  drender,
  dperf,
  dhot,
  dbatch,
} from './core/UnifiedDebugManager';

export type {
  DebugConfig,
  LogEntry,
  DebugStatistics,
  LogLevel,
  LogFunction,
  DebugModule,
  PerformanceMetrics,
} from './core/types';

// ⚠️ ΔΕΝ ΕΠΑΝΕΞΑΓΟΝΤΑΙ ΕΔΩ — επίτηδες, και ΜΗΝ τα ξαναβάλεις:
//
//   • `SnapDebugLogger`      → ο μοναδικός καταναλωτής (`snapping/ProSnapEngineV2.ts`) κάνει
//                              ήδη βαθιά εισαγωγή. Το re-export ΕΔΩ ήταν η πρώτη ακμή του
//                              κύκλου που έριξε την παραγωγή.
//   • `HierarchyDebugPanel`  → νεκρό από το ADR-309 Φ.1 (βγήκε από το UI). Το αρχείο του
//                              component μένει στον δίσκο· μόνο το re-export φεύγει.
//   • `OptimizedLogger` (`DXF_DEBUG`, `enableEmergencySilence`, …) → μηδέν καταναλωτές.
//   • `runGridEnterpriseTests` / `runEnterpriseSettingsTests` → QA harness. Και οι τρεις
//     πραγματικοί καταναλωτές τα παίρνουν ήδη με **δυναμική** εισαγωγή, που είναι και το
//     σωστό: ένα QA runner δεν έχει καμία δουλειά στο chunk κάθε σελίδας.
//   • `CanvasLogger`/`canvasLog`/… (20 σύμβολα) → μετρημένα **μηδέν** καταναλωτές εκτός του
//     ίδιου του παλιού barrel. Ζουν παρακάτω ως module-local, μόνο για την κονσόλα.

// ═══ DEVELOPMENT HELPERS ═══

// Module-local, ΟΧΙ exports: τους χρειάζεται μόνο το `window.dxfDebug` παρακάτω.
const CanvasLogger = getDebugLogger('Canvas');
const RenderingLogger = getDebugLogger('Rendering');
const SnapLogger = getDebugLogger('Snap');
const PerformanceLogger = getDebugLogger('Performance');

/**
 * ⚠️ **ΔΙΠΛΟΤΥΠΟ ΠΟΥ ΔΕΝ ΛΥΘΗΚΕ ΕΔΩ**: το `debug/utils/devlog.ts` γράφει **κι αυτό**
 * `window.dxfDebug`, με **ασύμβατο σχήμα** (`enable/disable/status/stats/reset` έναντι του
 * παρακάτω). Όποιο module φορτώσει τελευταίο κερδίζει ⇒ ποιο API βλέπει ο developer στην
 * κονσόλα είναι **σήμερα λαχείο**, και ήταν ήδη πριν από αυτή την αλλαγή.
 *
 * Δεν επιλέγεται νικητής εδώ επίτηδες: είναι απόφαση για dev εργαλείο, όχι για το σφάλμα
 * παραγωγής που διορθώνει αυτή η αλλαγή. Καταγεγραμμένο στο
 * `.claude-rules/pending-ratchet-work.md`.
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  import('./settings-enterprise-test.qa').then(({ runEnterpriseSettingsTests }) => {
    window.runEnterpriseSettingsTests = runEnterpriseSettingsTests;
  });

  window.dxfDebug = {
    enable: () => {
      window.__DXF_DEBUG__ = true;
      return 'DXF Debug enabled (legacy mode)';
    },
    disable: () => {
      window.__DXF_DEBUG__ = false;
      return 'DXF Debug disabled (legacy mode)';
    },

    manager: () => window.dxfDebugManager,
    canvas: () => CanvasLogger,
    rendering: () => RenderingLogger,
    snap: () => SnapLogger,
    performance: () => PerformanceLogger,

    testSettings: () => {
      if (window.runEnterpriseSettingsTests) {
        return window.runEnterpriseSettingsTests();
      }
      console.error('Enterprise Settings Tests not loaded yet');
      return undefined;
    },

    help: () => {
      console.log(`
🔧 DXF Debug System Help:

== Quick Loggers ==
dxfDebug.canvas()      - Canvas logger
dxfDebug.rendering()   - Rendering logger
dxfDebug.snap()        - Snap logger
dxfDebug.performance() - Performance logger

== Manager Controls ==
dxfDebug.manager().enable()            - Enable all debug
dxfDebug.manager().disable()           - Disable all debug
dxfDebug.manager().enableModule(name)  - Enable specific module
dxfDebug.manager().disableModule(name) - Disable specific module
dxfDebug.manager().stats()             - View statistics
dxfDebug.manager().modules()           - List all modules

== Emergency Controls ==
dxfDebug.manager().emergencySilence() - Silence all logs except errors
dxfDebug.manager().emergencyRestore() - Restore normal logging

== Enterprise Tests ==
dxfDebug.testSettings()               - Run Enterprise Settings validation suite
runEnterpriseSettingsTests()          - Direct test runner (async)

== Legacy Support ==
dxfDebug.enable()  - Enable legacy DXF_DEBUG flag
dxfDebug.disable() - Disable legacy DXF_DEBUG flag
      `);
    },
  };
}
