'use client';

/**
 * Πλοήγηση στις ενότητες της φόρμας, με το πλήθος ευρημάτων καθεμιάς (ADR-928 Φ3γ-2 απόφαση 9). Όπως ο πίνακας
 * περιεχομένων του Ironclad: το «3 ευρήματα» της εργαλειοθήκης γίνεται «Γραμμές · 2», «Σχέδιο πληρωμών · 1», με σύνδεσμο.
 *
 * 🔑 Το πλήθος είναι λέξη + αριθμός (όχι μόνο κόκκινη τελεία, ADR-771), και μετρά τα **ορατά** ευρήματα: ανέγγιχτη φόρμα
 *    δεν κοκκινίζει, ούτε εδώ.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { EDITOR_SECTIONS, issueCountsBySection } from './editor-sections';

export function EditorSectionNav({ issues }: { readonly issues: readonly SubcontractIssue[] }) {
  const { t } = useTranslation('procurement');
  const counts = issueCountsBySection(issues);
  return (
    <nav aria-label={t('subcontracts.sections.nav.label')}>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {EDITOR_SECTIONS.map((section) => (
          <li key={section}>
            <a href={`#editor-${section}`} className="underline-offset-2 hover:underline">
              {t(`subcontracts.sections.nav.${section}`)}
              {counts[section] > 0 && <span className="ml-1 text-destructive">· {t('subcontracts.sections.issueCount', { count: counts[section] })}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
