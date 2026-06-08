'use client';

/**
 * CreditsDialog — in-app third-party asset attribution / licences screen.
 *
 * Closes the ADR-409 §B-θετικό.2 obligation: CC-BY assets (Sketchfab meshes)
 * require a visible creator attribution; CC0 assets are listed per source for
 * provenance. Reads the `collectAssetCredits()` SSoT — no hand-maintained list.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-409-third-party-bim-library-licensing-policy.md §B-θετικό.2
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { collectAssetCredits, type AssetCredit } from '../../bim/licensing/asset-credits';

export interface CreditsDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/** Normalise a bare host/path into an absolute https URL for the anchor. */
function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function CreditsDialog({ isOpen, onClose }: CreditsDialogProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const credits = React.useMemo(() => collectAssetCredits(), []);
  const ccBy = credits.filter((c) => c.license === 'CC-BY');
  const cc0 = credits.filter((c) => c.license === 'CC0');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('credits.title')}</DialogTitle>
          <DialogDescription>{t('credits.intro')}</DialogDescription>
        </DialogHeader>

        {ccBy.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold">{t('credits.ccByHeading')}</h3>
            <p className="text-xs text-muted-foreground">{t('credits.ccByNotice')}</p>
            <Table size="compact">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('credits.colAsset')}</TableHead>
                  <TableHead>{t('credits.colAuthor')}</TableHead>
                  <TableHead>{t('credits.colSource')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ccBy.map((c: AssetCredit, i) => (
                  <TableRow key={`ccby-${i}`}>
                    <TableCell>{c.title}</TableCell>
                    <TableCell>{c.author}</TableCell>
                    <TableCell>
                      {c.url && (
                        <a
                          href={toHref(c.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {c.url}
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {cc0.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold">{t('credits.cc0Heading')}</h3>
            <Table size="compact">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('credits.colSource')}</TableHead>
                  <TableHead>{t('credits.colCount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cc0.map((c: AssetCredit, i) => (
                  <TableRow key={`cc0-${i}`}>
                    <TableCell>{c.author}</TableCell>
                    <TableCell>{t('credits.assetCount', { count: c.count ?? 0 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
