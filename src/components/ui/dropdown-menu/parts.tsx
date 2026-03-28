"use client";
import * as React from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useDropdownTokens } from '@/hooks/useDropdownTokens';
import { componentSizes } from '@/styles/design-tokens';
import {
  DropdownMenuPortal,
  PrimitiveSubTrigger,
  PrimitiveSubContent,
  PrimitiveContent,
  PrimitiveItem,
  PrimitiveCheckboxItem,
  PrimitiveRadioItem,
  PrimitiveLabel,
  PrimitiveSeparator,
  PrimitiveItemIndicator,
} from "./primitives";
import '@/lib/design-system';

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof PrimitiveSubTrigger>,
  React.ComponentPropsWithoutRef<typeof PrimitiveSubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => {
  const { quick } = useBorderTokens();
  const dropdown = useDropdownTokens();

  return (
    <PrimitiveSubTrigger
      ref={ref}
      className={cn(
        `flex cursor-default select-none items-center ${quick.rounded} ${dropdown.item.standard} ${dropdown.item.fontSize} outline-none focus:bg-accent data-[state=open]:bg-accent`,
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
    </PrimitiveSubTrigger>
  );
});
DropdownMenuSubTrigger.displayName = PrimitiveSubTrigger.displayName;

export const DropdownMenuSubContent = React.forwardRef<
  React.ComponentRef<typeof PrimitiveSubContent>,
  React.ComponentPropsWithoutRef<typeof PrimitiveSubContent>
>(({ className, ...props }, ref) => {
  const { quick } = useBorderTokens();
  const dropdown = useDropdownTokens();

  return (
    <PrimitiveSubContent
      ref={ref}
      className={cn(
        `${dropdown.content.zIndex} ${dropdown.content.minWidth} overflow-hidden ${quick.table} bg-popover ${dropdown.content.padding} text-popover-foreground ${dropdown.content.shadowElevated} data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2`,
        className
      )}
      {...props}
    />
  );
});
DropdownMenuSubContent.displayName = PrimitiveSubContent.displayName;

export const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof PrimitiveContent>,
  React.ComponentPropsWithoutRef<typeof PrimitiveContent>
>(({ className, sideOffset, ...props }, ref) => {
  const { quick } = useBorderTokens();
  const dropdown = useDropdownTokens();

  return (
    <DropdownMenuPortal>
      <PrimitiveContent
        ref={ref}
        sideOffset={sideOffset ?? dropdown.content.sideOffset}
        className={cn(
          `${dropdown.content.zIndex} ${dropdown.content.minWidth} overflow-hidden ${quick.table} bg-popover ${dropdown.content.padding} text-popover-foreground ${dropdown.content.shadow} data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2`,
          className
        )}
        {...props}
      />
    </DropdownMenuPortal>
  );
});
DropdownMenuContent.displayName = PrimitiveContent.displayName;

export const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof PrimitiveItem>,
  React.ComponentPropsWithoutRef<typeof PrimitiveItem> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => {
  const { quick } = useBorderTokens();
  const dropdown = useDropdownTokens();

  return (
    <PrimitiveItem
      ref={ref}
      className={cn(
        `relative flex cursor-default select-none items-center ${dropdown.item.gap} ${quick.rounded} ${dropdown.item.standard} ${dropdown.item.fontSize} outline-none ${TRANSITION_PRESETS.STANDARD_COLORS} focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50`,
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = PrimitiveItem.displayName;

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof PrimitiveCheckboxItem>,
  React.ComponentPropsWithoutRef<typeof PrimitiveCheckboxItem>
>(({ className, children, checked, ...props }, ref) => {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const dropdown = useDropdownTokens();

  return (
    <PrimitiveCheckboxItem
      ref={ref}
      className={cn(
        `relative flex cursor-default select-none items-center ${quick.rounded} ${dropdown.item.indented} ${dropdown.item.fontSize} outline-none ${TRANSITION_PRESETS.STANDARD_COLORS} focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50`,
        className
      )}
      checked={checked}
      {...props}
    >
      <span className={`absolute left-2 flex ${dropdown.indicator.container} items-center justify-center`}>
        <PrimitiveItemIndicator>
          <Check className={iconSizes.sm} />
        </PrimitiveItemIndicator>
      </span>
      {children}
    </PrimitiveCheckboxItem>
  );
});
DropdownMenuCheckboxItem.displayName = PrimitiveCheckboxItem.displayName;

export const DropdownMenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof PrimitiveRadioItem>,
  React.ComponentPropsWithoutRef<typeof PrimitiveRadioItem>
>(({ className, children, ...props }, ref) => {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const dropdown = useDropdownTokens();

  return (
    <PrimitiveRadioItem
      ref={ref}
      className={cn(
        `relative flex cursor-default select-none items-center ${quick.rounded} ${dropdown.item.indented} ${dropdown.item.fontSize} outline-none ${TRANSITION_PRESETS.STANDARD_COLORS} focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50`,
        className
      )}
      {...props}
    >
      <span className={`absolute left-2 flex ${dropdown.indicator.container} items-center justify-center`}>
        <PrimitiveItemIndicator>
          <Circle className={iconSizes.xs} />
        </PrimitiveItemIndicator>
      </span>
      {children}
    </PrimitiveRadioItem>
  );
});
DropdownMenuRadioItem.displayName = PrimitiveRadioItem.displayName;

export const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof PrimitiveLabel>,
  React.ComponentPropsWithoutRef<typeof PrimitiveLabel> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => {
  const dropdown = useDropdownTokens();

  return (
    <PrimitiveLabel
      ref={ref}
      className={cn(
        `${dropdown.item.standard} ${dropdown.item.fontSize} ${dropdown.item.fontWeightLabel}`,
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
});
DropdownMenuLabel.displayName = PrimitiveLabel.displayName;

export const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof PrimitiveSeparator>,
  React.ComponentPropsWithoutRef<typeof PrimitiveSeparator>
>(({ className, ...props }, ref) => {
  const dropdown = useDropdownTokens();

  return (
    <PrimitiveSeparator
      ref={ref}
      className={cn(`${dropdown.separator.margin} ${dropdown.separator.height} bg-muted`, className)}
      {...props}
    />
  );
});
DropdownMenuSeparator.displayName = PrimitiveSeparator.displayName;

export const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn(componentSizes.dropdown.shortcut, className)} {...props} />
);
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";
