'use client';
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { cancelExtra } from "../constants";
import { PrimitiveCancel } from "../primitives";

export const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof PrimitiveCancel>,
  React.ComponentPropsWithoutRef<typeof PrimitiveCancel> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : PrimitiveCancel;
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant: "outline" }), cancelExtra, className)}
      {...props}
    />
  );
});
AlertDialogCancel.displayName = PrimitiveCancel.displayName;
