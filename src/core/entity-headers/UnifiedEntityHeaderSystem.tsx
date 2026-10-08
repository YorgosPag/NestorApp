/**
 * 🏢 UNIFIED ENTITY HEADER SYSTEM - ENTERPRISE PATTERN
 *
 * Κεντρικό React component για όλα τα entity detail headers
 * Single Source of Truth για Contact/Project/Building/Unit profile cards
 */

'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LucideIcon } from 'lucide-react';
import { EntityActionButton, EntityHeaderActions } from './EntityHeaderActions';
import { cn } from '@/lib/utils';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
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

export interface EntityHeaderAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: 'default' | 'outline' | 'ghost';
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
  avatarImageUrl?: string; // Optional avatar/photo URL to display instead of icon
  onAvatarClick?: () => void; // Optional click handler for avatar image

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

// ===== MAIN ENTITY HEADER COMPONENT =====

export const EntityDetailsHeader: React.FC<EntityHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  badges = [],
  actions = [],
  titleAdornment,
  avatarImageUrl,
  onAvatarClick,
  iconColor,
  variant = 'default',
  className,
  media,
  details,
  headingLevel = 3,
  children
}) => {
  const Heading = headingLevel === 1 ? 'h1' : 'h3';
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
        **υπερχειλίζουν σε μενού** αντί να αναδιπλωθούν (ADR-777 §8.87.7). Το πλέγμα δίνει στην ταυτότητα εγγυημένο
        ελάχιστο και στις ενέργειες ό,τι περισσεύει: `minmax(0,auto)` — με σκέτο `auto` το ελάχιστο της στήλης θα
        ήταν το περιεχόμενό της, δηλαδή όλα τα κουμπιά, και ο τίτλος θα έπεφτε ξανά στο 0 (μετρημένο §8.87.6γ).
      */}
      <div className={media
        ? "flex flex-wrap items-start justify-between gap-3"
        : actions.length > 0
          ? "grid grid-cols-[minmax(min(16rem,100%),1fr)_minmax(0,auto)] items-center gap-3"
          : "flex items-center justify-between"}>
        {/* Left side: Icon + Content */}
        <div className={media
          ? "flex flex-col gap-4 sm:flex-row sm:items-start flex-1 basis-[32rem] min-w-0"
          : "flex items-center gap-3 flex-1 min-w-0"}>
          {/* Media, Icon or Avatar */}
          {media ? media : avatarImageUrl ? (
            <Avatar
              key={avatarImageUrl || 'empty-avatar'}
              className={cn(
                `flex-shrink-0 shadow-sm cursor-pointer ${INTERACTIVE_PATTERNS.OPACITY_HOVER} ${TRANSITION_PRESETS.OPACITY}`,
                iconSizeClasses[variant]
              )}
              onClick={onAvatarClick}
            >
              <AvatarImage
                src={avatarImageUrl}
                alt={`${title} φωτογραφία`}
                className="object-cover"
              />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600">
                <Icon className={cn(
                  "text-white",
                  variant === 'detailed' ? iconSizes.sm :
                  variant === 'compact' ? iconSizes.sm :
                  iconSizes.md
                )} />
              </AvatarFallback>
            </Avatar>
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
        {actions.length > 0 && (media ? (
          <div className="flex flex-wrap gap-2 max-w-full">
            {actions.map((action, index) => (
              <EntityActionButton key={index} action={action} />
            ))}
          </div>
        ) : (
          <EntityHeaderActions actions={actions} />
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