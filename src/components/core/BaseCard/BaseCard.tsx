'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import { Heart, MoreVertical } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Types για το BaseCard system
export interface CardAction {
  id?: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  disabled?: boolean;
}

export interface CardStatus {
  value?: string;
  label: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  color?: string;
  className?: string;
}

// 🏢 ENTERPRISE: Extended header configuration for composition cards
export interface HeaderConfig {
  backgroundGradient?: string;
  logo?: React.ReactNode;
  showImageOverlay?: boolean;
  compact?: boolean;
}

// 🏢 ENTERPRISE: Content section for structured card content
export interface ContentSection {
  title: string;
  content: React.ReactNode;
}

// 🏢 ENTERPRISE: Status badge configuration
export interface StatusBadge {
  label: string;
  className?: string;
}

export interface BaseCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect' | 'title'> {
  // 🏢 ENTERPRISE: Extended card properties for compositions
  title?: string;
  subtitle?: string;
  headerConfig?: HeaderConfig;
  statusBadges?: (StatusBadge | React.ReactNode)[];
  // 🏢 ENTERPRISE: Supports all falsy values from conditional expressions (&&)
  contentSections?: (ContentSection | false | null | undefined | '' | 0)[];

  // Selection state (supports both APIs)
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  onSelectionChange?: () => void;
  selectable?: boolean;

  // Favorite functionality (supports both APIs)
  isFavorite?: boolean;
  onFavoriteToggle?: (favorite: boolean) => void;
  onFavoriteChange?: (favorite: boolean) => void;
  showFavorite?: boolean;

  // Status and badges (legacy API)
  status?: CardStatus;
  badges?: CardStatus[];

  // Actions - supports all falsy values from conditional expressions
  actions?: (CardAction | false | null | undefined | '' | 0)[];
  primaryAction?: CardAction;

  // Visual options
  hoverEffects?: boolean;
  variant?: 'default' | 'bordered' | 'elevated' | 'minimal';
  size?: 'sm' | 'md' | 'lg';

  // Content slots
  header?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;

  // Image/media
  image?: {
    src: string;
    alt: string;
    aspectRatio?: 'square' | 'video' | 'auto';
  };

  // Loading state
  loading?: boolean;

  // Accessibility
  role?: string;
  'aria-label'?: string;
}

