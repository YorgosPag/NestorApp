'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import { contentBase } from "../constants";
import { AlertDialogPortal } from "../primitives";
import { PrimitiveContent } from "../primitives";
import { AlertDialogOverlay } from "./Overlay";

export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof PrimitiveContent>,
  React.ComponentPropsWithoutRef<typeof PrimitiveContent>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <PrimitiveContent ref={ref} className={cn(contentBase, className)} {...props} />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = PrimitiveContent.displayName;
