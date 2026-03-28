"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { useIconSizes } from "@/hooks/useIconSizes"
import { useDropdownTokens } from "@/hooks/useDropdownTokens"

import { cn } from "@/lib/utils"
import { useBorderTokens } from "@/hooks/useBorderTokens"
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors"
import '@/lib/design-system';

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

interface SelectTriggerProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  /** Trigger size variant — defaults to 'lg' (h-10) for backward compatibility */
  size?: 'sm' | 'md' | 'lg';
}

const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, size = 'lg', ...props }, ref) => {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const dropdown = useDropdownTokens();

  // 🏢 ENTERPRISE: Base styles WITHOUT hardcoded dimensions - size comes from tokens
  // Pattern: Autodesk/Adobe - height/padding/text controlled via centralized tokens
  const baseStyles = [
    "flex w-full items-center justify-between",
    quick.input,
    colors.bg.primary,
    dropdown.getTriggerSize(size),
    "ring-offset-background placeholder:text-muted-foreground",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    "disabled:cursor-not-allowed disabled:bg-muted/50",
    "[&>span]:line-clamp-1" // eslint-disable-line custom/no-hardcoded-strings
  ].join(" ");

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(baseStyles, className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown size={iconSizes.numeric.sm} className="opacity-50 shrink-0" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
})
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => {
  const iconSizes = useIconSizes();
  const dropdown = useDropdownTokens();
  return (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      `flex cursor-default items-center justify-center ${dropdown.scrollButton}`,
      className
    )}
    {...props}
  >
    <ChevronUp size={iconSizes.numeric.sm} />
  </SelectPrimitive.ScrollUpButton>
);
})
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => {
  const iconSizes = useIconSizes();
  const dropdown = useDropdownTokens();
  return (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      `flex cursor-default items-center justify-center ${dropdown.scrollButton}`,
      className
    )}
    {...props}
  >
    <ChevronDown size={iconSizes.numeric.sm} />
  </SelectPrimitive.ScrollDownButton>
);
})
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => {
  const { quick } = useBorderTokens();
  const dropdown = useDropdownTokens();

  // 🏢 ENTERPRISE: z-index must be ABOVE floating panels (1700)
  // Pattern: Autodesk/Adobe - dropdown content always on top
  // Using centralized tokens for z-index, max-height, shadow
  // 🏢 ENTERPRISE: Width EXACTLY matches trigger width (not min-width)
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        // eslint-disable-next-line custom/no-hardcoded-strings -- CSS classes, not i18n
        className={cn(
          `relative ${dropdown.content.zIndexElevated} ${dropdown.content.maxHeight} overflow-hidden ${quick.table} bg-popover text-popover-foreground ${dropdown.content.shadow} data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2`,
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1 w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]", // eslint-disable-line custom/no-hardcoded-strings
          className
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            dropdown.content.padding,
            position === "popper" &&
              "min-h-[var(--radix-select-trigger-height)] w-full" // eslint-disable-line custom/no-hardcoded-strings
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
})
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => {
  const dropdown = useDropdownTokens();
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn(`${dropdown.item.indented} ${dropdown.item.fontSize} ${dropdown.item.fontWeightLabel}`, className)}
      {...props}
    />
  );
})
SelectLabel.displayName = SelectPrimitive.Label.displayName

/**
 * 🏢 ENTERPRISE: SelectItem with compile-time AND runtime empty value protection
 *
 * Radix Select FORBIDS <SelectItem value="" /> - it will crash at runtime.
 *
 * PROTECTION LAYERS:
 * 1. Compile-time: TypeScript enforces `value: string` (required, non-optional)
 * 2. Runtime (dev): Assertion throws if value is empty/undefined/null
 *
 * For "clear/no selection" options, use SELECT_CLEAR_VALUE from domain-constants.ts:
 * @example
 * ```tsx
 * import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
 * <SelectItem value={SELECT_CLEAR_VALUE}>No selection</SelectItem>
 * ```
 */
type SelectItemProps = Omit<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>, 'value'> & {
  /**
   * 🏢 ENTERPRISE: Required non-empty string value.
   * Use SELECT_CLEAR_VALUE from '@/config/domain-constants' for "no selection" options.
   */
  value: string;
};

const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, value, ...props }, ref) => {
  const iconSizes = useIconSizes();
  const dropdown = useDropdownTokens();

  // 🏢 ENTERPRISE: Dev-only guardrail - catch empty value early
  if (process.env.NODE_ENV !== 'production') {
    if (value === '' || value === undefined || value === null) {
      throw new Error(
        `[SelectItem] Empty value is forbidden by Radix Select.\n` +
        `Use SELECT_CLEAR_VALUE from '@/config/domain-constants' for "no selection" options.\n` +
        `Example: <SelectItem value={SELECT_CLEAR_VALUE}>No selection</SelectItem>\n` +
        `Received value: ${JSON.stringify(value)}`
      );
    }
  }

  return (
    <SelectPrimitive.Item
      ref={ref}
      value={value}
      className={cn(
        `relative flex w-full cursor-default select-none items-center rounded-sm ${dropdown.item.indented} ${dropdown.item.fontSize} outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50`,
        className
      )}
      {...props}
    >
      <span className={`${dropdown.indicator.position} ${iconSizes.xs}`}>
        <SelectPrimitive.ItemIndicator>
          <Check size={iconSizes.numeric.sm} />
        </SelectPrimitive.ItemIndicator>
      </span>

      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
})
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => {
  const dropdown = useDropdownTokens();
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn(`${dropdown.separator.margin} ${dropdown.separator.height} bg-muted`, className)}
      {...props}
    />
  );
})
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}

export type { SelectTriggerProps }