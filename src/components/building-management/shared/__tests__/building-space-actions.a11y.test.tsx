/**
 * @file ADR-898 §21.6 Ε10 · WCAG 4.1.2 — οι γραμμές ενεργειών των πινάκων κτιρίου.
 *
 * Τι κλειδώνει:
 * - Ο1: και τα τέσσερα κουμπιά (προβολή · επεξεργασία · αποσύνδεση · διαγραφή) έχουν όνομα από i18n κλειδί.
 * - Ο2: το όνομα **μένει** όσο τρέχει η αποσύνδεση/διαγραφή (ο Spinner δεν το σβήνει).
 * - Ο3: η γραμμή επεξεργασίας (αποθήκευση · ακύρωση) έχει όνομα· `canSave=false` κλειδώνει μόνο την αποθήκευση.
 * - Ο4: κανένα εύρημα axe.
 * - Κ1 (η ΚΛΑΣΗ): κανένα `<Button>`/`<ToggleButton>` με `size="icon"` στο `building-management`
 *   χωρίς ρητό όνομα — όποιος θέλει κουμπί-εικονίδιο περνά από το `IconButton`.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () =>
    jest
      .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
      .keyEchoTranslation(),
}));

import { expectNoA11yViolations } from '@/test-utils/a11y';
import { listRepoSourceFiles, readRepoCode } from '@/test-utils/read-source';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BuildingSpaceActions, BuildingSpaceEditActions } from '../BuildingSpaceActions';

const noop = (): void => undefined;

function wrap(ui: React.ReactElement): React.ReactElement {
  return <TooltipProvider>{ui}</TooltipProvider>;
}

describe('BuildingSpaceActions — προσβάσιμα ονόματα', () => {
  it('Ο1: κάθε κουμπί έχει όνομα από i18n κλειδί', () => {
    render(wrap(<BuildingSpaceActions onView={noop} onEdit={noop} onUnlink={noop} onDelete={noop} />));
    for (const key of ['view', 'edit', 'unlink', 'delete']) {
      expect(screen.getByRole('button', { name: `spaceActions.${key}` })).toBeEnabled();
    }
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('Ο1β: ομάδα με όνομα — ΟΧΙ landmark πλοήγησης ανά γραμμή πίνακα', () => {
    render(wrap(<BuildingSpaceActions onView={noop} />));
    expect(screen.getByRole('group', { name: 'spaceActions.actions' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('Ο2: το όνομα μένει όσο τρέχει η πράξη', () => {
    render(wrap(<BuildingSpaceActions onUnlink={noop} onDelete={noop} isUnlinking isDeleting />));
    expect(screen.getByRole('button', { name: 'spaceActions.unlink' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'spaceActions.delete' })).toBeDisabled();
  });

  it('Ο3: γραμμή επεξεργασίας — ονόματα, και canSave κλειδώνει μόνο την αποθήκευση', () => {
    render(wrap(<BuildingSpaceEditActions onSave={noop} onCancel={noop} saving={false} canSave={false} />));
    expect(screen.getByRole('button', { name: 'spaceActions.save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'spaceActions.cancel' })).toBeEnabled();
  });

  it('Ο3β: όσο αποθηκεύει, κλειδώνουν και τα δύο', () => {
    render(wrap(<BuildingSpaceEditActions onSave={noop} onCancel={noop} saving />));
    expect(screen.getByRole('button', { name: 'spaceActions.save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'spaceActions.cancel' })).toBeDisabled();
  });

  it('Ο4: κανένα εύρημα axe', async () => {
    await expectNoA11yViolations(
      wrap(
        <>
          <BuildingSpaceActions onView={noop} onEdit={noop} onUnlink={noop} onDelete={noop} />
          <BuildingSpaceEditActions onSave={noop} onCancel={noop} saving={false} />
        </>,
      ),
    );
  });
});

// ============================================================================
// Κ1 — η κλάση: ανώνυμο κουμπί-εικονίδιο δεν ξαναγράφεται σε αυτόν τον φάκελο
// ============================================================================

const SCOPE = 'src/components/building-management';
const ICON_SIZE = /size=(?:"icon(?:-sm)?"|\{'icon(?:-sm)?'\})/;
const NAMED = /aria-label(?:ledby)?=/;

/** Τα opening tags `<Button …>` / `<ToggleButton …>` ενός αρχείου, με ισορροπία αγκυλών JSX. */
function buttonOpeningTags(code: string): string[] {
  const tags: string[] = [];
  const opener = /<(?:Toggle)?Button\b/g;
  for (let match = opener.exec(code); match; match = opener.exec(code)) {
    let depth = 0;
    for (let i = match.index; i < code.length; i++) {
      const char = code[i];
      if (char === '{') depth++;
      else if (char === '}') depth--;
      else if (char === '>' && depth === 0 && code[i - 1] !== '=') {
        tags.push(code.slice(match.index, i + 1));
        break;
      }
    }
  }
  return tags;
}

function anonymousIconButtons(code: string): string[] {
  return buttonOpeningTags(code).filter((tag) => ICON_SIZE.test(tag) && !NAMED.test(tag));
}

describe('Κ1 — κουμπί-εικονίδιο χωρίς όνομα', () => {
  const files = listRepoSourceFiles(SCOPE, ['.tsx']).filter((file) => !file.includes('/__tests__/'));

  it('ο ανιχνευτής βλέπει αρχεία και πιάνει το σχήμα (όχι «0 = κανείς δεν κοίταξε»)', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(anonymousIconButtons('<Button variant="ghost" size="icon" onClick={() => go()}><X /></Button>')).toHaveLength(1);
    expect(anonymousIconButtons('<ToggleButton pressed={on} size="icon"><Map /></ToggleButton>')).toHaveLength(1);
    expect(anonymousIconButtons('<Button size="icon" aria-label={t(\'x\')}><X /></Button>')).toHaveLength(0);
    expect(anonymousIconButtons('<Button size="sm">Κείμενο</Button>')).toHaveLength(0);
  });

  it('κανένα στο building-management — χρησιμοποίησε το IconButton', () => {
    const offenders = files.flatMap((file) =>
      anonymousIconButtons(readRepoCode(file)).map((tag) => `${file}: ${tag.replace(/\s+/g, ' ').slice(0, 90)}`),
    );
    expect(offenders).toEqual([]);
  });
});
