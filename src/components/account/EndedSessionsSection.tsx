'use client';

/**
 * @fileoverview **«Συνεδρίες που τελείωσαν»** — ADR-894 §10 Β2 (πρότυπο Google «Your devices»: 28 ημέρες).
 * @related components/account/SessionsList (ο γονέας) · services/session/session-lifecycle (`endReasonOf`)
 * @module components/account/EndedSessionsSection
 *
 * 🔑 Ο άνθρωπος βλέπει **και** ό,τι δεν τρέχει πια: «ήταν αυτή η σύνδεση δική μου;» είναι ερώτηση που αφορά και
 * τις χθεσινές. Κάθε γραμμή λέει **γιατί** τελείωσε (αποσύνδεση · από άλλη συσκευή · όριο · αδράνεια).
 * Χωρίς κουμπί ενέργειας: δεν υπάρχει τίποτα να ανακληθεί. Κλειστή από προεπιλογή (`<details>`) — η λίστα των
 * ζωντανών μένει το κύριο θέμα της κάρτας.
 */

import React, { useMemo } from 'react';

import { cn } from '@/lib/utils';
import { formatRelativeTime, getDisplayNames } from '@/lib/intl-formatting';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTypography } from '@/hooks/useTypography';
import type { EndedSessionDisplayItem } from '@/services/session';
import { SESSION_HISTORY_WINDOW_DAYS } from '@/services/session/session-lifecycle';

import { SessionDeviceSummary, type Translate } from './session-device-summary';
import { sessionLocationLabel } from './session-location-label';

interface EndedSessionsSectionProps {
  t: Translate;
  sessions: readonly EndedSessionDisplayItem[];
}

export function EndedSessionsSection({ t, sessions }: EndedSessionsSectionProps) {
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const typography = useTypography();
  // Το `t` αλλάζει με τη γλώσσα ⇒ τα ονόματα χωρών ξαναβγαίνουν στη νέα γλώσσα.
  const regionNames = useMemo(() => getDisplayNames().region, [t]);
  if (sessions.length === 0) return null;

  const unknownLocation = t('account.security.locationUnknown');
  return (
    <details className={cn(borders.radiusClass.md, layout.padding3, 'bg-muted/20')}>
      <summary className={cn(typography.body.sm, 'cursor-pointer font-medium')}>
        {t('account.security.endedSessionsTitle')}
        <span className={cn('ml-2', colors.text.muted)}>
          {t('account.security.endedSessionsWindow', { days: SESSION_HISTORY_WINDOW_DAYS, count: sessions.length })}
        </span>
      </summary>
      <ul className={cn(layout.flexColGap2, 'mt-3')} role="list" aria-label={t('account.security.endedSessionsTitle')}>
        {sessions.map((session) => (
          <li key={session.id} className={cn(layout.padding3, borders.radiusClass.md, 'opacity-80')}>
            <SessionDeviceSummary
              t={t}
              session={session}
              device={t('account.security.deviceLabel', { browser: session.browser, os: session.os })}
              locationLabel={sessionLocationLabel(session.location, regionNames, unknownLocation)}
              when={{
                at: session.endedAt,
                label: t('account.security.endedAt', {
                  reason: t(`account.security.endReason.${session.endReason}`),
                  when: formatRelativeTime(session.endedAt),
                }),
              }}
            />
          </li>
        ))}
      </ul>
    </details>
  );
}
