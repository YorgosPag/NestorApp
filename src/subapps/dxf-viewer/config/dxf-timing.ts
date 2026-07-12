/**
 * 🏢 DXF_TIMING — TIMING & LATENCY SINGLE SOURCE OF TRUTH (ADR-516)
 * ============================================================================
 *
 * THE single source of truth for every *intentional* timing value in the DXF
 * Viewer (throttle / debounce / animation / persist / lifecycle / gesture).
 *
 * It UNIFIES the three previously-competing timing configs:
 *   - `PANEL_LAYOUT.TIMING`  (panel-tokens.ts, ADR-096)  → now a facade over this
 *   - `TIMING_CONFIG`        (timing-config.ts, ADR-098)  → now a facade over this
 *   - `settings-config.ts` timing constants               → now a facade over this
 *
 * Organised by the 7 latency categories (ADR-516 §4). Each *concept* has exactly
 * one entry; multiple call-sites that mean the same thing reference the same key.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * 🔴 CATEGORY 0 — INSTANT PATH (zero-lag mandate, ADR-040). NO CONSTANT HERE.
 * ──────────────────────────────────────────────────────────────────────────
 * Cursor, crosshair, snap marker and the *visual ghost* that follows the cursor
 * are NEVER throttled/debounced. They update synchronously from the event and
 * paint on the GPU compositor (`registerDirectRender` + `translate3d`), off the
 * main thread. This is an ARCHITECTURAL guarantee — it is intentionally absent
 * from this table. Introducing a timing constant on that path would be a
 * latency regression (ADR-516 §2.5, "lag type A"). See the ZERO-LAG GUARD note
 * at the bottom of this file.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-516-timing-latency-ssot.md
 * @since 2026-06-24 (ADR-516 Phase 1)
 */

