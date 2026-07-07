'use client';

/**
 * ADR-581 §12 — Natural-language intent row for «Αντιγραφή Ιδιοτήτων» (flag-gated).
 *
 * Lazy-loaded (registered in `dxf-viewer-lazy-components.tsx`) so the AI code stays
 * out of the base DXF Viewer bundle. Renders nothing when the flag is OFF. On submit
 * it asks the LLM which roles to transfer vs preserve and hands the resolved role set
 * back via `onResolve` — the deterministic checklist then reflects the AI's choice,
 * which the user can still edit before Apply.
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import type { SemanticRole } from '../../systems/match-properties';
import { useMatchAi, type MatchAiContext } from './useMatchAi';
import styles from './match-properties-dialog.module.css';

interface MatchAiPromptProps {
  readonly offeredRoles: readonly SemanticRole[];
  readonly sourceType: string | null;
  readonly targetTypes: readonly string[];
  readonly onResolve: (roles: Set<SemanticRole>) => void;
}

export const MatchAiPrompt: React.FC<MatchAiPromptProps> = ({
  offeredRoles,
  sourceType,
  targetTypes,
  onResolve,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { enabled, loading, error, planIntent } = useMatchAi();
  const [text, setText] = useState('');

  const submit = useCallback(async () => {
    const ctx: MatchAiContext = { offeredRoles, sourceType, targetTypes };
    const roles = await planIntent(text, ctx);
    if (roles) onResolve(roles);
  }, [text, offeredRoles, sourceType, targetTypes, planIntent, onResolve]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !loading) {
        e.preventDefault();
        void submit();
      }
    },
    [loading, submit],
  );

  if (!enabled) return null;

  return (
    <section className={styles.aiRow}>
      <div className={styles.aiField}>
        <input
          type="text"
          className={styles.aiInput}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('matchProperties.ai.placeholder')}
          disabled={loading}
        />
        <Button
          variant="secondary"
          onClick={() => void submit()}
          disabled={loading || text.trim().length === 0}
        >
          {loading ? t('matchProperties.ai.thinking') : t('matchProperties.ai.submit')}
        </Button>
      </div>
      {error ? (
        <p className={styles.aiError}>{error}</p>
      ) : (
        <p className={styles.aiHint}>{t('matchProperties.ai.hint')}</p>
      )}
    </section>
  );
};

export default MatchAiPrompt;
