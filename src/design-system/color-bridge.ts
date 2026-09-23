// ============================================================================
// 🌉 COLOR BRIDGE - Single Source of Truth Mapping
// ============================================================================
//
// ✨ Bridge between Enterprise Semantic API ↔ shadcn/ui CSS Variables
// 🎯 Single source of truth for color mappings
// 🔒 Compile-time safe, auditable, reversible
//
// Enterprise → shadcn → CSS Variables → UI
// ============================================================================

/**
 * 🌉 COLOR BRIDGE MAPPING TABLE
 *
 * Maps semantic Enterprise API calls to working shadcn/ui Tailwind classes
 *
 * @example
 * // Before (broken):
 * colors.bg.primary → 'bg-[hsl(var(--bg-primary))]' ❌
 *
 * // After (working):
 * colors.bg.primary → 'bg-background' ✅
 */
export const COLOR_BRIDGE = {
  /** 🎨 Background Color Mappings */
  bg: {
    // Core backgrounds
    primary: 'bg-background',      // CORRECTED BACK: Use --background for navigation test
    secondary: 'bg-muted',         // Secondary areas → --muted
    card: 'bg-card',               // Card backgrounds → --card
    surface: 'bg-card',            // Surface/elevated → --card

    // ✅ ENTERPRISE MISSING MAPPINGS - Required by DXF-Viewer components
    muted: 'bg-muted',             // Muted backgrounds
    skeleton: 'bg-muted',          // Loading skeleton backgrounds
    tertiary: 'bg-muted/70',         // Tertiary backgrounds (theme-aware, slightly transparent)
    elevated: 'bg-card',           // Elevated surfaces
    selection: 'bg-accent',        // Selected states
    backgroundSecondary: 'bg-muted', // Secondary background surfaces
    overlay: 'bg-background/95',   // Overlay backgrounds (panels, tooltips)
    modalBackdrop: 'bg-black/50',  // 🏢 ENTERPRISE: Modal backdrop (semi-transparent dark)
    modalBackdropLight: 'bg-black/30', // 🏢 ENTERPRISE: Light modal backdrop
    modalBackdropDark: 'bg-black/75',  // 🏢 ENTERPRISE: Dark modal backdrop
    accent: 'bg-accent',           // Accent backgrounds

    // Interactive states
    hover: 'bg-accent',            // Hover state → --accent
    active: 'bg-accent/80',        // Active state → --accent with opacity

    // Status colors (SUBTLE surfaces) - ✅ ENTERPRISE FIX: Use CSS variables for theme support
    // ⚠️ These are SOFT alert/surface backgrounds (--bg-* = *-50). For VIVID filled
    // badges/dots/toggles use the *Solid variants below (ADR-365 follow-up).
    success: 'bg-[hsl(var(--bg-success))]',        // Success background (theme-aware, subtle)
    error: 'bg-[hsl(var(--bg-error))]',            // Error background (theme-aware, subtle)
    warning: 'bg-[hsl(var(--bg-warning))]',        // Warning background (theme-aware, subtle)
    info: 'bg-[hsl(var(--bg-info))]',              // Info background (theme-aware, subtle)

    // ✅ SOLID status fills (vivid, theme-aware) — ADR-365 follow-up.
    // Reuse the existing --status-* SSoT (globals.css). Pair with text.onSolid.
    successSolid: 'bg-[hsl(var(--status-success))]', // Vivid success fill (badges/dots/toggles)
    errorSolid: 'bg-[hsl(var(--status-error))]',     // Vivid error fill
    warningSolid: 'bg-[hsl(var(--status-warning))]', // Vivid warning fill
    infoSolid: 'bg-[hsl(var(--status-info))]',       // Vivid info fill
    purpleSolid: 'bg-[hsl(var(--status-purple))]',   // Vivid purple/special fill

    // ✅ ENTERPRISE MISSING STATUS VARIANTS - Use CSS variables for theme support
    danger: 'bg-[hsl(var(--bg-error))]',           // Danger background (alias for error, theme-aware)
    successHover: 'bg-[hsl(var(--bg-success))]/80',  // Success hover state
    dangerHover: 'bg-[hsl(var(--bg-error))]/80',     // Danger hover state

    // Subtle variants - ✅ ENTERPRISE FIX: Use CSS variables for theme support
    successSubtle: 'bg-[hsl(var(--bg-success))]/50',  // Soft success
    errorSubtle: 'bg-[hsl(var(--bg-error))]/50',      // Soft error
    infoSubtle: 'bg-[hsl(var(--bg-info))]/50',        // Soft info
    neutralSubtle: 'bg-muted',                         // Soft neutral
    warningSubtle: 'bg-[hsl(var(--bg-warning))]/50',  // Soft warning
    errorLight: 'bg-[hsl(var(--bg-error))]/30',       // Light error background
    warningLight: 'bg-[hsl(var(--bg-warning))]/30',   // Light warning background

    // Disabled state
    disabled: 'bg-muted/50',       // Disabled field background — unified across Input, Select, Combobox

    // Special backgrounds
    light: 'bg-card',              // ✅ ENTERPRISE: Light surface (was white, now beautiful blue)
    transparent: 'bg-transparent', // Transparent

    // ✅ GOOGLE-STYLE FIX: Missing constraint colors
    yellow: 'bg-yellow-100',       // Yellow constraint backgrounds
    orange: 'bg-orange-100',       // Orange constraint backgrounds
    purple: 'bg-purple-100',       // Purple constraint backgrounds
    magenta: 'bg-pink-100',        // Magenta constraint backgrounds (pink is closest)

    // ✅ ENTERPRISE: Dark theme modal backgrounds (ModalContainer variants)
    infoDark: 'bg-blue-950/40',          // Dark info background for modals
    successDark: 'bg-green-950/40',      // Dark success background for modals
    warningDark: 'bg-orange-950/40',     // Dark warning background for modals
    errorDark: 'bg-red-950/40',          // Dark error background for modals
    slateDark: 'bg-slate-800/50',        // Dark slate background for default modals
    slateLight: 'bg-slate-800/60',       // Slightly lighter slate for upload modals

    // ✅ ENTERPRISE: Panel backgrounds on dark UIs (CursorSettingsPanel, debug panels)
    warningPanel: 'bg-yellow-900/30',    // Warning on dark panels (soft yellow)
    infoPanel: 'bg-blue-900/30',         // Info on dark panels (soft blue)
    successPanel: 'bg-green-900/30',     // Success on dark panels (soft green)
    errorPanel: 'bg-red-900/30',         // Error on dark panels (soft red)

    // ✅ ENTERPRISE: Debug overlay colors (LayoutMapper, visual debugging)
    debugBlue: 'bg-blue-500',            // Debug: Toolbar elements
    debugYellow: 'bg-yellow-500',        // Debug: Ruler elements
    debugGreen: 'bg-green-500',          // Debug: Canvas elements
    debugPurple: 'bg-purple-500',        // Debug: Layer elements
    debugRed: 'bg-red-500',              // Debug: Crosshair elements
    debugOrange: 'bg-orange-500',        // Debug: Section containers
    debugPink: 'bg-pink-500',            // Debug: Container elements
    debugIndigo: 'bg-indigo-500',        // Debug: Layout elements
    debugTeal: 'bg-teal-500',            // Debug: Control panels

    // ✅ ENTERPRISE: Button colors (tests-modal, debug UI)
    purpleButton: 'bg-purple-600',       // Purple primary button
    purpleButtonHover: 'bg-purple-700',  // Purple button hover

    // ✅ ENTERPRISE: Missing bg colors for component compatibility
    accentSubtle: 'bg-accent/20',        // Subtle accent for badges, highlights
    backgroundTertiary: 'bg-muted/70',   // Tertiary background surfaces
    gradient: 'bg-gradient-to-br from-primary/10 to-accent/10', // Generic gradient bg

    // ✅ ENTERPRISE FIX: Missing bg colors for BuildingCardUtils, SafePDFLoader
    mutedLight: 'bg-muted/30',           // Light muted background
    dangerSubtle: 'bg-red-100',          // Subtle danger background

    // 🏢 Property Showcase brand surfaces (ADR-312 Phase 3.8) — fixed in both modes
    showcase: 'bg-[hsl(var(--showcase-bg))]',          // Navy brand surface (#1D283A)
    showcaseSurface: 'bg-[hsl(var(--showcase-surface))]', // Slightly lighter navy card
  },

  /** 📝 Text Color Mappings */
  text: {
    // Core text colors
    primary: 'text-foreground',           // Main text → --foreground
    secondary: 'text-muted-foreground',   // Secondary text → --muted-foreground
    muted: 'text-muted-foreground',       // Muted text → --muted-foreground
    inverse: 'text-primary-foreground',   // Text on dark backgrounds
    inverted: 'text-primary-foreground',  // ✅ ENTERPRISE: Alias for inverse
    foreground: 'text-foreground',        // ✅ ENTERPRISE: Direct foreground mapping

    // ✅ ENTERPRISE FIX: Missing text colors for LayersSettings, ProSnapToolbar, ZoomControls
    WHITE: 'text-white',                  // White text for LayersSettings, ProSnapToolbar, ZoomControls
    BLACK: 'text-black',                  // Black text for light buttons (DebugToolbar)
    DARKER: 'text-gray-800',              // Darker text for ui/effects

    // Status text colors (WCAG AA: -700 for 4.5:1 contrast on light backgrounds)
    // ✅ ADR-365 follow-up: success/price point to --text-success var (SSoT) — one source,
    //    matches green-700 in light, auto green-400 in dark. (was duplicated 'text-green-700')
    success: 'text-[hsl(var(--text-success))]', // Success text (theme-aware SSoT)
    error: 'text-[hsl(var(--text-error))]',   // ADR-770 §18 — θεματικό (ήταν text-red-700 = σκούρο κόκκινο και στο σκοτεινό)
    warning: 'text-[hsl(var(--text-warning))]', // ADR-770 §18 — θεματικό (ήταν text-yellow-700)
    info: 'text-[hsl(var(--text-info))]',     // ADR-770 §18 — θεματικό (ήταν text-blue-700 = αόρατο στο σκοτεινό)
    price: 'text-[hsl(var(--text-success))]', // Price text (reuse success SSoT)

    // ✅ Text on SOLID status fills (vivid bg) — ADR-365 follow-up
    onSolid: 'text-white',                // White text on *Solid status backgrounds
    // 🔑 ADR-854: ΤΟ ΜΕΛΑΝΙ ΔΕΝ ΕΙΝΑΙ ΠΑΝΤΑ ΛΕΥΚΟ. Τα *Solid δεν έχουν ίδια φωτεινότητα:
    // μετρημένο με λευκό → error 4,80:1 · info 5,20:1 ✅ ΑΛΛΑ success 2,30:1 · warning 3,15:1 ❌.
    // Με ΜΑΥΡΟ τα δύο τελευταία γίνονται 9,14:1 και 6,66:1. Άρα κάθε *Solid ζευγαρώνει με
    // ΣΥΓΚΕΚΡΙΜΕΝΟ μελάνι, όχι με το «προεπιλεγμένο λευκό» — βλ. ADR-854 §3.
    // ⛔ ΜΗΝ το κάνεις `text-foreground`: εκείνο αλλάζει ανά θέμα (σκούρο στο φωτεινό,
    // ΣΧΕΔΟΝ ΛΕΥΚΟ στο σκοτεινό) και θα έσπαγε πάνω σε γέμισμα που κρατά τον τόνο του.
    // ΓΙΑΤΙ ΕΞΑΙΡΕΙΤΑΙ ΑΠΟ ΤΟ CHECK 3.42: το μελάνι αυτό ΔΕΝ είναι ελεύθερο. Μοναδικός
    // καταναλωτής το `TONE_PAIRS` του IconCountBadge (ADR-854 §3), που το επιτρέπει ΜΟΝΟ
    // πάνω σε `successSolid` / `warningSolid`. Και τα δύο ζεύγη μετρήθηκαν ΚΑΙ ΣΤΑ ΔΥΟ
    // θέματα: success 9,14/6,27 (το `--status-success` ΟΝΤΩΣ σκουραίνει στο σκοτεινό,
    // 142 71% 45% → 142 76% 36%) · warning 6,66/6,66 (ίδιο token και στα δύο) ⇒ ≥4,5:1
    // παντού όπου επιτρέπεται. Οι 21 επιφάνειες που καταγγέλλει η πύλη είναι ΑΚΡΙΒΩΣ
    // αυτές που το ζεύγος ΔΕΝ επιτρέπει — τον περιορισμό δεν τον βλέπει, γιατί τα *Solid
    // είναι css-var. ⚠️ Καταναλωτής εκτός TONE_PAIRS ⇒ ο λόγος γίνεται ΨΕΥΔΗΣ· μέτρα ξανά.
    // theme-exempt: δεσμευμένο μελάνι ζεύγους — μόνο πάνω σε successSolid/warningSolid, μετρημένο 9,14/6,27 και 6,66/6,66 (ADR-854 §3)
    onSolidDark: 'text-black',            // Σταθερό σκούρο μελάνι για ΑΝΟΙΧΤΑ *Solid (success/warning)

    // Strong text variants
    successStrong: 'text-green-800',      // Strong success text
    errorStrong: 'text-red-800',          // Strong error text

    // ✅ ENTERPRISE MISSING VARIANTS - ADDED FOR COMPONENT COMPATIBILITY
    danger: 'text-[hsl(var(--text-error))]',  // ADR-770 §18 — alias του error, ίδιο θεματικό token
    accent: 'text-blue-700',              // Accent text (alias for info)
    tertiary: 'text-slate-500',           // Tertiary text για DynamicInput components

    // ✅ ENTERPRISE FIX: Missing text colors for TestResultsModal and other components
    disabled: 'text-gray-400',            // Disabled text state

    // ✅ GOOGLE-STYLE FIX: Missing constraint text colors
    yellow: 'text-yellow-600',            // Yellow constraint text
    orange: 'text-orange-600',            // Orange constraint text
    purple: 'text-purple-600',            // Purple constraint text
    magenta: 'text-pink-600',             // Magenta constraint text (pink is closest)

    // ✅ ENTERPRISE FIX: Missing text color for LayoutMapper debug components
    RED_LIGHT: 'text-red-400',            // Light red text for debug components

    // ✅ ENTERPRISE FIX: Missing mutedInverted for ComboBox.tsx and EnterpriseComboBox.tsx
    mutedInverted: 'text-white',           // Muted text on dark backgrounds

    // ✅ ENTERPRISE: Light variants for dark backgrounds (calibration overlays, debug panels)
    infoLight: 'text-blue-300',           // Info text on dark backgrounds
    infoLighter: 'text-blue-200',         // Lighter info text on dark backgrounds
    infoAccent: 'text-blue-400',          // Info accent (icons on dark backgrounds)
    successLight: 'text-green-300',       // Success text on dark backgrounds
    successLighter: 'text-green-400',     // Lighter success text on dark backgrounds
    successAccent: 'text-green-400',      // Success accent (icons on dark backgrounds)
    warningLight: 'text-yellow-300',      // Warning text on dark backgrounds
    warningLighter: 'text-yellow-200',    // Lighter warning text (panels, notes)
    warningTitleLight: 'text-orange-300', // Warning title on dark backgrounds
    errorLight: 'text-red-300',           // Error text on dark backgrounds
    errorAccent: 'text-red-400',          // Error accent (icons on dark backgrounds)
    orangeLight: 'text-orange-400',       // Orange text on dark backgrounds
    cyanLight: 'text-cyan-300',           // Cyan/info accent on dark backgrounds
    cyanAccent: 'text-cyan-400',          // Cyan accent (headers on dark backgrounds)

    // ✅ ENTERPRISE: Slate variants for modal dark themes
    slateLight: 'text-slate-200',         // Light slate text for modals
    slateMuted: 'text-slate-400',         // Muted slate text for modals

    // ✅ ENTERPRISE: Purple variants for button descriptions
    purpleLight: 'text-purple-200',       // Light purple text for button descriptions

    // ✅ ENTERPRISE FIX: onStatus text colors (text that appears ON status backgrounds)
    onSuccess: 'text-green-800',          // Text on success backgrounds
    onError: 'text-red-800',              // Text on error backgrounds
    onInfo: 'text-blue-800',              // Text on info backgrounds
    onWarning: 'text-yellow-800',         // Text on warning backgrounds

    // 🏢 Property Showcase brand text (ADR-312 Phase 3.8) — fixed in both modes
    onShowcase: 'text-[hsl(var(--showcase-fg))]',         // Primary text on showcase navy
    onShowcaseMuted: 'text-[hsl(var(--showcase-muted-fg))]', // Muted text on showcase navy
  },

  /** 🔲 Border Color Mappings */
  border: {
    // Core borders
    default: 'border-border',             // Default border → --border
    muted: 'border-border',               // Muted border → --border
    primary: 'border-border',             // Primary border → --border
    secondary: 'border-border',           // Secondary border → --border

    // ✅ ENTERPRISE FIX: Missing border colors for ProSnapToolbar, UnitTestsTab
    MUTED: 'border-muted',                // Muted border for ProSnapToolbar, UnitTestsTab

    // Interactive borders
    focus: 'border-ring',                 // Focus border → --ring
    input: 'border-input',                // Input border → --input
    checkbox: 'border-[1px] border-[rgb(229, 231, 235)] rounded-md', // ✅ ENTERPRISE: Checkbox borders

    // Status borders
    success: 'border-green-300',          // Success border
    error: 'border-red-300',              // Error border
    warning: 'border-yellow-300',         // Warning border
    info: 'border-blue-300',              // Info border

    // 🏢 Property Showcase border (ADR-312 Phase 3.8)
    showcase: 'border-[hsl(var(--showcase-border))]',
  },

  /** 💍 Ring Color Mappings (Focus States) */
  ring: {
    // Core rings
    default: 'ring-ring',                 // Default ring → --ring
    muted: 'ring-ring/50',               // Muted ring → --ring with opacity
    primary: 'ring-ring',                // Primary ring → --ring

    // Status rings
    success: 'ring-green-500',           // Success ring
    error: 'ring-red-500',               // Error ring
    warning: 'ring-yellow-500',          // Warning ring
    info: 'ring-blue-500',               // Info ring
  },

  /** 🎯 Interactive State Mappings (Legacy Support) */
  interactive: {
    focus: {
      ring: 'focus:ring-2 focus:ring-ring',  // Focus ring → --ring
    },
    // ✅ ENTERPRISE FIX: Missing hover object for panel-tokens.ts TS2339 errors
    hover: {
      bg: 'hover:bg-accent/50',             // Hover background effect
      text: 'hover:text-foreground',        // Hover text effect
      border: 'hover:border-ring',          // Hover border effect
      scale: 'hover:scale-105',             // Hover scale effect

      // ✅ ENTERPRISE FIX: Additional properties for panel-tokens compatibility
      background: 'hover:bg-accent/50',     // Alias for bg (panel-tokens compatibility)
      error: 'hover:text-red-600',          // Error hover text effect
    },
  },

  /**
   * ☑️ ΡΟΛΟΣ ΧΕΙΡΙΣΤΗΡΙΟΥ ΕΠΙΛΟΓΗΣ (ADR-770 §17 · γενίκευση ADR-682 §5.5)
   *
   * Radio, checkbox, switch, progress και επιλεγμένη μέρα ημερολογίου ζητούσαν `primary`,
   * που εδώ είναι **επιφάνεια** (`.dark --primary` ≡ `--card` ⇒ 1,00:1): η επιλογή υπήρχε
   * και ήταν αόρατη. Material 3 (`primary`/`on-primary`/`outline`), Fluent 2 και Radix
   * Themes (`--accent-indicator`/`--accent-contrast`) απαντούν με **έναν** ρόλο — εδώ τα
   * `--control-*` του `globals.css`. Η άγκυρα Ο5 (`theme-token-hygiene.test.js`) εκτελεί τη
   * μηχανή WCAG στις τιμές **και** ελέγχει ότι κανένας δείκτης κατάστασης δεν ζητά επιφάνεια.
   */
  selectionControl: {
    /** Περίγραμμα ανεπίλεκτου — WCAG 1.4.11 ≥3:1 (το `--input` έδινε 1,31:1). */
    outline: 'border-control-outline',
    checkedOutline: 'data-[state=checked]:border-control-accent',
    /** Περίγραμμα επιλεγμένου χωρίς Radix state (κάρτα `role="radio"`, ADR-866 §2.10.8 Β4) — όπως `fill` ↔ `checkedFill`. */
    accentOutline: 'border-control-accent',
    checkedFill: 'data-[state=checked]:bg-control-accent',
    /** Μελάνι ΠΑΝΩ στον τονισμό (✓) — αντιστρέφεται σε σκούρο στο σκοτεινό θέμα. */
    checkedInk: 'data-[state=checked]:text-control-accent-foreground',
    /** Δείκτης που κάθεται σε επιφάνεια (κουκκίδα radio). */
    indicator: 'text-control-accent',
    /** Γεμάτος δείκτης χωρίς Radix state (progress, επιλεγμένη μέρα). */
    fill: 'bg-control-accent',
    fillInk: 'text-control-accent-foreground',
    /** ADR-770 §18 — η ΡΑΓΑ κάτω από γέμισμα (progress). Ήταν `bg-secondary` = ΙΔΙΟ με το `--card`
     *  στο σκοτεινό ⇒ «26%» χωρίς ορατό «από πόσο». Ίδια οικογένεια με το `--control-outline`
     *  (M3 `outline`), σε 25% ώστε να διαβάζεται ως κενό, όχι ως δεύτερο γέμισμα. */
    track: 'bg-control-outline/25',
    /**
     * ADR-770 §19 — **ΠΑΤΗΜΕΝΟ ΚΟΥΜΠΙ** (Fluent `ToggleButton` checked · M3 segmented selected). Ήταν
     * `variant={x ? 'default' : 'outline'}` σε 111 σημεία: `bg-primary`/`bg-secondary` ≡ `--card` στο σκοτεινό ⇒
     * το πατημένο χανόταν. Μία σύνθεση για `ToggleButton` · `SegmentedControl` · `Toggle` — ποτέ χειρόγραφη.
     */
    pressed:
      'border-control-accent bg-control-accent text-control-accent-foreground hover:bg-control-accent/90 hover:text-control-accent-foreground',
    /** Το ίδιο για Radix Toggle/ToggleGroup, όπου την κατάσταση τη γράφει το `data-state`. */
    pressedOn:
      'data-[state=on]:border-control-accent data-[state=on]:bg-control-accent data-[state=on]:text-control-accent-foreground data-[state=on]:hover:bg-control-accent/90 data-[state=on]:hover:text-control-accent-foreground',
  },

  /**
   * 🎯 ΙΕΡΑΡΧΙΑ ΕΝΕΡΓΕΙΩΝ (ADR-770 §18) — «ποιο κουμπί πατάω;» έχει ΜΙΑ απάντηση ανά οθόνη.
   *
   * ⚠️ ΓΙΑΤΙ ΟΧΙ `<Button variant="default">`: είναι `bg-primary`, και το `--primary` εδώ
   * είναι ΕΠΙΦΑΝΕΙΑ (`.dark --primary` ≡ `--card`) ⇒ το «κύριο» κουμπί στο σκοτεινό ΣΒΗΝΕΙ
   * μέσα στην κάρτα και μοιάζει με όλα τα άλλα. ⛔ Όχι αλλαγή του `--primary` (ADR-682 §5.5)·
   * ⛔ όχι δανεισμός του `--control-accent` (ρόλος ΧΕΙΡΙΣΤΗΡΙΟΥ — δύο σημασίες σε ένα token).
   *
   * 🔑 Ανεστραμμένο μονόχρωμο (Vercel · Linear · GitHub Primer «emphasis»): το ζεύγος
   * `--foreground`/`--background` είναι θεματικό ΕΞ ΟΡΙΣΜΟΥ, ~14:1 και στα δύο θέματα.
   * Ήταν ήδη η κύρια ενέργεια του δημόσιου site, γραμμένη με το χέρι σε 2 αρχεία.
   */
  action: {
    /** ΜΙΑ ανά οθόνη — η επόμενη κίνηση. */
    primary: 'bg-foreground text-background hover:bg-foreground/90',
    /** Δευτερεύουσα — περίγραμμα, καμία γέμιση. */
    secondary: 'border border-border bg-transparent text-foreground hover:bg-accent/50',
    /** Πράξη που αλλάζει τι βλέπει ο ΚΟΣΜΟΣ (απόσυρση) — μελάνι άρνησης, ΟΧΙ γέμισμα:
     *  αναστρέψιμη, άρα δεν φωνάζει όσο μια διαγραφή (GitHub «Danger zone»). */
    caution: 'border border-border bg-transparent text-[hsl(var(--text-error))] hover:bg-[hsl(var(--bg-error))]/10',
  },

  /** 🔘 ENTERPRISE SWITCH TOKENS - Status-based toggle colors (ADR-128) */
  switch: {
    // Default variant — ADR-770 §17: ρόλος χειριστηρίου επιλογής. OFF = περιγραμμένη τροχιά
    // + λαβή `outline` (M3 `unselected-handle-color → outline` · Fluent `colorNeutralStrokeAccessible`)·
    // ON = τροχιά τονισμού + λαβή `on-accent`. Ήταν `bg-primary`/`bg-input` ⇒ ON αόρατο (σκοτ.),
    // OFF 1,33:1 (φωτ.).
    default: {
      checked: 'data-[state=checked]:bg-control-accent',
      unchecked: 'data-[state=unchecked]:bg-transparent data-[state=unchecked]:border-control-outline',
      thumb: 'data-[state=checked]:bg-control-accent-foreground data-[state=unchecked]:bg-control-outline',
    },
    // Status variant (green ON / red OFF) - for visibility toggles
    status: {
      checked: 'data-[state=checked]:bg-green-500',
      unchecked: 'data-[state=unchecked]:bg-red-500',
      thumb: 'bg-background',
    },
    // Success variant (green ON / muted OFF)
    success: {
      checked: 'data-[state=checked]:bg-green-500',
      unchecked: 'data-[state=unchecked]:bg-input',
      thumb: 'bg-background',
    },
    // Destructive variant (red ON / muted OFF)
    destructive: {
      checked: 'data-[state=checked]:bg-destructive',
      unchecked: 'data-[state=unchecked]:bg-input',
      thumb: 'bg-background',
    },
  },

  /** 🌈 ENTERPRISE GRADIENT MAPPINGS - Professional gradient patterns */
  gradients: {
    // Map-specific gradients
    mapSuccess: 'bg-gradient-to-br from-green-100 via-blue-50 to-green-100',  // Maps success areas
    mapWarning: 'bg-gradient-to-br from-yellow-100 via-orange-50 to-yellow-100', // Maps warning areas
    mapInfo: 'bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-100',    // Maps info areas

    // Generic gradients
    successSubtle: 'bg-gradient-to-r from-green-50 to-green-100',           // Soft success
    warningSubtle: 'bg-gradient-to-r from-yellow-50 to-yellow-100',         // Soft warning
    infoSubtle: 'bg-gradient-to-r from-blue-50 to-blue-100',               // Soft info
    neutralSubtle: 'bg-gradient-to-r from-gray-50 to-gray-100',            // Soft neutral

    // Card gradients
    cardElevated: 'bg-gradient-to-b from-card to-muted',                    // Elevated cards
    cardInteractive: 'bg-gradient-to-br from-card via-accent/5 to-card',    // Interactive cards

    // ✅ ENTERPRISE FIX: Missing gradient for DebugToolbar TS2339 error
    GRADIENT_PURPLE_PINK: 'bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600', // Purple-pink gradient for debug UI

    // ✅ ENTERPRISE: Test button gradients
    testButtonPrimary: 'bg-gradient-to-r from-purple-600 to-blue-600', // Purple to blue button gradient
  },
} as const;

