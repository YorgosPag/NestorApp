/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * FinancialQueryChat — SPEC-242E D3 NL Financial Query
 *
 * Chat interface for natural language financial queries.
 * Calls /api/financial-intelligence/query with the user message.
 * Renders AI responses in Greek + optional bar/line charts.
 *
 * @enterprise ADR-242 SPEC-242E
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Send, Bot, User, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { API_ROUTES } from '@/config/domain-constants';
import { formatCurrencyWhole } from '@/lib/intl-utils';

// =============================================================================
// TYPES
// =============================================================================

interface ChartDataPoint {
  label: string;
  value: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  chartData?: ChartDataPoint[];
  chartType?: 'bar' | 'line';
}

interface QueryResponse {
  data: {
    answer: string;
    suggestedChart: 'bar' | 'line' | null;
    chartData: ChartDataPoint[] | null;
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FinancialQueryChat() {
  const { t } = useTranslation(['payments']);
  const colors = useSemanticColors();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(API_ROUTES.FINANCIAL_INTELLIGENCE.QUERY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json() as QueryResponse;
      const { answer, suggestedChart, chartData } = json.data;

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: answer,
        chartData: chartData ?? undefined,
        chartType: suggestedChart ?? undefined,
      }]);
    } catch {
      setError(t('financialQuery.error'));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, messages, t]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSubmit(input);
  };

  const handleExampleClick = (question: string) => {
    void handleSubmit(question);
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
  };

  const examples = [
    t('financialQuery.examples.q1'),
    t('financialQuery.examples.q2'),
    t('financialQuery.examples.q3'),
    t('financialQuery.examples.q4'),
  ];

  return (
    <section
      aria-label={t('financialQuery.title')}
      className={cn('border rounded-lg overflow-hidden', colors.border.default)}
    >
      {/* Header */}
      <header className={cn('flex items-center justify-between px-4 py-3 border-b', colors.border.default, colors.bg.muted)}>
        <div className="flex items-center gap-2">
          <Bot className={cn('h-5 w-5', colors.text.primary)} aria-hidden />
          <div>
            <p className={cn('text-sm font-semibold', colors.text.primary)}>
              {t('financialQuery.title')}
            </p>
            <p className={cn('text-xs', colors.text.muted)}>
              {t('financialQuery.subtitle')}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            aria-label={t('financialQuery.clearHistory')}
            className={cn('h-8 w-8 p-0', colors.text.muted)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </header>

      {/* Message log */}
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label={t('financialQuery.title')}
        className="flex flex-col gap-3 p-4 min-h-[200px] max-h-[400px] overflow-y-auto"
      >
        {/* Example pills (shown when no messages) */}
        {messages.length === 0 && !loading && (
          <aside aria-label={t('financialQuery.examplesTitle')} className="flex flex-col gap-2">
            <p className={cn('text-xs font-medium', colors.text.muted)}>
              {t('financialQuery.examplesTitle')}
            </p>
            <div className="flex flex-wrap gap-2">
              {examples.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleExampleClick(q)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full border transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    colors.border.default, colors.text.secondary
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <article
            key={i}
            className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
          >
            <div
              aria-hidden
              className={cn(
                'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center',
                msg.role === 'user' ? 'bg-primary' : colors.bg.muted
              )}
            >
              {msg.role === 'user'
                ? <User className="h-4 w-4 text-primary-foreground" />
                : <Bot className={cn('h-4 w-4', colors.text.primary)} />
              }
            </div>
            <div className={cn('flex flex-col gap-1 max-w-[85%]', msg.role === 'user' ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'px-3 py-2 rounded-lg text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : cn(colors.bg.muted, colors.text.primary)
                )}
              >
                {msg.content}
              </div>
              {/* Chart */}
              {msg.chartData && msg.chartData.length > 0 && (
                <div className={cn('w-full mt-1 p-3 rounded-lg border', colors.border.default, colors.bg.muted)}>
                  <p className={cn('text-xs font-medium mb-2', colors.text.muted)}>
                    {t('financialQuery.chartTitle')}
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    {msg.chartType === 'line' ? (
                      <LineChart data={msg.chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyWhole(v as number) ?? String(v)} />
                        <Tooltip formatter={(v: number) => formatCurrencyWhole(v) ?? v} />
                        <Line type="monotone" dataKey="value" strokeWidth={2} dot={false} className="stroke-primary" />
                      </LineChart>
                    ) : (
                      <BarChart data={msg.chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyWhole(v as number) ?? String(v)} />
                        <Tooltip formatter={(v: number) => formatCurrencyWhole(v) ?? v} />
                        <Bar dataKey="value" className="fill-primary" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </article>
        ))}

        {/* Loading skeleton */}
        {loading && (
          <div className="flex gap-2 items-start" role="status" aria-label={t('financialQuery.thinking')}>
            <div className={cn('flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center', colors.bg.muted)}>
              <Bot className={cn('h-4 w-4', colors.text.primary)} aria-hidden />
            </div>
            <div className="flex flex-col gap-1 pt-1">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p role="alert" className="text-xs text-destructive px-2">{error}</p>
        )}
      </div>

      {/* Input form */}
      <footer className={cn('px-4 py-3 border-t', colors.border.default)}>
        <form onSubmit={handleFormSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('financialQuery.placeholder')}
            disabled={loading}
            maxLength={1000}
            aria-label={t('financialQuery.placeholder')}
            className={cn(
              'flex-1 text-sm px-3 py-2 rounded-md border bg-background',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              colors.border.default, colors.text.primary
            )}
          />
          <Button
            type="submit"
            size="sm"
            disabled={loading || !input.trim()}
            aria-label={t('financialQuery.send')}
          >
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      </footer>
    </section>
  );
}
