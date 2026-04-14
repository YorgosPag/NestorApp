/**
 * =============================================================================
 * 🏢 ENTERPRISE: LinkTokenResult — Display Created Share URL
 * =============================================================================
 *
 * Shown after a successful link-token share creation. URL + copy button +
 * summary of expiration / password / downloads policy.
 *
 * @module components/ui/sharing/panels/link-token/LinkTokenResult
 * @see ADR-147 Unified Share Surface
 */

'use client';

import React, { useCallback } from 'react';
import { Check, Clock, Copy, Download, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { LinkTokenResultData } from './types';

export interface LinkTokenResultProps {
  result: LinkTokenResultData;
  onClose: () => void;
}

export function LinkTokenResult({
  result,
  onClose,
}: LinkTokenResultProps): React.ReactElement {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const { copy, copied } = useCopyToClipboard();

  const handleCopy = useCallback(async () => {
    await copy(result.url);
  }, [copy, result.url]);

  return (
    <section className="flex flex-col gap-4">
      {/* eslint-disable-next-line design-system/enforce-semantic-colors */}
      <p className="text-sm text-green-600 font-medium text-center">
        {t('share.created')}
      </p>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={result.url}
          readOnly
          className="flex-1 px-3 py-2 text-xs border rounded-md bg-muted truncate"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          /* eslint-disable-next-line design-system/enforce-semantic-colors */
          className={cn('flex-shrink-0', copied && 'text-green-600')}
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>

      <footer className={cn('text-xs space-y-1', colors.text.muted)}>
        <p className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {t('share.expiresIn', { label: result.expiresInHoursLabel })}
        </p>
        {result.passwordProtected && (
          <p className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            {t('share.passwordProtected')}
          </p>
        )}
        {result.maxDownloadsCount > 0 && (
          <p className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {t('share.maxDownloadsLabel', { count: result.maxDownloadsCount })}
          </p>
        )}
      </footer>

      <nav className="flex items-center justify-end pt-2">
        <Button onClick={onClose}>{t('share.close')}</Button>
      </nav>
    </section>
  );
}