/**
 * 🔍 Type Definitions for Bridge Mappings
 * Compile-time safety for color bridge usage
 */
export type BgColorKey = keyof typeof COLOR_BRIDGE.bg;
export type TextColorKey = keyof typeof COLOR_BRIDGE.text;
export type BorderColorKey = keyof typeof COLOR_BRIDGE.border;

/**
 * 🎯 Bridge Validation Helpers
 * Runtime checks to ensure mappings are valid
 */
export const validateBridgeMapping = (
  category: keyof typeof COLOR_BRIDGE,
  key: string
): boolean => {
  return key in COLOR_BRIDGE[category];
};

/**
 * 📊 Bridge Statistics
 * Useful for migration tracking and analytics
 */
export const BRIDGE_STATS = {
  totalMappings: Object.keys(COLOR_BRIDGE.bg).length +
                 Object.keys(COLOR_BRIDGE.text).length +
                 Object.keys(COLOR_BRIDGE.border).length,
  backgroundMappings: Object.keys(COLOR_BRIDGE.bg).length,
  textMappings: Object.keys(COLOR_BRIDGE.text).length,
  borderMappings: Object.keys(COLOR_BRIDGE.border).length,
} as const;

/**
 * 🎨 Default Export
 * Main bridge for consumption by useSemanticColors
 */
export default COLOR_BRIDGE;