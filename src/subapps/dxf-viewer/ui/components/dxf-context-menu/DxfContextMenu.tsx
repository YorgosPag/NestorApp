/**
 * DXF CONTEXT MENU — Shared primitive wrappers (SSoT)
 *
 * Single Source of Truth for context menu visual language in the DXF Viewer
 * subapp. Wraps shadcn DropdownMenu primitives with the shared module CSS so
 * every consumer gets a consistent look without importing the CSS directly.
 *
 * Consumers: DrawingContextMenu, EntityContextMenu, GripContextMenu.
 *
 * @see DxfContextMenu.module.css — shared styles
 * @see ADR-047: Drawing Tool Keyboard Shortcuts & Context Menu
 */

'use client';

import React, { forwardRef } from 'react';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import styles from './DxfContextMenu.module.css';

// Re-export unstyled primitives — consumers import everything from one place.
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuSub,
} from '@/components/ui/dropdown-menu';

// ─── Styled wrappers ────────────────────────────────────────────────────────

export const DxfMenuContent = forwardRef<
  React.ElementRef<typeof DropdownMenuContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuContent>
>(({ className, side = 'bottom', align = 'start', sideOffset = 0, avoidCollisions = false, ...props }, ref) => (
  <DropdownMenuContent
    ref={ref}
    className={cn(styles.menuContent, className)}
    side={side}
    align={align}
    sideOffset={sideOffset}
    avoidCollisions={avoidCollisions}
    {...props}
  />
));
DxfMenuContent.displayName = 'DxfMenuContent';

export const DxfMenuSubContent = forwardRef<
  React.ElementRef<typeof DropdownMenuSubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuSubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuSubContent
    ref={ref}
    className={cn(styles.menuContent, className)}
    {...props}
  />
));
DxfMenuSubContent.displayName = 'DxfMenuSubContent';

interface DxfMenuItemProps extends React.ComponentPropsWithoutRef<typeof DropdownMenuItem> {
  /** Red destructive styling (e.g. Exit / Delete). */
  destructive?: boolean;
}

export const DxfMenuItem = forwardRef<
  React.ElementRef<typeof DropdownMenuItem>,
  DxfMenuItemProps
>(({ className, disabled, destructive, ...props }, ref) => (
  <DropdownMenuItem
    ref={ref}
    className={cn(
      styles.menuItem,
      disabled && styles.menuItemDisabled,
      destructive && styles.menuItemDestructive,
      className,
    )}
    disabled={disabled}
    {...props}
  />
));
DxfMenuItem.displayName = 'DxfMenuItem';

export const DxfMenuSubTrigger = forwardRef<
  React.ElementRef<typeof DropdownMenuSubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuSubTrigger>
>(({ className, ...props }, ref) => (
  <DropdownMenuSubTrigger
    ref={ref}
    className={cn(styles.menuItem, className)}
    {...props}
  />
));
DxfMenuSubTrigger.displayName = 'DxfMenuSubTrigger';

export const DxfMenuSeparator = forwardRef<
  React.ElementRef<typeof DropdownMenuSeparator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuSeparator>
>(({ className, ...props }, ref) => (
  <DropdownMenuSeparator
    ref={ref}
    className={cn(styles.menuSeparator, className)}
    {...props}
  />
));
DxfMenuSeparator.displayName = 'DxfMenuSeparator';

export const DxfMenuHiddenTrigger = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ ...props }, ref) => (
    <span ref={ref} className={styles.hiddenTrigger} aria-hidden="true" {...props} />
  ),
);
DxfMenuHiddenTrigger.displayName = 'DxfMenuHiddenTrigger';

export function DxfMenuSectionTitle({ children }: { children: React.ReactNode }) {
  return <div className={styles.menuSectionTitle}>{children}</div>;
}

export function DxfMenuIcon({ children }: { children: React.ReactNode }) {
  return <span className={styles.menuItemIcon}>{children}</span>;
}

export function DxfMenuLabel({ children }: { children: React.ReactNode }) {
  return <span className={styles.menuItemLabel}>{children}</span>;
}

export function DxfMenuShortcut({ children }: { children: React.ReactNode }) {
  return <span className={styles.menuItemShortcut}>{children}</span>;
}

export function DxfMenuCheck({ checked }: { checked: boolean }) {
  return (
    <span className={styles.menuItemCheck} aria-hidden="true">
      {checked ? '✓' : ''}
    </span>
  );
}