const BaseCard = forwardRef<HTMLDivElement, BaseCardProps>(({
  className,
  // 🏢 ENTERPRISE: Extended card properties
  title,
  subtitle,
  headerConfig,
  statusBadges,
  contentSections,
  // Selection state (supports both APIs)
  isSelected = false,
  onSelect,
  onSelectionChange,
  selectable = false,
  // Favorites (supports both APIs)
  isFavorite = false,
  onFavoriteToggle,
  onFavoriteChange,
  showFavorite = false,
  // Legacy status/badges API
  status,
  badges = [],
  // Actions
  actions = [],
  primaryAction,
  // Visual options
  hoverEffects = true,
  variant = 'default',
  size = 'md',
  // Content slots
  header,
  children,
  footer,
  image,
  // Loading state
  loading = false,
  role = 'article',
  onClick,
  ...props
}, ref) => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();

  // Styling variants
  const cardVariants = {
    default: 'border bg-card text-card-foreground shadow-sm',
    bordered: 'border bg-card text-card-foreground',
    elevated: `border-0 bg-card text-card-foreground shadow-md ring-1 ring-ring/50`,
    minimal: 'border-0 bg-transparent text-foreground shadow-none',
  };

  const sizeVariants = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  // 🏢 ENTERPRISE: Unified selection handler supporting both APIs
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectable || onSelectionChange) {
      if (onSelect) {
        onSelect(!isSelected);
      }
      if (onSelectionChange) {
        onSelectionChange();
      }
    }
    if (onClick) {
      onClick(e);
    }
  };

  // 🏢 ENTERPRISE: Unified favorite handler supporting both APIs
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFavoriteToggle) {
      onFavoriteToggle(!isFavorite);
    }
    if (onFavoriteChange) {
      onFavoriteChange(!isFavorite);
    }
  };

  // 🏢 ENTERPRISE: Filter valid actions (removes all falsy values)
  const validActions = (actions || []).filter((action): action is CardAction =>
    Boolean(action) && typeof action === 'object' && 'label' in action && 'onClick' in action
  );

  // 🏢 ENTERPRISE: Filter valid content sections (removes all falsy values)
  const validContentSections = (contentSections || []).filter((section): section is ContentSection =>
    Boolean(section) && typeof section === 'object' && 'title' in section && 'content' in section
  );

  return (
    <Card
      ref={ref}
      className={cn(
        cardVariants[variant],
        sizeVariants[size],
        {
          // Selection styles
          'ring-2 ring-primary ring-offset-2': isSelected,
          'cursor-pointer': selectable || onClick,
          
          // Hover effects
          [INTERACTIVE_PATTERNS.CARD_STANDARD]: hoverEffects && (selectable || onClick),
          
          // Loading state
          'opacity-60 pointer-events-none': loading,
        },
        className
      )}
      onClick={handleCardClick}
      role={role}
      {...props}
    >
      {/* Image/Media Section */}
      {image && (
        <div className={cn(
          'relative overflow-hidden rounded-t-lg -mt-4 -mx-4 mb-4',
          {
            'aspect-square': image.aspectRatio === 'square',
            'aspect-video': image.aspectRatio === 'video',
            'aspect-auto': image.aspectRatio === 'auto',
          }
        )}>
          <img
            src={image.src}
            alt={image.alt}
            className="w-full h-full object-cover"
          />
          
          {/* Favorite overlay on image */}
          {showFavorite && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                `absolute top-2 right-2 ${colors.bg.primary} opacity-80`,
                INTERACTIVE_PATTERNS.BUTTON_OVERLAY
              )}
              onClick={handleFavoriteClick}
            >
              <Heart className={cn(
                iconSizes.sm,
                isFavorite ? `fill-current ${colors.text.error}` : `${colors.text.muted}`
              )} />
            </Button>
          )}
        </div>
      )}

      {/* 🏢 ENTERPRISE: Extended Header with headerConfig support */}
      {headerConfig && (
        <CardHeader className={cn(
          'relative rounded-t-lg -mt-4 -mx-4 mb-4 p-4',
          headerConfig.backgroundGradient && `bg-gradient-to-r ${headerConfig.backgroundGradient}`,
          headerConfig.compact && 'p-3'
        )}>
          <div className="flex items-center gap-4">
            {/* Logo/Icon */}
            {headerConfig.logo && (
              <div className="flex-shrink-0">
                {headerConfig.logo}
              </div>
            )}

            {/* Title and Subtitle */}
            {(title || subtitle) && (
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 className="font-semibold text-foreground truncate">{title}</h3>
                )}
                {subtitle && (
                  <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
                )}
              </div>
            )}

            {/* Favorite button in header */}
            {(isFavorite !== undefined || onFavoriteChange || onFavoriteToggle) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFavoriteClick}
                className="flex-shrink-0"
              >
                <Heart className={cn(
                  iconSizes.sm,
                  isFavorite ? `fill-current ${colors.text.error}` : `${colors.text.muted}`
                )} />
              </Button>
            )}
          </div>

          {/* Status Badges */}
          {statusBadges && statusBadges.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {statusBadges.map((badge, index) => {
                // Support both StatusBadge objects and React nodes
                if (React.isValidElement(badge)) {
                  return <React.Fragment key={index}>{badge}</React.Fragment>;
                }
                const statusBadge = badge as StatusBadge;
                return (
                  <CommonBadge
                    key={index}
                    status="company"
                    customLabel={statusBadge.label}
                    variant="default"
                    className={statusBadge.className || ''}
                  />
                );
              })}
            </div>
          )}
        </CardHeader>
      )}

      {/* Legacy Header Section (when no headerConfig) */}
      {!headerConfig && (header || status || badges.length > 0 || validActions.length > 0 || showFavorite || title) && (
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex-1 space-y-1">
            {/* Title/Subtitle without headerConfig */}
            {(title || subtitle) && !headerConfig && (
              <div>
                {title && <h3 className="font-semibold text-foreground">{title}</h3>}
                {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
              </div>
            )}
            {header}

            {/* Legacy Status and Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {status && (
                <CommonBadge
                  status="company"
                  customLabel={status.label}
                  variant={status.variant || 'default'}
                  className={status.color ? `bg-${status.color}` : ''}
                />
              )}

              {badges.map((badge, index) => (
                <CommonBadge
                  key={index}
                  status="company"
                  customLabel={badge.label}
                  variant={badge.variant || 'secondary'}
                  className={badge.color ? `bg-${badge.color}` : ''}
                />
              ))}
            </div>
          </div>

          {/* Actions Section */}
          <div className="flex items-center gap-1">
            {/* Favorite button (when not on image) */}
            {showFavorite && !image && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFavoriteClick}
              >
                <Heart className={cn(
                  iconSizes.sm,
                  isFavorite ? `fill-current ${colors.text.error}` : `${colors.text.muted}`
                )} />
              </Button>
            )}

            {/* Primary Action */}
            {primaryAction && (
              <Button
                variant={primaryAction.variant || 'default'}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  primaryAction.onClick();
                }}
                disabled={primaryAction.disabled}
              >
                {primaryAction.icon && (
                  <primaryAction.icon className={`${iconSizes.sm} mr-1`} />
                )}
                {primaryAction.label}
              </Button>
            )}

            {/* Dropdown Actions */}
            {validActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className={iconSizes.sm} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {validActions.map((action, index) => (
                    <DropdownMenuItem
                      key={action.id || index}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                      }}
                      disabled={action.disabled}
                    >
                      {action.icon && (
                        <action.icon className={`${iconSizes.sm} mr-2`} />
                      )}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
      )}

      {/* Content Section */}
      <CardContent className="pb-2">
        {loading ? (
          <div className="space-y-2">
            <div className={`h-4 ${colors.bg.muted} rounded animate-pulse`} />
            <div className={`h-4 ${colors.bg.muted} rounded animate-pulse w-3/4`} />
            <div className={`h-4 ${colors.bg.muted} rounded animate-pulse w-1/2`} />
          </div>
        ) : (
          <>
            {/* 🏢 ENTERPRISE: Content Sections support */}
            {validContentSections.length > 0 && (
              <div className="space-y-4">
                {validContentSections.map((section, index) => (
                  <div key={index} className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">{section.title}</h4>
                    <div>{section.content}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Legacy children content */}
            {children}
          </>
        )}
      </CardContent>

      {/* 🏢 ENTERPRISE: Actions Footer for extended API */}
      {headerConfig && validActions.length > 0 && (
        <CardFooter className="flex flex-wrap gap-2 pt-2">
          {validActions.map((action, index) => (
            <Button
              key={action.id || index}
              variant={action.variant || 'outline'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              disabled={action.disabled}
            >
              {action.icon && (
                <action.icon className={`${iconSizes.sm} mr-1`} />
              )}
              {action.label}
            </Button>
          ))}
        </CardFooter>
      )}

      {/* Footer Section */}
      {footer && (
        <CardFooter className="pt-2">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
});

BaseCard.displayName = 'BaseCard';

export { BaseCard };