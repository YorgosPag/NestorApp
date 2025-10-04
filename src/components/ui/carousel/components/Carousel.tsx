'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import type { CarouselProps, CarouselContextProps } from "../types";
import { CarouselContext } from "../context";
import { useEmblaSetup } from "../hooks/useEmblaSetup";
import { useNavState } from "../hooks/useNavState";
import { useA11yNav } from "../hooks/useA11yNav";

export const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(({ orientation = "horizontal", opts, setApi, plugins, className, children, ...props }, ref) => {
  const { carouselRef, api } = useEmblaSetup(orientation, opts, plugins, setApi);
  const { canScrollPrev, canScrollNext, scrollPrev, scrollNext } = useNavState(api);
  const handleKeyDown = useA11yNav(scrollPrev, scrollNext);

  const contextValue = React.useMemo<CarouselContextProps>(() => ({
    carouselRef,
    api,
    opts,
    orientation: orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
    scrollPrev,
    scrollNext,
    canScrollPrev,
    canScrollNext,
  }), [carouselRef, api, opts, orientation, scrollPrev, scrollNext, canScrollPrev, canScrollNext]);

  return (
    <CarouselContext.Provider value={contextValue}>
      <div
        ref={ref}
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
});
Carousel.displayName = "Carousel";
