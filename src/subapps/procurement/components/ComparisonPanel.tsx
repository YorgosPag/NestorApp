'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart2, Trophy, Award, AlertTriangle, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { RecommendationCard } from './RecommendationCard';
import { COMPARISON_TEMPLATES } from '@/subapps/procurement/types/comparison';
import {
  COMPARISON_FACTOR_COLORS,
  FLAG_TO_FACTOR,
} from '@/subapps/procurement/config/comparison-factor-colors';
import type {
  QuoteComparisonEntry,
  QuoteComparisonResult,
  CherryPickResult,
  ComparisonWeights,
} from '@/subapps/procurement/types/comparison';

interface ComparisonPanelProps {
  comparison: QuoteComparisonResult;
  cherryPick: CherryPickResult | null;
  loading: boolean;
  rfqAwarded: boolean;
  winnerQuoteId?: string | null;
  awardMode: 'whole_package' | 'cherry_pick';
  onAwardIntent: (entry: QuoteComparisonEntry) => void;
  onRowClick?: (quoteId: string) => void;
}

export function ComparisonPanel({
  comparison,
  cherryPick,
  loading,
  rfqAwarded,
  winnerQuoteId,
  awardMode,
  onAwardIntent,
  onRowClick,
}: ComparisonPanelProps) {
  const { t } = useTranslation('quotes');

  const recommended = useMemo(() => {
    if (!comparison.recommendation) return null;
    return comparison.quotes.find((e) => e.quoteId === comparison.recommendation!.quoteId) ?? null;
  }, [comparison]);

  const handleAwardClick = (entry: QuoteComparisonEntry) => {
    onAwardIntent(entry);
  };

  if (loading) {
    return <PanelShell title={t('comparison.title')}>{t('quotes.loading')}</PanelShell>;
  }

  if (comparison.quoteCount === 0) {
    return (
      <PanelShell title={t('comparison.title')}>
        <p className="text-sm text-muted-foreground">{t('comparison.empty')}</p>
      </PanelShell>
    );
  }

  return (
    <div className="space-y-4">
      {comparison.recommendation && recommended && (
        <RecommendationCard recommendation={comparison.recommendation} winner={recommended} />
      )}

      {awardMode === 'cherry_pick' && cherryPick && cherryPick.lineWinners.length > 0 && (
        <CherryPickCard result={cherryPick} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="h-5 w-5" />
            {t('comparison.title')}
          </CardTitle>
          <TemplateSummary templateId={comparison.templateId} weights={comparison.weights} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t('quotes.vendor')}</TableHead>
                <TableHead className="text-right">{t('quotes.total')}</TableHead>
                <TableHead className="text-right">{t('comparison.scoreLabel')}</TableHead>
                <TableHead className="min-w-[320px]">{t('comparison.breakdown')}</TableHead>
                <TableHead>{t('comparison.flagsHeader')}</TableHead>
                <TableHead className="text-right">{t('comparison.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.quotes.map((entry) => (
                <ComparisonRow
                  key={entry.quoteId}
                  entry={entry}
                  isRecommended={recommended?.quoteId === entry.quoteId}
                  rfqAwarded={rfqAwarded}
                  winnerQuoteId={winnerQuoteId}
                  onAwardClick={handleAwardClick}
                  onRowClick={onRowClick}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          <BarChart2 className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TemplateSummary({ templateId, weights }: { templateId: string; weights: ComparisonWeights }) {
  const { t, i18n } = useTranslation('quotes');
  const meta = COMPARISON_TEMPLATES[templateId];
  const label = meta ? (i18n.language === 'el' ? meta.labelEl : meta.labelEn) : templateId;
  const fmt = (n: number) => `${Math.round(n * 100)}%`;
  const factors: Array<[keyof QuoteComparisonEntry['breakdown'], string]> = [
    ['price', t('comparison.factors.price')],
    ['supplier', t('comparison.factors.supplier')],
    ['terms', t('comparison.factors.terms')],
    ['delivery', t('comparison.factors.delivery')],
  ];

  return (
    <p className="text-xs text-muted-foreground">
      {t('comparison.template')}: <span className="font-medium">{label}</span>
      {factors.map(([key, factorLabel]) => (
        <span key={key}>
          {' · '}
          <span className={`font-medium ${COMPARISON_FACTOR_COLORS[key].text}`}>
            {factorLabel} {fmt(weights[key])}
          </span>
        </span>
      ))}
    </p>
  );
}

interface RowProps {
  entry: QuoteComparisonEntry;
  isRecommended: boolean;
  rfqAwarded: boolean;
  winnerQuoteId?: string | null;
  onAwardClick: (entry: QuoteComparisonEntry) => void;
  onRowClick?: (quoteId: string) => void;
}

function ComparisonRow({ entry, isRecommended, rfqAwarded, winnerQuoteId, onAwardClick, onRowClick }: RowProps) {
  const { t } = useTranslation('quotes');
  const clickable = !!onRowClick;
  const isWinner = winnerQuoteId === entry.quoteId;
  return (
    <TableRow
      className={[
        isWinner ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : isRecommended ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : '',
        clickable ? 'group cursor-pointer hover:bg-muted/50' : '',
      ].join(' ') || undefined}
      onClick={clickable ? () => onRowClick(entry.quoteId) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onRowClick(entry.quoteId);
              }
            }
          : undefined
      }
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? t('rfqs.comparison.rowAriaLabel') : undefined}
    >
      <TableCell className="font-medium">
        {(isWinner || entry.rank === 1) && <Trophy className="inline h-4 w-4 text-emerald-600" />}
        {entry.rank}
      </TableCell>
      <TableCell>{entry.vendorName}</TableCell>
      <TableCell className="text-right">{formatCurrency(entry.total)}</TableCell>
      <TableCell className="text-right font-semibold">{entry.score.toFixed(1)}</TableCell>
      <TableCell>
        <BreakdownBars breakdown={entry.breakdown} />
      </TableCell>
      <TableCell>
        <FlagsRow flags={entry.flags} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant={isWinner ? 'outline' : isRecommended ? 'default' : 'outline'}
            disabled={rfqAwarded}
            onClick={(e) => {
              e.stopPropagation();
              if (!isWinner) onAwardClick(entry);
            }}
          >
            {isWinner ? (
              <>{t('rfqs.award.lockedBadge')}</>
            ) : (
              <><Award className="mr-1 h-4 w-4" />{t('comparison.awardBtn')}</>
            )}
          </Button>
          {clickable && (
            <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function BreakdownBars({ breakdown }: { breakdown: QuoteComparisonEntry['breakdown'] }) {
  const { t } = useTranslation('quotes');
  const items: Array<[keyof QuoteComparisonEntry['breakdown'], string]> = [
    ['price', t('comparison.factors.price')],
    ['supplier', t('comparison.factors.supplier')],
    ['terms', t('comparison.factors.terms')],
    ['delivery', t('comparison.factors.delivery')],
  ];
  return (
    <div className="grid grid-cols-1 gap-1 min-w-[280px]">
      {items.map(([key, label]) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
          <Progress
            value={Math.round(breakdown[key])}
            className="h-1.5 flex-1"
            indicatorClassName={COMPARISON_FACTOR_COLORS[key].bar}
          />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums">{Math.round(breakdown[key])}</span>
        </div>
      ))}
    </div>
  );
}

function FlagsRow({ flags }: { flags: QuoteComparisonEntry['flags'] }) {
  const { t } = useTranslation('quotes');
  if (flags.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {flags.map((flag) => {
        if (flag === 'risk_low_score') {
          return (
            <Badge key={flag} variant="destructive" className="text-[10px]">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {t(`comparison.flags.${flag}`, { defaultValue: '' }) || flag}
            </Badge>
          );
        }
        const factor = FLAG_TO_FACTOR[flag];
        const palette = factor ? COMPARISON_FACTOR_COLORS[factor].badge : '';
        return (
          <Badge key={flag} variant="outline" className={`text-[10px] ${palette}`}>
            {t(`comparison.flags.${flag}`, { defaultValue: '' }) || flag}
          </Badge>
        );
      })}
    </div>
  );
}

function CherryPickCard({ result }: { result: CherryPickResult }) {
  const { t } = useTranslation('quotes');
  return (
    <Card className="border-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20">
      <CardHeader>
        <CardTitle className="text-base">{t('comparison.cherryPick.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          {t('comparison.cherryPick.summary', {
            cherry: formatCurrency(result.totalIfCherryPick),
            whole: formatCurrency(result.totalIfWholePackage),
          })}
        </p>
        {result.savingsFromSplit > 0 && (
          <p className="font-medium text-blue-700 dark:text-blue-300">
            {t('comparison.cherryPick.savings', {
              amount: formatCurrency(result.savingsFromSplit),
              percent: result.savingsPercent.toFixed(1),
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
