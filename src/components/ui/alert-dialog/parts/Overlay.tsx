'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import { overlayBase } from "../constants";
import { PrimitiveOverlay } from "../primitives";

export const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof PrimitiveOverlay>,
  React.ComponentPropsWithoutRef<typeof PrimitiveOverlay>
>(({ className, ...props }, ref) => (
  <PrimitiveOverlay ref={ref} className={cn(overlayBase, className)} {...props} />
));
AlertDialogOverlay.displayName = PrimitiveOverlay.displayName;
