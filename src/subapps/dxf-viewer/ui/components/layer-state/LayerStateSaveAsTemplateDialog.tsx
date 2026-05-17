'use client';

/**
 * LayerStateSaveAsTemplateDialog — ADR-358 §5.9 Q12 Phase 13B.3.
 *
 * Modal for promoting the current layer snapshot to a cross-project template.
 * Drives `useLayerStateTemplates.saveCurrentAsTemplate()` (which routes through
 * the store + service injected by 13B.2).
 *
 * Validation surfaces are mapped from `LayerStateTemplateValidationError`
 * codes thrown by the service layer:
 *   - LAYER_STATE_TEMPLATE_NAME_REQUIRED → errorNameRequired
 *   - LAYER_STATE_TEMPLATE_EMPTY_SNAPSHOT → errorEmptySnapshot
 *
 * Pre-commit ratchet `layer-state-system` allowlists this file.
 */

import * as React from 'react';
import { toast } from 'sonner';
import { X as XIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { PRESET_CATEGORIES } from '../../../types/layer-state-template';
import type {
  DxfTemplateCategory,
  LayerStateTemplate,
} from '../../../types/layer-state-template';

const MAX_TAGS = 10;

export interface SaveAsTemplateInputPayload {
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly sourceStateId?: string;
}

export interface LayerStateSaveAsTemplateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  readonly categories: ReadonlyArray<DxfTemplateCategory>;
  readonly sourceStateId?: string;
  readonly onSave: (input: SaveAsTemplateInputPayload) => Promise<LayerStateTemplate>;
}

