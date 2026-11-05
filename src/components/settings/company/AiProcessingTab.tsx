'use client';

/**
 * Καρτέλα «Τεχνητή νοημοσύνη» των Ρυθμίσεων εταιρείας (ADR-929 Δ15 #1).
 *
 * 🔑 Ο διακόπτης δείχνει την **επιλογή**· η ετικέτα «Ενεργό / Ανενεργό» δείχνει αν **πράγματι** φεύγουν δεδομένα
 *    (επιλογή **και** νομική γνωστοποίηση σε ισχύ). Τα δύο διαφέρουν όσο εκκρεμεί η πολιτική απορρήτου, και η οθόνη το λέει.
 * 🔑 Optimistic: η αλλαγή φαίνεται αμέσως, και σε αποτυχία επανέρχεται η τιμή του διακομιστή με μήνυμα.
 * 🔑 Ο διακόπτης ζωγραφίζεται ενεργός μόνο όταν ο διακομιστής λέει `canEdit` (το ίδιο ταβάνι με το PUT).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { formatDate } from '@/lib/intl-formatting';
import type {
  AiProcessingPurpose,
  AiProcessingSettingsResponse,
  AiProcessingState,
  AiPurposeStatus,
} from '@/types/company-ai-processing';

/** Τα κλειδιά ανά σκοπό, γραμμένα ρητά (κανένα δυναμικό κλειδί i18n, CHECK 3.13). */
const PURPOSE_KEYS: Readonly<Record<AiProcessingPurpose, { label: string; description: string; whatIsSent: string; provider: string }>> = {
  'plan-reading': {
    label: 'orgStructure.aiProcessing.purpose.plan-reading.label',
    description: 'orgStructure.aiProcessing.purpose.plan-reading.description',
    whatIsSent: 'orgStructure.aiProcessing.purpose.plan-reading.whatIsSent',
    provider: 'orgStructure.aiProcessing.purpose.plan-reading.provider',
  },
};

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'ready'; readonly data: AiProcessingSettingsResponse };

/** Η αισιόδοξη εικόνα: ο σκοπός με τη νέα επιλογή, πριν απαντήσει ο διακομιστής. */
function withChoice(data: AiProcessingSettingsResponse, purpose: AiProcessingPurpose, state: AiProcessingState): AiProcessingSettingsResponse {
  return {
    ...data,
    purposes: data.purposes.map((p) =>
      p.purpose === purpose ? { ...p, state, source: 'company', effective: state === 'enabled' && p.legal === 'disclosed' } : p,
    ),
  };
}

function useAiProcessingSettings() {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [saveFailed, setSaveFailed] = useState(false);
  const inFlight = useRef(0);

  useEffect(() => {
    let alive = true;
    apiClient
      .get<AiProcessingSettingsResponse>(API_ROUTES.AI_PROCESSING_SETTINGS)
      .then((data) => alive && setLoad({ kind: 'ready', data }))
      .catch(() => alive && setLoad({ kind: 'failed' }));
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback(async (purpose: AiProcessingPurpose, state: AiProcessingState) => {
    if (load.kind !== 'ready') return;
    const previous = load.data;
    const ticket = ++inFlight.current;
    setSaveFailed(false);
    setLoad({ kind: 'ready', data: withChoice(previous, purpose, state) });
    try {
      const data = await apiClient.put<AiProcessingSettingsResponse>(API_ROUTES.AI_PROCESSING_SETTINGS, { purpose, state });
      // Μόνο η τελευταία αλλαγή γράφει την απάντηση: γρήγορα διπλά κλικ δεν αφήνουν παλιά απάντηση να κερδίσει.
      if (ticket === inFlight.current) setLoad({ kind: 'ready', data });
    } catch {
      if (ticket === inFlight.current) {
        setLoad({ kind: 'ready', data: previous });
        setSaveFailed(true);
      }
    }
  }, [load]);

  return { load, saveFailed, toggle };
}

interface PurposeRowProps {
  readonly status: AiPurposeStatus;
  readonly canEdit: boolean;
  readonly onToggle: (purpose: AiProcessingPurpose, state: AiProcessingState) => void;
}

function PurposeRow({ status, canEdit, onToggle }: PurposeRowProps) {
  const { t } = useTranslation('org-structure');
  const keys = PURPOSE_KEYS[status.purpose];
  const switchId = `ai-purpose-${status.purpose}`;
  const source = status.decision
    ? t('orgStructure.aiProcessing.source.company', { date: formatDate(status.decision.decidedAt) })
    : t('orgStructure.aiProcessing.source.platformDefault');

  return (
    <article className="rounded-lg border bg-card p-4 space-y-3">
      <header className="flex items-start justify-between gap-4">
        <section className="space-y-1">
          <Label htmlFor={switchId} className="text-base font-medium">{t(keys.label)}</Label>
          <p className="text-sm text-muted-foreground">{t(keys.description)}</p>
        </section>
        <Switch
          id={switchId}
          checked={status.state === 'enabled'}
          disabled={!canEdit}
          onCheckedChange={(checked) => onToggle(status.purpose, checked ? 'enabled' : 'disabled')}
        />
      </header>
      <footer className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={status.effective ? 'default' : 'secondary'}>
          {t(status.effective ? 'orgStructure.aiProcessing.effective.on' : 'orgStructure.aiProcessing.effective.off')}
        </Badge>
        <span>{source}</span>
      </footer>
      {status.legal === 'pending' && (
        <Alert role="status" withIcon>
          <AlertDescription>{t('orgStructure.aiProcessing.legalPending')}</AlertDescription>
        </Alert>
      )}
      <ul className="list-disc ps-5 text-sm text-muted-foreground space-y-1">
        <li>{t(keys.whatIsSent)}</li>
        <li>{t(keys.provider)}</li>
      </ul>
    </article>
  );
}

export function AiProcessingTab() {
  const { t } = useTranslation('org-structure');
  const { load, saveFailed, toggle } = useAiProcessingSettings();

  if (load.kind === 'loading') {
    return <Spinner />;
  }
  if (load.kind === 'failed') {
    return <p role="alert" className="text-sm text-destructive">{t('orgStructure.aiProcessing.loadFailed')}</p>;
  }
  return (
    <section className="space-y-4" aria-labelledby="ai-processing-title">
      <header className="space-y-1">
        <h2 id="ai-processing-title" className="text-lg font-semibold">{t('orgStructure.aiProcessing.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('orgStructure.aiProcessing.intro')}</p>
        {!load.data.canEdit && <p className="text-sm text-muted-foreground">{t('orgStructure.aiProcessing.readOnly')}</p>}
      </header>
      {saveFailed && <p role="alert" className="text-sm text-destructive">{t('orgStructure.aiProcessing.saveFailed')}</p>}
      {load.data.purposes.map((status) => (
        <PurposeRow key={status.purpose} status={status} canEdit={load.data.canEdit} onToggle={(p, s) => void toggle(p, s)} />
      ))}
    </section>
  );
}
