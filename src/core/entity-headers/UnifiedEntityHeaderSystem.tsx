/**
 * 🏢 UNIFIED ENTITY HEADER SYSTEM - ENTERPRISE PATTERN
 *
 * Κεντρικό React component για όλα τα entity detail headers
 * Single Source of Truth για Contact/Project/Building/Unit profile cards
 */

'use client';

import React from 'react';
import { EntityAvatar } from '@/design-system/primitives/Avatar/EntityAvatar';
import type { EntityAvatarSize, EntityAvatarSpec } from '@/design-system/primitives/Avatar/entity-avatar.types';
import { LucideIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useDetailsSheetActions, type DetailsSheetActionsSlot } from '@/core/layouts/details-sheet-actions';
import { EntityHeaderActions } from './EntityHeaderActions';
import { RecordHeaderActions } from './RecordHeaderActions';
import { orderEntityActions } from './entity-action-presets';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import '@/lib/design-system';

// ===== TYPES & INTERFACES =====

export interface EntityHeaderBadge {
  type: 'status' | 'progress' | 'category' | 'custom';
  value: string | number;
  variant?: 'default' | 'secondary' | 'outline';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

/**
 * **Έμφαση ενέργειας** (ADR-912 §12.13): `primary` = το ΕΝΑ γεμάτο κουμπί της γραμμής (το πρώτο, αν δηλωθούν πολλά) ·
 * `secondary` = ουδέτερο κουμπί · `destructive` = ζει **μόνο** στο μενού «⋯», με χρώμα κινδύνου.
 */
export type EntityActionEmphasis = 'primary' | 'secondary' | 'destructive';

export interface EntityHeaderAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  /** Ρητή όψη κουμπιού — υπερισχύει της έμφασης. Σπάνια· η έμφαση είναι ο κανόνας. */
  variant?: 'default' | 'outline' | 'ghost';
  /** Το γεμίζει το `createEntityAction` από τον τύπο. Απούσα ⇒ `secondary`. */
  emphasis?: EntityActionEmphasis;
  className?: string;
  disabled?: boolean;
  /**
   * **Η ενέργεια τρέχει ΤΩΡΑ** (ADR-332 D27 Ζ5). Απενεργοποιεί το κουμπί, δηλώνει `aria-busy` και
   * αντικαθιστά το εικονίδιο με δείκτη.
   *
   * 🔴 **Και τα τρία μαζί, όχι ένα από αυτά.** Το W3C (ARIA25) το γράφει ρητά για την «απασχολημένη»
   * περιοχή: *«Forgetting to also disable interactive controls inside the busy region is a common
   * mistake — sighted users still see and can click them»*. Μετρημένο ζωντανά στις επαφές: αποθήκευση
   * **61,4″** με το κουμπί ενεργό ⇒ δεύτερο πάτημα ⇒ δεύτερη εγγραφή.
   */
  pending?: boolean;
  /** Τι λέει όσο τρέχει (π.χ. «Αποθήκευση...»). Απών ⇒ μένει το `label`. */
  pendingLabel?: string;
  /**
   * Θέση στην κανονική σειρά (ADR-912 §12): μικρότερο = πιο μπροστά **και** τελευταίο που φεύγει στο μενού. Το γεμίζει
   * το `createEntityAction` από τον `ENTITY_ACTION_PRIORITY`· ρητή τιμή μόνο για δηλωμένη εξαίρεση.
   */
  priority?: number;
  /**
   * **Η ενέργεια εγκαταλείπει την επεξεργασία** (ADR-912 §12.5). Το γεμίζει το `createEntityAction` για τον τύπο
   * `cancel`. Στο φύλλο κινητού την αναλαμβάνει ο ✕ της μπάρας και **δεν** ζωγραφίζεται ως κουμπί· αλλού μένει κουμπί.
   */
  dismisses?: boolean;
  /**
   * **Η ενέργεια ανοίγει δικό της πεδίο και κρατά την εστίαση** (ADR-912 §12.14 — π.χ. επιτόπια μετονομασία αρχείου).
   * Από μενού: στο κλείσιμο η εστίαση δεν γυρίζει στο «⋯», αλλιώς το πεδίο που μόλις άνοιξε τη χάνει.
   */
  claimsFocus?: boolean;
  /**
   * **Διακόπτης, όχι πράξη** (ADR-912 §12.17 — εργαλεία μέτρησης, 3D της κάτοψης). Ορισμένο ⇒ στο μενού γίνεται
   * `menuitemcheckbox` με σημάδι (WAI-ARIA APG), ώστε ο άνθρωπος να βλέπει **ποιο είναι ενεργό** και χωρίς το κουμπί.
   */
  pressed?: boolean;
  /**
   * Θα χαθούν αλλαγές αν εκτελεστεί; Το δηλώνει η φόρμα που **ξέρει**. `false` ⇒ ο ✕ ακυρώνει χωρίς ερώτηση·
   * `undefined` (η φόρμα δεν το δήλωσε) ⇒ ρωτά: το άγνωστο δεν δηλώνει ποτέ «καθαρό».
   */
  discards?: boolean;
}

