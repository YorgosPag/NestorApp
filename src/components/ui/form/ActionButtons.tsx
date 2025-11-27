'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, X, Trash2, Plus, Edit, Archive, RotateCcw, Phone, Mail, MessageSquare, Download, Upload, HelpCircle, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// Enterprise Button Categorization - Global Design System Standards
// Based on Google Material Design, Microsoft Fluent, Apple HIG, Bootstrap 5
export const BUTTON_CATEGORIES = {
  // 🔵 PRIMARY ACTIONS (Blue #0d6efd) - Main user actions
  primary: "bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 hover:border-blue-700",

  // 🟢 SUCCESS/POSITIVE (Green #198754) - Successful completion, save actions
  success: "bg-green-600 hover:bg-green-700 text-white border border-green-600 hover:border-green-700",

  // 🔴 DANGER/DESTRUCTIVE (Red #dc3545) - Permanent destructive actions
  danger: "bg-red-600 hover:bg-red-700 text-white border border-red-600 hover:border-red-700",

  // 🟡 WARNING/CAUTION (Orange/Yellow #ffc107) - Reversible destructive actions
  warning: "bg-orange-500 hover:bg-orange-600 text-white border border-orange-500 hover:border-orange-600",

  // ⚪ SECONDARY/NEUTRAL (Gray #6c757d) - Secondary, optional actions
  secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 hover:border-gray-400",

  // 🌑 UTILITY/PASSIVE (Dark Gray #374151) - Tools, communication, management
  utility: "bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-gray-500"
} as const;

// Legacy button styles with enterprise categorization mapping
export const BUTTON_STYLES = {
  variants: {
    // Primary Actions (Blue)
    add: BUTTON_CATEGORIES.primary,

    // Success Actions (Green)
    save: BUTTON_CATEGORIES.success,

    // Danger Actions (Red)
    delete: BUTTON_CATEGORIES.danger,

    // Warning Actions (Orange)
    archive: BUTTON_CATEGORIES.warning,
    edit: BUTTON_CATEGORIES.warning, // Edit can be warning as it modifies data

    // Secondary Actions (Gray)
    cancel: BUTTON_CATEGORIES.secondary,
    restore: BUTTON_CATEGORIES.secondary,

    // Utility Actions (Dark with colored text for differentiation)
    call: `${BUTTON_CATEGORIES.utility} text-green-400`,
    email: `${BUTTON_CATEGORIES.utility} text-blue-400`,
    sms: `${BUTTON_CATEGORIES.utility} text-purple-400`,
    export: `${BUTTON_CATEGORIES.utility} text-emerald-400`,
    import: `${BUTTON_CATEGORIES.utility} text-orange-400`,
    help: `${BUTTON_CATEGORIES.utility} text-cyan-400`,
  }
} as const;

interface BaseButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
  badge?: number;
}

// SaveButton - Για αποθήκευση forms
export function SaveButton({
  children = "Αποθήκευση",
  loading = false,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  return (
    <Button
      type="submit"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(BUTTON_STYLES.variants.save, className)}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Αποθήκευση...
        </>
      ) : (
        <>
          <Save className="mr-2 h-4 w-4" />
          {children}
        </>
      )}
    </Button>
  );
}

// CancelButton - Για ακύρωση
export function CancelButton({
  children = "Άκυρο",
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.cancel, className)}
    >
      <X className="mr-2 h-4 w-4" />
      {children}
    </Button>
  );
}

// DeleteButton - Για διαγραφή
export function DeleteButton({
  children = "Διαγραφή",
  loading = false,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(BUTTON_STYLES.variants.delete, className)}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Διαγραφή...
        </>
      ) : (
        <>
          <Trash2 className="mr-2 h-4 w-4" />
          {children}
        </>
      )}
    </Button>
  );
}

// AddButton - Για προσθήκη νέων items
export function AddButton({
  children = "Προσθήκη",
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.add, className)}
    >
      <Plus className="mr-2 h-4 w-4" />
      {children}
    </Button>
  );
}

// EditButton - Για επεξεργασία
export function EditButton({
  children = "Επεξεργασία",
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.edit, className)}
    >
      <Edit className="mr-2 h-4 w-4" />
      {children}
    </Button>
  );
}

// ArchiveButton - Για αρχειοθέτηση
export function ArchiveButton({
  children = "Αρχειοθέτηση",
  loading = false,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(BUTTON_STYLES.variants.archive, className)}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Αρχειοθέτηση...
        </>
      ) : (
        <>
          <Archive className="mr-2 h-4 w-4" />
          {children}
        </>
      )}
    </Button>
  );
}

// RestoreButton - Για επαναφορά από archive
export function RestoreButton({
  children = "Επαναφορά",
  loading = false,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(BUTTON_STYLES.variants.restore, className)}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Επαναφορά...
        </>
      ) : (
        <>
          <RotateCcw className="mr-2 h-4 w-4" />
          {children}
        </>
      )}
    </Button>
  );
}

