'use client';
import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { CarouselApi, CarouselOptions, CarouselPlugin } from "../types";
import { ORIENTATION_AXIS } from "../constants";

export function useEmblaSetup(
  orientation: "horizontal" | "vertical",
  opts?: CarouselOptions,
  plugins?: CarouselPlugin,
  setApi?: (api: CarouselApi) => void
) {
  const [carouselRef, api] = useEmblaCarousel(
    { ...opts, axis: ORIENTATION_AXIS[orientation] },
    plugins
  );

  React.useEffect(() => {
    if (!api || !setApi) return;
    setApi(api);
  }, [api, setApi]);

  return { carouselRef, api };
}
