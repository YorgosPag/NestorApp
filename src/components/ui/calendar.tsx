"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { el, enUS } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { useTranslation } from "@/i18n/hooks/useTranslation"
import '@/lib/design-system';

export type CalendarProps = React.ComponentProps<typeof DayPicker>

const DATE_FNS_LOCALE_MAP: Record<string, typeof el> = { el, en: enUS };

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale,
  ...props
}: CalendarProps) {
  const { currentLanguage } = useTranslation();
  const resolvedLocale = locale ?? DATE_FNS_LOCALE_MAP[currentLanguage] ?? el;
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={resolvedLocale}
      className={cn("p-3", className)}
      classNames={{
        // react-day-picker v9 — uses <table> structure, NOT flex divs
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-between pt-1 items-center",
        caption_label: "text-sm font-medium",
        nav: "contents",
        button_previous: "",
        button_next: "",
        month_grid: "w-full border-collapse",
        weekdays: "",
        weekday: "text-muted-foreground font-normal text-[0.8rem] w-9 py-1",
        weeks: "",
        week: "",
        day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        range_end: "day-range-end",
        selected: "!bg-blue-600 !text-white rounded-md",
        today: "bg-accent text-accent-foreground",
        outside: "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        PreviousMonthButton: ({ className: btnClassName, ...buttonProps }) => (
          <button
            type="button"
            className={cn(
              "h-8 w-8 p-0 inline-flex items-center justify-center rounded-md",
              "border border-input bg-transparent",
              "text-muted-foreground hover:text-foreground hover:bg-accent",
              "transition-colors duration-150",
              btnClassName
            )}
            {...buttonProps}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ),
        NextMonthButton: ({ className: btnClassName, ...buttonProps }) => (
          <button
            type="button"
            className={cn(
              "h-8 w-8 p-0 inline-flex items-center justify-center rounded-md",
              "border border-input bg-transparent",
              "text-muted-foreground hover:text-foreground hover:bg-accent",
              "transition-colors duration-150",
              btnClassName
            )}
            {...buttonProps}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