export function LayerStateSaveAsTemplateDialog({
  open,
  onOpenChange,
  categories,
  sourceStateId,
  onSave,
}: LayerStateSaveAsTemplateDialogProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagDraft, setTagDraft] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [errorKey, setErrorKey] = React.useState<string | null>(null);

  // Reset form whenever the dialog (re-)opens.
  React.useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setCategory('');
    setTags([]);
    setTagDraft('');
    setSubmitting(false);
    setErrorKey(null);
  }, [open]);

  const suggestions = React.useMemo<readonly string[]>(() => {
    const fromCatalog = categories.map((c) => c.value);
    const merged = new Set<string>([...PRESET_CATEGORIES, ...fromCatalog]);
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const tagsLimitReached = tags.length >= MAX_TAGS;

  const addTag = (raw: string): void => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setTagDraft('');
      return;
    }
    if (tagsLimitReached) return;
    setTags((prev) => [...prev, trimmed]);
    setTagDraft('');
  };

  const removeTag = (value: string): void => {
    setTags((prev) => prev.filter((x) => x !== value));
  };

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorKey(null);
    try {
      const created = await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        sourceStateId,
      });
      toast.success(t('layerState.templates.toastSaved', { name: created.name }));
      onOpenChange(false);
    } catch (err) {
      setErrorKey(resolveSaveErrorKey(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default" data-testid="layer-state-save-as-template-dialog">
        <DialogHeader>
          <DialogTitle>{t('layerState.templates.saveAsTitle')}</DialogTitle>
          <DialogDescription>
            {t('layerState.templates.saveAsDescription')}
          </DialogDescription>
        </DialogHeader>

        <form
          className={FORM_CLASS}
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <label className={FIELD_CLASS}>
            <span className={LABEL_CLASS}>{t('layerState.templates.saveAsName')}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('layerState.templates.saveAsNamePlaceholder')}
              className={INPUT_CLASS}
              autoFocus
              data-testid="layer-state-save-as-template-name"
            />
          </label>

          <label className={FIELD_CLASS}>
            <span className={LABEL_CLASS}>
              {t('layerState.templates.saveAsDescriptionField')}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('layerState.templates.saveAsDescriptionPlaceholder')}
              className={TEXTAREA_CLASS}
              rows={2}
              data-testid="layer-state-save-as-template-description"
            />
          </label>

          <label className={FIELD_CLASS}>
            <span className={LABEL_CLASS}>{t('layerState.templates.saveAsCategory')}</span>
            <input
              type="text"
              list="layer-state-template-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t('layerState.templates.saveAsCategoryPlaceholder')}
              className={INPUT_CLASS}
              data-testid="layer-state-save-as-template-category"
            />
            <datalist id="layer-state-template-categories">
              {suggestions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>

          <fieldset className={FIELD_CLASS}>
            <legend className={LABEL_CLASS}>{t('layerState.templates.saveAsTags')}</legend>
            <div className={CHIPS_CLASS} data-testid="layer-state-save-as-template-tags-list">
              {tags.map((tag) => (
                <span key={tag} className={CHIP_CLASS} data-testid={`tag-chip-${tag}`}>
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className={CHIP_REMOVE_CLASS}
                    aria-label={`remove tag ${tag}`}
                    data-testid={`tag-chip-remove-${tag}`}
                  >
                    <XIcon className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag(tagDraft);
                  } else if (e.key === 'Backspace' && tagDraft === '' && tags.length > 0) {
                    removeTag(tags[tags.length - 1]);
                  }
                }}
                disabled={tagsLimitReached}
                placeholder={t('layerState.templates.saveAsTagsPlaceholder')}
                className={TAG_INPUT_CLASS}
                data-testid="layer-state-save-as-template-tag-input"
              />
            </div>
            {tagsLimitReached && (
              <p className={HINT_CLASS} data-testid="layer-state-save-as-template-tags-limit">
                {t('layerState.templates.saveAsTagsLimitReached')}
              </p>
            )}
          </fieldset>

          {errorKey && (
            <p
              className={ERROR_CLASS}
              role="alert"
              data-testid="layer-state-save-as-template-error"
            >
              {t(errorKey)}
            </p>
          )}

          <footer className={FOOTER_CLASS}>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => onOpenChange(false)}
              data-testid="layer-state-save-as-template-cancel"
            >
              {t('layerState.templates.saveAsCancel')}
            </button>
            <button
              type="submit"
              className={PRIMARY_BUTTON_CLASS}
              disabled={!canSubmit}
              data-testid="layer-state-save-as-template-submit"
            >
              {t('layerState.templates.saveAsSubmit')}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function resolveSaveErrorKey(err: unknown): string {
  if (err instanceof Error) {
    // Match by message — the validation-error class sets `message` to the
    // codepoint constant, which is the stable contract. `name` is best-effort
    // metadata and may be erased across module/realm boundaries in tests.
    if (err.message === 'LAYER_STATE_TEMPLATE_NAME_REQUIRED') {
      return 'layerState.templates.errorNameRequired';
    }
    if (err.message === 'LAYER_STATE_TEMPLATE_EMPTY_SNAPSHOT') {
      return 'layerState.templates.errorEmptySnapshot';
    }
  }
  return 'layerState.templates.errorSave';
}

const FORM_CLASS = 'flex flex-col gap-3';
const FIELD_CLASS = 'flex flex-col gap-1';
const LABEL_CLASS = 'text-xs font-medium text-foreground';
const INPUT_CLASS =
  'h-8 px-2 rounded border border-border bg-background text-sm ' +
  'focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50';
const TEXTAREA_CLASS =
  'px-2 py-1 rounded border border-border bg-background text-sm ' +
  'focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 resize-none';
const CHIPS_CLASS =
  'flex flex-wrap items-center gap-1 px-2 py-1 rounded border border-border bg-background min-h-8';
const CHIP_CLASS =
  'inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full bg-muted text-xs';
const CHIP_REMOVE_CLASS =
  'inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-background/80';
const TAG_INPUT_CLASS =
  'flex-1 min-w-[120px] h-6 px-1 bg-transparent text-sm focus:outline-none disabled:opacity-50';
const HINT_CLASS = 'text-[11px] text-muted-foreground';
const ERROR_CLASS = 'text-xs text-destructive';
const FOOTER_CLASS = 'mt-2 flex items-center justify-end gap-2';
const SECONDARY_BUTTON_CLASS =
  'h-8 px-3 rounded border border-border bg-background text-sm hover:bg-muted';
const PRIMARY_BUTTON_CLASS =
  'h-8 px-3 rounded bg-primary text-primary-foreground text-sm font-medium ' +
  'hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed';
