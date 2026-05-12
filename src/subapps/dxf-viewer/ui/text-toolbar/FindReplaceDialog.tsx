'use client';

/**
 * ADR-344 Phase 9 — Find & Replace dialog.
 *
 * Iterates all TEXT/MTEXT entities in the current dxfScene. Supports
 * case-sensitive, whole-word, and regex match modes. Replace All wraps
 * every substitution in a single ReplaceAllTextCommand (one undo step).
 * Replace (Next) issues a granular ReplaceOneTextCommand per match.
 * Click-to-zoom on a match item triggers the optional onZoomToEntity
 * callback so the canvas re-centers on the entity.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { X, CaseSensitive, WholeWord, Regex } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  findMatches,
  ReplaceAllTextCommand,
  ReplaceOneTextCommand,
  type MatchOptions,
  type MatchLocation,
  type DxfTextSceneEntity,
  type ILayerAccessProvider,
} from '../../core/commands/text';
import type { ICommand, ISceneManager } from '../../core/commands/interfaces';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FindReplaceDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly entities: readonly DxfTextSceneEntity[];
  readonly sceneManager: ISceneManager;
  readonly layerProvider: ILayerAccessProvider;
  readonly onExecuteCommand: (cmd: ICommand) => void;
  readonly onZoomToEntity?: (entityId: string) => void;
}

interface MatchItem {
  readonly entityId: string;
  readonly location: MatchLocation;
  readonly snippet: string;
  readonly matchText: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSnippet(runText: string, start: number, end: number): string {
  const CONTEXT = 24;
  const before = runText.slice(Math.max(0, start - CONTEXT), start);
  const match = runText.slice(start, end);
  const after = runText.slice(end, end + CONTEXT);
  const leadEllipsis = start > CONTEXT ? '…' : '';
  const tailEllipsis = end + CONTEXT < runText.length ? '…' : '';
  return `${leadEllipsis}${before}【${match}】${after}${tailEllipsis}`;
}

function collectMatches(
  entities: readonly DxfTextSceneEntity[],
  pattern: string,
  opts: MatchOptions,
): MatchItem[] {
  if (!pattern) return [];
  const items: MatchItem[] = [];
  for (const entity of entities) {
    const locations = findMatches(entity.textNode, pattern, opts);
    for (const loc of locations) {
      const para = entity.textNode.paragraphs[loc.paragraphIndex];
      const run = para?.runs[loc.runIndex];
      if (!run || 'top' in run) continue;
      items.push({
        entityId: entity.id,
        location: loc,
        snippet: buildSnippet(run.text, loc.start, loc.end),
        matchText: run.text.slice(loc.start, loc.end),
      });
    }
  }
  return items;
}

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FindReplaceDialog({
  open,
  onOpenChange,
  entities,
  sceneManager,
  layerProvider,
  onExecuteCommand,
  onZoomToEntity,
}: FindReplaceDialogProps) {
  const { t } = useTranslation(['textFindReplace']);

  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const matchOptions: MatchOptions = useMemo(
    () => ({ caseSensitive, wholeWord, regex: useRegex }),
    [caseSensitive, wholeWord, useRegex],
  );

  const regexError = useRegex && searchText ? !isValidRegex(searchText) : false;

  const matches = useMemo<MatchItem[]>(() => {
    if (!searchText || regexError) return [];
    return collectMatches(entities, searchText, matchOptions);
  }, [entities, searchText, matchOptions, regexError]);

  const safeCurrentIndex = matches.length > 0
    ? Math.min(currentMatchIndex, matches.length - 1)
    : 0;

  const handleReplaceOne = useCallback(() => {
    if (matches.length === 0) return;
    const match = matches[safeCurrentIndex];
    const cmd = new ReplaceOneTextCommand(
      {
        entityId: match.entityId,
        location: match.location,
        replacement: replaceText,
        originalText: match.matchText,
      },
      sceneManager,
      layerProvider,
    );
    onExecuteCommand(cmd);
    setCurrentMatchIndex((prev) => {
      const next = prev + 1;
      return next >= matches.length ? 0 : next;
    });
  }, [matches, safeCurrentIndex, replaceText, sceneManager, layerProvider, onExecuteCommand]);

  const handleReplaceAll = useCallback(() => {
    if (matches.length === 0) return;
    const entityIds = [...new Set(matches.map((m) => m.entityId))];
    const cmd = new ReplaceAllTextCommand(
      {
        entityIds,
        pattern: searchText,
        replacement: replaceText,
        matchOptions,
      },
      sceneManager,
      layerProvider,
    );
    onExecuteCommand(cmd);
    setCurrentMatchIndex(0);
  }, [matches, searchText, replaceText, matchOptions, sceneManager, layerProvider, onExecuteCommand]);

  const handleMatchClick = useCallback(
    (item: MatchItem, index: number) => {
      setCurrentMatchIndex(index);
      onZoomToEntity?.(item.entityId);
    },
    [onZoomToEntity],
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    setCurrentMatchIndex(0);
  }, []);

  const matchCountLabel = useMemo(() => {
    if (!searchText) return t('textFindReplace:results.noSearch');
    if (regexError) return t('textFindReplace:invalidRegex');
    if (matches.length === 0) return t('textFindReplace:results.noMatches');
    return t('textFindReplace:results.count_other', { count: matches.length });
  }, [searchText, regexError, matches.length, t]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">
              {t('textFindReplace:dialog.title')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={t('textFindReplace:actions.close')}>
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {t('textFindReplace:search.label')}
              </label>
              <div className="flex gap-1.5">
                <Input
                  value={searchText}
                  onChange={handleSearchChange}
                  placeholder={t('textFindReplace:search.placeholder')}
                  className={cn('flex-1', regexError && 'border-destructive')}
                  autoFocus
                />
                <Toggle
                  pressed={caseSensitive}
                  onPressedChange={setCaseSensitive}
                  size="sm"
                  aria-label={t('textFindReplace:options.caseSensitive')}
                  title={t('textFindReplace:options.caseSensitive')}
                >
                  <CaseSensitive className="h-3.5 w-3.5" />
                </Toggle>
                <Toggle
                  pressed={wholeWord}
                  onPressedChange={setWholeWord}
                  size="sm"
                  aria-label={t('textFindReplace:options.wholeWord')}
                  title={t('textFindReplace:options.wholeWord')}
                >
                  <WholeWord className="h-3.5 w-3.5" />
                </Toggle>
                <Toggle
                  pressed={useRegex}
                  onPressedChange={setUseRegex}
                  size="sm"
                  aria-label={t('textFindReplace:options.regex')}
                  title={t('textFindReplace:options.regex')}
                >
                  <Regex className="h-3.5 w-3.5" />
                </Toggle>
              </div>
              {regexError && (
                <p className="text-xs text-destructive" role="alert">
                  {t('textFindReplace:invalidRegex')}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {t('textFindReplace:replace.label')}
              </label>
              <Input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder={t('textFindReplace:replace.placeholder')}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground" role="status" aria-live="polite">
              {matchCountLabel}
            </p>
            {matches.length > 0 && (
              <ScrollArea className="h-44 rounded-md border">
                <ul className="divide-y divide-border" role="listbox" aria-label={t('textFindReplace:results.count_other', { count: matches.length })}>
                  {matches.map((item, idx) => (
                    <li
                      key={`${item.entityId}-${item.location.paragraphIndex}-${item.location.runIndex}-${item.location.start}`}
                      role="option"
                      aria-selected={idx === safeCurrentIndex}
                      onClick={() => handleMatchClick(item, idx)}
                      className={cn(
                        'cursor-pointer px-3 py-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground',
                        idx === safeCurrentIndex && 'bg-accent text-accent-foreground',
                      )}
                    >
                      <p className="font-medium text-muted-foreground">
                        {t('textFindReplace:results.entityLabel', { id: item.entityId.slice(-8) })}
                        {' · '}
                        {t('textFindReplace:results.matchLocation', {
                          paragraph: item.location.paragraphIndex,
                          run: item.location.runIndex,
                        })}
                      </p>
                      <p className="mt-0.5 font-mono text-foreground/80">{item.snippet}</p>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReplaceOne}
              disabled={matches.length === 0}
            >
              {t('textFindReplace:actions.replaceOne')}
            </Button>
            <Button
              size="sm"
              onClick={handleReplaceAll}
              disabled={matches.length === 0}
            >
              {t('textFindReplace:actions.replaceAll')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
