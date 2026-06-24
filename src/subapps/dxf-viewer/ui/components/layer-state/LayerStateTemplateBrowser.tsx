'use client';

/**
 * LayerStateTemplateBrowser — ADR-358 §5.9 Q12 Phase 13B.3.
 *
 * Modal listing all cross-project `LayerStateTemplate` summaries visible to
 * the current tenant. Search (name) + category + tags filters are evaluated
 * client-side over a one-shot fetch via
 * `useLayerStateTemplates.searchTemplateSummaries()`; the user-visible list
 * is sorted by `updatedAt DESC` by the service already.
 *
 * On `Use`, the template is imported into the project as a regular
 * `LayerState` (source = `template-shared`) via
 * `useLayerStateTemplates.importTemplateAsState()` and the modal closes.
 *
 * Equality guard: the fetched summaries are hash-compared (id + updatedAt)
 * before `setState` to avoid unnecessary re-renders on identical re-fetches
 * (ADR-040 §XV pattern, [[feedback_firestore_subscribe_equality_guard]]).
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
import { compareByLocale } from '@/lib/intl-formatting';
import { PRESET_CATEGORIES } from '../../../types/layer-state-template';
import { DXF_TIMING } from '../../../config/dxf-timing';
import type {
  DxfTemplateCategory,
  LayerStateTemplateSummary,
} from '../../../types/layer-state-template';

const SEARCH_DEBOUNCE_MS = DXF_TIMING.ui.SEARCH_DEBOUNCE; // ADR-516

export interface LayerStateTemplateBrowserProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  readonly categories: ReadonlyArray<DxfTemplateCategory>;
  readonly fetchSummaries: () => Promise<readonly LayerStateTemplateSummary[]>;
  readonly onUseTemplate: (templateId: string) => Promise<unknown>;
}

interface FetchState {
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly summaries: readonly LayerStateTemplateSummary[];
  readonly errorKey: string | null;
}

const INITIAL_FETCH: FetchState = {
  status: 'idle',
  summaries: [],
  errorKey: null,
};

function hashSummaries(list: readonly LayerStateTemplateSummary[]): string {
  return list.map((s) => `${s.id}:${s.updatedAt}`).join('|');
}

export function LayerStateTemplateBrowser({
  open,
  onOpenChange,
  categories,
  fetchSummaries,
  onUseTemplate,
}: LayerStateTemplateBrowserProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const [fetchState, setFetchState] = React.useState<FetchState>(INITIAL_FETCH);
  const [searchDraft, setSearchDraft] = React.useState('');
  const [searchActive, setSearchActive] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('');
  const [tagFilters, setTagFilters] = React.useState<string[]>([]);
  const [tagDraft, setTagDraft] = React.useState('');
  const [actionTemplateId, setActionTemplateId] = React.useState<string | null>(null);
  const hashRef = React.useRef<string>('');

  // ─── Reset on close ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (open) return;
    setFetchState(INITIAL_FETCH);
    setSearchDraft('');
    setSearchActive('');
    setCategoryFilter('');
    setTagFilters([]);
    setTagDraft('');
    setActionTemplateId(null);
    hashRef.current = '';
  }, [open]);

  // ─── Fetch summaries on open ───────────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFetchState((prev) => ({ ...prev, status: 'loading', errorKey: null }));
    fetchSummaries()
      .then((next) => {
        if (cancelled) return;
        const nextHash = hashSummaries(next);
        if (nextHash === hashRef.current) {
          setFetchState((prev) => ({ ...prev, status: 'ready', errorKey: null }));
          return;
        }
        hashRef.current = nextHash;
        setFetchState({ status: 'ready', summaries: next, errorKey: null });
      })
      .catch(() => {
        if (cancelled) return;
        setFetchState({
          status: 'error',
          summaries: [],
          errorKey: 'layerState.templates.errorImport',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [open, fetchSummaries]);

  // ─── Debounce search ───────────────────────────────────────────────────────
  React.useEffect(() => {
    const id = window.setTimeout(() => setSearchActive(searchDraft), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchDraft]);

  // ─── Derived: category options ────────────────────────────────────────────
  const categoryOptions = React.useMemo<readonly string[]>(() => {
    const set = new Set<string>([...PRESET_CATEGORIES, ...categories.map((c) => c.value)]);
    return Array.from(set).sort(compareByLocale);
  }, [categories]);

  // ─── Derived: filtered list ────────────────────────────────────────────────
  const filtered = React.useMemo<readonly LayerStateTemplateSummary[]>(() => {
    const needle = searchActive.trim().toLowerCase();
    return fetchState.summaries.filter((s) => {
      if (needle && !s.name.toLowerCase().includes(needle)) return false;
      if (categoryFilter && s.category !== categoryFilter) return false;
      if (tagFilters.length > 0 && !tagFilters.every((tf) => s.tags.includes(tf))) return false;
      return true;
    });
  }, [fetchState.summaries, searchActive, categoryFilter, tagFilters]);

  // ─── Tag chip helpers ──────────────────────────────────────────────────────
  const addTagFilter = (raw: string): void => {
    const v = raw.trim();
    if (!v || tagFilters.includes(v)) {
      setTagDraft('');
      return;
    }
    setTagFilters((prev) => [...prev, v]);
    setTagDraft('');
  };

  const removeTagFilter = (v: string): void => {
    setTagFilters((prev) => prev.filter((x) => x !== v));
  };

  // ─── Use template ──────────────────────────────────────────────────────────
  const handleUse = async (s: LayerStateTemplateSummary): Promise<void> => {
    setActionTemplateId(s.id);
    try {
      await onUseTemplate(s.id);
      toast.success(t('layerState.templates.toastImported', { name: s.name }));
      onOpenChange(false);
    } catch (err) {
      const key = resolveImportErrorKey(err);
      toast.error(t(key));
      setFetchState((prev) => ({ ...prev, errorKey: key }));
    } finally {
      setActionTemplateId(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const isLoading = fetchState.status === 'loading' || fetchState.status === 'idle';
  const hasAny = fetchState.summaries.length > 0;
  const hasFiltered = filtered.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" data-testid="layer-state-template-browser">
        <DialogHeader>
          <DialogTitle>{t('layerState.templates.browserTitle')}</DialogTitle>
          <DialogDescription>
            {t('layerState.templates.browserDescription')}
          </DialogDescription>
        </DialogHeader>

        <BrowserFilters
          searchDraft={searchDraft}
          onSearchChange={setSearchDraft}
          categoryOptions={categoryOptions}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          tagFilters={tagFilters}
          tagDraft={tagDraft}
          onTagDraftChange={setTagDraft}
          onAddTag={addTagFilter}
          onRemoveTag={removeTagFilter}
        />

        <section className={LIST_WRAPPER_CLASS} aria-label={t('layerState.templates.browserTitle')}>
          {isLoading && <BrowserLoading />}
          {!isLoading && !hasAny && (
            <p className={EMPTY_CLASS} data-testid="layer-state-template-browser-empty">
              {t('layerState.templates.empty')}
            </p>
          )}
          {!isLoading && hasAny && !hasFiltered && (
            <p className={EMPTY_CLASS} data-testid="layer-state-template-browser-no-results">
              {t('layerState.templates.noResults')}
            </p>
          )}
          {!isLoading && hasFiltered && (
            <ul className={LIST_CLASS} data-testid="layer-state-template-browser-list">
              {filtered.map((s) => (
                <BrowserRow
                  key={s.id}
                  summary={s}
                  inFlight={actionTemplateId === s.id}
                  onUse={() => handleUse(s)}
                />
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface BrowserFiltersProps {
  readonly searchDraft: string;
  readonly onSearchChange: (next: string) => void;
  readonly categoryOptions: ReadonlyArray<string>;
  readonly categoryFilter: string;
  readonly onCategoryChange: (next: string) => void;
  readonly tagFilters: ReadonlyArray<string>;
  readonly tagDraft: string;
  readonly onTagDraftChange: (next: string) => void;
  readonly onAddTag: (raw: string) => void;
  readonly onRemoveTag: (value: string) => void;
}

function BrowserFilters({
  searchDraft,
  onSearchChange,
  categoryOptions,
  categoryFilter,
  onCategoryChange,
  tagFilters,
  tagDraft,
  onTagDraftChange,
  onAddTag,
  onRemoveTag,
}: BrowserFiltersProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <section className={FILTERS_CLASS} aria-label="filters">
      <input
        type="search"
        value={searchDraft}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t('layerState.templates.searchPlaceholder')}
        className={SEARCH_INPUT_CLASS}
        data-testid="layer-state-template-browser-search"
      />
      <select
        value={categoryFilter}
        onChange={(e) => onCategoryChange(e.target.value)}
        className={SELECT_CLASS}
        aria-label={t('layerState.templates.categoryLabel')}
        data-testid="layer-state-template-browser-category"
      >
        <option value="">{t('layerState.templates.categoryFilterAll')}</option>
        {categoryOptions.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <div className={TAG_FILTERS_CLASS} data-testid="layer-state-template-browser-tag-filters">
        {tagFilters.map((tf) => (
          <span key={tf} className={CHIP_CLASS} data-testid={`tag-filter-${tf}`}>
            {tf}
            <button
              type="button"
              onClick={() => onRemoveTag(tf)}
              className={CHIP_REMOVE_CLASS}
              aria-label={`remove tag filter ${tf}`}
              data-testid={`tag-filter-remove-${tf}`}
            >
              <XIcon className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={tagDraft}
          onChange={(e) => onTagDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              onAddTag(tagDraft);
            } else if (e.key === 'Backspace' && tagDraft === '' && tagFilters.length > 0) {
              onRemoveTag(tagFilters[tagFilters.length - 1]);
            }
          }}
          placeholder={t('layerState.templates.tagsPlaceholder')}
          className={TAG_INPUT_CLASS}
          data-testid="layer-state-template-browser-tag-input"
        />
      </div>
    </section>
  );
}

function BrowserLoading(): React.ReactElement {
  return (
    <ul className={LIST_CLASS} aria-busy="true" data-testid="layer-state-template-browser-loading">
      {[0, 1, 2].map((i) => (
        <li key={i} className={SKELETON_ROW_CLASS}>
          <span className={SKELETON_BAR_CLASS} />
          <span className={SKELETON_BAR_SHORT_CLASS} />
        </li>
      ))}
    </ul>
  );
}

interface BrowserRowProps {
  readonly summary: LayerStateTemplateSummary;
  readonly inFlight: boolean;
  readonly onUse: () => void;
}

function BrowserRow({ summary, inFlight, onUse }: BrowserRowProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const desc = summary.description?.trim() ?? '';
  const descTruncated = desc.length > 100 ? `${desc.slice(0, 100)}…` : desc;
  return (
    <li className={ROW_CLASS} data-testid={`layer-state-template-browser-row-${summary.id}`}>
      <div className={ROW_MAIN_CLASS}>
        <div className={ROW_HEADER_CLASS}>
          <span className={ROW_NAME_CLASS}>{summary.name}</span>
          <span className={BADGE_CLASS}>{summary.category}</span>
          <span className={ROW_META_CLASS}>
            {t('layerState.templates.entryCount', { count: summary.entryCount })}
          </span>
        </div>
        {descTruncated && <p className={ROW_DESC_CLASS}>{descTruncated}</p>}
        {summary.tags.length > 0 && (
          <div className={ROW_TAGS_CLASS}>
            {summary.tags.map((tag) => (
              <span key={tag} className={ROW_TAG_PILL_CLASS}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        className={USE_BUTTON_CLASS}
        onClick={onUse}
        disabled={inFlight}
        data-testid={`layer-state-template-browser-use-${summary.id}`}
      >
        {t('layerState.templates.useButton')}
      </button>
    </li>
  );
}

// ─── Error mapping ───────────────────────────────────────────────────────────

function resolveImportErrorKey(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'LayerStateTemplateCrossTenantError') {
      return 'layerState.templates.errorCrossTenant';
    }
    if (err.name === 'LayerStateTemplateNotFoundError') {
      return 'layerState.templates.errorNotFound';
    }
  }
  return 'layerState.templates.errorImport';
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const FILTERS_CLASS = 'flex flex-wrap items-center gap-2';
const SEARCH_INPUT_CLASS =
  'h-8 px-2 rounded border border-border bg-background text-sm min-w-[200px] flex-1 ' +
  'focus:outline-none focus:ring-1 focus:ring-primary';
const SELECT_CLASS =
  'h-8 px-2 rounded border border-border bg-background text-sm ' +
  'focus:outline-none focus:ring-1 focus:ring-primary';
const TAG_FILTERS_CLASS =
  'flex flex-wrap items-center gap-1 px-2 py-1 rounded border border-border bg-background min-h-8 flex-1 min-w-[200px]';
const CHIP_CLASS =
  'inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full bg-muted text-xs';
const CHIP_REMOVE_CLASS =
  'inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-background/80';
const TAG_INPUT_CLASS =
  'flex-1 min-w-[120px] h-6 px-1 bg-transparent text-sm focus:outline-none';

const LIST_WRAPPER_CLASS = 'mt-3 max-h-[60vh] overflow-y-auto';
const LIST_CLASS = 'flex flex-col gap-2';
const EMPTY_CLASS = 'py-10 text-center text-sm text-muted-foreground';

const ROW_CLASS =
  'flex items-start gap-2 p-3 rounded border border-border bg-background hover:bg-muted/30';
const ROW_MAIN_CLASS = 'flex-1 min-w-0 flex flex-col gap-1';
const ROW_HEADER_CLASS = 'flex items-center gap-2 flex-wrap';
const ROW_NAME_CLASS = 'text-sm font-medium truncate';
const BADGE_CLASS =
  'inline-flex items-center h-5 px-2 rounded-full bg-primary/10 text-primary text-[11px] uppercase';
const ROW_META_CLASS = 'text-[11px] text-muted-foreground ml-auto';
const ROW_DESC_CLASS = 'text-xs text-muted-foreground line-clamp-2';
const ROW_TAGS_CLASS = 'flex flex-wrap gap-1';
const ROW_TAG_PILL_CLASS =
  'inline-flex items-center h-5 px-2 rounded bg-muted text-[11px] text-foreground';
const USE_BUTTON_CLASS =
  'shrink-0 h-8 px-3 rounded bg-primary text-primary-foreground text-sm font-medium ' +
  'hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed';

const SKELETON_ROW_CLASS =
  'flex flex-col gap-2 p-3 rounded border border-border bg-background animate-pulse';
const SKELETON_BAR_CLASS = 'block h-3 w-1/3 rounded bg-muted';
const SKELETON_BAR_SHORT_CLASS = 'block h-2 w-1/2 rounded bg-muted';
