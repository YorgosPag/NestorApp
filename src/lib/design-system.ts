// Design system utilities για consistent styling
import { designTokens } from '@/styles/design-tokens';
import { borders } from '@/styles/design-tokens';
import { COLOR_BRIDGE, SOLID_FILL_INK, type SolidFillKey } from '@/design-system/color-bridge';

// ✅ CENTRALIZED: Import + re-export cn from canonical source (@/lib/utils)
import { cn } from '@/lib/utils';
export { cn };

type StatusToken = 'status-success' | 'status-info' | 'status-warning' | 'status-error' | 'status-purple';

/** Η ΜΙΑ αντιστοίχιση «λέξη κατάστασης → token». Άγνωστη λέξη ⇒ `status-info` (εφεδρεία). */
const resolveStatusToken = (status: string): StatusToken => {
  const statusColorMap: Record<string, StatusToken> = {
    // Property statuses
    'for-sale': 'status-success',
    'available': 'status-success',
    'active': 'status-success',
    'success': 'status-success',
    
    'for-rent': 'status-info',
    'planned': 'status-info',
    'pending': 'status-info',
    'info': 'status-info',
    
    'reserved': 'status-warning',
    'construction': 'status-warning',
    'in_progress': 'status-warning',
    'warning': 'status-warning',
    
    'sold': 'status-error',
    'cancelled': 'status-error',
    'error': 'status-error',
    
    'landowner': 'status-purple',
    'completed': 'status-purple',
    'owner': 'status-purple',
  };

  return statusColorMap[status] ?? 'status-info';
};

// Status color utilities (CSS-class generator — distinct from domain-typed getStatusColor in @/lib/status-helpers)
// ⛔ ΜΗΝ συνδυάσεις `'bg'` + `'text'` στο ΙΔΙΟ στοιχείο: ίδιο token ⇒ 1,00:1, αόρατο (ADR-770, CHECK 3.38).
//    Για «σήμα/κουτί κατάστασης» χρησιμοποίησε τους ΡΟΛΟΥΣ πιο κάτω (`getStatusBadgeVariant` · `getStatusSolidClass` ·
//    `getStatusSurfaceClass`).
const getStatusColorClass = (status: string, variant: 'bg' | 'text' | 'border' = 'text') =>
  STATUS_COLOR_CLASSES[resolveStatusToken(status)][variant];

/**
 * Οι κλάσεις χρώματος κατάστασης, **ολόκληρες και κυριολεκτικές**.
 *
 * 🔴 ΓΙΑΤΙ ΕΙΝΑΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΠΑΡΕΜΒΟΛΗ (μετρημένο στον browser, 2026-10-10): ως τότε το όνομα συντίθετο από
 * πρόθεμα + μεταβλητή μέσα σε template literal. Το Tailwind σαρώνει **κείμενο**: κλάση που δεν υπάρχει αυτούσια σε αρχείο
 * του `content` δεν παράγεται ποτέ. Από τους 15 συνδυασμούς οι **7 δεν είχαν CSS** — ανάμεσά τους το κόκκινο κείμενο
 * σφάλματος. Οι υπόλοιποι 8 δούλευαν **κατά σύμπτωση** (η ίδια συμβολοσειρά υπήρχε αλλού). Το μήνυμα σύγκρουσης
 * ορόφων έβγαινε λευκό, ίδιο με μια προειδοποίηση.
 *
 * ⚠️ ΜΗΝ το ξανακάνεις παρεμβολή, και ΜΗΝ βγάλεις αυτό το αρχείο από το `content` του `tailwind.config.ts`.
 * ⚠️ ΜΗΝ γράψεις εδώ **ούτε σε σχόλιο** όνομα κλάσης με παρεμβολή: το αρχείο σαρώνεται, και το Tailwind γεννά CSS
 *    από ό,τι μοιάζει με κλάση — άκυρο CSS που ρίχνει ΟΛΟ το `globals.css` (συνέβη την ίδια μέρα, από αυτό το σχόλιο).
 * Άγκυρα: `src/lib/__tests__/design-system-status-classes.test.ts`.
 */
const STATUS_COLOR_CLASSES: Record<StatusToken, Record<'bg' | 'text' | 'border', string>> = {
  'status-success': {
    bg: 'bg-[hsl(var(--status-success))]',
    text: 'text-[hsl(var(--status-success))]',
    border: 'border-[hsl(var(--status-success))]',
  },
  'status-info': {
    bg: 'bg-[hsl(var(--status-info))]',
    text: 'text-[hsl(var(--status-info))]',
    border: 'border-[hsl(var(--status-info))]',
  },
  'status-warning': {
    bg: 'bg-[hsl(var(--status-warning))]',
    text: 'text-[hsl(var(--status-warning))]',
    border: 'border-[hsl(var(--status-warning))]',
  },
  'status-error': {
    bg: 'bg-[hsl(var(--status-error))]',
    text: 'text-[hsl(var(--status-error))]',
    border: 'border-[hsl(var(--status-error))]',
  },
  'status-purple': {
    bg: 'bg-[hsl(var(--status-purple))]',
    text: 'text-[hsl(var(--status-purple))]',
    border: 'border-[hsl(var(--status-purple))]',
  },
};
const getStatusColor = getStatusColorClass;
export { getStatusColor };

