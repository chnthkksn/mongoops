"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "h-7 justify-start px-2.5 text-[12px] font-normal",
              !value?.from && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <CalendarIcon className="mr-1.5 size-3.5" />
        {value?.from ? (
          value.to ? (
            <>
              {format(value.from, "LLL d, y")} – {format(value.to, "LLL d, y")}
            </>
          ) : (
            format(value.from, "LLL d, y")
          )
        ) : (
          "All time"
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={value?.from}
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
        />
        {value?.from && (
          <div className="border-t border-border p-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full text-[12px]"
              onClick={() => onChange(undefined)}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
