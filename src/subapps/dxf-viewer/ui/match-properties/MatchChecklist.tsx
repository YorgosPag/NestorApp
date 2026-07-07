'use client';

/**
 * ADR-581 — Checklist των μεταφέρσιμων ρόλων, ομαδοποιημένο ανά κατηγορία.
 *
 * Κάθε κατηγορία = `<fieldset>` με master checkbox (επιλογή/αποεπιλογή όλης της
 * κατηγορίας) + ένα checkbox ανά πεδίο. Οι ετικέτες πεδίων είναι έτοιμα i18n keys
 * (`item.labelKey`), οι τίτλοι κατηγορίας `matchProperties.categories.*`.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { MatchGroup } from './match-dialog-model';
import type { SemanticRole } from '../../systems/match-properties';
import styles from './match-properties-dialog.module.css';

interface MatchChecklistProps {
  readonly groups: readonly MatchGroup[];
  readonly selectedRoles: ReadonlySet<SemanticRole>;
  readonly toggleRole: (role: SemanticRole) => void;
  readonly setCategoryRoles: (roles: readonly SemanticRole[], on: boolean) => void;
}

export const MatchChecklist: React.FC<MatchChecklistProps> = ({
  groups,
  selectedRoles,
  toggleRole,
  setCategoryRoles,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <section className={styles.checklist}>
      {groups.map((group) => (
        <MatchChecklistCategory
          key={String(group.category)}
          group={group}
          selectedRoles={selectedRoles}
          toggleRole={toggleRole}
          setCategoryRoles={setCategoryRoles}
          categoryTitle={t(`matchProperties.categories.${group.category}`)}
        />
      ))}
    </section>
  );
};

interface MatchChecklistCategoryProps {
  readonly group: MatchGroup;
  readonly selectedRoles: ReadonlySet<SemanticRole>;
  readonly toggleRole: (role: SemanticRole) => void;
  readonly setCategoryRoles: (roles: readonly SemanticRole[], on: boolean) => void;
  readonly categoryTitle: string;
}

const MatchChecklistCategory: React.FC<MatchChecklistCategoryProps> = ({
  group,
  selectedRoles,
  toggleRole,
  setCategoryRoles,
  categoryTitle,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');

  const roles = group.items.map((item) => item.role);
  const allChecked = roles.every((role) => selectedRoles.has(role));
  const someChecked = roles.some((role) => selectedRoles.has(role));

  const onToggleCategory = useCallback(() => {
    setCategoryRoles(roles, !allChecked);
  }, [setCategoryRoles, roles, allChecked]);

  return (
    <fieldset className={styles.category}>
      <legend className={styles.categoryHeader}>
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = someChecked && !allChecked;
          }}
          onChange={onToggleCategory}
          aria-label={categoryTitle}
        />
        <span className={styles.categoryTitle}>{categoryTitle}</span>
      </legend>
      <ul className={styles.items}>
        {group.items.map((item) => (
          <li key={String(item.role)}>
            <label className={styles.itemRow}>
              <input
                type="checkbox"
                checked={selectedRoles.has(item.role)}
                onChange={() => toggleRole(item.role)}
              />
              <span className={styles.itemLabel}>{t(item.labelKey)}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
};
