'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import { footerBase } from "../constants";

export const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn(footerBase, className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";
