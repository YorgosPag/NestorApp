'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart2, Trophy, Award, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { RecommendationCard } from './RecommendationCard';
import { AwardModal } from './AwardModal';
import { COMPARISON_TEMPLATES } from '@/subapps/procurement/types/comparison';
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
  awardMode: 'whole_package' | 'cherry_pick';
  onAward: (winnerQuoteId: string, overrideReason: string | null) => Promise<void>;
}

export function ComparisonPanel({
  comparison,
  cherryPick,
  loading,
  rfqAwarded,
  awardMode,
  onAward,
}: ComparisonPanelProps) {
  const { t } = useTranslation('quotes');
  const [selected, setSelected] = useState<QuoteComparisonEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const recommended = useMemo(() => {
    if (!comparison.recommendation) return null;
    return comparison.quotes.find((e) => e.quoteId === comparison.recommendation!.quoteId) ?? null;
  }, [comparison]);

  const handleAwardClick = (entry: QuoteComparisonEntry) => {
    setSelected(entry);
    setModalOpen(true);
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
                <TableHead>{t('comparison.breakdown')}</TableHead>
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
                  onAwardClick={handleAwardClick}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AwardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        selected={selected}
        recommended={recommended}
        onConfirm={onAward}
      />
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

  return (
    <p className="text-xs text-muted-foreground">
      {t('comparison.template')}: <span className="font-medium">{label}</span>
      {' · '}
      {t('comparison.weightSummary', {
        price: fmt(weights.price),
        supplier: fmt(weights.supplier),
        terms: fmt(weights.terms),
        delivery: fmt(weights.delivery),
      })}
    </p>
  );
}

interface RowProps {
  entry: QuoteComparisonEntry;
  isRecommended: boolean;
  rfqAwarded: boolean;
  onAwardClick: (entry: QuoteComparisonEntry) => void;
}

function ComparisonRow({ entry, isRecommended, rfqAwarded, onAwardClick }: RowProps) {
  const { t } = useTranslation('quotes');
  return (
    <TableRow className={isRecommended ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : undefined}>
      <TableCell className="font-medium">
        {entry.rank === 1 && <Trophy className="inline h-4 w-4 text-emerald-600" />}
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
        <Button
          size="sm"
          variant={isRecommended ? 'default' : 'outline'}
          disabled={rfqAwarded}
          onClick={() => onAwardClick(entry)}
        >
          <Award className="mr-1 h-4 w-4" />
          {t('comparison.awardBtn')}
        </Button>
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
    <div className="grid grid-cols-1 gap-1 min-w-[180px]">
      {items.map(([key, label]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-16 text-xs text-muted-foreground">{label}</span>
          <Progress value={Math.round(breakdown[key])} className="h-1.5 flex-1" />
          <span className="w-8 text-right text-xs tabular-nums">{Math.round(breakdown[key])}</span>
        </div>
      ))}
    </div>
  );
}

function FlagsRow({ flags }: { flags: QuoteComparisonEntry['flags'] }) {
  const { t } = useTranslation('quotes');
  if (flags.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((flag) => {
        const isRisk = flag === 'risk_low_score';
        return (
          <Badge key={flag} variant={isRisk ? 'destructive' : 'secondary'} className="text-[10px]">
            {isRisk && <AlertTriangle className="mr-1 h-3 w-3" />}
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
