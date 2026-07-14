'use client';

/**
 * ADR-651 Φάση Θ — το state του διαλόγου **«Βιβλιοθήκη Προτύπων Πινακίδας»**.
 *
 * Τέσσερις ενέργειες, ακριβώς όσες ορίζει ο **Δρόμος 1** (ArchiCAD Master Layout / Revit):
 *
 *  - **Αποθήκευση** της ενεργής πινακίδας ως πρότυπο (γραφείου / έργου / δικό μου),
 *  - **Δημοσίευση** στο γραφείο — ΙΔΙΟ έγγραφο αλλάζει εμβέλεια, ποτέ αντίγραφο,
 *  - **Απόσπαση** παραλλαγής για ΑΥΤΟ το έργο (κρατά την προέλευση),
 *  - **Ενημέρωση από τον γονιό** — ρητό pull, μόνο όταν όντως άλλαξε ο γονιός.
 *
 * Δεν κρατά δική του λίστα: διαβάζει τον `title-block-library-store`, τον οποίο τρέφει
 * **ζωντανά** ο `TitleBlockLibraryHost` ⇒ μόλις ολοκληρωθεί μια εγγραφή, η λίστα ανανεώνεται
 * μόνη της από το Firestore snapshot (καμία χειροκίνητη ανανέωση, καμία δεύτερη πηγή).
 */

import * as React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getErrorMessage } from '@/lib/error-utils';
import { createTextTemplateLibraryService } from '../../../text-engine/templates/text-template-library.service';
import {
  findParentTemplate,
  isParentUpdateAvailable,
} from '../../../text-engine/templates/template-inheritance';
import type {
  TextTemplate,
  WritableTextTemplateScope,
} from '../../../text-engine/templates/template.types';
import { buildActiveTitleBlockSaveContent } from '../../../text-engine/title-block/active-title-block';
import {
  getTitleBlockLibraryVersion,
  listTitleBlockLibrary,
  subscribeTitleBlockLibrary,
} from '../../../text-engine/title-block/title-block-library-store';
import { toTitleBlockLocale } from '../../../text-engine/title-block/title-block-presets';
import { useTitleBlockOptionsStore } from '../../../state/title-block-options-store';

/** Μια γραμμή της βιβλιοθήκης, μαζί με ό,τι χρειάζεται το UI για να αποφασίσει τι δείχνει. */
export interface TitleBlockLibraryRow {
  readonly template: TextTemplate;
  /** Ο **άμεσος** γονιός (αν είναι αποσπασμένο) — βάθος 1, καμία αναδρομή. */
  readonly parent: TextTemplate | null;
  /** Ο γονιός άλλαξε **μετά** τον τελευταίο συγχρονισμό ⇒ προτείνουμε «Ενημέρωση». */
  readonly updateAvailable: boolean;
  /** Είναι το ενεργό πρότυπο του εργαλείου; */
  readonly isActive: boolean;
}

export interface UseTitleBlockLibraryResult {
  readonly rows: readonly TitleBlockLibraryRow[];
  readonly busy: boolean;
  readonly error: string | null;
  readonly canWrite: boolean;
  readonly hasProject: boolean;
  readonly saveActive: (name: string, scope: WritableTextTemplateScope) => Promise<void>;
  readonly publishToCompany: (template: TextTemplate) => Promise<void>;
  readonly detachToProject: (template: TextTemplate, name: string) => Promise<void>;
  readonly pull: (row: TitleBlockLibraryRow) => Promise<void>;
  readonly remove: (template: TextTemplate) => Promise<void>;
  /** Κάνει ένα πρότυπο **ενεργό** για την επόμενη τοποθέτηση (ίδιο κανάλι με το ribbon). */
  readonly activate: (template: TextTemplate) => void;
}

export function useTitleBlockLibrary(projectId?: string): UseTitleBlockLibraryResult {
  const { i18n } = useTranslation('dxf-viewer-shell');
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId;
  const userId = user?.uid;

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const libraryVersion = useSyncLibraryVersion();
  const activeId = useTitleBlockOptionsStore((s) => s.presetId);

  const service = React.useMemo(
    () =>
      companyId && userId
        ? createTextTemplateLibraryService({ companyId, userId, projectId })
        : null,
    [companyId, userId, projectId],
  );

  const rows = React.useMemo<readonly TitleBlockLibraryRow[]>(() => {
    const templates = listTitleBlockLibrary();
    return templates.map((template) => {
      const parent = findParentTemplate(template, templates);
      return {
        template,
        parent,
        updateAvailable: parent ? isParentUpdateAvailable(template, parent) : false,
        isActive: template.id === activeId,
      };
    });
    // `libraryVersion` είναι το gate του store (νέο snapshot ⇒ νέα λίστα).
  }, [libraryVersion, activeId]);

  /** Κάθε γραφή περνά από εδώ: ένα σημείο για busy/error — μηδέν επαναλήψεις try/catch. */
  const run = React.useCallback(
    async (operation: () => Promise<unknown>): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        await operation();
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const saveActive = React.useCallback(
    async (name: string, scope: WritableTextTemplateScope): Promise<void> => {
      if (!service) return;
      const { content, titleBlock } = buildActiveTitleBlockSaveContent(
        toTitleBlockLocale(i18n.language),
      );
      await run(() =>
        service.save({ name: name.trim(), category: 'title-block', content, titleBlock }),
      );
    },
    [service, run, i18n.language],
  );

  const publishToCompany = React.useCallback(
    async (template: TextTemplate): Promise<void> => {
      if (!service) return;
      await run(() => service.publish(template.id, 'company'));
    },
    [service, run],
  );

  const detachToProject = React.useCallback(
    async (template: TextTemplate, name: string): Promise<void> => {
      if (!service || !projectId) return;
      await run(() =>
        service.detach(template, { scope: 'project', projectId, name: name.trim() }),
      );
    },
    [service, run, projectId],
  );

  const pull = React.useCallback(
    async (row: TitleBlockLibraryRow): Promise<void> => {
      const parent = row.parent;
      if (!service || !parent) return;
      await run(() => service.pullFromParent(row.template, parent));
    },
    [service, run],
  );

  const remove = React.useCallback(
    async (template: TextTemplate): Promise<void> => {
      if (!service) return;
      await run(() => service.remove(template.id));
    },
    [service, run],
  );

  const activate = React.useCallback((template: TextTemplate): void => {
    useTitleBlockOptionsStore.getState().setPreset(template.id);
  }, []);

  return {
    rows,
    busy,
    error,
    canWrite: Boolean(service),
    hasProject: Boolean(projectId),
    saveActive,
    publishToCompany,
    detachToProject,
    pull,
    remove,
    activate,
  };
}

/** Low-freq store gate (η βιβλιοθήκη αλλάζει μόνο όταν κάποιος σώζει πρότυπο). */
function useSyncLibraryVersion(): number {
  return React.useSyncExternalStore(
    subscribeTitleBlockLibrary,
    getTitleBlockLibraryVersion,
    getTitleBlockLibraryVersion,
  );
}