export interface EntityHeaderProps {
  // Required
  icon: LucideIcon;
  title: string;

  // Optional content
  subtitle?: string;
  badges?: EntityHeaderBadge[];
  actions?: EntityHeaderAction[];
  // Inline element rendered next to the title (e.g. interactive status pill).
  // Why: badges[] renders below and is non-interactive; this slot keeps the
  // pill on the title line — Linear/Gmail pattern for entity state.
  titleAdornment?: React.ReactNode;
  /** Identity image (photo / logo / monogram) in place of the icon — ADR-190 §Display */
  avatar?: EntityAvatarSpec;
  /** Opens the image viewer; makes the avatar a button */
  onAvatarClick?: () => void;
  /** Accessible name of that button */
  avatarActivateLabel?: string;

  // 🏢 ENTERPRISE: Flat icon color from NAVIGATION_ENTITIES (SSoT)
  // When provided → flat icon with this color (like breadcrumb). When omitted → gradient bg container.
  iconColor?: string;

  // Layout & Styling
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;

  /**
   * **Μέσο ταυτότητας** στη θέση του εικονιδίου (π.χ. γκαλερί φωτογραφιών) — η κεφαλίδα **σελίδας εγγραφής**
   * (ADR-777 §8.87): ταυτότητα αριστερά, ενέργειες δεξιά, ΜΙΑ φορά. Με `media` η διάταξη στοιβάζεται σε στενό
   * πλάτος και οι ενέργειες αναδιπλώνονται, αντί να ξεχειλίζουν.
   */
  media?: React.ReactNode;
  /** Γεγονότα ταυτότητας κάτω από τον υπότιτλο (π.χ. τιμή · εμβαδόν). */
  details?: React.ReactNode;
  /** Επίπεδο επικεφαλίδας του τίτλου. `1` όταν η κεφαλίδα **είναι** ο τίτλος της σελίδας. Προεπιλογή `3`. */
  headingLevel?: 1 | 3;

  // Custom content
  children?: React.ReactNode;
}

/** Avatar box per header variant — matches the icon box it replaces (xl2 = 48 · xl = 32). */
const AVATAR_SIZE_BY_VARIANT: Readonly<Record<NonNullable<EntityHeaderProps['variant']>, EntityAvatarSize>> = {
  default: 'lg',
  compact: 'sm',
  detailed: 'sm',
};

// ===== MAIN ENTITY HEADER COMPONENT =====

