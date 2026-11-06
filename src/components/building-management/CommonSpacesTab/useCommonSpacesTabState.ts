'use client';

/**
 * Κατάσταση της καρτέλας «Κοινόχρηστοι» (ADR-931).
 *
 * Η λίστα είναι **ζωντανή** (onSnapshot): μετά από αποθήκευση/κάδο δεν γίνεται refetch — το
 * snapshot φέρνει την αλλαγή. Ο διάλογος κρατά ένα πρόχειρο· η αποθήκευση περνά από την ΜΙΑ
 * πόρτα (`common-space-mutation-gateway`) με έλεγχο έκδοσης (`_v`, SPEC-256A) στην επεξεργασία.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useMutationFailureFeedback } from '@/hooks/useMutationFailureFeedback';
import { useFirestoreCommonSpaces } from '@/hooks/useFirestoreCommonSpaces';
import { useFirestoreProperties } from '@/hooks/useFirestoreProperties';
import { isRetired } from '@/lib/firestore/trashed-status';
import { getCurrentLocale } from '@/lib/intl-utils';
import { resolveDecimalSeparator } from '@/components/ui/numeric-field';
import { createCommonSpace, deleteCommonSpace, updateCommonSpace } from '@/services/common-space-mutation-gateway';
import type { CommonSpace } from '@/types/common-space';
import {
  EMPTY_COMMON_SPACE_DRAFT,
  draftFromCommonSpace,
  toCommonSpacePayload,
  validateCommonSpaceDraft,
  type CommonSpaceDraft,
  type CommonSpaceDraftError,
} from './common-space-draft';
import type { ExclusiveUseOption } from './CommonSpaceFormFields';

const KEY = 'tab';

/** `null` = κλειστός· `editing` απόν = δημιουργία. */
interface FormState {
  readonly editing: CommonSpace | null;
  readonly draft: CommonSpaceDraft;
  readonly error: CommonSpaceDraftError | null;
}

function usePropertyOptions(buildingId: string): readonly ExclusiveUseOption[] {
  const { properties } = useFirestoreProperties({ buildingId });
  return useMemo(
    () => properties
      .filter((property) => !isRetired(property))
      .map((property) => ({ id: property.id, label: property.code || property.name || property.id })),
    [properties],
  );
}

interface Feedback {
  readonly t: (key: string) => string;
  readonly success: (message: string) => void;
  readonly reportFailure: ReturnType<typeof useMutationFailureFeedback>;
}

/** Ο διάλογος: άνοιγμα, πρόχειρο, επικύρωση, αποθήκευση (με `_v` στην επεξεργασία). */
function useCommonSpaceForm(buildingId: string, { t, success, reportFailure }: Feedback) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = useCallback(() => setForm({ editing: null, draft: EMPTY_COMMON_SPACE_DRAFT, error: null }), []);
  const openEdit = useCallback((space: CommonSpace) => setForm({ editing: space, draft: draftFromCommonSpace(space, resolveDecimalSeparator(getCurrentLocale())), error: null }), []);
  const closeForm = useCallback(() => setForm(null), []);
  const changeDraft = useCallback((patch: Partial<CommonSpaceDraft>) =>
    setForm((current) => (current ? { ...current, draft: { ...current.draft, ...patch }, error: null } : current)), []);

  const submit = useCallback(async () => {
    if (!form || saving) return;
    const invalid = validateCommonSpaceDraft(form.draft);
    if (invalid) { setForm({ ...form, error: invalid }); return; }
    setSaving(true);
    try {
      const payload = toCommonSpacePayload(form.draft);
      if (form.editing) await updateCommonSpace(form.editing.id, payload, form.editing._v);
      else await createCommonSpace(buildingId, payload);
      success(t(form.editing ? `${KEY}.notifications.updated` : `${KEY}.notifications.created`));
      setForm(null);
    } catch (err) {
      reportFailure(err, form.editing ? 'update' : 'create', t(`${KEY}.notifications.failed`));
    } finally {
      setSaving(false);
    }
  }, [form, saving, buildingId, success, t, reportFailure]);

  return { form, saving, openCreate, openEdit, closeForm, changeDraft, submit };
}

/** Μεταφορά στον κάδο (ADR-281) με επιβεβαίωση. */
function useCommonSpaceDeletion({ t, success, reportFailure }: Feedback) {
  const [confirmDelete, setConfirmDelete] = useState<CommonSpace | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDeletion = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteCommonSpace(confirmDelete.id);
      success(t(`${KEY}.notifications.deleted`));
      setConfirmDelete(null);
    } catch (err) {
      reportFailure(err, 'delete', t(`${KEY}.notifications.failed`));
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete, success, t, reportFailure]);

  return { confirmDelete, setConfirmDelete, deleting, confirmDeletion };
}

export function useCommonSpacesTabState(buildingId: string) {
  const { t } = useTranslation('common-spaces');
  const { success } = useNotifications();
  const reportFailure = useMutationFailureFeedback('CommonSpacesTab');
  const feedback = useMemo<Feedback>(() => ({ t, success, reportFailure }), [t, success, reportFailure]);
  const { commonSpaces, loading, error } = useFirestoreCommonSpaces({ buildingId });
  const propertyOptions = usePropertyOptions(buildingId);

  return {
    t, commonSpaces, loading, error, propertyOptions,
    ...useCommonSpaceForm(buildingId, feedback),
    ...useCommonSpaceDeletion(feedback),
  };
}
