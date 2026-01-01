'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import { descriptionBase } from "../constants";
import { PrimitiveDescription } from "../primitives";

export const AlertDialogDescription = React.forwardRef<
  React.ComponentRef<typeof PrimitiveDescription>,
  React.ComponentPropsWithoutRef<typeof PrimitiveDescription>
>(({ className, ...props }, ref) => (
  <PrimitiveDescription ref={ref} className={cn(descriptionBase, className)} {...props} />
));
AlertDialogDescription.displayName = PrimitiveDescription.displayName;
