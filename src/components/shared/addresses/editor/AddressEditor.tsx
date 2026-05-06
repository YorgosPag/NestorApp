'use client';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
import { useAddressTelemetry } from './hooks/useAddressTelemetry';
import type { CorrectionContextEntityType, FieldActionsMap } from '@/services/geocoding/address-corrections-telemetry.service';
import {
  extractResult,
  buildFieldActionsMap,
  resolveReconciliationAction,
} from './helpers/coordinatorHelpers';
import { AddressFieldBadge } from './components/AddressFieldBadge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AddressConfidenceMeter } from './components/AddressConfidenceMeter';
import { AddressActivityLog } from './components/AddressActivityLog';
import { AddressReconciliationPanel } from './components/AddressReconciliationPanel';
import { AddressSuggestionsPanel } from './components/AddressSuggestionsPanel';
import { AddressDragConfirmDialog } from './components/AddressDragConfirmDialog';
import { AddressEditorContext } from './AddressEditorContext';
import type { AddressEditorProps, AddressEditorHandle } from './AddressEditor.types';
import type {
  AddressEditorState,
  AddressFieldStatus,
  GeocodingApiResponse,
  ResolvedAddressFields,
} from './types';

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

function useEditorKeyboard(
  canUndo: boolean,
  canRedo: boolean,
  onUndo: () => void,
  onRedo: () => void,
  onForceRegeocode: () => void,
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
      } else if (e.key === 'r' && e.shiftKey) {
        e.preventDefault();
        onForceRegeocode();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [canUndo, canRedo, onUndo, onRedo, onForceRegeocode]);
}

