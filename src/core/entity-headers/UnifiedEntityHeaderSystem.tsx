/**
 * 🏢 UNIFIED ENTITY HEADER SYSTEM - ENTERPRISE PATTERN
 *
 * Κεντρικό React component για όλα τα entity detail headers
 * Single Source of Truth για Contact/Project/Building/Unit profile cards
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export interface EntityHeaderProps {
  // Required
  icon: LucideIcon;
  title: string;

  // Optional content
  subtitle?: string;
  badges?: EntityHeaderBadge[];
  actions?: EntityHeaderAction[];
  avatarImageUrl?: string; // Optional avatar/photo URL to display instead of icon
  onAvatarClick?: () => void; // Optional click handler for avatar image

  // Layout & Styling
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;

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
  avatarImageUrl,
  onAvatarClick,
  variant = 'default',
  className,
  children
}) => {
  const variantClasses = {
    default: "p-4",
    compact: "p-3",
    detailed: "p-6"
  };

  const iconSizes = {
    default: "h-10 w-10",
    compact: "h-8 w-8",
    detailed: "h-12 w-12"
  };

  const titleSizes = {
    default: "text-lg",
    compact: "text-base",
    detailed: "text-xl"
  };

  return (
    <div className={cn(
      "border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-t-lg",
      variantClasses[variant],
      className
    )}>
      <div className="flex items-center justify-between">
        {/* Left side: Icon + Content */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Icon or Avatar */}
          {avatarImageUrl ? (
            <Avatar
              key={avatarImageUrl || 'empty-avatar'}
              className={cn(
                "flex-shrink-0 shadow-sm cursor-pointer hover:opacity-80 transition-opacity",
                iconSizes[variant]
              )}
              onClick={onAvatarClick}
            >
              <AvatarImage
                src={avatarImageUrl}
                alt={`${title} φωτογραφία`}
                className="object-cover"
              />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600">
                <Icon className="text-white" style={{
                  width: variant === 'detailed' ? '24px' : variant === 'compact' ? '16px' : '20px',
                  height: variant === 'detailed' ? '24px' : variant === 'compact' ? '16px' : '20px'
                }} />
              </AvatarFallback>
            </Avatar>
          ) : (
            <div
              className={cn(
                "flex items-center justify-center rounded-lg shadow-sm flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600",
                iconSizes[variant]
              )}
            >
              <Icon className="text-white" style={{
                width: variant === 'detailed' ? '24px' : variant === 'compact' ? '16px' : '20px',
                height: variant === 'detailed' ? '24px' : variant === 'compact' ? '16px' : '20px'
              }} />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className={cn(
              "font-semibold text-foreground line-clamp-1",
              titleSizes[variant]
            )}>
              {title}
            </h3>

            {/* Subtitle */}
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
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
          </div>
        </div>

        {/* Right side: Actions */}
        {actions.length > 0 && (
          <div className="flex gap-2 flex-shrink-0 ml-3">
            {actions.map((action, index) => (
              <EntityAction key={index} {...action} />
            ))}
          </div>
        )}
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
  const baseClasses = "inline-flex items-center rounded-md font-medium transition-colors";

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    default: "px-3 py-1 text-sm",
    lg: "px-4 py-2 text-base"
  };

  const variantClasses = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    outline: "border border-input bg-background text-foreground"
  };

  const typeClasses = {
    status: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    progress: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    category: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
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

// ===== ENTITY ACTION COMPONENT =====

const EntityAction: React.FC<EntityHeaderAction> = ({
  label,
  onClick,
  icon: Icon,
  variant = 'default',
  className
}) => {
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      className={cn("h-8", className)}
    >
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {label}
    </Button>
  );
};

// ===== CONVENIENCE EXPORTS =====

export default EntityDetailsHeader;

// Additional aliases
export { EntityDetailsHeader as EntityHeader };
export { EntityDetailsHeader as UnifiedEntityHeader };