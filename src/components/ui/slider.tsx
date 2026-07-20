"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

// ✅ ENTERPRISE FIX: Use relative paths instead of @ aliases
import { cn } from "../../lib/utils"
import '@/lib/design-system';

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  /**
   * Accessible name for the draggable thumb.
   *
   * Radix puts `role="slider"` on the THUMB, not on the Root — so an
   * `aria-label` handed to <Slider> lands on a roleless wrapper span and is
   * never announced. This prop is the only way to name the actual control.
   *
   * Strictly additive: when omitted, React drops the attribute entirely and
   * the rendered DOM is byte-identical to before this prop existed.
   */
  thumbAriaLabel?: string
}

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, thumbAriaLabel, ...props }, ref) => {
  // ✅ ENTERPRISE FIX: Simplified approach without problematic hooks

  return (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      // Orientation-aware (Radix sets data-orientation). Horizontal = original look.
      "relative flex touch-none select-none",
      "data-[orientation=horizontal]:w-full data-[orientation=horizontal]:items-center",
      // items-center is required on the cross axis so the wider thumb (w-5) stays centred
      // over the narrow track (w-2); without it flex-col aligns both to flex-start → off-centre thumb.
      "data-[orientation=vertical]:h-full data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-center data-[orientation=vertical]:justify-center",
      className
    )}
    {...props}
  >
    {/*
      COLOUR (ADR-682 §5.5): the accent is `--slider-accent`, NOT `--primary`.
      Stock shadcn paints sliders with `bg-primary` because there `--primary` IS
      the brand accent. In this app `--primary` was repurposed as a dark surface
      colour — in dark mode it equals `--card`, so the slider was drawn in its own
      background's colour. Changing `--primary` would have repainted every button
      and surface, so the accent got its own token instead (globals.css :root/.dark).
      Anything wanting a differently-themed slider overrides `--slider-accent` in a
      scope — see `.cut-plane-slider-accent` (ADR-452) for the working example.
    */}
    <SliderPrimitive.Track className="relative grow overflow-hidden rounded-full bg-[hsl(var(--slider-accent)/0.25)] data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2">
      <SliderPrimitive.Range className="absolute bg-[hsl(var(--slider-accent))] data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />
    </SliderPrimitive.Track>
    {/*
      The disabled visuals key off `data-disabled`, NOT `:disabled`. The thumb is a
      <span>, and the CSS `:disabled` pseudo-class only ever matches form controls —
      so `disabled:opacity-50` could never fire and the disabled state was invisible.
      Radix stamps `data-disabled` on the thumb whenever the Root is disabled.

      SIZE (ADR-682): the diameter comes from `--slider-thumb-size` (globals.css),
      NOT a literal `h-5 w-5`. Radix keeps the thumb in-bounds (±½ diameter), so
      anything overlaying the track — e.g. TimelineScrubber's waypoint ticks — must
      position itself in the SAME units. It used to copy the number as
      `THUMB_SIZE_PX = 20` behind a "keep in sync" comment; a token both sides read
      makes drift impossible instead of merely discouraged.
    */}
    <SliderPrimitive.Thumb
      aria-label={thumbAriaLabel}
      className="block h-[var(--slider-thumb-size)] w-[var(--slider-thumb-size)] rounded-full border-2 border-[hsl(var(--slider-accent))] bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    />
  </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