/** Οι παραλλαγές του `<Badge>` που ζωγραφίζουν κατάσταση (⊂ `BadgeVariantProps['variant']` ⊂ `BadgeVariant` του core). */
export type StatusBadgeVariant = 'success' | 'info' | 'warning' | 'error' | 'purple';
type SubtleStatusKey = 'success' | 'info' | 'warning' | 'error';

/**
 * 🔑 ΡΟΛΟΙ ΚΑΤΑΣΤΑΣΗΣ — γέμισμα και μελάνι ΠΟΤΕ από το ίδιο token (ADR-770 · 2026-10-29).
 *
 * 🔴 ΓΙΑΤΙ (μετρημένο στον browser, PO-0001): `getStatusColor(x,'bg')` + `getStatusColor(x,'text')` ⇒ `color` =
 * `background-color` = `rgb(36,99,235)` ⇒ ετικέτα χωρίς ορατό κείμενο. Βρέθηκαν 38 τέτοια σημεία σε 14 αρχεία (AST, 2026-10-29).
 * ⚠️ Ούτε η διαφάνεια το σώζει (μετρημένο από το `globals.css`): `--status-success` πάνω σε `--status-success/15`
 * = **1,80:1** στο φωτεινό· σε `/10` κανένα από τα 5 tokens δεν φτάνει 4,5:1 σε καμία
 * επιφάνεια του φωτεινού (μέγ. 4,48)· στο σκοτεινό μόνο success/warning, και όχι πάνω σε κάρτα.
 *
 * Το σωστό ζεύγος είναι ΡΟΛΟΣ, όπως στο Material 3 (`container` / `on-container`), στο Atlassian Lozenge
 * (subtle / bold) και στο Primer (`Label` / `StateLabel`):
 *   · `badge`  → παραλλαγή `<Badge>` (συμπαγές + το μετρημένο μελάνι του, ADR-854 §3) — για ΧΑΠΙ.
 *   · `fill`   → συμπαγές γέμισμα ΧΩΡΙΣ `<Badge>` (κελί, κουκκίδα με κείμενο) — ίδιο ζεύγος με το `badge`.
 *   · `subtle` → απαλό `--bg-X` + `--text-X`: 5,78…7,84:1 και στα ΔΥΟ θέματα. Το purple ΔΕΝ έχει απαλό ζεύγος
 *                (δεν υπάρχουν `--bg-purple`/`--text-purple`) ⇒ πέφτει στο συμπαγές, ΡΗΤΑ, όχι σιωπηλά.
 * Άγκυρα: `src/lib/__tests__/design-system-status-classes.test.ts` · πύλη: CHECK 3.38 (`same-token-fill-ink.js`).
 */
const STATUS_ROLES: Record<StatusToken, { badge: StatusBadgeVariant; fill: SolidFillKey; subtle: SubtleStatusKey | null }> = {
  'status-success': { badge: 'success', fill: 'successSolid', subtle: 'success' },
  'status-info': { badge: 'info', fill: 'infoSolid', subtle: 'info' },
  'status-warning': { badge: 'warning', fill: 'warningSolid', subtle: 'warning' },
  'status-error': { badge: 'error', fill: 'errorSolid', subtle: 'error' },
  'status-purple': { badge: 'purple', fill: 'purpleSolid', subtle: null },
};

/** Χάπι κατάστασης: `<Badge variant={getStatusBadgeVariant('reserved')}>` — το `Badge` βάζει γέμισμα + μελάνι. */
export const getStatusBadgeVariant = (status: string): StatusBadgeVariant =>
  STATUS_ROLES[resolveStatusToken(status)].badge;

/** Συμπαγές γέμισμα κατάστασης + το ΜΕΤΡΗΜΕΝΟ μελάνι του (`SOLID_FILL_INK`) — όταν το στοιχείο δεν είναι `<Badge>`. */
export const getStatusSolidClass = (status: string): string => {
  const { fill } = STATUS_ROLES[resolveStatusToken(status)];
  return `${COLOR_BRIDGE.bg[fill]} ${COLOR_BRIDGE.text[SOLID_FILL_INK[fill]]}`;
};

