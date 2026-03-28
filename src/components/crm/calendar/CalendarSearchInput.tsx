/**
 * Calendar search input — debounced client-side event filter.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CalendarEvent } from '@/types/calendar-event';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

interface CalendarSearchInputProps {
  events: CalendarEvent[];
  onFilteredEvents: (filtered: CalendarEvent[]) => void;
}

export function CalendarSearchInput({ events, onFilteredEvents }: CalendarSearchInputProps) {
  const { t } = useTranslation('crm');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Filter events
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      onFilteredEvents(events);
      return;
    }
    const q = debouncedQuery.toLowerCase();
    const filtered = events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.eventType.toLowerCase().includes(q)
    );
    onFilteredEvents(filtered);
  }, [debouncedQuery, events, onFilteredEvents]);

  const resultCount = debouncedQuery.trim()
    ? events.filter(
        (e) =>
          e.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          e.description.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          e.eventType.toLowerCase().includes(debouncedQuery.toLowerCase())
      ).length
    : null;

  const handleClear = useCallback(() => setQuery(''), []);
  const colors = useSemanticColors();

  return (
    <search className="relative flex items-center gap-2" role="search">
      <Search className={cn("absolute left-3 h-4 w-4 pointer-events-none", colors.text.muted)} />
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('calendarPage.search.placeholder')}
        className="pl-9 pr-8 h-9 w-64"
      />
      {query && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-12 h-5 w-5"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
      {resultCount !== null && (
        <Badge variant="secondary" className="text-xs shrink-0">
          {resultCount}
        </Badge>
      )}
    </search>
  );
}
