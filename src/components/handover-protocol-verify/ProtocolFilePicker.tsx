'use client';

/**
 * @fileoverview **Ο επιλογέας αρχείων της σελίδας επαλήθευσης** — ρίψη ή επιλογή, ένα ή πολλά (ADR-916 Φ-Γ2 Σ6).
 * @module components/handover-protocol-verify/ProtocolFilePicker
 *
 * ♿ Ολόκληρη η ζώνη είναι `<label>` του πραγματικού `<input type="file">`: πληκτρολόγιο, αναγνώστης οθόνης και κινητό
 *    δουλεύουν χωρίς τίποτα επιπλέον· η ρίψη είναι **πρόσθετη** δυνατότητα, ποτέ η μόνη.
 * 🔒 Τίποτα δεν ανεβαίνει: τα `File` δίνονται στον καλούντα, που τα διαβάζει στη συσκευή.
 */

import React from 'react';
import { FileUp } from 'lucide-react';

import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';

export function ProtocolFilePicker({ title, hint, action, multiple = false, accept, level = 'h2', onFiles, children }: {
  readonly title: string;
  /** `h3` όταν ο επιλογέας ζει μέσα σε ετυμηγορία (ο έλεγχος πακέτου). */
  readonly level?: 'h2' | 'h3';
  readonly hint: string;
  readonly action: string;
  readonly multiple?: boolean;
  readonly accept?: string;
  readonly onFiles: (files: readonly File[]) => void;
  readonly children?: React.ReactNode;
}) {
  const iconSizes = useIconSizes();
  const titleId = React.useId();
  const inputId = React.useId();
  const [dragging, setDragging] = React.useState(false);
  const Heading = level;

  const take = React.useCallback((list: FileList | null) => {
    const files = list === null ? [] : Array.from(list);
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  }, [multiple, onFiles]);

  const onDrop = React.useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    take(event.dataTransfer.files);
  }, [take]);

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <Heading id={titleId} className="m-0 text-base font-semibold text-foreground">{title}</Heading>
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center',
          'focus-within:ring-2 focus-within:ring-ring',
          dragging && 'bg-accent/50',
        )}
      >
        <FileUp className={cn(iconSizes.lg, 'text-muted-foreground')} aria-hidden="true" />
        <span className="text-sm text-foreground">{hint}</span>
        <span className={cn('inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium', COLOR_BRIDGE.action.secondary)}>{action}</span>
        <input
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(event) => {
            take(event.currentTarget.files);
            event.currentTarget.value = '';
          }}
        />
      </label>
      {children}
    </section>
  );
}