/** Απαλή επιφάνεια κατάστασης + το μελάνι ΠΑΝΩ της (container / on-container): χάπι 10px, κελί, πλακίδιο εικονιδίου. */
export const getStatusSurfaceClass = (status: string): string => {
  const { subtle } = STATUS_ROLES[resolveStatusToken(status)];
  return subtle ? `${COLOR_BRIDGE.bg[subtle]} ${COLOR_BRIDGE.text[subtle]}` : getStatusSolidClass(status);
};

// Typography utilities
export const getTypographyClass = (
  size: keyof typeof designTokens.typography.fontSize,
  weight: keyof typeof designTokens.typography.fontWeight = 'normal',
  leading: keyof typeof designTokens.typography.lineHeight = 'normal'
) => {
  const sizeMap: Record<keyof typeof designTokens.typography.fontSize, string> = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl',
    '5xl': 'text-5xl',
    '6xl': 'text-6xl',
  };

  const weightMap = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  const leadingMap = {
    tight: 'leading-tight',
    snug: 'leading-snug',
    normal: 'leading-normal',
    relaxed: 'leading-relaxed',
    loose: 'leading-loose',
  };

  return cn(sizeMap[size], weightMap[weight], leadingMap[leading]);
};

// Spacing utilities
export const getSpacingClass = (
  type: 'p' | 'm' | 'gap',
  size: keyof typeof designTokens.spacing,
  direction?: 'x' | 'y' | 't' | 'r' | 'b' | 'l'
) => {
  const sizeMap = {
    xs: '2',
    sm: '3',
    md: '4',
    lg: '6',
    xl: '8',
    '2xl': '12',   // ✅ ENTERPRISE FIX: Added missing 2xl mapping
    '3xl': '16',   // ✅ ENTERPRISE FIX: Added missing 3xl mapping
    component: '4' // ✅ ENTERPRISE FIX: Added missing component mapping (fallback to md)
  } as Record<string, string>;

  const base = direction ? `${type}${direction}` : type;
  return `${base}-${sizeMap[size as keyof typeof sizeMap] || '4'}`; // ✅ ENTERPRISE FIX: Type safety with fallback
};

// Component size utilities
export const getComponentSizeClass = (
  component: keyof typeof designTokens.componentSizes,
  size: string
) => {
  const componentSizes = designTokens.componentSizes[component];
  return (componentSizes as Record<string, string>)[size] || (componentSizes as Record<string, string>).md;
};

// Interactive state utilities
export const getInteractiveStateClass = (
  type: keyof typeof designTokens.interactiveStates
) => {
  return designTokens.interactiveStates[type].full;
};

// Grid pattern utilities
export const getGridClass = (
  pattern: keyof typeof designTokens.gridPatterns
) => {
  const gridPattern = designTokens.gridPatterns[pattern];

  // ✅ ENTERPRISE: Handle different grid pattern structures
  if ('full' in gridPattern) {
    return gridPattern.full;
  }

  // Handle form patterns with specific full variants
  if (pattern === 'form') {
    return gridPattern.fullDouble; // Default form layout
  }

  // Fallback: construct basic grid class
  const mobile = 'mobile' in gridPattern ? gridPattern.mobile : 'grid-cols-1';
  const gap = 'gap' in gridPattern ? gridPattern.gap : 'gap-4';
  return `grid ${gap} ${mobile}`;
};

// Shadow utilities
export const getShadowClass = (size: keyof typeof designTokens.shadows) => {
  const shadowMap: Record<string, string> = {
    none: 'shadow-none',
    sm: 'shadow-sm',
    default: 'shadow',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    '2xl': 'shadow-2xl',
    inner: 'shadow-inner',
    focus: 'ring-2 ring-ring ring-offset-2', // ✅ ENTERPRISE FIX: Focus shadow
  };

  return shadowMap[size] || shadowMap.default;
};

// Border radius utilities
export const getBorderRadiusClass = (size: keyof typeof designTokens.borderRadius) => {
  const radiusMap: Record<string, string> = {
    none: 'rounded-none',
    xs: 'rounded-sm', // ✅ ENTERPRISE FIX: xs radius
    sm: 'rounded-sm',
    default: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    '3xl': 'rounded-3xl', // ✅ ENTERPRISE FIX: 3xl radius
    full: 'rounded-full',
  };

  return radiusMap[size] || radiusMap.default;
};

// Responsive utilities
export const getResponsiveClass = (
  breakpoint: keyof typeof designTokens.breakpoints,
  className: string
) => {
  if (breakpoint === 'sm') return `sm:${className}`;
  if (breakpoint === 'md') return `md:${className}`;
  if (breakpoint === 'lg') return `lg:${className}`;
  if (breakpoint === 'xl') return `xl:${className}`;
  if (breakpoint === '2xl') return `2xl:${className}`;
  return className;
};

