// Design tokens — Component Sizes module
// Button, input, icon, avatar, dropdown size variants

// Component size variants
export const componentSizes = {
  // Button sizes
  button: {
    xs: 'h-6 px-2 text-xs',
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
    xl: 'h-14 px-8 text-lg',
  },

  // Input sizes
  input: {
    sm: 'h-8 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
  },

  // Icon sizes - ENTERPRISE EXTENDED SYSTEM
  icon: {
    // ============================================================================
    // 🎯 CORE ICON SIZES - EXISTING (BACKWARD COMPATIBLE)
    // ============================================================================
    xxs: 'h-2 w-2',      // 8px  - Micro icons
    xs: 'h-3 w-3',       // 12px - Tiny icons
    sm: 'h-4 w-4',       // 16px - Standard icons (most common)
    md: 'h-5 w-5',       // 20px - Medium icons
    lg: 'h-6 w-6',       // 24px - Large icons
    xl: 'h-8 w-8',       // 32px - Extra large icons
    '2xl': 'h-10 w-10',  // 40px - Double extra large

    // ============================================================================
    // 🚀 ENTERPRISE EXTENDED SIZES - PROFESSIONAL GRADE
    // ============================================================================
    // Following Tailwind spacing scale for consistency with enterprise standards
    xl2: 'h-12 w-12',    // 48px - Card headers, feature icons
    xl3: 'h-14 w-14',    // 56px - Section icons, user avatars
    xl4: 'h-16 w-16',    // 64px - Hero icons, prominent displays
    xl5: 'h-20 w-20',    // 80px - Large feature displays
    xl6: 'h-24 w-24',    // 96px - Loading spinners, thumbnails
    xl8: 'h-32 w-32',    // 128px - Large avatars, placeholders
    xl12: 'h-48 w-48',   // 192px - Empty states, splash screens

    // ============================================================================
    // 🏢 NUMERIC SIZES - FOR LUCIDE-REACT & SVG ICONS (size prop)
    // ============================================================================
    // Enterprise-grade numeric values for libraries that require pixel values
    numeric: {
      xxs: 8,    // Micro icons
      xs: 12,    // Tiny icons
      sm: 16,    // Standard icons (most common)
      md: 20,    // Medium icons
      lg: 24,    // Large icons
      xl: 32,    // Extra large icons
      '2xl': 40, // Double extra large
      xl2: 48,   // Card headers
      xl3: 56,   // Section icons
      xl4: 64,   // Hero icons
      xl5: 80,   // Large displays
      xl6: 96,   // Loading spinners
    },
  },

  // Avatar sizes
  avatar: {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  },

  // ============================================================================
  // 🎯 DROPDOWN / SELECT / COMBOBOX / POPOVER — SSOT TOKENS
  // ============================================================================
  // Single source of truth for ALL dropdown-family component dimensions.
  // Consumed via useDropdownTokens() hook in React components.
  // Pattern: Same as button/input/icon above.
  // ============================================================================
  dropdown: {
    // === TRIGGER SIZES (Select/Combobox trigger button) ===
    trigger: {
      sm: 'h-8 px-3 py-1.5 text-xs',    // Compact inline forms (~40 consumer sites)
      md: 'h-9 px-3 py-2 text-sm',      // Standard forms — most common (~75 sites)
      lg: 'h-10 px-3 py-2 text-sm',     // Default / spacious forms
    },

    // === CONTENT CONTAINER (dropdown floating panel) ===
    content: {
      padding: 'p-1',
      maxHeight: 'max-h-96',             // 384px — default
      maxHeightCompact: 'max-h-80',      // 320px — constrained lists
      maxHeightCombobox: 'max-h-60',     // 240px — searchable combobox
      minWidth: 'min-w-[8rem]',          // 128px — minimum dropdown width
      shadow: 'shadow-md',
      shadowElevated: 'shadow-lg',       // Sub-menus
      sideOffset: 4,                     // Radix numeric prop (px)
      zIndex: 'z-50',                    // Standard dropdown layer
      zIndexElevated: 'z-[2000]',        // Above FloatingPanel (1700)
    },

    // === MENU ITEM PADDING (3 distinct patterns) ===
    item: {
      standard: 'px-2 py-1.5',           // DropdownMenuItem, SubTrigger, Label
      indented: 'py-1.5 pl-8 pr-2',      // SelectItem, CheckboxItem, RadioItem (left icon space)
      combobox: 'px-3 py-1.5',           // SearchableCombobox items (wider padding)
      gap: 'gap-2',                       // Icon-to-text gap
      fontSize: 'text-sm',               // 14px — all items
      fontSizeSecondary: 'text-xs',       // 12px — secondary labels, hints
      fontWeightLabel: 'font-semibold',   // Group labels
      fontWeightOption: 'font-medium',    // Option primary text
    },

    // === INDICATOR (checkbox/radio icon container) ===
    indicator: {
      container: 'h-3.5 w-3.5',          // 14px icon box
      position: 'absolute left-2 flex items-center justify-center',
    },

    // === SEPARATOR ===
    separator: {
      margin: '-mx-1 my-1',
      height: 'h-px',
    },

    // === SCROLL BUTTONS ===
    scrollButton: 'py-1',

    // === SHORTCUT TEXT ===
    shortcut: 'ml-auto text-xs tracking-widest opacity-60',

    // === POPOVER (larger padding, standalone context) ===
    popover: {
      padding: 'p-4',
      width: 'w-72',                      // 288px default
    },

    // === COMBOBOX-SPECIFIC ===
    combobox: {
      inputPaddingRight: 'pr-16',         // Space for clear + chevron buttons
      listPadding: 'py-1',
      addNewSection: 'border-t p-1',
      addNewInput: 'h-8 text-sm flex-1',
      addNewButton: 'h-8 px-2 text-sm',
      addNewRow: 'gap-2 px-2 py-1',
      emptyState: 'p-3 text-sm',
      loadingState: 'py-4',
    },

    // === CONTACT DROPDOWN (domain-specific dimensions) ===
    contact: {
      contentMin: 'min-w-[300px]',
      contentMax: 'max-w-[450px]',
      resultsMaxHeight: 'max-h-[300px]',
      searchArea: 'p-3 border-b',
      searchIconPosition: 'absolute left-2 top-2.5',
      searchInputIndent: 'pl-8',
      contactItem: 'p-3 border-b border-border last:border-b-0',
      emptyState: 'p-4',
      createButton: 'p-3 text-sm font-medium',
      summaryFooter: 'p-3 text-center text-xs',
    },
  },
} as const;
