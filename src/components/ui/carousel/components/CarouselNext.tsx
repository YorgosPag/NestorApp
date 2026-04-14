'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useIconSizes } from "@/hooks/useIconSizes";
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCarousel } from "../context";
import '@/lib/design-system';

export const CarouselNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const iconSizes = useIconSizes();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const { orientation, scrollNext, canScrollNext } = useCarousel();
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        `absolute ${iconSizes.xl} rounded-full`,
        orientation === "horizontal" ? "-right-12 top-1/2 -translate-y-1/2" : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ArrowRight className={iconSizes.sm} />
      <span className="sr-only">{t('buttons.nextSlide')}</span>
    </Button>
  );
});
CarouselNext.displayName = "CarouselNext";
