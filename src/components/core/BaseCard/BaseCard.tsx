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
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  disabled?: boolean;
}

export interface CardStatus {
  value: string;
  label: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  color?: string;
}

export interface BaseCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  // Selection state
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  selectable?: boolean;

  // Favorite functionality
  isFavorite?: boolean;
  onFavoriteToggle?: (favorite: boolean) => void;
  showFavorite?: boolean;

  // Status and badges
  status?: CardStatus;
  badges?: CardStatus[];

  // Actions
  actions?: CardAction[];
  primaryAction?: CardAction;

  // Visual options
  hoverEffects?: boolean;
  variant?: 'default' | 'bordered' | 'elevated' | 'minimal';
  size?: 'sm' | 'md' | 'lg';

  // Content slots
  header?: React.ReactNode;
  children: React.ReactNode;
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
  isSelected = false,
  onSelect,
  selectable = false,
  isFavorite = false,
  onFavoriteToggle,
  showFavorite = false,
  status,
  badges = [],
  actions = [],
  primaryAction,
  hoverEffects = true,
  variant = 'default',
  size = 'md',
  header,
  children,
  footer,
  image,
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

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectable && onSelect) {
      onSelect(!isSelected);
    }
    if (onClick) {
      onClick(e);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFavoriteToggle) {
      onFavoriteToggle(!isFavorite);
    }
  };

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

      {/* Header Section */}
      {(header || status || badges.length > 0 || actions.length > 0 || showFavorite) && (
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex-1 space-y-1">
            {header}
            
            {/* Status and Badges */}
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
            {actions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className={iconSizes.sm} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {actions.map((action) => (
                    <DropdownMenuItem
                      key={action.id}
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
          children
        )}
      </CardContent>

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