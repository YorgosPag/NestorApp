'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import { titleBase } from "../constants";
import { PrimitiveTitle } from "../primitives";

export const AlertDialogTitle = React.forwardRef<
  React.ComponentRef<typeof PrimitiveTitle>,
  React.ComponentPropsWithoutRef<typeof PrimitiveTitle>
>(({ className, ...props }, ref) => (
  <PrimitiveTitle ref={ref} className={cn(titleBase, className)} {...props} />
));
AlertDialogTitle.displayName = PrimitiveTitle.displayName;
