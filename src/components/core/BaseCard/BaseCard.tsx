'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MoreVertical } from 'lucide-react';
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

export interface BaseCardProps extends React.HTMLAttributes<HTMLDivElement> {
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
  // Styling variants
  const cardVariants = {
    default: 'border bg-card text-card-foreground shadow-sm',
    bordered: 'border-2 bg-card text-card-foreground',
    elevated: 'border-0 bg-card text-card-foreground shadow-lg',
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
          'transition-all duration-200 hover:shadow-md hover:scale-[1.02]': 
            hoverEffects && (selectable || onClick),
          
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
              className="absolute top-2 right-2 bg-white/80 hover:bg-white/90"
              onClick={handleFavoriteClick}
            >
              <Heart className={cn(
                'h-4 w-4',
                isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'
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
                <Badge 
                  variant={status.variant || 'default'}
                  className={status.color ? `bg-${status.color}` : ''}
                >
                  {status.label}
                </Badge>
              )}
              
              {badges.map((badge, index) => (
                <Badge 
                  key={index}
                  variant={badge.variant || 'secondary'}
                  className={badge.color ? `bg-${badge.color}` : ''}
                >
                  {badge.label}
                </Badge>
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
                  'h-4 w-4',
                  isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'
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
                  <primaryAction.icon className="h-4 w-4 mr-1" />
                )}
                {primaryAction.label}
              </Button>
            )}

            {/* Dropdown Actions */}
            {actions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
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
                        <action.icon className="h-4 w-4 mr-2" />
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
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
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