"use client";
import * as React from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
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

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof PrimitiveSubTrigger>,
  React.ComponentPropsWithoutRef<typeof PrimitiveSubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <PrimitiveSubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
  </PrimitiveSubTrigger>
));
DropdownMenuSubTrigger.displayName = PrimitiveSubTrigger.displayName;

export const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof PrimitiveSubContent>,
  React.ComponentPropsWithoutRef<typeof PrimitiveSubContent>
>(({ className, ...props }, ref) => (
  <PrimitiveSubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = PrimitiveSubContent.displayName;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof PrimitiveContent>,
  React.ComponentPropsWithoutRef<typeof PrimitiveContent>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPortal>
    <PrimitiveContent
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </DropdownMenuPortal>
));
DropdownMenuContent.displayName = PrimitiveContent.displayName;

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof PrimitiveItem>,
  React.ComponentPropsWithoutRef<typeof PrimitiveItem> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <PrimitiveItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = PrimitiveItem.displayName;

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof PrimitiveCheckboxItem>,
  React.ComponentPropsWithoutRef<typeof PrimitiveCheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <PrimitiveCheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <PrimitiveItemIndicator>
        <Check className="h-4 w-4" />
      </PrimitiveItemIndicator>
    </span>
    {children}
  </PrimitiveCheckboxItem>
));
DropdownMenuCheckboxItem.displayName = PrimitiveCheckboxItem.displayName;

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof PrimitiveRadioItem>,
  React.ComponentPropsWithoutRef<typeof PrimitiveRadioItem>
>(({ className, children, ...props }, ref) => (
  <PrimitiveRadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <PrimitiveItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </PrimitiveItemIndicator>
    </span>
    {children}
  </PrimitiveRadioItem>
));
DropdownMenuRadioItem.displayName = PrimitiveRadioItem.displayName;

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof PrimitiveLabel>,
  React.ComponentPropsWithoutRef<typeof PrimitiveLabel> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <PrimitiveLabel
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = PrimitiveLabel.displayName;

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof PrimitiveSeparator>,
  React.ComponentPropsWithoutRef<typeof PrimitiveSeparator>
>(({ className, ...props }, ref) => (
  <PrimitiveSeparator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
DropdownMenuSeparator.displayName = PrimitiveSeparator.displayName;

export const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
);
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";