// Color scheme utilities για theming
export const colorScheme = {
  light: {
    background: COLOR_BRIDGE.bg.primary,
    foreground: 'text-foreground',
    card: 'bg-card text-card-foreground',
    muted: 'bg-muted text-muted-foreground',
    accent: 'bg-accent text-accent-foreground',
  },
  dark: {
    background: `dark:${COLOR_BRIDGE.bg.primary}`,
    foreground: 'dark:text-foreground',
    card: 'dark:bg-card dark:text-card-foreground',
    muted: 'dark:bg-muted dark:text-muted-foreground',
    accent: 'dark:bg-accent dark:text-accent-foreground',
  },
  responsive: {
    background: `${COLOR_BRIDGE.bg.primary} dark:${COLOR_BRIDGE.bg.primary}`,
    foreground: 'text-foreground dark:text-foreground',
    card: 'bg-card text-card-foreground dark:bg-card dark:text-card-foreground',
    muted: 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground',
    accent: 'bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground',
  }
};

// Preset class combinations για common patterns
export const presets = {
  // Card presets
  card: {
    default: cn(
      'rounded-lg bg-card text-card-foreground shadow-sm',
      borders.variants.card.className,
      getInteractiveStateClass('card')
    ),
    interactive: cn(
      'rounded-lg bg-card text-card-foreground shadow-sm cursor-pointer',
      borders.variants.card.className,
      getInteractiveStateClass('card')
    ),
    elevated: cn(
      'rounded-lg bg-card text-card-foreground shadow-lg',
      borders.variants.modal.className,
      getInteractiveStateClass('card')
    ),
  },

  // Button presets
  button: {
    primary: cn(
      'inline-flex items-center justify-center rounded-md text-sm font-medium',
      'bg-primary text-primary-foreground',
      getComponentSizeClass('button', 'md'),
      getInteractiveStateClass('button')
    ),
    secondary: cn(
      'inline-flex items-center justify-center rounded-md text-sm font-medium',
      'bg-secondary text-secondary-foreground',
      getComponentSizeClass('button', 'md'),
      getInteractiveStateClass('button')
    ),
    outline: cn(
      'inline-flex items-center justify-center rounded-md text-sm font-medium',
      COLOR_BRIDGE.bg.primary,
      borders.variants.button.default.className,
      getComponentSizeClass('button', 'md'),
      getInteractiveStateClass('button')
    ),
  },

  // Layout presets
  layout: {
    container: 'container mx-auto px-4',
    section: 'py-8 px-4',
    grid: getGridClass('cards'),
    toolbar: cn(`flex items-center justify-between p-4 ${COLOR_BRIDGE.bg.primary}`, borders.variants.separator.horizontal.className),
  },

  // Text presets
  text: {
    title: getTypographyClass('2xl', 'semibold', 'tight'),
    subtitle: getTypographyClass('lg', 'medium', 'normal'),
    body: getTypographyClass('base', 'normal', 'normal'),
    caption: getTypographyClass('sm', 'normal', 'normal'),
    muted: cn(getTypographyClass('sm', 'normal', 'normal'), 'text-muted-foreground'),
  }
};

// Status badge utilities
export const getStatusBadgeClass = (status: string, variant: 'default' | 'outline' = 'default') => {
  const baseClass = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
  if (variant === 'outline') {
    return cn(
      baseClass,
      borders.variants.status[status as keyof typeof borders.variants.status]?.className || borders.variants.card.className,
      getStatusColor(status, 'border'),
      getStatusColor(status, 'text'),
      'bg-transparent'
    );
  }
  
  // Ως τις 2026-10-29 `text-white` παντού: success 2,30:1 · warning 3,16:1 (ADR-854 §3) ⇒ το μετρημένο μελάνι.
  return cn(baseClass, getStatusSolidClass(status));
};

// Form field utilities
export const getFormFieldClass = (hasError: boolean = false, disabled: boolean = false) => {
  return cn(
    `flex h-10 w-full rounded-md ${COLOR_BRIDGE.bg.primary} px-3 py-2 text-sm`,
    borders.variants.input.default.className,
    'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    {
      [borders.variants.status.error.className]: hasError,
      'focus-visible:ring-destructive': hasError,
      'cursor-not-allowed opacity-50': disabled,
    }
  );
};

// Export all utilities
export const designSystem = {
  cn,
  getStatusColor,
  getTypographyClass,
  getSpacingClass,
  getComponentSizeClass,
  getInteractiveStateClass,
  getGridClass,
  getShadowClass,
  getBorderRadiusClass,
  getResponsiveClass,
  getStatusBadgeClass,
  getStatusBadgeVariant,
  getStatusSolidClass,
  getStatusSurfaceClass,
  getFormFieldClass,
  colorScheme,
  presets,
} as const;
