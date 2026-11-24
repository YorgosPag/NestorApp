'use client';

/**
 * @fileoverview **«Λογότυπο εταιρείας»** στις Ρυθμίσεις → Εταιρεία → Στοιχεία (ADR-ACC-018 §17).
 * @module components/settings/company/brand/CompanyBrandLogoSection
 *
 * Το ΕΝΑ σημείο όπου ορίζεται το λογότυπο του χώρου (μοτίβο Stripe «Settings → Branding»). Η προεπισκόπηση έχει την
 * **αναλογία του κουτιού της κεφαλίδας του PDF**, ώστε ο άνθρωπος να βλέπει πώς θα χωρέσει πριν εκδώσει τιμολόγιο.
 */

import { useId, useRef, type ChangeEvent } from 'react';
import { ImageUp, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  BRAND_LOGO_MAX_INPUT_BYTES,
  BRAND_LOGO_MIN_EDGE_PX,
  BRAND_LOGO_RECOMMENDED_EDGE_PX,
  type BrandLogoRefusal,
} from '@/lib/company/brand-logo-policy';
import { fileDisplayUrl } from '@/lib/files/file-display-url';
import { useCompanyBrandLogo, type BrandLogoProblem } from './useCompanyBrandLogo';

const MAX_MB = BRAND_LOGO_MAX_INPUT_BYTES / (1024 * 1024);

const REFUSAL_KEY: Readonly<Record<BrandLogoRefusal, string>> = {
  format: 'orgStructure.brandLogo.refusal.format',
  size: 'orgStructure.brandLogo.refusal.size',
  'too-small': 'orgStructure.brandLogo.refusal.tooSmall',
  undecodable: 'orgStructure.brandLogo.refusal.undecodable',
};

function problemKey(problem: BrandLogoProblem): string {
  if (problem.kind === 'refused') return REFUSAL_KEY[problem.refusal];
  return problem.kind === 'load-failed' ? 'orgStructure.brandLogo.loadFailed' : 'orgStructure.brandLogo.saveFailed';
}

export function CompanyBrandLogoSection() {
  const { t } = useTranslation('org-structure');
  const { state, upload, remove } = useCompanyBrandLogo();
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const hintId = useId();

  const storedUrl = state.brandLogo
    ? fileDisplayUrl({ storagePath: state.brandLogo.storagePath, contentType: state.brandLogo.contentType })
    : null;
  const shownUrl = state.optimisticPreview ?? storedUrl;
  const busy = state.pending !== null || state.loading;

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void upload(file);
  };

  return (
    <section aria-labelledby={titleId} className="space-y-4 py-6">
      <header className="space-y-1">
        <h2 id={titleId} className="text-base font-semibold">{t('orgStructure.brandLogo.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('orgStructure.brandLogo.description')}</p>
      </header>

      <figure className="max-w-sm space-y-2">
        <figcaption className="text-xs text-muted-foreground">{t('orgStructure.brandLogo.previewLabel')}</figcaption>
        {/* Χαρτί, όχι επιφάνεια θέματος: το PDF είναι πάντα λευκό — η προεπισκόπηση δείχνει ό,τι θα τυπωθεί. */}
        <span className="flex aspect-[9/5] w-full items-center justify-start rounded-md border border-border bg-white p-3">
          {shownUrl ? (
            <img src={shownUrl} alt={t('orgStructure.brandLogo.alt')} className="max-h-full max-w-full object-contain" />
          ) : null}
        </span>
        {shownUrl ? null : <p className="text-sm text-muted-foreground">{t('orgStructure.brandLogo.empty')}</p>}
      </figure>

      <p id={hintId} className="text-xs text-muted-foreground">
        {t('orgStructure.brandLogo.hint', { maxMb: MAX_MB, recommendedPx: BRAND_LOGO_RECOMMENDED_EDGE_PX })}
      </p>

      <footer className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-describedby={hintId}
          tabIndex={-1}
          onChange={onPick}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <ImageUp className="mr-1 h-4 w-4" aria-hidden />
          {state.pending === 'upload'
            ? t('orgStructure.brandLogo.uploading')
            : t(state.brandLogo ? 'orgStructure.brandLogo.replace' : 'orgStructure.brandLogo.upload')}
        </Button>
        {state.brandLogo !== null || state.pending === 'remove' ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
            <Trash2 className="mr-1 h-4 w-4" aria-hidden />
            {state.pending === 'remove' ? t('orgStructure.brandLogo.removing') : t('orgStructure.brandLogo.remove')}
          </Button>
        ) : null}
      </footer>

      {state.problem !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {t(problemKey(state.problem), { maxMb: MAX_MB, minPx: BRAND_LOGO_MIN_EDGE_PX })}
        </p>
      ) : null}
    </section>
  );
}
