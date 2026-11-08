'use client';

/**
 * @fileoverview **«Δημοσίευση σε…»** — μια έτοιμη έκδοση του εκδότη γίνεται έντυπο που διαβάζει ένα κοινό (ADR-923 §5.15.3).
 * @related subapps/catalog/publishing/catalog-edition-policy.ts (`publishabilityOf` — ο ίδιος κριτής με τον διακομιστή)
 * @module components/catalog/publishing/PublicationEditionPublish
 *
 * 🔑 Το κουμπί ακολουθεί τον **ίδιο** κριτή με τον διακομιστή (`publishabilityOf`)· ο διακομιστής ξαναρωτά, γιατί το κουμπί είναι UX.
 * ⛔ **Θ4**: έκδοση **με τιμές** δεν παίρνει καν κουμπί — η οθόνη λέει γιατί. Η άρση είναι απόφαση μετά από ανασκόπηση ασφαλείας.
 * 🔑 Κοινό από την **μία** φόρμα κοινού (`AudienceField`), στενεμένη στα είδη που δέχεται έντυπο — κανένα δεύτερο λεξιλόγιο.
 * 🔑 Ιδεμπότητο στον διακομιστή· εδώ το κουμπί κλειδώνει όσο η αίτηση πετά, ώστε το διπλό κλικ να μη στέλνει δύο.
 */

import React, { useState } from 'react';
import { Globe2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDiscountsView } from '@/hooks/catalog/usePriceListViews';
import { nowISO } from '@/lib/date-local';
import { useNotifications } from '@/providers/NotificationProvider';
import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import { publishCatalogEdition } from '@/services/catalog/catalog-editions-api.client';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { isCatalogEditionAudience, publishabilityOf, type CatalogEditionRefusal } from '@/subapps/catalog/publishing/catalog-edition-policy';
import { CATALOG_EDITION_AUDIENCE_KINDS, type CatalogEditionAudience } from '@/subapps/catalog/types/catalog-edition';
import type { PriceAudience } from '@/subapps/catalog/types/price-list';
import type { CustomerGroupWire } from '@/subapps/catalog/types/pricing-views';
import type { PublicationRunWire } from '@/subapps/catalog/types/publication';
import { AudienceField } from '../pricing/AudienceField';
import { useCatalogAccess, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';

const NO_GROUPS: readonly CustomerGroupWire[] = [];
const NO_ISSUES: readonly CatalogIssue[] = [];

/** Γιατί δεν δημοσιεύεται — κλειστός πίνακας ανά άρνηση του κριτή. «Δεν είναι έτοιμη» δεν λέγεται: η γραμμή δείχνει ήδη πρόοδο. */
const REFUSAL_KEYS: Readonly<Record<CatalogEditionRefusal, string | null>> = {
  notReady: null,
  disposed: 'publishing.editions.refusal.disposed',
  disposalDue: 'publishing.editions.refusal.disposalDue',
  priced: 'publishing.editions.refusal.priced',
  noScreenFile: 'publishing.editions.refusal.noScreenFile',
};

/** Πλήρες κοινό εντύπου; Η ομάδα χωρίς επιλογή (`''`) δεν στέλνεται — ο διακομιστής θα την έλεγε «άγνωστη αναφορά». */
function readyAudience(audience: PriceAudience | null): CatalogEditionAudience | null {
  if (audience === null || !isCatalogEditionAudience(audience)) return null;
  return audience.kind === 'customerGroup' && audience.customerGroupId === '' ? null : audience;
}

interface PublishDialogProps {
  readonly runId: string;
  readonly onClose: () => void;
  readonly onPublished: () => Promise<void>;
}

function usePublish({ runId, onClose, onPublished }: PublishDialogProps) {
  const { t } = useCatalogText();
  const { success } = useNotifications();
  const notifyFailure = useCatalogFailureNotice();
  const [pending, setPending] = useState(false);
  const [issues, setIssues] = useState<readonly CatalogIssue[]>(NO_ISSUES);
  const publish = async (audience: CatalogEditionAudience) => {
    setPending(true);
    try {
      await publishCatalogEdition({ runId, audience });
      success(t('publishing.editions.published'));
      onClose();
    } catch (cause) {
      const failure = catalogFailureOf(cause);
      setIssues(failure.issues);
      notifyFailure(failure);
    } finally {
      setPending(false);
    }
    await onPublished();
  };
  return { pending, issues, publish };
}

function PublishDialog(props: PublishDialogProps) {
  const { t } = useCatalogText();
  const groupsApi = useDiscountsView();
  const groups = groupsApi.current.state === 'ready' ? groupsApi.current.view.customerGroups : NO_GROUPS;
  const [audience, setAudience] = useState<PriceAudience | null>({ kind: 'anonymous' });
  const { pending, issues, publish } = usePublish(props);
  const ready = readyAudience(audience);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('publishing.editions.publishTitle')}</DialogTitle>
          <DialogDescription>{t('publishing.editions.publishDescription')}</DialogDescription>
        </DialogHeader>
        <AudienceField value={audience} onChange={setAudience} allowNone={false} kinds={CATALOG_EDITION_AUDIENCE_KINDS}
          customerGroups={groups} disabled={pending} issues={issues} hint={t('publishing.editions.audienceHint')} />
        <DialogFooter>
          <Button type="button" disabled={ready === null || pending} onClick={() => { if (ready !== null) void publish(ready); }}>
            {t('publishing.editions.publish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface PublicationEditionPublishProps {
  readonly run: PublicationRunWire;
  readonly onPublished: () => Promise<void>;
}

export function PublicationEditionPublish({ run, onPublished }: PublicationEditionPublishProps) {
  const { t } = useCatalogText();
  const canPublish = useCatalogAccess('pricingPublish') === 'granted';
  const [open, setOpen] = useState(false);
  if (!canPublish || run.status !== 'ready') return null;
  const verdict = publishabilityOf(run, nowISO());
  if (!verdict.ok) {
    const key = REFUSAL_KEYS[verdict.refusal];
    return key === null ? null : <p className="m-0 text-xs text-muted-foreground">{t(key)}</p>;
  }
  return (
    <>
      <p className="m-0">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Globe2 className="mr-1 h-4 w-4" aria-hidden />{t('publishing.editions.publishTo')}
        </Button>
      </p>
      {open ? <PublishDialog runId={run.id} onClose={() => setOpen(false)} onPublished={onPublished} /> : null}
    </>
  );
}
