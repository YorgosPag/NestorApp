'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type {
  ComparisonRecommendation,
  QuoteComparisonEntry,
} from '@/subapps/procurement/types/comparison';

interface RecommendationCardProps {
  recommendation: ComparisonRecommendation;
  winner: QuoteComparisonEntry;
}

export function RecommendationCard({ recommendation, winner }: RecommendationCardProps) {
  const { t } = useTranslation('quotes');

  const reasonTokens = recommendation.reason.split(',').filter(Boolean);
  const confidencePct = Math.round(recommendation.confidence * 100);

  return (
    <Card className="border-2 border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-emerald-600" />
          {t('comparison.recommendation.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-lg font-semibold">{winner.vendorName}</span>
          <span className="text-sm text-muted-foreground">
            {t('comparison.totalLabel')}: <span className="font-medium">{formatCurrency(winner.total)}</span>
          </span>
          <span className="text-sm text-muted-foreground">
            {t('comparison.scoreLabel')}: <span className="font-medium">{winner.score.toFixed(1)}/100</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {reasonTokens.map((token) => (
            <Badge key={token} variant="secondary">
              {t(`comparison.reasons.${token}`, { defaultValue: '' }) || token}
            </Badge>
          ))}
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{t('comparison.confidence')}</span>
            <span>{confidencePct}% (Δ {recommendation.deltaFromSecond.toFixed(1)})</span>
          </div>
          <Progress value={confidencePct} className="h-2" indicatorClassName="bg-emerald-500" />
        </div>

        {winner.hasRiskFlags && (
          <div className="flex items-start gap-2 rounded-md border border-amber-400/50 bg-amber-50/60 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{t('comparison.riskWarning')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
