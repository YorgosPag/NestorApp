"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects'
import { useIconSizes } from '@/hooks/useIconSizes'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const iconSizes = useIconSizes();
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        // react-day-picker v9 classNames
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        button_previous: "absolute left-1",
        button_next: "absolute right-1",
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].range_end)]:rounded-r-md [&:has([aria-selected].outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        range_end: "range-end",
        selected:
          `bg-primary text-primary-foreground ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_SELECTED_HOVER} focus:bg-primary focus:text-primary-foreground`,
        today: "bg-accent text-accent-foreground",
        outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        PreviousMonthButton: ({ className, ...buttonProps }) => (
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "outline" }),
              `h-7 w-7 bg-transparent p-0 opacity-50 ${INTERACTIVE_PATTERNS.FADE_IN}`,
              className
            )}
            {...buttonProps}
          >
            <ChevronLeft className={cn(iconSizes.sm)} />
          </button>
        ),
        NextMonthButton: ({ className, ...buttonProps }) => (
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "outline" }),
              `h-7 w-7 bg-transparent p-0 opacity-50 ${INTERACTIVE_PATTERNS.FADE_IN}`,
              className
            )}
            {...buttonProps}
          >
            <ChevronRight className={cn(iconSizes.sm)} />
          </button>
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
