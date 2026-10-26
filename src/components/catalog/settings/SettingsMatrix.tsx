'use client';
/**
 * **Κανάλια × γλώσσες** — ο πίνακας των ρυθμίσεων (ADR-923 §5.10 Δ6, §5.10.4 Β5).
 *
 * Σημασιολογικός `<table>` με `<caption>` και κεφαλίδες γραμμών/στηλών (`scope`): ο αναγνώστης οθόνης ακούει
 * «Βιτρίνα, EN, επιλεγμένο». Τα κλειδωμένα κελιά λένε **γιατί** (tooltip + περιγραφή), όχι απλώς «απενεργοποιημένο».
 *
 * @module components/catalog/settings/SettingsMatrix
 */

import { Lock } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { LocaleUsage } from '@/hooks/catalog/useCatalogLocaleUsage';
import { HUMAN_LANGUAGES, type HumanLanguage } from '@/i18n/languages';
import type { CatalogSettingsDefinition } from '@/subapps/catalog/types/catalog-settings';
import { CATALOG_CHANNELS, type CatalogChannel } from '@/subapps/catalog/vocabulary/channels';

import { CHANNEL_KEYS, LANGUAGE_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { settingsCellLock, type SettingsCellLock } from './settings-model';

export interface SettingsMatrixProps {
  readonly settings: CatalogSettingsDefinition;
  readonly usage: ReadonlyMap<HumanLanguage, LocaleUsage> | null;
  readonly disabled: boolean;
  readonly onToggle: (channel: CatalogChannel, locale: HumanLanguage) => void;
}

const LOCK_KEYS: Readonly<Record<Exclude<SettingsCellLock, null>, string>> = {
  lastLocale: 'settings.lock.lastLocale',
  inUse: 'settings.lock.inUse',
};

function MatrixCell({ channel, locale, props }: { readonly channel: CatalogChannel; readonly locale: HumanLanguage; readonly props: SettingsMatrixProps }) {
  const { t } = useCatalogText();
  const lock = settingsCellLock(props.settings, channel, locale, props.usage);
  const checked = props.settings.channelLocales[channel].includes(locale);
  const id = `settings-${channel}-${locale}`;
  const reason = lock ? t(LOCK_KEYS[lock], { locale: t(LANGUAGE_KEYS[locale]) }) : null;
  const box = (
    <Checkbox id={id} checked={checked} disabled={props.disabled || lock !== null}
      aria-label={`${t(CHANNEL_KEYS[channel])} · ${t(LANGUAGE_KEYS[locale])}`}
      aria-describedby={reason ? `${id}-lock` : undefined}
      onCheckedChange={() => props.onToggle(channel, locale)} />
  );
  return (
    <TableCell className="text-center">
      <span className="inline-flex items-center gap-1">
        {reason ? (
          <Tooltip>
            <TooltipTrigger asChild><span className="inline-flex">{box}</span></TooltipTrigger>
            <TooltipContent>{reason}</TooltipContent>
          </Tooltip>
        ) : box}
        {reason ? <Lock className="h-3 w-3 text-muted-foreground" aria-hidden /> : null}
        {reason ? <span id={`${id}-lock`} className="sr-only">{reason}</span> : null}
      </span>
    </TableCell>
  );
}

export function SettingsMatrix(props: SettingsMatrixProps) {
  const { t } = useCatalogText();
  return (
    <Table>
      <TableCaption>{t('settings.matrixCaption')}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t('settings.channel')}</TableHead>
          {HUMAN_LANGUAGES.map((locale) => <TableHead key={locale} scope="col" className="text-center">{t(LANGUAGE_KEYS[locale])}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {CATALOG_CHANNELS.map((channel) => (
          <TableRow key={channel}>
            <TableHead scope="row" className="font-medium text-foreground">{t(CHANNEL_KEYS[channel])}</TableHead>
            {HUMAN_LANGUAGES.map((locale) => <MatrixCell key={locale} channel={channel} locale={locale} props={props} />)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
