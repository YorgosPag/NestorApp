'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

// ── Constants ──────────────────────────────────────────────────────────────────

const ITEM_H = 44;
const VISIBLE = 5; // must be odd — center slot = selected
const PAD = ITEM_H * Math.floor(VISIBLE / 2);

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// ── Pure helpers ───────────────────────────────────────────────────────────────

function clampInt(n: number, min: number, max: number): number {
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function deriveSelH(value: string): string {
  const part = value.split(':')[0] ?? '';
  return String(clampInt(parseInt(part, 10), 0, 23)).padStart(2, '0');
}

function deriveSelM(value: string): string {
  const part = value.split(':')[1] ?? '';
  return String(clampInt(parseInt(part, 10), 0, 59)).padStart(2, '0');
}

/** Live formatter — auto-inserts colon after 2 hour digits. Used during typing. */
function formatTimeInput(raw: string, prevValue: string): string {
  // Backspace on auto-inserted colon: remove colon + last hour digit
  if (prevValue.endsWith(':') && raw === prevValue.slice(0, -1)) {
    return raw.slice(0, -1);
  }
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 0) return '';
  if (digits.length <= 1) return digits;
  if (digits.length === 2) return `${digits}:`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** Final normalizer — pads + clamps to "HH:MM". Used on Enter/blur. */
export function normalizeTime(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 0) return '00:00';
  let h: number;
  let m: number;
  if (digits.length <= 2) {
    h = parseInt(digits, 10);
    m = 0;
  } else {
    h = parseInt(digits.slice(0, 2), 10);
    m = parseInt(digits.slice(2).padEnd(2, '0'), 10);
  }
  return `${String(clampInt(h, 0, 23)).padStart(2, '0')}:${String(clampInt(m, 0, 59)).padStart(2, '0')}`;
}

// ── WheelColumn ────────────────────────────────────────────────────────────────

interface WheelColumnProps {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  closeOnSelect?: boolean;
  onClose?: () => void;
}

function WheelColumn({ items, value, onChange, closeOnSelect, onClose }: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  const busy = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || busy.current) return;
    const idx = items.indexOf(value);
    if (idx >= 0) {
      busy.current = true;
      el.scrollTop = idx * ITEM_H;
      requestAnimationFrame(() => { busy.current = false; });
    }
  }, [value, items]);

  const handleScroll = useCallback(() => {
    if (busy.current) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = clampInt(Math.round(el.scrollTop / ITEM_H), 0, items.length - 1);
      busy.current = true;
      el.scrollTop = idx * ITEM_H;
      requestAnimationFrame(() => { busy.current = false; });
      onChange(items[idx]);
      if (closeOnSelect) onClose?.();
    }, 90);
  }, [items, onChange, closeOnSelect, onClose]);

  return (
    <div className="relative" style={{ height: ITEM_H * VISIBLE, width: 60 }}>
      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        <div style={{ height: PAD }} />
        {items.map((item, i) => {
          const isActive = item === value;
          return (
            <div
              key={item}
              style={{ height: ITEM_H }}
              className={`flex items-center justify-center cursor-pointer select-none tabular-nums transition-all duration-200
                ${isActive ? 'text-foreground text-lg font-semibold' : 'text-muted-foreground text-sm opacity-40'}`}
              onClick={() => {
                const el = ref.current;
                if (el) {
                  busy.current = true;
                  el.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
                  setTimeout(() => { busy.current = false; }, 350);
                }
                onChange(item);
                if (closeOnSelect) onClose?.();
              }}
            >
              {item}
            </div>
          );
        })}
        <div style={{ height: PAD }} />
      </div>

      <div
        className="absolute inset-x-0 top-0 pointer-events-none bg-gradient-to-b from-popover to-transparent"
        style={{ height: PAD }}
      />
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none bg-gradient-to-t from-popover to-transparent"
        style={{ height: PAD }}
      />
      <div
        className="absolute inset-x-1.5 pointer-events-none rounded-lg border border-border bg-accent/30"
        style={{ top: PAD, height: ITEM_H }}
      />
    </div>
  );
}

// ── TimePickerPopover ──────────────────────────────────────────────────────────

interface TimePickerPopoverProps {
  value: string; // "HH:MM" (or partial during typing)
  onChange: (v: string) => void;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  inputId?: string;
  placeholder?: string;
}

export function TimePickerPopover({ value, onChange, disabled, open, onOpenChange, inputId, placeholder }: TimePickerPopoverProps) {
  const anchorRef = useRef<HTMLDivElement>(null);

  // Wheel state DERIVED from value — single source of truth, no sync bugs.
  const selH = deriveSelH(value);
  const selM = deriveSelM(value);

  const handleHour = useCallback((h: string) => onChange(`${h}:${selM}`), [selM, onChange]);
  const handleMinute = useCallback((m: string) => {
    onChange(`${selH}:${m}`);
    onOpenChange(false);
  }, [selH, onChange, onOpenChange]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const commit = useCallback(() => {
    const normalized = normalizeTime(value);
    if (normalized !== value) onChange(normalized);
  }, [value, onChange]);

  return (
    <Popover open={!disabled && open} onOpenChange={(o) => !disabled && onOpenChange(o)}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative">
          <button
            type="button"
            disabled={disabled}
            tabIndex={-1}
            onClick={() => { if (!disabled) onOpenChange(true); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:pointer-events-none disabled:opacity-40"
          >
            <Clock className="h-4 w-4" />
          </button>
          <Input
            id={inputId}
            type="text"
            hasLeftIcon
            value={value}
            onChange={(e) => onChange(formatTimeInput(e.target.value, value))}
            onFocus={(e) => { const el = e.currentTarget; setTimeout(() => el.select(), 0); }}
            onClick={(e) => { const el = e.currentTarget; setTimeout(() => el.select(), 0); if (!disabled) onOpenChange(true); }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onOpenChange(false);
                return;
              }
              if (e.key === 'Enter') {
                commit();
                onOpenChange(false);
                // Let event bubble → form's onSubmit fires via hidden submit button
              }
            }}
            disabled={disabled}
            placeholder={placeholder}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-auto p-3"
        align="start"
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        <div className="text-center text-2xl font-bold tabular-nums tracking-tight text-foreground mb-3 select-none">
          {selH}<span className="text-muted-foreground">:</span>{selM}
        </div>
        <div className="flex items-center gap-0.5">
          <WheelColumn items={HOURS} value={selH} onChange={handleHour} />
          <span className="text-xl font-bold text-muted-foreground select-none pb-1 px-0.5">:</span>
          <WheelColumn items={MINUTES} value={selM} onChange={handleMinute} closeOnSelect onClose={close} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
