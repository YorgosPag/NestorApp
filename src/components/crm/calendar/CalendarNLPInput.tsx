/**
 * Natural language input for creating calendar events.
 * Toggle between smart input and traditional form.
 */

'use client';

import { useState, useCallback } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { Sparkles, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/providers/NotificationProvider';
import '@/lib/design-system';

interface ParsedEvent {
  title: string;
  date: string;
  time: string;
  duration: number;
  type: 'meeting' | 'call' | 'viewing' | 'follow_up' | 'email' | 'document' | 'other';
  contactName?: string | null;
  description?: string | null;
}

interface CalendarNLPInputProps {
  onParsed: (result: ParsedEvent) => void;
  locale: string;
}

export function CalendarNLPInput({ onParsed, locale }: CalendarNLPInputProps) {
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const { error: notifyError } = useNotifications();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleParse = useCallback(async () => {
    if (!text.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(API_ROUTES.CALENDAR.PARSE_EVENT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          currentDate: new Date().toISOString().split('T')[0],
          locale,
        }),
      });

      if (!response.ok) {
        const err = await response.json() as { error: string };
        throw new Error(err.error);
      }

      const data = await response.json() as { result: ParsedEvent };
      onParsed(data.result);
      setText('');
    } catch (err) {
      notifyError(err instanceof Error ? err.message : t('calendarPage.nlp.error'));
    } finally {
      setLoading(false);
    }
  }, [text, locale, onParsed, notifyError, t]);

  return (
    <section className="space-y-2">
      <header className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" />
          {t('calendarPage.nlp.badge')}
        </Badge>
      </header>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('calendarPage.nlp.placeholder')}
        rows={2}
        className="resize-none"
      />
      <Button
        size="sm"
        onClick={handleParse}
        disabled={loading || !text.trim()}
        className="gap-1.5"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {t('calendarPage.nlp.analyze')}
      </Button>
    </section>
  );
}
