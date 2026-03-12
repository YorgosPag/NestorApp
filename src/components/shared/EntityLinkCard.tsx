'use client';

/**
 * EntityLinkCard — Centralized entity linking component
 *
 * Generic card for linking entities (company, project, building).
 * Used in: Building details, Unit details, Project details.
 *
 * Supports two modes:
 * - Standard: Radix Select dropdown (ADR-001 canonical)
 * - Searchable: Popover with typeahead filter + scrollable list
 *
 * @module components/shared/EntityLinkCard
 * @see CompanySelectorCard (building) — original pattern
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, ChevronsUpDown, Check, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface EntityLinkOption {
  id: string;
  name: string;
  /** Optional alternative label shown in "Τρέχον" line instead of name */
  currentLabel?: string;
}

export interface EntityLinkLabels {
  title: string;
  label: string;
  placeholder: string;
  noSelection: string;
  loading: string;
  save: string;
  saving: string;
  success: string;
  error: string;
  currentLabel: string;
}

export interface EntityLinkCardProps {
  /** Unique ID for accessibility */
  cardId: string;
  /** Icon for the card header */
  icon: LucideIcon;
  /** All UI labels (pre-translated by caller) */
  labels: EntityLinkLabels;
  /** Current linked entity ID */
  currentValue?: string;
  /** Load available options */
  loadOptions: () => Promise<EntityLinkOption[]>;
  /** Save the selected value (null = unlink). Required when autoSave=true (default). */
  onSave?: (newId: string | null, name: string) => Promise<{ success: boolean; error?: string }>;
  /** Callback after successful save (autoSave mode only) */
  onChanged?: (newId: string, name: string) => void;
  /** Callback on selection change (called in both modes). Use this to sync parent state. */
  onValueChange?: (newId: string | null, name: string) => void;
  /** Edit mode toggle */
  isEditing?: boolean;
  /** Enable searchable mode with typeahead filter (for large lists) */
  searchable?: boolean;
  /** Placeholder for search input (only when searchable=true) */
  searchPlaceholder?: string;
  /** Hide the "Τρέχον:" label below the dropdown */
  hideCurrentLabel?: boolean;
  /** Auto-save on selection change (default: true). Set to false when part of a form with its own Save button. */
  autoSave?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

const NONE_VALUE = '__none__';
const STATUS_RESET_MS = 3000;

export function EntityLinkCard({
  cardId,
  icon: Icon,
  labels,
  currentValue,
  loadOptions,
  onSave,
  onChanged,
  isEditing = true,
  searchable = false,
  searchPlaceholder = 'Αναζήτηση...',
  hideCurrentLabel = false,
  autoSave = true,
  onValueChange,
}: EntityLinkCardProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();

  const [options, setOptions] = useState<EntityLinkOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>(currentValue || NONE_VALUE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Track the last successfully saved value locally (autoSave mode ONLY).
  // When autoSave=false, parent controls state via currentValue — no internal tracking needed.
  const [savedValue, setSavedValue] = useState<string | undefined>(undefined);

  // Effective saved value: only use savedValue in autoSave mode
  const effectiveSavedValue = autoSave ? savedValue : undefined;

  // Load options on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await loadOptions();
        if (!cancelled) setOptions(data);
      } catch {
        // Options load failure is non-fatal — empty list shown
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [loadOptions]);

  // Sync with external value changes
  // When currentValue changes (e.g. user selects a different entity in the sidebar),
  // reset savedValue so we pick up the new entity's data instead of showing stale save.
  useEffect(() => {
    setSavedValue(undefined);
    setSelectedId(currentValue || NONE_VALUE);
  }, [currentValue]);

  // 🏢 ENTERPRISE: Auto-save on selection change
  // Saves immediately when user picks a value — no separate save button needed.
  // This matches user expectations (single "Αποθήκευση" in the header for form data,
  // entity links save independently on selection).
  const performSave = useCallback(async (valueToSave: string) => {
    setSaving(true);
    setSaveStatus('idle');

    try {
      const idToSave = valueToSave === NONE_VALUE ? null : valueToSave;
      const selectedOption = options.find(o => o.id === valueToSave);
      const name = selectedOption?.name || '';

      const result = await onSave(idToSave, name);

      if (result.success) {
        setSaveStatus('success');
        setSavedValue(idToSave ?? undefined);
        if (onChanged) {
          onChanged(idToSave ?? '', name);
        }
        setTimeout(() => setSaveStatus('idle'), STATUS_RESET_MS);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), STATUS_RESET_MS);
      }
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), STATUS_RESET_MS);
    } finally {
      setSaving(false);
    }
  }, [options, onSave, onChanged]);

  const handleChange = useCallback((value: string) => {
    setSelectedId(value);
    setSaveStatus('idle');

    const idValue = value === NONE_VALUE ? null : value;
    const selectedOption = options.find(o => o.id === value);
    const name = selectedOption?.name || '';

    // Always notify parent of value change
    onValueChange?.(idValue, name);

    if (autoSave && onSave) {
      // Auto-save: only if value actually changed from current/saved
      const effective = effectiveSavedValue !== undefined ? (effectiveSavedValue || NONE_VALUE) : (currentValue || NONE_VALUE);
      if (value !== effective) {
        performSave(value);
      }
    }
  }, [effectiveSavedValue, currentValue, performSave, autoSave, onSave, onValueChange, options]);

  const currentName = options.find(o => o.id === (effectiveSavedValue ?? currentValue))?.name;
  const selectedName = options.find(o => o.id === selectedId)?.name;

  // Searchable mode: filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(o => o.name.toLowerCase().includes(query));
  }, [options, searchQuery, searchable]);

  // ==========================================================================
  // SEARCHABLE SELECT (Popover + Input + scrollable list)
  // ==========================================================================

  const renderSearchableSelect = () => (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={popoverOpen}
          disabled={!isEditing}
          className={cn(
            'w-full justify-between font-normal h-10',
            !isEditing && 'bg-muted',
            !selectedName && selectedId === NONE_VALUE && 'text-muted-foreground',
            saveStatus === 'success' && getStatusBorder('success'),
            saveStatus === 'error' && getStatusBorder('error')
          )}
        >
          <span className="truncate">
            {selectedId === NONE_VALUE
              ? labels.placeholder
              : selectedName || labels.placeholder
            }
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* Search input */}
        <fieldset className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </fieldset>

        {/* Options list */}
        <ul
          role="listbox"
          className="max-h-60 overflow-y-auto p-1"
        >
          {/* None option */}
          <li
            role="option"
            aria-selected={selectedId === NONE_VALUE}
            className={cn(
              'flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
              selectedId === NONE_VALUE && 'bg-accent'
            )}
            onClick={() => {
              handleChange(NONE_VALUE);
              setPopoverOpen(false);
              setSearchQuery('');
            }}
          >
            <Check className={cn('mr-2 h-4 w-4', selectedId === NONE_VALUE ? 'opacity-100' : 'opacity-0')} />
            <span className="text-muted-foreground">{labels.noSelection}</span>
          </li>

          {filteredOptions.map((option) => (
            <li
              key={option.id}
              role="option"
              aria-selected={selectedId === option.id}
              className={cn(
                'flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
                selectedId === option.id && 'bg-accent'
              )}
              onClick={() => {
                handleChange(option.id);
                setPopoverOpen(false);
                setSearchQuery('');
              }}
            >
              <Check className={cn('mr-2 h-4 w-4', selectedId === option.id ? 'opacity-100' : 'opacity-0')} />
              {option.name}
            </li>
          ))}

          {filteredOptions.length === 0 && searchQuery.trim() && (
            <li className="px-2 py-4 text-center text-sm text-muted-foreground">
              Δεν βρέθηκαν αποτελέσματα
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );

  // ==========================================================================
  // STANDARD SELECT (Radix — ADR-001 canonical)
  // ==========================================================================

  const renderStandardSelect = () => (
    <Select
      value={selectedId}
      onValueChange={handleChange}
      disabled={!isEditing}
    >
      <SelectTrigger
        id={cardId}
        className={cn(
          !isEditing && 'bg-muted',
          saveStatus === 'success' && getStatusBorder('success'),
          saveStatus === 'error' && getStatusBorder('error')
        )}
      >
        <SelectValue placeholder={labels.placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          {labels.noSelection}
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <Card>
      <CardHeader className="p-2">
        <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
          <Icon className={iconSizes.md} />
          {labels.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 space-y-2">
        <fieldset className="space-y-2">
          <Label htmlFor={cardId}>{labels.label}</Label>

          {loading ? (
            <section className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
              <span>{labels.loading}</span>
            </section>
          ) : (
            searchable ? renderSearchableSelect() : renderStandardSelect()
          )}
        </fieldset>

        {!hideCurrentLabel && currentName && (
          <p className={cn('text-sm', colors.text.muted)}>
            {labels.currentLabel} <strong>{
              options.find(o => o.id === (effectiveSavedValue ?? currentValue))?.currentLabel || currentName
            }</strong>
          </p>
        )}

        {/* Auto-save status indicators */}
        {saving && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground pt-1">
            <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
            {labels.saving}
          </p>
        )}
        {saveStatus === 'success' && (
          <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 pt-1">
            <CheckCircle className={iconSizes.sm} />
            {labels.success}
          </p>
        )}
        {saveStatus === 'error' && (
          <p className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 pt-1">
            <AlertCircle className={iconSizes.sm} />
            {labels.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