export const AddressEditor = forwardRef<AddressEditorHandle, AddressEditorProps>(
  function AddressEditor({
    value,
    onChange,
    onDragApplied,
    onUndoRedo,
    mode = 'edit',
    formOptions,
    activityLog: activityLogOpts,
    telemetry,
    className,
    children,
  }, ref) {
  const { t } = useTranslation('addresses');
  // Semi-controlled: internal form state; reset on value identity change.
  const [userInput, setUserInput] = useState<ResolvedAddressFields>(() => value);
  const [pendingDrag, setPendingDrag] = useState<ResolvedAddressFields | null>(null);
  const [logCollapsed, setLogCollapsed] = useState(activityLogOpts?.collapsed ?? false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);
  const userInputRef = useRef(userInput);
  const hasStartedEditRef = useRef(false);
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
  useImperativeHandle(ref, () => ({
    setPendingDrag: (addr: ResolvedAddressFields) => setPendingDrag(addr),
  }), []);
  const telemetryHook = useAddressTelemetry({
    contextEntityType: (telemetry?.contextEntityType ?? 'contact') as CorrectionContextEntityType,
    contextEntityId: telemetry?.contextEntityId ?? '',
    disabled: !telemetry?.enabled || !telemetry?.contextEntityId,
  });
  const editor = useAddressEditor(userInput, {
    autoGeocode: mode === 'edit',
    verbosity: activityLogOpts?.verbosity ?? 'detailed',
  });

  const currentResult = extractResult(editor.state);
  const resolvedFields: ResolvedAddressFields = currentResult?.resolvedFields ?? {};
  const suggestions = useAddressSuggestions(currentResult);
  const reconciliation = useAddressReconciliation(userInput, resolvedFields);
  const undoHook = useAddressUndo();
  const handleFieldChange = useCallback(
    (field: keyof ResolvedAddressFields, val: string) => {
      if (!hasStartedEditRef.current) {
        hasStartedEditRef.current = true;
        telemetryHook.markInputStart();
      }
      const next = { ...userInputRef.current, [field]: val };
      setUserInput(next);
      setDismissedSuggestions(false);
      onChange(next);
    },
    [onChange, telemetryHook],
  );

  const handleUndo = useCallback(() => {
    const entry = undoHook.undo();
    if (!entry) return;
    telemetryHook.markUndoOccurred();
    setUserInput(entry.before);
    onChange(entry.before);
    onUndoRedo?.();
  }, [undoHook, onChange, telemetryHook, onUndoRedo]);

  const handleRedo = useCallback(() => {
    const entry = undoHook.redo();
    if (!entry) return;
    setUserInput(entry.after);
    onChange(entry.after);
    onUndoRedo?.();
  }, [undoHook, onChange, onUndoRedo]);

  const handleForceRegeocode = useCallback(() => {
    void editor.triggerGeocode();
  }, [editor]);

  useEditorKeyboard(undoHook.canUndo, undoHook.canRedo, handleUndo, handleRedo, handleForceRegeocode);

  const handleApplyField = useCallback((field: keyof ResolvedAddressFields) => {
    const conflict = reconciliation.conflicts.find(c => c.field === field);
    if (!conflict) return;
    const next = { ...userInputRef.current, [field]: conflict.resolvedValue };
    undoHook.push({
      kind: 'field-correction',
      before: userInputRef.current,
      after: next,
      i18nKey: 'addresses.editor.undo.fieldCorrection',
    });
    setUserInput(next);
    onChange(next);
    reconciliation.applyField(field);
  }, [reconciliation, undoHook, onChange]);

  const handleMergeConfirm = useCallback(() => {
    if (!reconciliation.resolved) return;
    const merged = reconciliation.merged;
    undoHook.push({
      kind: 'bulk-correction',
      before: userInputRef.current,
      after: merged,
      i18nKey: 'addresses.editor.undo.bulkCorrection',
    });
    void telemetryHook.flush(resolveReconciliationAction(reconciliation.decisions), {
      userInput: userInputRef.current,
      nominatimResolved: resolvedFields,
      confidence: currentResult?.confidence ?? 0,
      variantUsed: currentResult?.source?.variantUsed ?? 1,
      partialMatch: currentResult?.partialMatch ?? false,
      fieldActions: buildFieldActionsMap(reconciliation.decisions),
      finalAddress: merged,
    });
    setUserInput(merged);
    onChange(merged);
    editor.applyCorrection();
  }, [reconciliation, undoHook, onChange, editor, telemetryHook, resolvedFields, currentResult]);
  const handleSuggestionSelect = useCallback(
    (candidate: GeocodingApiResponse) => {
      const fields = candidate.resolvedFields;
      const rank = suggestions.candidates.findIndex(r => r.candidate === candidate);
      undoHook.push({
        kind: 'suggestion-accepted',
        before: userInputRef.current,
        after: fields,
        i18nKey: 'addresses.editor.undo.suggestionAccepted',
      });
      const suggestionFieldActions: FieldActionsMap = {};
      for (const k of Object.keys(fields) as Array<keyof ResolvedAddressFields>) {
        suggestionFieldActions[k] = 'corrected-to-suggestion';
      }
      void telemetryHook.flush('accepted-suggestion', {
        userInput: userInputRef.current,
        nominatimResolved: resolvedFields,
        confidence: candidate.confidence,
        variantUsed: candidate.source?.variantUsed ?? 1,
        partialMatch: candidate.partialMatch ?? false,
        acceptedSuggestionRank: rank >= 0 ? rank : 0,
        fieldActions: suggestionFieldActions,
        finalAddress: fields,
      });
      setUserInput(fields);
      onChange(fields);
      editor.applyCorrection();
    },
    [undoHook, onChange, editor, suggestions.candidates, telemetryHook, resolvedFields],
  );

  const handleSuggestionRetry = useCallback(
    (field: keyof ResolvedAddressFields) => {
      suggestions.recordOmitAttempt(field);
      void editor.triggerGeocode();
    },
    [suggestions, editor],
  );

  const handleDragConfirm = useCallback(() => {
    if (!pendingDrag) return;
    undoHook.push({
      kind: 'drag-applied',
      before: userInputRef.current,
      after: pendingDrag,
      i18nKey: 'addresses.editor.undo.dragApplied',
    });
    const dragFieldActions: FieldActionsMap = {};
    for (const k of Object.keys(pendingDrag) as Array<keyof ResolvedAddressFields>) {
      dragFieldActions[k] = 'corrected-to-resolved';
    }
    void telemetryHook.flush('used-drag', {
      userInput: userInputRef.current,
      nominatimResolved: resolvedFields,
      confidence: currentResult?.confidence ?? 0,
      variantUsed: currentResult?.source?.variantUsed ?? 1,
      partialMatch: currentResult?.partialMatch ?? false,
      fieldActions: dragFieldActions,
      finalAddress: pendingDrag,
    });
    setUserInput(pendingDrag);
    onChange(pendingDrag);
    onDragApplied?.(pendingDrag);
    editor.markStale();
    setPendingDrag(null);
  }, [pendingDrag, undoHook, onChange, onDragApplied, editor, telemetryHook, resolvedFields, currentResult]);
  const showReconciliation =
    editor.state.phase === 'conflict' || editor.state.phase === 'partial';
  const showSuggestions =
    !dismissedSuggestions && suggestions.trigger !== null && suggestions.candidates.length > 0;
  const showActivityLog = (activityLogOpts?.enabled ?? true) && mode === 'edit';
  const confidence = currentResult?.confidence;
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={handleUndo}
                  disabled={!undoHook.canUndo}
                  aria-label={t('editor.coordinator.undo')}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('editor.coordinator.undo')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={handleRedo}
                  disabled={!undoHook.canRedo}
                  aria-label={t('editor.coordinator.redo')}
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('editor.coordinator.redo')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={editor.reset}
                  aria-label={t('editor.coordinator.retryGeocode')}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('editor.coordinator.retryGeocode')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Confidence meter */}
        {confidence !== undefined && (
          <AddressConfidenceMeter confidence={confidence} />
        )}

        {/* Form body: internal flat grid OR children (when formOptions.hideGrid) */}
        {formOptions?.hideGrid ? children : (
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
        )}

        {/* Reconciliation panel */}
        {showReconciliation && (
          <div className="space-y-2">
            <AddressReconciliationPanel
              conflicts={reconciliation.conflicts}
              pending={reconciliation.pending}
              decisions={reconciliation.decisions}
              resolved={reconciliation.resolved}
              applyField={handleApplyField}
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
            onDismiss={() => setDismissedSuggestions(true)}
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
          onCancel={() => { setPendingDrag(null); onUndoRedo?.(); }}
        />

        {!formOptions?.hideGrid && children}

        {formOptions?.hideGrid && formOptions?.showNeighborhoodRegion && (
          <div className="grid grid-cols-2 gap-3">
            {FIELD_CONFIGS.filter(c => c.field === 'neighborhood' || c.field === 'region').map(({ field, labelKey, placeholderKey }) => (
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
        )}
      </div>
    </AddressEditorContext.Provider>
  );
});

AddressEditor.displayName = 'AddressEditor';
