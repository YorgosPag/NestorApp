'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ActivityLevel, ActivityVerbosity, GeocodingActivityEvent } from '../types';

const LEVEL_TEXT_CLASS: Record<ActivityLevel, string> = {
  info: 'text-muted-foreground',
  success: 'text-green-600 dark:text-green-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
};

const LEVEL_DOT_CLASS: Record<ActivityLevel, string> = {
  info: 'bg-muted-foreground/40',
  success: 'bg-green-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
};

const VERBOSITY_OPTIONS: ActivityVerbosity[] = ['basic', 'detailed', 'debug'];
const COPY_RESET_MS = 2000;

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(new Date(timestamp));
}

export interface AddressActivityLogProps {
  events: GeocodingActivityEvent[];
  verbosity: ActivityVerbosity;
  onClear: () => void;
  onSetVerbosity: (v: ActivityVerbosity) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  className?: string;
}

export function AddressActivityLog({
  events,
  verbosity,
  onClear,
  onSetVerbosity,
  collapsed = false,
  onToggleCollapsed,
  className,
}: AddressActivityLogProps) {
  const { t } = useTranslation('addresses');
  const logRef = useRef<HTMLUListElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (collapsed || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events.length, collapsed]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(events, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_RESET_MS);
    } catch {
      // Clipboard access unavailable
    }
  }, [events]);

  return (
    <section className={cn('border rounded-md overflow-hidden', className)}>
      <header className="flex items-center gap-1 px-3 py-1.5 bg-muted/40 border-b">
        <span className="text-xs font-medium flex-1 text-foreground">
          {t('editor.activity.title')}
        </span>

        <select
          value={verbosity}
          onChange={(e) => onSetVerbosity(e.target.value as ActivityVerbosity)}
          className="text-xs bg-background border border-input rounded px-1 py-0.5 h-6 cursor-pointer"
          aria-label={t('editor.activity.verbosity.label')}
        >
          {VERBOSITY_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {t(`editor.activity.verbosity.${v}` as Parameters<typeof t>[0])}
            </option>
          ))}
        </select>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleCopy}
              aria-label={t('editor.activity.copy')}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('editor.activity.copy')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={onClear}
              aria-label={t('editor.activity.clear')}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('editor.activity.clear')}</TooltipContent>
        </Tooltip>

        {onToggleCollapsed && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={onToggleCollapsed}
            aria-label={
              collapsed ? t('editor.activity.expand') : t('editor.activity.collapse')
            }
          >
            {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </Button>
        )}
      </header>

      {!collapsed && (
        <ul
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label={t('editor.activity.title')}
          className="max-h-48 overflow-y-auto px-3 py-1.5 space-y-0.5"
        >
          {events.length === 0 ? (
            <li className="text-xs text-muted-foreground py-2 text-center">
              {t('editor.activity.empty')}
            </li>
          ) : (
            events.map((ev) => (
              <li
                key={ev.id}
                className={cn('flex items-start gap-2 py-0.5 text-xs', LEVEL_TEXT_CLASS[ev.level])}
              >
                <span
                  className={cn(
                    'mt-1.5 h-1.5 w-1.5 rounded-full shrink-0',
                    LEVEL_DOT_CLASS[ev.level],
                  )}
                  aria-hidden="true"
                />
                <time className="font-mono text-muted-foreground/70 shrink-0 tabular-nums">
                  {formatTime(ev.timestamp)}
                </time>
                <span>{t(ev.i18nKey, ev.i18nParams)}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
