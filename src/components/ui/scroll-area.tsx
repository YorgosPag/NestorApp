"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import type { ScrollEdges } from "@/hooks/useScrollEdges"
import { cn } from "@/lib/utils"
import '@/lib/design-system';

/**
 * 🏢 ENTERPRISE: ScrollArea with visible scrollbar support
 * - type="always" για μόνιμη εμφάνιση scrollbar
 * - type="auto" (default) για εμφάνιση μόνο όταν χρειάζεται
 * - type="hover" για εμφάνιση με hover
 * - type="scroll" για εμφάνιση μόνο κατά το scroll
 */
interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  /** Radix scroll type: "auto" | "always" | "hover" | "scroll" */
  type?: "auto" | "always" | "hover" | "scroll";
  /**
   * Ποιες μπάρες ζωγραφίζονται (προεπιλογή `vertical` — η συμπεριφορά όλων των υπαρχόντων καταναλωτών).
   * ⚠️ Οι μπάρες του Radix είναι **δικά του στοιχεία DOM**, άρα φαίνονται παρά τον καθολικό κανόνα του `globals.css`
   * που κρύβει κάθε εγγενή μπάρα (`* { scrollbar-width: none }`) — γι' αυτό εδώ και όχι πέμπτη εξαίρεση CSS (ADR-930 §3.11).
   */
  orientation?: "vertical" | "horizontal" | "both";
  /** Το στοιχείο που ΚΥΛΑ (π.χ. για `useScrollEdges`). */
  viewportRef?: React.Ref<HTMLDivElement>;
  /** Κλάσεις του στοιχείου που κυλά (π.χ. το σβήσιμο άκρης `scroll-edge-fade`). */
  viewportClassName?: string;
  /** `data-scroll-edges` του στοιχείου που κυλά — το ζευγάρι του `useScrollEdges` (ADR-777 §8.79). */
  viewportEdges?: ScrollEdges;
}

const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, children, type = "auto", orientation = "vertical", viewportRef, viewportClassName, viewportEdges, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    type={type}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    {/* 🔑 `[&>div]:!block` (ADR-912 §10): το Radix τυλίγει το περιεχόμενο σε `<div style="display:table; min-width:100%">`.
        Ως πίνακας, το περιτύλιγμα φαρδαίνει όσο το πιο φαρδύ ΑΣΠΑΣΤΟ περιεχόμενο (ένας μακρύς τίτλος με `truncate`),
        και επειδή δεν υπάρχει οριζόντια μπάρα, ό,τι περισσεύει απλώς ΚΟΒΕΤΑΙ: στα 390px οι κάρτες της λίστας κτιρίων
        έβγαιναν 375px σε θυρίδα 348px (μετρημένο 2026-10-11). Ως block το πλάτος το ορίζει η θυρίδα. */}
    <ScrollAreaPrimitive.Viewport
      ref={viewportRef}
      data-scroll-edges={viewportEdges}
      className={cn("h-full w-full rounded-[inherit] [&>div]:!block", viewportClassName)}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    {orientation !== "horizontal" && <ScrollBar />}
    {orientation !== "vertical" && <ScrollBar orientation="horizontal" />}
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    {/* 🏢 ENTERPRISE: More visible scrollbar thumb */}
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/50 transition-colors" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
