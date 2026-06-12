
import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate } from "@/lib/utils";

export function DatePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (d: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const parsedDate = value ? new Date(value) : undefined;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "justify-start text-left font-normal bg-background px-3",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatDate(value) : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsedDate}
          onSelect={(d) => {
            if (d) {
              // Adjust for timezone to avoid picking the previous day locally
              const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
              onChange(localDate.toISOString().slice(0, 10));
            } else {
              onChange("");
            }
            setIsOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}