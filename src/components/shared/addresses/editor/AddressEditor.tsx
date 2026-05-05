'use client';

/**
 * AddressEditor — Layer 6 coordinator (ADR-332 Phase 5)
 *
 * Wires all Layer 4 hooks + Layer 5 panels into a single enterprise address
 * editing surface. Supports edit and view modes.
 *
 * @module components/shared/addresses/editor/AddressEditor
 * @see ADR-332 §3.3 Coordinator API
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Redo2, RotateCcw, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAddressEditor } from './hooks/useAddressEditor';
import { useAddressSuggestions } from './hooks/useAddressSuggestions';
import { useAddressReconciliation } from './hooks/useAddressReconciliation';
import { useAddressUndo } from './hooks/useAddressUndo';
import { AddressFieldBadge } from './components/AddressFieldBadge';
import { AddressConfidenceMeter } from './components/AddressConfidenceMeter';
import { AddressActivityLog } from './components/AddressActivityLog';
import { AddressReconciliationPanel } from './components/AddressReconciliationPanel';
import { AddressSuggestionsPanel } from './components/AddressSuggestionsPanel';
import { AddressDragConfirmDialog } from './components/AddressDragConfirmDialog';
import { AddressEditorContext } from './AddressEditorContext';
import type { AddressEditorProps } from './AddressEditor.types';
import type {
  AddressEditorState,
  AddressFieldStatus,
  GeocodingApiResponse,
  ResolvedAddressFields,
} from './types';

// =============================================================================
// Constants
// =============================================================================

const FIELD_CONFIGS: ReadonlyArray<{
  field: keyof ResolvedAddressFields;
  labelKey: string;
  placeholderKey?: string;
}> = [
  { field: 'street', labelKey: 'form.street', placeholderKey: 'form.streetPlaceholder' },
  { field: 'number', labelKey: 'form.number', placeholderKey: 'form.numberPlaceholder' },
  { field: 'postalCode', labelKey: 'form.postalCode', placeholderKey: 'form.postalCodePlaceholder' },
  { field: 'neighborhood', labelKey: 'form.neighborhood', placeholderKey: 'form.neighborhoodPlaceholder' },
  { field: 'city', labelKey: 'form.city', placeholderKey: 'form.cityPlaceholder' },
  { field: 'county', labelKey: 'editor.fields.county' },
  { field: 'region', labelKey: 'form.region', placeholderKey: 'form.regionPlaceholder' },
  { field: 'country', labelKey: 'form.country', placeholderKey: 'form.countryPlaceholder' },
];

const PHASE_STATUS_CLASS: Record<AddressEditorState['phase'], string> = {
  idle: 'text-muted-foreground',
  typing: 'text-muted-foreground',
  debouncing: 'text-muted-foreground',
  loading: 'text-blue-600 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
  partial: 'text-amber-600 dark:text-amber-400',
  conflict: 'text-orange-600 dark:text-orange-400',
  suggestions: 'text-purple-600 dark:text-purple-400',
  stale: 'text-muted-foreground',
  error: 'text-red-600 dark:text-red-400',
};

// =============================================================================
// Helpers
// =============================================================================

function extractResult(state: AddressEditorState): GeocodingApiResponse | null {
  if (
    state.phase === 'success' ||
    state.phase === 'partial' ||
    state.phase === 'conflict'
  ) {
    return state.result;
  }
  if (state.phase === 'stale') return state.lastResult;
  return null;
}

// =============================================================================
// Sub-components
// =============================================================================

interface FormFieldRowProps {
  field: keyof ResolvedAddressFields;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  status: AddressFieldStatus;
  disabled: boolean;
}

function FormFieldRow({
  field,
  label,
  placeholder,
  value,
  onChange,
  status,
  disabled,
}: FormFieldRowProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`addr-${field}`} className="text-xs font-medium">
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <Input
          id={`addr-${field}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-8 text-sm"
        />
        <AddressFieldBadge status={status} />
      </div>
    </div>
  );
}

// =============================================================================
// Keyboard hook
// =============================================================================

function useEditorKeyboard(
  canUndo: boolean,
  canRedo: boolean,
  onUndo: () => void,
  onRedo: () => void,
): void {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'z' && !e.shiftKey && canUndo) {
        e.preventDefault();
        onUndo();
      } else if ((e.key === 'y' || (e.key === 'z' && e.shiftKey)) && canRedo) {
        e.preventDefault();
        onRedo();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [canUndo, canRedo, onUndo, onRedo]);
}

// =============================================================================
// Coordinator
// =============================================================================

export function AddressEditor({
  value,
  onChange,
  mode = 'edit',
  activityLog: activityLogOpts,
  className,
}: AddressEditorProps) {
  const { t } = useTranslation('addresses');

  // Semi-controlled: internal form state; reset on value identity change.
  const [userInput, setUserInput] = useState<ResolvedAddressFields>(() => value);
  const [pendingDrag, setPendingDrag] = useState<ResolvedAddressFields | null>(null);
  const [logCollapsed, setLogCollapsed] = useState(activityLogOpts?.collapsed ?? false);
  const userInputRef = useRef(userInput);

  useEffect(() => {
    userInputRef.current = userInput;
  }, [userInput]);

  // Sync when parent resets the address (e.g. switching entity).
  const valueRef = useRef(value);
  useEffect(() => {
    if (valueRef.current !== value) {
      valueRef.current = value;
      setUserInput(value);
    }
  }, [value]);

  // === Hook wiring ===
  const editor = useAddressEditor(userInput, {
    autoGeocode: mode === 'edit',
    verbosity: activityLogOpts?.verbosity ?? 'detailed',
  });

  const currentResult = extractResult(editor.state);
  const resolvedFields: ResolvedAddressFields = currentResult?.resolvedFields ?? {};

  const suggestions = useAddressSuggestions(currentResult);
  const reconciliation = useAddressReconciliation(userInput, resolvedFields);
  const undoHook = useAddressUndo();

  // === Field change ===
  const handleFieldChange = useCallback(
    (field: keyof ResolvedAddressFields, val: string) => {
      const next = { ...userInputRef.current, [field]: val };
      setUserInput(next);
      onChange(next);
    },
    [onChange],
  );

  // === Undo / Redo ===
  const handleUndo = useCallback(() => {
    const entry = undoHook.undo();
    if (!entry) return;
    setUserInput(entry.before);
    onChange(entry.before);
  }, [undoHook, onChange]);

  const handleRedo = useCallback(() => {
    const entry = undoHook.redo();
    if (!entry) return;
    setUserInput(entry.after);
    onChange(entry.after);
  }, [undoHook, onChange]);

  useEditorKeyboard(undoHook.canUndo, undoHook.canRedo, handleUndo, handleRedo);

  // === Reconciliation confirm ===
  const handleMergeConfirm = useCallback(() => {
    if (!reconciliation.resolved) return;
    const merged = reconciliation.merged;
    undoHook.push({
      kind: 'bulk-correction',
      before: userInputRef.current,
      after: merged,
      i18nKey: 'addresses.editor.undo.bulkCorrection',
    });
    setUserInput(merged);
    onChange(merged);
    editor.applyCorrection();
  }, [reconciliation, undoHook, onChange, editor]);

  // === Suggestion select ===
  const handleSuggestionSelect = useCallback(
    (candidate: GeocodingApiResponse) => {
      const fields = candidate.resolvedFields;
      undoHook.push({
        kind: 'suggestion-accepted',
        before: userInputRef.current,
        after: fields,
        i18nKey: 'addresses.editor.undo.suggestionAccepted',
      });
      setUserInput(fields);
      onChange(fields);
      editor.applyCorrection();
    },
    [undoHook, onChange, editor],
  );

  const handleSuggestionRetry = useCallback(
    (field: keyof ResolvedAddressFields) => {
      suggestions.recordOmitAttempt(field);
      void editor.triggerGeocode();
    },
    [suggestions, editor],
  );

  // === Drag confirm ===
  const handleDragConfirm = useCallback(() => {
    if (!pendingDrag) return;
    undoHook.push({
      kind: 'drag-applied',
      before: userInputRef.current,
      after: pendingDrag,
      i18nKey: 'addresses.editor.undo.dragApplied',
    });
    setUserInput(pendingDrag);
    onChange(pendingDrag);
    editor.markStale();
    setPendingDrag(null);
  }, [pendingDrag, undoHook, onChange, editor]);

  // === Panel visibility ===
  const showReconciliation =
    editor.state.phase === 'conflict' || editor.state.phase === 'partial';
  const showSuggestions =
    suggestions.trigger !== null && suggestions.candidates.length > 0;
  const showActivityLog = (activityLogOpts?.enabled ?? true) && mode === 'edit';
  const confidence = currentResult?.confidence;

  // === Context value ===
  const contextValue = useMemo(
    () => ({
      editorState: editor.state,
      fieldStatus: editor.fieldStatus,
      activity: editor.activity,
      suggestions,
      reconciliation,
      undo: undoHook,
      userInput,
      mode,
    }),
    [editor.state, editor.fieldStatus, editor.activity, suggestions, reconciliation, undoHook, userInput, mode],
  );

  return (
    <AddressEditorContext.Provider value={contextValue}>
      <div className={cn('space-y-4', className)}>
        {/* Status bar */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn('text-xs font-medium', PHASE_STATUS_CLASS[editor.state.phase])}
            aria-live="polite"
          >
            {t(`editor.coordinator.phase.${editor.state.phase}`)}
          </span>
          <div className="flex items-center gap-1" role="toolbar" aria-label="Editor actions">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleUndo}
              disabled={!undoHook.canUndo}
              aria-label="Undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleRedo}
              disabled={!undoHook.canRedo}
              aria-label="Redo"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={editor.reset}
              aria-label={t('editor.coordinator.retryGeocode')}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Confidence meter */}
        {confidence !== undefined && (
          <AddressConfidenceMeter confidence={confidence} />
        )}

        {/* Form grid */}
        <div className="grid grid-cols-2 gap-3">
          {FIELD_CONFIGS.map(({ field, labelKey, placeholderKey }) => (
            <FormFieldRow
              key={field}
              field={field}
              label={t(labelKey)}
              placeholder={placeholderKey ? t(placeholderKey) : undefined}
              value={userInput[field] ?? ''}
              onChange={(v) => handleFieldChange(field, v)}
              status={editor.fieldStatus[field]}
              disabled={mode === 'view'}
            />
          ))}
        </div>

        {/* Reconciliation panel */}
        {showReconciliation && (
          <div className="space-y-2">
            <AddressReconciliationPanel
              conflicts={reconciliation.conflicts}
              pending={reconciliation.pending}
              decisions={reconciliation.decisions}
              resolved={reconciliation.resolved}
              applyField={reconciliation.applyField}
              keepField={reconciliation.keepField}
              applyAll={reconciliation.applyAll}
              keepAll={reconciliation.keepAll}
              onTrySuggestions={showSuggestions ? undefined : undefined}
            />
            {reconciliation.resolved && (
              <Button size="sm" onClick={handleMergeConfirm}>
                {t('editor.reconciliation.applyAll')}
              </Button>
            )}
          </div>
        )}

        {/* Suggestions panel */}
        {showSuggestions && (
          <AddressSuggestionsPanel
            trigger={suggestions.trigger}
            candidates={suggestions.candidates}
            nextOmitField={suggestions.nextOmitField}
            retryExhausted={suggestions.retryExhausted}
            onSelect={handleSuggestionSelect}
            onRetry={suggestions.nextOmitField ? handleSuggestionRetry : undefined}
          />
        )}

        {/* Activity log */}
        {showActivityLog && (
          <AddressActivityLog
            events={editor.activity.events}
            verbosity={editor.activity.verbosity}
            onClear={editor.activity.clear}
            onSetVerbosity={editor.activity.setVerbosity}
            collapsed={logCollapsed}
            onToggleCollapsed={() => setLogCollapsed((p) => !p)}
          />
        )}

        {/* Drag confirm dialog */}
        <AddressDragConfirmDialog
          open={pendingDrag !== null}
          currentAddress={userInput}
          newAddress={pendingDrag ?? {}}
          onConfirm={handleDragConfirm}
          onCancel={() => setPendingDrag(null)}
        />
      </div>
    </AddressEditorContext.Provider>
  );
}