export const DXF_TIMING = {
  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY 1 — PER-FRAME THROTTLE (coalesce work to vsync; never drop the
  // trailing frame). Used for redraw / hover hit-test / snap detection / the
  // *computation* behind a dragged ghost (the ghost itself stays category 0).
  // ──────────────────────────────────────────────────────────────────────────
  frame: {
    /** 1 frame @ 60fps — canonical per-frame throttle (redraw, drag/grip compute). */
    THROTTLE_60: 16,
    /** 1 frame @ 120fps — high-refresh future-proofing. */
    THROTTLE_120: 8,
    /** Cursor *context* update throttle (20fps) — NOT the instant cursor (cat 0). */
    CURSOR_CONTEXT: 50,
    /** Snap detection throttle (≈30fps — smooth feel + low CPU). */
    SNAP_DETECTION: 32,
    /** Entity/overlay hover hit-test throttle (20fps). */
    HOVER_HITTEST: 50,
    /** Grip hover detection throttle (10fps). */
    GRIP_HOVER: 100,
    /** Collaboration cursor broadcast inner throttle. */
    COLLAB_CURSOR_INNER: 50,
    /** Collaboration cursor update interval (10fps outer). */
    COLLAB_CURSOR_OUTER: 100,
    /** Coordinate debug overlay readout throttle. */
    READOUT: 100,
    /** Section edge-trim recompute throttle (bim-3d section controller). */
    EDGE_TRIM: 50,
    /** Geometric-constraint solver min interval between updates (ADR-516 Group 6). */
    CONSTRAINT_MIN: 10,
    /** Geometric-constraint solver max interval between updates (ADR-516 Group 6). */
    CONSTRAINT_MAX: 100,
    /** Incremental 3D scene-build per-frame wall-clock budget (time-sliced streaming, ADR-645). */
    INCREMENTAL_BUILD_BUDGET: 8,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY 2 — UI DEBOUNCE (settings sliders, search, resize, input, focus).
  // ──────────────────────────────────────────────────────────────────────────
  ui: {
    /** Minimal focus delay (immediate DOM-ready focus). */
    FOCUS_IMMEDIATE: 10,
    /** Standard focus delay (allows a React re-render cycle). */
    FOCUS_DEFAULT: 50,
    /** Tool state transition / cleanup delay. */
    TOOL_TRANSITION: 50,
    /** Wait for browser layout stabilization (CanvasSection, ADR-045). */
    LAYOUT_STABILIZATION: 50,
    /** Field component mount-before-focus delay. */
    FIELD_RENDER_DELAY: 150,
    /** Settings slider/input debounce. */
    SETTINGS_DEBOUNCE: 150,
    /** Generic user-input debounce. */
    INPUT_DEBOUNCE: 150,
    /** Window resize debounce. */
    RESIZE_DEBOUNCE: 200,
    /** Scroll event debounce. */
    SCROLL_DEBOUNCE: 100,
    /** Ribbon widget commit debounce. */
    COMMIT_DEBOUNCE: 200,
    /** Search input debounce. */
    SEARCH_DEBOUNCE: 150,
    /** Click-outside guard (prevents immediate menu close after open). */
    MENU_CLICK_GUARD: 100,
    /** ESC reactivation lock (ignore re-fire of just-cancelled tool, ADR-362). */
    ESCAPE_REACTIVATION_LOCK: 200,
    /** Reset justFinishedDrag flag after drag ops (CanvasSection). */
    DRAG_FINISH_RESET: 100,
    /** Canvas observer setup retry. */
    OBSERVER_RETRY: 100,
    /** State transition delay (useSceneState fitToView). */
    STATE_TRANSITION: 200,
    /** Fit-to-view after scene load. */
    FIT_TO_VIEW_DELAY: 200,
    /** Viewport→URL query-sync debounce (deep-link sharing). */
    URL_DEBOUNCE: 400,
    /** Slower ribbon widget commit debounce (MEP circuit name/conductors). */
    COMMIT_DEBOUNCE_SLOW: 300,
    /** Faster resize debounce (CanvasBoundsService recompute). */
    RESIZE_DEBOUNCE_FAST: 150,
    /** Section view refine delay before high-quality recompute (bim-3d). */
    SECTION_REFINE: 150,
    /** Screen-reader aria-live duplicate-announcement idempotency window. */
    ARIA_IDEMPOTENCY: 200,
    /** Screen-reader announcement coalescing debounce. */
    ARIA_DEBOUNCE: 250,
    /** Spell-check worker round-trip debounce (text engine, ADR-516 Group 6). */
    SPELLCHECK_DEBOUNCE: 300,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY 3 — AUTOSAVE / PERSIST (Firestore / storage writes). Debounce big.
  // Distinct concepts (ADR-516 §6 Q1): per-entity vs scene vs settings.
  // ──────────────────────────────────────────────────────────────────────────
  persist: {
    /** Per-entity autosave debounce — the canonical value for ~24 persistence hooks. */
    ENTITY_AUTOSAVE: 500,
    /** Scene-level snapshot debounce (heavier full-scene write). */
    SCENE_AUTOSAVE: 2000,
    /** Settings / overlay state debounce. */
    SETTINGS: 500,
    /** Grid-guide persistence debounce. */
    GRID_GUIDE: 1000,
    /** LocalStorage periodic autosave interval. */
    LOCALSTORAGE_INTERVAL: 5000,
    /** Periodic full auto-save interval (30s). */
    AUTOSAVE_INTERVAL: 30000,
    /** Firestore local-write grace / quiet window (echo suppression). */
    WRITE_GRACE: 2000,
    /** "Saved" status message display duration. */
    SAVE_STATUS_DISPLAY: 2000,
    /** Save status reset to idle. */
    SAVE_STATUS_RESET: 3000,
    /** MEP fitting auto-reconciliation debounce (same cadence as entity autosave). */
    RECONCILE: 500,
    /** Hosting reconciler settle-before-persist delay. */
    SETTLE_PERSIST: 350,
    /** Text-draft recovery autosave debounce (30s). */
    DRAFT_DEBOUNCE: 30000,
    /** 3D animation render progress persist interval (queue processor, ADR-516 Group 6). */
    PROGRESS_INTERVAL: 1500,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY 4 — ANIMATION / FADE (camera, grid fade, projection, POI, toasts).
  // ──────────────────────────────────────────────────────────────────────────
  animation: {
    /** Fast transitions. */
    FAST: 150,
    /** Standard animation duration. */
    DEFAULT: 300,
    /** Slow / emphasis animations. */
    SLOW: 500,
    /** Element removal after feedback. */
    ELEMENT_REMOVE: 500,
    /** Tooltip show delay. */
    TOOLTIP_DELAY: 500,
    /** Generic UI fade duration (200ms). */
    FADE: 200,
    /** Quick toast / notification. */
    TOAST_SHORT: 2000,
    /** Standard toast. */
    TOAST_DEFAULT: 3000,
    /** Important toast. */
    TOAST_LONG: 5000,
    /** Clipboard copy feedback reset. */
    COPY_FEEDBACK_RESET: 2000,
    /** Page reload after storage action. */
    PAGE_RELOAD: 1500,
    /** Yellow anchor coordinate highlight display duration. */
    ANCHOR_DISPLAY: 1000,
    /** Point-of-interest fade-out start delay (bim-3d viewport). */
    POI_FADE_DELAY: 1500,
    /** Origin-indicator overlay auto-remove TTL (panToWorldOrigin confirm, ADR-516 Group 6). */
    OVERLAY_TTL: 6000,
    /** Preview pivot crosshair flash duration after Alt+click (bim-3d, ADR-516 Group 6). */
    MARKER_FLASH: 900,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY 5 — LIFECYCLE / TIMEOUT (TTL, cache, health, import, lock, quota).
  // ──────────────────────────────────────────────────────────────────────────
  lifecycle: {
    /** Layout measurement interval (LayoutMapper). */
    MEASURE_INTERVAL: 1000,
    /** Performance monitoring interval. */
    PERFORMANCE_MONITOR: 1000,
    /** Performance HUD metrics poll cadence (4Hz) — shared by the 2D + 3D
     *  collectors so the 60s history window (240 × 4Hz) is identical across modes. */
    PERFORMANCE_HUD_POLL: 250,
    /** Collaboration presence heartbeat. */
    PRESENCE_HEARTBEAT: 5000,
    /** Service initialization timeout. */
    SERVICE_INIT: 5000,
    /** Mock collaboration connection delay. */
    CONNECTION_DELAY: 500,
    /** Service health check interval. */
    HEALTH_CHECK: 30000,
    /** Test runner timeout. */
    TEST_TIMEOUT: 30000,
    /** Storage quota check interval. */
    QUOTA_CHECK: 60000,
    /** DXF import timeout (1 minute). */
    IMPORT_TIMEOUT: 60000,
    /** DXF import Worker readiness-probe timeout — ADR-639 Στάδιο 1. No `worker-ready`
     *  within this window ⇒ the worker module failed to load ⇒ fast main-thread fallback
     *  (8s tolerates a cold Turbopack worker-bundle compile). */
    IMPORT_WORKER_READY_PROBE: 8000,
    /** DXF import Worker parse ceiling, applied ONLY once the worker is confirmed alive —
     *  ADR-639 Στάδιο 1. Abandons a worker that loaded but wedged mid-parse; the main-thread
     *  fallback finishes the job. Generous but bounded (a healthy 215k-entity parse fits). */
    IMPORT_WORKER_PARSE_TIMEOUT: 90000,
    /** Default cache TTL (5 minutes). */
    CACHE_TTL: 300000,
    /** Extended cache TTL (10 minutes, global/singleton caches). */
    CACHE_TTL_EXTENDED: 600000,
    /** Periodic cache cleanup interval (1 minute). */
    CACHE_CLEANUP: 60000,
    /** Soft-lock TTL (5 minutes). */
    LOCK_TTL: 300000,
    /** Tracking point inactivity timeout. */
    TRACKING_INACTIVITY: 5000,
    /** Canvas bounds cache max age before forced recompute. */
    BOUNDS_MAX_AGE: 5000,
    /** Telemetry batch flush interval (5 minutes). */
    TELEMETRY_FLUSH: 5 * 60 * 1000,
    /** Text-draft recovery expiry (7 days). */
    DRAFT_EXPIRY: 7 * 24 * 60 * 60 * 1000,
    // ── ADR-516 Group 6 one-offs ──────────────────────────────────────────
    /** Service health-check probe timeout (ServiceHealthMonitor). */
    HEALTH_TIMEOUT: 1000,
    /** Health response-time threshold for "degraded" status. */
    HEALTH_DEGRADED: 500,
    /** Health response-time threshold for "unhealthy" status. */
    HEALTH_UNHEALTHY: 1000,
    /** Voice recorder hard cap on a single recording (text-engine AI). */
    MAX_RECORDING: 30000,
    /** DXF AI assistant REST request timeout. */
    AI_REQUEST_TIMEOUT: 30000,
    /** Telemetry upload exponential-backoff base delay (bim-3d telemetry). */
    RETRY_BASE_DELAY: 500,
    /** Service-registry init retry backoff base (service-registry-initializer). */
    SERVICE_RETRY_BACKOFF: 100,
    /** Storage quota fast check interval (cf. QUOTA_CHECK=60000 for the slow path). */
    QUOTA_CHECK_FAST: 30000,
    /** Infinite-render-loop detector burst window (settings-provider diagnostic). */
    RENDER_LOOP_WINDOW: 2000,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY 6 — GESTURE / SETTLE (long-press, hover-reveal, menu-hold, chord,
  // warm-delay, linger, acquisition). Deliberate "intent" delays.
  // ──────────────────────────────────────────────────────────────────────────
  gesture: {
    /** Double-click detection window (enterprise standard 200–400ms). */
    DOUBLE_CLICK: 300,
    /** Long-press threshold. */
    LONG_PRESS: 500,
    /** Grip hover menu hold delay. */
    MENU_HOLD: 400,
    /** Grip warm-up delay (cold → warm). */
    WARM_DELAY: 1000,
    /** Guide-follow ghost linger after release. */
    LINGER: 140,
    /** Hover-reveal settle (quick properties / 3D hover). */
    HOVER_REVEAL: 800,
    /** Keyboard chord timeout (BIM / guide shortcuts). */
    CHORD_TIMEOUT: 350,
    /** Tracking point acquisition dwell. */
    ACQUISITION: 1000,
    /** Grid/guide settle before persist. */
    SETTLE: 400,
    /** Command-history merge window — consecutive drags within this window
     *  collapse into one undo step (shared by useEntityDrag + useGripMovement). */
    COMMAND_MERGE_WINDOW: 500,
    /** Wheel-interaction idle timeout (bim-3d camera settles after scroll). */
    WHEEL_IDLE: 220,
    /** Camera idle threshold before bim-3d quality escalation (IdleDetector, ADR-516 Group 6). */
    CAMERA_IDLE: 800,
    /** Pointer-sweep settle window — a cursor move within this counts as motion → cheap
     *  grey section caps (bim-3d section controller). MUST stay below ui.SECTION_REFINE. */
    POINTER_SETTLE: 100,
    /** ADR-366 §B.5 — adaptive-shadow settle window. Shadows (the ~40ms PCF cost) stay OFF while
     *  the cursor moves within this; they only «pop in» after GENUINE stillness, so the 40ms
     *  shadowed frame never fires on the micro-pauses of normal work. Longer than POINTER_SETTLE.
     *  Also governs the 3D hover-silhouette refine-on-settle (bim3d-pointer-scheduler) so the
     *  deferred hover render COALESCES with the shadow-on render → ONE settle frame, not two. */
    SHADOW_SETTLE: 350,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Non-time interaction thresholds that historically lived in the TIMING block
  // (pixels, not milliseconds). Kept here so the facade stays 1:1.
  // ──────────────────────────────────────────────────────────────────────────
  threshold: {
    /** Pixels to move before a drag starts. */
    DRAG_PX: 5,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // INPUT PREDICTION (latency compensation) — ADR-516 lag «type A», solved
  // architecturally. The 3D entity (WebGL) trails the 0ms OS cursor by the
  // measured present latency (~28ms, ADR-549). We draw it where the cursor WILL
  // be in `PRESENT_LATENCY_MS` so they coincide on present. See
  // `bim-3d/gizmo/pointer-prediction.ts`.
  // ──────────────────────────────────────────────────────────────────────────
  prediction: {
    /** Horizon (ms): measured WebGL present latency (ADR-549, 641 samples). */
    PRESENT_LATENCY_MS: 28,
    /** EMA smoothing of velocity (0..1) — higher = more responsive, lower = smoother. */
    EMA_ALPHA: 0.4,
    /** Clamp: max prediction distance (px) — caps overshoot on sharp moves. */
    MAX_AHEAD_PX: 40,
    /** Below this speed (px/ms) the prediction is zeroed (settle exactly on the cursor). */
    STOP_VEL_PX_PER_MS: 0.02,
    /** A/B toggle — false = raw position (old behaviour, visible lag). */
    ENABLED: true,
  },
} as const;

// ============================================================================
// 🔴 ZERO-LAG GUARD (ADR-516 §5.2) — CATEGORY 0 IS ARCHITECTURAL, NOT A VALUE
// ============================================================================
// The following files form the instant path. They MUST NOT import a throttle /
// debounce / timing constant for the *visual* cursor/crosshair/snap/ghost
// update — that update is synchronous + compositor-driven (ADR-040):
//   - systems/cursor/ImmediatePositionStore.ts   (registerDirectRender)
//   - systems/cursor/ImmediateTransformStore.ts  (getImmediateTransform)
//   - canvas-v2/overlays/CrosshairOverlay.tsx     (translate3d compositor)
// For dragged *objects* the rule is: the visual ghost follows instant (per-frame
// coalesced, never time-dropped); only the command/persist may be throttled
// (DXF_TIMING.frame.THROTTLE_60). Enforced via the shared raf-coalesced-throttle
// helper used by useEntityDrag + useGripMovement.
// ============================================================================

/** Category keys for type-safe access. */
export type DxfTiming = typeof DXF_TIMING;
