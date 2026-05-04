'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Checkbox } from '@/components/ui/checkbox';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface MultiComboboxOption {
  value: string;
  label: string;
}

export interface MultiComboboxProps {
  value: string[];
  onChange: (values: string[]) => void;
  options: MultiComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxChipsDisplay?: number;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

// --- Chip ---
interface ChipProps {
  label: string;
  onRemove: () => void;
  removeAriaLabel: string;
}

function MultiComboboxChip({ label, onRemove, removeAriaLabel }: ChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-sm font-medium text-secondary-foreground">
      {label}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label={removeAriaLabel}
        className="ml-0.5 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// --- Search Input ---
interface SearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function MultiComboboxSearch({ value, onChange, placeholder, onKeyDown }: SearchProps) {
  return (
    <div className="flex items-center border-b px-3">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
        autoFocus
      />
    </div>
  );
}

// --- List Item ---
interface ItemProps {
  option: MultiComboboxOption;
  selected: boolean;
  focused: boolean;
  onToggle: () => void;
}

function MultiComboboxItem({ option, selected, focused, onToggle }: ItemProps) {
  return (
    <li
      role="option"
      aria-selected={selected}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none',
        focused ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground',
      )}
      onClick={onToggle}
    >
      <Checkbox checked={selected} onCheckedChange={() => onToggle()} aria-hidden tabIndex={-1} />
      <span>{option.label}</span>
    </li>
  );
}

// --- Keyboard Navigation ---
function useListKeyboard(
  filteredCount: number,
  focusedIndex: number,
  setFocusedIndex: (i: number) => void,
  onToggleFocused: () => void,
  onClose: () => void,
) {
  return React.useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(Math.min(focusedIndex + 1, filteredCount - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(Math.max(focusedIndex - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        onToggleFocused();
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  }, [filteredCount, focusedIndex, setFocusedIndex, onToggleFocused, onClose]);
}

// --- State Hook ---
function useMultiComboboxState(
  options: MultiComboboxOption[],
  value: string[],
  onChange: (values: string[]) => void,
) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [focusedIndex, setFocusedIndex] = React.useState(0);

  const selectedSet = React.useMemo(() => new Set(value), [value]);
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const lc = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lc));
  }, [options, search]);

  React.useEffect(() => { setFocusedIndex(0); }, [search]);
  React.useEffect(() => { if (open) { setSearch(''); setFocusedIndex(0); } }, [open]);

  const toggleOption = React.useCallback((optionValue: string) => {
    const next = new Set(selectedSet);
    if (next.has(optionValue)) next.delete(optionValue);
    else next.add(optionValue);
    onChange(Array.from(next));
  }, [selectedSet, onChange]);

  return { open, setOpen, search, setSearch, focusedIndex, setFocusedIndex, selectedSet, filteredOptions, toggleOption };
}

// --- Popover Content ---
type ComboboxState = ReturnType<typeof useMultiComboboxState>;

interface ContentProps {
  state: ComboboxState;
  searchPlaceholder: string;
  emptyMessage: string;
  clearAllLabel: string;
  hasClearAll: boolean;
  onClearAll: () => void;
}

function MultiComboboxContent({ state, searchPlaceholder, emptyMessage, clearAllLabel, hasClearAll, onClearAll }: ContentProps) {
  const toggleFocused = React.useCallback(() => {
    const opt = state.filteredOptions[state.focusedIndex];
    if (opt) state.toggleOption(opt.value);
  }, [state]);

  const handleKeyDown = useListKeyboard(
    state.filteredOptions.length,
    state.focusedIndex,
    state.setFocusedIndex,
    toggleFocused,
    () => state.setOpen(false),
  );

  return (
    <PopoverPrimitive.Content
      className="z-50 min-w-[var(--radix-popover-trigger-width)] rounded-md border bg-popover p-0 shadow-md"
      align="start"
      sideOffset={4}
    >
      <MultiComboboxSearch value={state.search} onChange={state.setSearch} placeholder={searchPlaceholder} onKeyDown={handleKeyDown} />
      <ul role="listbox" aria-multiselectable className="max-h-60 overflow-y-auto p-1">
        {state.filteredOptions.length === 0 ? (
          <li className="py-4 text-center text-sm text-muted-foreground">{emptyMessage}</li>
        ) : (
          state.filteredOptions.map((opt, idx) => (
            <MultiComboboxItem
              key={opt.value}
              option={opt}
              selected={state.selectedSet.has(opt.value)}
              focused={idx === state.focusedIndex}
              onToggle={() => state.toggleOption(opt.value)}
            />
          ))
        )}
      </ul>
      {hasClearAll && (
        <div className="border-t p-1">
          <button type="button" onClick={onClearAll} className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            {clearAllLabel}
          </button>
        </div>
      )}
    </PopoverPrimitive.Content>
  );
}

// --- Main Component ---
export function MultiCombobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  maxChipsDisplay = 3,
  ariaLabel,
  disabled = false,
  className,
}: MultiComboboxProps) {
  const { t } = useTranslation(['common']);
  const state = useMultiComboboxState(options, value, onChange);

  const labelMap = React.useMemo(
    () => Object.fromEntries(options.map((o) => [o.value, o.label])),
    [options],
  );

  const removeLabel = t('multiCombobox.removeChip');
  const visibleChips = value.slice(0, maxChipsDisplay);
  const overflowCount = value.length - maxChipsDisplay;

  return (
    <PopoverPrimitive.Root open={state.open} onOpenChange={disabled ? undefined : state.setOpen}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <div
          role="combobox"
          tabIndex={disabled ? -1 : 0}
          aria-expanded={state.open}
          aria-multiselectable
          aria-label={ariaLabel}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); state.setOpen(!state.open); } }}
          className={cn(
            'flex min-h-10 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          {visibleChips.length === 0 && <span className="text-muted-foreground">{placeholder ?? ''}</span>}
          {visibleChips.map((v) => (
            <MultiComboboxChip key={v} label={labelMap[v] ?? v} onRemove={() => state.toggleOption(v)} removeAriaLabel={removeLabel} />
          ))}
          {overflowCount > 0 && (
            <span className="text-xs text-muted-foreground">{t('multiCombobox.selectedCount', { count: overflowCount })}</span>
          )}
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </div>
      </PopoverPrimitive.Trigger>
      <MultiComboboxContent
        state={state}
        searchPlaceholder={searchPlaceholder ?? t('multiCombobox.searchPlaceholder')}
        emptyMessage={emptyMessage ?? t('multiCombobox.emptyMessage')}
        clearAllLabel={t('multiCombobox.clearAll')}
        hasClearAll={value.length > 0}
        onClearAll={() => onChange([])}
      />
    </PopoverPrimitive.Root>
  );
}
