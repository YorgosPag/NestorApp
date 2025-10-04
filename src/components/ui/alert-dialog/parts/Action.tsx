'use client';
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PrimitiveAction } from "../primitives";

export const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof PrimitiveAction>,
  React.ComponentPropsWithoutRef<typeof PrimitiveAction> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : PrimitiveAction;
  return <Comp ref={ref} className={cn(buttonVariants(), className)} {...props} />;
});
AlertDialogAction.displayName = PrimitiveAction.displayName;
