'use client';
import * as React from "react";
import type { CarouselContextProps } from "./types";

export const CarouselContext = React.createContext<CarouselContextProps | null>(null);

export function useCarousel() {
  const ctx = React.useContext(CarouselContext);
  if (!ctx) throw new Error("useCarousel must be used within a <Carousel />");
  return ctx;
}
