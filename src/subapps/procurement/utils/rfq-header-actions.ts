/**
 * rfq-header-actions — ADR-335 factory
 *
 * Pure function: no hooks, no side effects. Returns header action descriptors
 * for the RFQ detail page based on lifecycle status (close / cancel / reopen /
 * archive). Mirrors the pattern of `quote-header-actions.ts`.
 */

import { Lock, RotateCcw, XCircle, Archive } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RFQ, RfqStatus } from '../types/rfq';

export interface RfqHeaderAction {
  id: 'close' | 'reopen' | 'cancel' | 'archive';
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  disabledTooltip?: string;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
  destructive?: boolean;
}

export interface BuildRfqHeaderActionsParams {
  rfq: RFQ | null;
  onClose: () => void;
  onReopen: () => void;
  onCancel: () => void;
  onArchive: () => void;
  t: (key: string) => string;
  isConnected?: boolean;
}

const CLOSEABLE: ReadonlySet<RfqStatus> = new Set(['active']);
const REOPENABLE: ReadonlySet<RfqStatus> = new Set(['closed']);
const CANCELLABLE: ReadonlySet<RfqStatus> = new Set(['draft', 'active']);
const ARCHIVABLE: ReadonlySet<RfqStatus> = new Set(['draft', 'active', 'closed', 'cancelled']);

export function buildRfqHeaderActions(p: BuildRfqHeaderActionsParams): RfqHeaderAction[] {
  if (!p.rfq) return [];
  const offline = p.isConnected === false;
  const offlineTooltip = offline ? p.t('rfqs.offline.requiresConnection') : undefined;
  const status = p.rfq.status;
  const out: RfqHeaderAction[] = [];

  if (CLOSEABLE.has(status)) {
    out.push({
      id: 'close',
      label: p.t('rfqs.detail.action.close'),
      icon: Lock,
      onClick: p.onClose,
      disabled: offline,
      disabledTooltip: offlineTooltip,
      variant: 'outline',
    });
  }

  if (REOPENABLE.has(status)) {
    out.push({
      id: 'reopen',
      label: p.t('rfqs.detail.action.reopen'),
      icon: RotateCcw,
      onClick: p.onReopen,
      disabled: offline,
      disabledTooltip: offlineTooltip,
      variant: 'outline',
    });
  }

  if (CANCELLABLE.has(status)) {
    out.push({
      id: 'cancel',
      label: p.t('rfqs.detail.action.cancel'),
      icon: XCircle,
      onClick: p.onCancel,
      disabled: offline,
      disabledTooltip: offlineTooltip,
      variant: 'ghost',
      destructive: true,
    });
  }

  if (ARCHIVABLE.has(status) && status !== 'archived') {
    out.push({
      id: 'archive',
      label: p.t('rfqs.detail.action.archive'),
      icon: Archive,
      onClick: p.onArchive,
      disabled: offline,
      disabledTooltip: offlineTooltip,
      variant: 'ghost',
    });
  }

  return out;
}
