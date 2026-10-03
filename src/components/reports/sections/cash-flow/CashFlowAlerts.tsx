'use client';

import '@/lib/design-system';

/**
 * @module reports/sections/cash-flow/CashFlowAlerts
 * @enterprise ADR-268 Phase 8 — Q10: 3 alert types
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AlertTriangle, X, Banknote, FileText, TrendingDown } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { CashFlowAlert, CashFlowAlertType } from '@/services/cash-flow/cash-flow.types';
import { formatCurrencyWhole as formatCurrency } from '@/lib/intl-domain';
import { formatCalendarMonth } from '@/lib/intl-formatting';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CashFlowAlertsProps {
  alerts: CashFlowAlert[];
}

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const ALERT_ICONS: Record<CashFlowAlertType, React.ElementType> = {
  'low-cash': Banknote,
  'pdc-maturity': FileText,
  'collection-rate-drop': TrendingDown,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CashFlowAlerts({ alerts }: CashFlowAlertsProps) {
  const { t, i18n } = useTranslation('cash-flow');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (alerts.length === 0) return null;

  const visible = alerts.filter(
    (a) => !dismissed.has(`${a.type}_${a.month ?? 'global'}`),
  );

  if (visible.length === 0) return null;

  return (
    <section aria-label={t('alerts.title', 'Cash Flow Alerts')} className="space-y-2">
      {visible.map((alert) => {
        const key = `${alert.type}_${alert.month ?? 'global'}`;
        const Icon = ALERT_ICONS[alert.type] ?? AlertTriangle;

        return (
          <Alert
            key={key}
            variant={alert.severity === 'critical' ? 'destructive' : 'default'}
            className="relative"
          >
            <Icon className="h-4 w-4" />
            <AlertTitle className="text-sm font-medium">
              {getAlertTitle(alert.type, t)}
            </AlertTitle>
            <AlertDescription className="text-sm">
              {getAlertMessage(alert, t, i18n.language)}
            </AlertDescription>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-2"
              onClick={() => {
                setDismissed((prev) => new Set(prev).add(key));
              }}
              aria-label={t('alerts.dismiss', 'Dismiss')}
            >
              <X className="h-3 w-3" />
            </Button>
          </Alert>
        );
      })}
    </section>
  );
}

/**
 * Το κείμενο συντίθεται ΕΔΩ από τα δομημένα πεδία της ειδοποίησης: το `alert.message` του
 * διακομιστή είναι αγγλικό και δεν περνά από i18n.
 */
function getAlertMessage(alert: CashFlowAlert, t: TFunction, language: string): string {
  switch (alert.type) {
    case 'low-cash':
      return t('alerts.lowCashMessage', {
        threshold: formatCurrency(alert.threshold ?? 0),
        month: alert.month ? formatCalendarMonth(alert.month, language, 'short') : '',
      });
    case 'pdc-maturity':
      return t('alerts.pdcMessage', {
        count: alert.count ?? 0,
        amount: formatCurrency(alert.value ?? 0),
        days: alert.days ?? 0,
      });
    case 'collection-rate-drop':
      return t('alerts.collectionMessage', {
        rate: Math.round(alert.value ?? 0),
        threshold: alert.threshold ?? 0,
      });
    default:
      return alert.message;
  }
}

function getAlertTitle(
  type: CashFlowAlertType,
  t: TFunction,
): string {
  switch (type) {
    case 'low-cash': return t('alerts.lowCashTitle', 'Low Cash Warning');
    case 'pdc-maturity': return t('alerts.pdcTitle', 'PDC Maturity');
    case 'collection-rate-drop': return t('alerts.collectionTitle', 'Collection Rate');
    default: return t('alerts.genericTitle', 'Alert');
  }
}