export const EntityDetailsHeader: React.FC<EntityHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  badges = [],
  actions = [],
  titleAdornment,
  avatar,
  onAvatarClick,
  avatarActivateLabel,
  iconColor,
  variant = 'default',
  className,
  media,
  details,
  headingLevel = 3,
  children
}) => {
  const Heading = headingLevel === 1 ? 'h1' : 'h3';
  const sheet = useDetailsSheetActions();
  const orderedActions = React.useMemo(() => orderEntityActions(actions), [actions]);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  const variantClasses = {
    default: "p-4",
    compact: "p-3",
    detailed: spacing.padding.sm  // 🏢 ENTERPRISE: Centralized 8px padding
  };

  const iconSizeClasses = {
    default: iconSizes.xl2,
    compact: iconSizes.xl,
    detailed: iconSizes.lg  // 🏢 ENTERPRISE: Μικρότερο εικονίδιο (όπως το PageHeader)
  };

  const titleSizes = {
    default: "text-lg",
    compact: "text-base",
    detailed: "text-xl"
  };

  // 📱 Μέσα στο φύλλο κινητού (ADR-912 §12) τον τίτλο τον λέει η μπάρα του φύλλου και οι ενέργειες αποδίδονται ΕΚΕΙ.
  //    Με `media` η κεφαλίδα ΕΙΝΑΙ η ταυτότητα της σελίδας (γκαλερί · γεγονότα) ⇒ μένει ολόκληρη.
  if (sheet && !media) {
    return (
      <EntityHeaderInSheet
        sheet={sheet}
        actions={orderedActions}
        icon={Icon}
        title={title}
        subtitle={subtitle}
        badges={badges}
        titleAdornment={titleAdornment}
        avatar={avatar}
        onAvatarClick={onAvatarClick}
        avatarActivateLabel={avatarActivateLabel}
        details={details}
      >
        {children}
      </EntityHeaderInSheet>
    );
  }

  return (
    <div className={cn(
      "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-t-lg",
      variantClasses[variant],
      className
    )}>
      {/*
        🔑 Με `media` η αναδίπλωση είναι **εγγενής** (`flex-wrap` + `basis`), όχι σημείο θραύσης οθόνης: η κεφαλίδα
        ζει μέσα σε κέλυφος με πλαϊνό μενού, άρα το πλάτος της **δεν** είναι το πλάτος της οθόνης. Μετρημένο
        2026-10-08 (ADR-777 §8.87.2): με `lg:flex-row` + ενέργειες `flex-shrink-0`, σε οθόνη 1024–1300px ο τίτλος
        είχε πλάτος **0** και οι ενέργειες έπεφταν πάνω στο μέσο. Τώρα οι ενέργειες κατεβαίνουν όταν η ταυτότητα
        δεν χωρά στη βάση της (`basis-[32rem]`: μέσο 12rem + 20rem κείμενο).
      */}
      {/*
        🔑 Χωρίς `media` (η μονόγραμμη κεφαλίδα — κτίρια, έργα, επαφές, στενή στήλη ακινήτων) οι ενέργειες
        **υπερχειλίζουν σε μενού** αντί να αναδιπλωθούν (ADR-777 §8.87.7).
        🔑 **Η ταυτότητα παίρνει ΠΡΩΤΗ το φυσικό της πλάτος** (`fit-content`), ως το 60% της γραμμής και ποτέ κάτω από
        16rem όταν χωρούν· οι ενέργειες παίρνουν **ό,τι περισσεύει** (`minmax(0,1fr)`) και αυτές υποχωρούν στο μενού.
        Ως τις 2026-10-09 ήταν `minmax(…16rem,1fr)` + `minmax(0,auto)`: το `auto` μεγάλωνε ως όλα τα κουμπιά ΠΡΙΝ πάρει
        οτιδήποτε το `1fr`, άρα όνομα πλατύτερο από 16rem κοβόταν δίπλα σε ορατές ενέργειες (μετρημένο §8.87.9γ1).
        ⚠️ Η στήλη ενεργειών ΔΕΝ γίνεται `auto`: το ελάχιστό της θα ήταν όλα τα κουμπιά και ο τίτλος θα έπεφτε στο 0 (§8.87.6γ).
      */}
      <div className={media
        ? "flex flex-wrap items-start justify-between gap-3"
        : actions.length > 0
          ? "grid grid-cols-[fit-content(min(100%,max(60%,16rem)))_minmax(0,1fr)] items-center gap-3"
          : "flex items-center justify-between"}>
        {/* Left side: Icon + Content */}
        <div className={media
          ? "flex flex-col gap-4 sm:flex-row sm:items-start flex-1 basis-[32rem] min-w-0"
          : "flex items-center gap-3 flex-1 min-w-0"}>
          {/* Media, Icon or Avatar */}
          {media ? media : avatar ? (
            <EntityAvatar
              {...avatar}
              size={AVATAR_SIZE_BY_VARIANT[variant]}
              onActivate={onAvatarClick}
              activateLabel={avatarActivateLabel}
              className="shadow-sm"
            />
          ) : iconColor ? (
            <Icon
              className={cn(
                "flex-shrink-0",
                iconColor,
                iconSizeClasses[variant]
              )}
            />
          ) : (
            <div
              className={cn(
                "flex items-center justify-center rounded-lg shadow-sm flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600",
                iconSizeClasses[variant]
              )}
            >
              <Icon className={cn(
                "text-white",
                variant === 'detailed' ? iconSizes.sm :
                variant === 'compact' ? iconSizes.sm :
                iconSizes.md
              )} />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row (title + optional inline adornment) */}
            {/* Τίτλος σελίδας (`media`): αναδιπλώνεται σε δύο γραμμές και το σήμα κατεβαίνει — δεν κόβεται στη μία. */}
            <div className={media ? "flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0" : "flex items-center gap-2 min-w-0"}>
              <Heading className={cn(
                "font-semibold text-foreground",
                media ? "line-clamp-2 min-w-0" : "line-clamp-1",
                titleSizes[variant]
              )}>
                {title}
              </Heading>
              {titleAdornment && (
                <div className="flex-shrink-0">{titleAdornment}</div>
              )}
            </div>

            {/* Subtitle */}
            {subtitle && (
              <p className={cn("text-sm mt-0.5 line-clamp-1", colors.text.muted)}>
                {subtitle}
              </p>
            )}

            {/* Badges */}
            {badges.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {badges.map((badge, index) => (
                  <EntityBadge key={index} {...badge} />
                ))}
              </div>
            )}

            {details && <div className="mt-3">{details}</div>}
          </div>
        </div>

        {/* Right side: Actions */}
        {/* Με `media` (σελίδα εγγραφής): επιτόπου σε φαρδιά οθόνη, κάτω μπάρα σε στενή (ADR-912 §12.13). */}
        {orderedActions.length > 0 && (media ? (
          <RecordHeaderActions actions={orderedActions} />
        ) : (
          <EntityHeaderActions actions={orderedActions} />
        ))}
      </div>

      {/* Custom children content */}
      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
};

// ===== IN-SHEET HEADER (ADR-912 §12) =====

type EntityHeaderInSheetProps = Pick<
  EntityHeaderProps,
  'icon' | 'title' | 'subtitle' | 'badges' | 'titleAdornment' | 'avatar' | 'onAvatarClick' | 'avatarActivateLabel' | 'details' | 'children'
> & {
  readonly sheet: DetailsSheetActionsSlot;
  readonly actions: readonly EntityHeaderAction[];
};

/**
 * Χωρίζει την Ακύρωση από τις ενέργειες της μπάρας και τη δηλώνει στο φύλλο — ο ✕ **είναι** η Ακύρωση (ADR-912 §12.5).
 * Επιστρέφει ό,τι μένει να ζωγραφιστεί ως κουμπιά.
 */
function useSheetDismissal(
  sheet: DetailsSheetActionsSlot,
  actions: readonly EntityHeaderAction[],
): readonly EntityHeaderAction[] {
  const dismissal = actions.find((action) => action.dismisses);
  const barActions = React.useMemo(
    () => (dismissal ? actions.filter((action) => action !== dismissal) : actions),
    [actions, dismissal],
  );
  const { claimDismissal } = sheet;

  // Σε κάθε render: ο χειριστής αλλάζει ταυτότητα, και ο ✕ πρέπει να καλέσει τον ΤΩΡΙΝΟ (το φύλλο κρατά μόνο ό,τι αλλάζει όψη).
  React.useLayoutEffect(() => {
    claimDismissal(dismissal ? {
      label: dismissal.label,
      onDismiss: dismissal.onClick,
      disabled: dismissal.disabled || dismissal.pending,
      discards: dismissal.discards,
    } : null);
  });
  React.useLayoutEffect(() => () => claimDismissal(null), [claimDismissal]);

  return barActions;
}

/**
 * **Η κεφαλίδα μέσα στο φύλλο κινητού**: οι ενέργειες πάνε στην μπάρα του φύλλου (portal — ΕΝΑ αντίτυπο στο DOM), ο
 * τίτλος δεν ξαναγράφεται. Ό,τι **δεν** είναι όνομα ή ενέργεια (φωτογραφία · χάπι κατάστασης · υπότιτλος · σήματα ·
 * γεγονότα) μένει σε λεπτή λωρίδα — αλλιώς θα χανόταν μαζί με τον διπλό τίτλο, όπως χάνονταν ως τώρα οι ενέργειες.
 *
 * 🔑 Το πλήρες όνομα γράφεται στη λωρίδα **μόνο όταν η μπάρα το κόβει** (ADR-912 §12.6), και μόνο για το μάτι
 *   (`aria-hidden`): το `h2` της μπάρας έχει ήδη ολόκληρο το κείμενο ⇒ ο αναγνώστης οθόνης το ακούει ΜΙΑ φορά.
 */
function EntityHeaderInSheet({
  sheet,
  actions: declaredActions,
  title,
  subtitle,
  badges = [],
  titleAdornment,
  avatar,
  onAvatarClick,
  avatarActivateLabel,
  details,
  children,
}: EntityHeaderInSheetProps) {
  const colors = useSemanticColors();
  // Στο φύλλο ο τίτλος ζει στη μπάρα ⇒ ένα σκέτο μονόγραμμα θα πρόσθετε γραμμή χωρίς πληροφορία· μόνο εικόνα.
  const sheetAvatar = avatar?.imageUrl ? avatar : undefined;
  const hasIdentityExtras = Boolean(sheetAvatar || titleAdornment || subtitle || badges.length > 0);
  const actions = useSheetDismissal(sheet, declaredActions);
  const { host, titleTruncated } = sheet;

  return (
    <>
      {host && actions.length > 0 && createPortal(<EntityHeaderActions actions={actions} keepPrimary />, host)}
      {(titleTruncated || hasIdentityExtras || details || children) && (
        <div className="flex flex-col gap-2 border-b px-3 py-2">
          {titleTruncated && (
            <p aria-hidden="true" data-details-sheet-full-title="" className="line-clamp-2 break-words text-base font-semibold text-foreground">
              {title}
            </p>
          )}
          {hasIdentityExtras && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {sheetAvatar && (
                <EntityAvatar {...sheetAvatar} size="sm" onActivate={onAvatarClick} activateLabel={avatarActivateLabel} />
              )}
              {titleAdornment}
              {subtitle && <p className={cn('min-w-0 truncate text-sm', colors.text.muted)}>{subtitle}</p>}
              {badges.map((badge, index) => (
                <EntityBadge key={index} {...badge} />
              ))}
            </div>
          )}
          {details}
          {children}
        </div>
      )}
    </>
  );
}

// ===== ENTITY BADGE COMPONENT =====

const EntityBadge: React.FC<EntityHeaderBadge> = ({
  type,
  value,
  variant = 'default',
  size = 'sm',
  className
}) => {
  const colors = useSemanticColors();
  const baseClasses = "inline-flex items-center rounded-md font-medium transition-colors";

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    default: "px-3 py-1 text-sm",
    lg: "px-4 py-2 text-base"
  };

  const variantClasses = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    outline: `border border-input ${colors.bg.primary} text-foreground`
  };

  const typeClasses = {
    status: `${colors.bg.info} text-primary`,
    progress: `${colors.bg.success} text-[hsl(var(--text-success))]`,
    category: `${colors.bg.accent} text-primary`,
    custom: variantClasses[variant]
  };

  return (
    <span className={cn(
      baseClasses,
      sizeClasses[size],
      typeClasses[type],
      className
    )}>
      {value}
    </span>
  );
};

// ===== CONVENIENCE EXPORTS =====

export default EntityDetailsHeader;

// Additional aliases
export { EntityDetailsHeader as EntityHeader };
export { EntityDetailsHeader as UnifiedEntityHeader };