// Toolbar variants - Για ContactsToolbar με consistent styling
export function ToolbarAddButton({
  children = "Προσθήκη",
  disabled = false,
  onClick,
  className,
  size = 'sm',
  variant = 'default'
}: BaseButtonProps) {
  // Use centralized styling for default variant
  const buttonClassName = variant === 'default'
    ? cn(BUTTON_STYLES.variants.add, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn("flex items-center gap-2 min-w-[100px] justify-start", className);

  return (
    <Button
      variant={variant === 'default' ? undefined : variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName}
    >
      <Plus className="w-4 h-4" />
      <span className="hidden md:inline">{children}</span>
    </Button>
  );
}

export function ToolbarEditButton({
  children = "Επεξεργασία",
  disabled = false,
  onClick,
  className,
  size = 'sm',
  variant = 'outline'
}: BaseButtonProps) {
  // Use centralized styling for outline variant (edit action)
  const buttonClassName = variant === 'outline'
    ? cn(BUTTON_STYLES.variants.edit, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn("flex items-center gap-2 min-w-[100px] justify-start", className);

  return (
    <Button
      variant={variant === 'outline' ? undefined : variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName}
    >
      <Edit className="w-4 h-4" />
      <span className="hidden md:inline">{children}</span>
    </Button>
  );
}

export function ToolbarDeleteButton({
  children = "Διαγραφή",
  disabled = false,
  onClick,
  className,
  size = 'sm',
  variant = 'destructive',
  badge
}: BaseButtonProps) {
  // Use centralized styling for destructive variant
  const buttonClassName = variant === 'destructive'
    ? cn(BUTTON_STYLES.variants.delete, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn("flex items-center gap-2 min-w-[100px] justify-start", className);

  return (
    <Button
      variant={variant === 'destructive' ? undefined : variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName}
    >
      <Trash2 className="w-4 h-4" />
      <span className="hidden md:inline">{children}</span>
      {badge && (
        <Badge variant="secondary" className="ml-auto">
          {badge}
        </Badge>
      )}
    </Button>
  );
}

export function ToolbarArchiveButton({
  children = "Αρχειοθέτηση",
  disabled = false,
  onClick,
  className,
  size = 'sm',
  variant = 'ghost',
  badge
}: BaseButtonProps) {
  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_CATEGORIES.utility, "text-orange-400 flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <Archive className="w-4 h-4" />
      <span className="hidden md:inline">{children}</span>
      {badge && (
        <Badge variant="secondary" className="ml-auto">
          {badge}
        </Badge>
      )}
    </Button>
  );
}

// Communication buttons - Subtle styling
export function ToolbarCallButton({
  children = "Κλήση",
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.call, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <Phone className="w-4 h-4" />
      <span className="hidden md:inline">{children}</span>
    </Button>
  );
}

export function ToolbarEmailButton({
  children = "Email",
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.email, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <Mail className="w-4 h-4" />
      <span className="hidden md:inline">{children}</span>
    </Button>
  );
}

export function ToolbarSMSButton({
  children = "SMS",
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.sms, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <MessageSquare className="w-4 h-4" />
      <span className="hidden md:inline">{children}</span>
    </Button>
  );
}

// Management buttons - Same dark theme styling as communication
export function ToolbarExportButton({
  children = "Εξαγωγή",
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.export, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <Download className="w-4 h-4" />
      <span className="hidden md:inline">{children}</span>
    </Button>
  );
}

export function ToolbarImportButton({
  children = "Εισαγωγή",
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.import, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <Upload className="w-4 h-4" />
      <span className="hidden md:inline">{children}</span>
    </Button>
  );
}

export function ToolbarHelpButton({
  children = "Βοήθεια",
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.help, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <HelpCircle className="w-4 h-4" />
      <span className="hidden md:inline">{children}</span>
    </Button>
  );
}

// Filter buttons - Toggle functionality for filters
interface FilterButtonProps extends BaseButtonProps {
  active?: boolean;
}

export function ToolbarFavoritesButton({
  children = "Αγαπημένα",
  disabled = false,
  onClick,
  className,
  size = 'sm',
  active = false
}: FilterButtonProps) {
  // Active state uses primary color, inactive uses utility (subtle)
  const buttonClassName = active
    ? cn(BUTTON_CATEGORIES.primary, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn(BUTTON_CATEGORIES.utility, "text-yellow-400 flex items-center gap-2 min-w-[100px] justify-start", className);

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName}
    >
      <Star className="w-4 h-4" />
      <span className="hidden md:inline">{children}</span>
    </Button>
  );
}

export function ToolbarArchivedFilterButton({
  children = "Αρχειοθετημένα",
  disabled = false,
  onClick,
  className,
  size = 'sm',
  active = false
}: FilterButtonProps) {
  // Active state uses primary color, inactive uses utility (subtle)
  const buttonClassName = active
    ? cn(BUTTON_CATEGORIES.primary, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn(BUTTON_CATEGORIES.utility, "text-orange-400 flex items-center gap-2 min-w-[100px] justify-start", className);

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName}
    >
      <Archive className="w-4 h-4" />
      <span className="hidden md:inline">{children}</span>
    </Button>
  );
}