'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import { headerBase } from "../constants";

export const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn(headerBase, className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";
