'use client';

/**
 * @fileoverview **Η κάρτα ενός φακέλου** στη λίστα «Οι φάκελοί μου».
 * @related ADR-866 Φ1.2 · §2.9.6 · §2.9.8 (Δ1 · Δ3) · components/owner-property/OwnerPropertyCard.tsx (ύφος)
 * @module components/property-dossier/PropertyDossierCard
 *
 * 🔑 **Το όνομα είναι σύνδεσμος** (`Link` του συνόρου — πραγματικό `<a>`: μεσαίο κλικ / νέα καρτέλα), και οι
 * πράξεις ζουν σε **μενού γραμμής** (Drive/ACC: «⋮» ανά στοιχείο) — μετονομασία · αρχειοθέτηση/επαναφορά.
 * «Πότε άλλαξε» σε **σχετικό** χρόνο (Drive «Last modified»), γιατί η λίστα ταξινομείται ακριβώς έτσι.
 */

import React from 'react';
import '@/lib/design-system';
import { MoreHorizontal } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatRelativeTime } from '@/lib/intl-formatting';
import { dossierDetailHref } from '@/lib/property-dossier/property-dossier-routes';
import { Link, useRouter } from '@/lib/workspace/navigation';
import type { PropertyDossier } from '@/types/property-dossier';

import type { PropertyDossierLifecycleControls } from './usePropertyDossierLifecycle';

const NS = 'property-market';
const K = `${NS}:dossier.list`;

interface PropertyDossierCardProps {
  readonly dossier: PropertyDossier;
  readonly lifecycle: PropertyDossierLifecycleControls;
  readonly onRename: (dossier: PropertyDossier) => void;
}

/** «Διαμέρισμα» ή «Είδος: δεν ορίστηκε» — το `null` **φαίνεται**: είναι η οθόνη του μόνου που μπορεί να το διορθώσει. */
export function usePropertyDossierTypeLabel(type: PropertyDossier['type']): string {
  const { t } = useTranslation([NS, 'properties-enums']);
  return type === null ? t(`${K}.noType`) : t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[type]}`);
}

function DossierActions({ dossier, lifecycle, onRename }: PropertyDossierCardProps) {
  const { t } = useTranslation([NS]);
  const router = useRouter();
  const iconSizes = useIconSizes();
  const archived = dossier.lifecycle === 'archived';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t(`${K}.actions.label`, { label: dossier.label })}
        className="rounded-md p-1.5 text-foreground hover:bg-muted"
      >
        <MoreHorizontal className={iconSizes.sm} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => router.push(dossierDetailHref(dossier.id))}>{t(`${K}.actions.open`)}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onRename(dossier)}>{t(`${K}.actions.rename`)}</DropdownMenuItem>
        <DropdownMenuItem
          disabled={lifecycle.busy}
          onSelect={() => void (archived ? lifecycle.restore(dossier) : lifecycle.archive(dossier))}
        >
          {t(archived ? `${K}.actions.restore` : `${K}.actions.archive`)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PropertyDossierCard(props: PropertyDossierCardProps): React.ReactElement {
  const { dossier } = props;
  const { t } = useTranslation([NS]);
  const typeLabel = usePropertyDossierTypeLabel(dossier.type);
  return (
    <article className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="m-0 truncate text-base font-semibold">
          <Link href={dossierDetailHref(dossier.id)} className="text-foreground hover:underline">
            {dossier.label}
          </Link>
        </h2>
        <p className="m-0 text-sm text-muted-foreground">
          {typeLabel} · {t(`${K}.updated`, { date: formatRelativeTime(dossier.updatedAt) })}
        </p>
      </div>
      <DossierActions {...props} />
    </article>
  );
}
