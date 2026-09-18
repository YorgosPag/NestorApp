'use client';

/**
 * @fileoverview **Ο τίτλος του φακέλου, μετονομάσιμος επιτόπου** (Figma/Notion: κλικ στον τίτλο).
 * @related ADR-866 Φ1.2 · Ε-Φ1.2-1 (§2.9.8 Δ1) · lib/property-dossier/property-dossier-form.ts
 * @module components/property-dossier/PropertyDossierTitle
 *
 * 🔑 **Ίδιος κριτής, ίδια πόρτα με τον διάλογο**: `validatePropertyDossierForm` (→ τα invariants της πόρτας) και
 * `updatePropertyDossierDetails`. Το είδος **μένει** ό,τι είναι — εδώ αλλάζει μόνο το όνομα· το είδος αλλάζει από τον
 * διάλογο «Μετονομασία».
 *
 * ⚠️ **Enter αποθηκεύει, Escape ακυρώνει, απώλεια εστίασης αποθηκεύει** (Figma/Notion). Άκυρο όνομα ⇒ το πεδίο
 * **μένει ανοιχτό** με τον λόγο — ποτέ σιωπηλή επαναφορά που θα έσβηνε ό,τι έγραψε ο άνθρωπος.
 */

import React from 'react';
import '@/lib/design-system';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { validatePropertyDossierForm } from '@/lib/property-dossier/property-dossier-form';
import { handleInlineRenameKey } from '@/lib/ui/inline-rename-keyboard';
import { updatePropertyDossierDetails } from '@/services/property-dossier/property-dossier.service';
import {
  PROPERTY_DOSSIER_LABEL_MAX,
  type PropertyDossier,
  type PropertyDossierInvariant,
} from '@/types/property-dossier';

const NS = 'property-market';
const K = `${NS}:dossier`;

type EditState =
  | { readonly kind: 'viewing' }
  | { readonly kind: 'editing'; readonly value: string; readonly problem: readonly PropertyDossierInvariant[] | 'failed' | null }
  | { readonly kind: 'saving'; readonly value: string };

/** Η αποθήκευση — ίδιο όνομα ⇒ απλώς κλείνει (καμία κλήση· η πόρτα θα απαντούσε «ήδη έτσι» ούτως ή άλλως). */
function useTitleEditor(dossier: PropertyDossier) {
  const [state, setState] = React.useState<EditState>({ kind: 'viewing' });
  // ⚠️ Το Enter απενεργοποιεί το πεδίο ⇒ ο browser στέλνει και `blur` ⇒ δεύτερη κλήση. Ο φρουρός την κόβει (η πόρτα
  //    θα την απαντούσε ιδεμπότητα, αλλά ένα αίτημα που δεν χρειάζεται δεν στέλνεται).
  const inFlight = React.useRef(false);

  const commit = async (value: string): Promise<void> => {
    if (inFlight.current) return;
    if (value.trim() === dossier.label) {
      setState({ kind: 'viewing' });
      return;
    }
    const validation = validatePropertyDossierForm({ label: value, type: dossier.type ?? '' });
    if (validation.kind !== 'ready') {
      setState({ kind: 'editing', value, problem: validation.violations });
      return;
    }
    inFlight.current = true;
    setState({ kind: 'saving', value });
    const result = await updatePropertyDossierDetails(dossier.id, validation.draft);
    inFlight.current = false;
    setState(result.kind === 'saved'
      ? { kind: 'viewing' }
      : { kind: 'editing', value, problem: result.kind === 'invalid' ? result.violations : 'failed' });
  };

  return { state, setState, commit };
}

function TitleProblem({ problem }: { readonly problem: readonly PropertyDossierInvariant[] | 'failed' | null }) {
  const { t } = useTranslation([NS]);
  if (problem === null) return null;
  const lines = problem === 'failed'
    ? [t(`${K}.dialog.failed`)]
    : problem.map((code) => t(`${K}.invariant.${code}`, { max: PROPERTY_DOSSIER_LABEL_MAX }));
  return <p aria-live="polite" className="m-0 text-sm text-foreground">{lines.join(' ')}</p>;
}

type TitleEditor = ReturnType<typeof useTitleEditor>;

/** Το πεδίο επεξεργασίας — Enter/απώλεια εστίασης αποθηκεύουν, Escape ακυρώνει. */
function TitleInput({ editor, state }: { readonly editor: TitleEditor; readonly state: Exclude<EditState, { kind: 'viewing' }> }) {
  const { t } = useTranslation([NS]);
  const inputId = React.useId();
  const { setState, commit } = editor;
  const value = state.value;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="sr-only">{t(`${K}.detail.renameLabel`)}</label>
      <input
        id={inputId}
        autoFocus
        value={value}
        disabled={state.kind === 'saving'}
        onChange={(event) => setState({ kind: 'editing', value: event.target.value, problem: null })}
        onBlur={() => void commit(value)}
        onKeyDown={(event) =>
          handleInlineRenameKey(event, {
            onConfirm: () => void commit(value),
            onCancel: () => setState({ kind: 'viewing' }),
          })
        }
        className="rounded-md border border-border bg-background px-2 py-1 text-2xl font-semibold text-foreground"
      />
      {state.kind === 'editing' && <TitleProblem problem={state.problem} />}
    </div>
  );
}

export function PropertyDossierTitle({ dossier }: { readonly dossier: PropertyDossier }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const editor = useTitleEditor(dossier);
  const { state, setState } = editor;

  if (state.kind === 'viewing') {
    return (
      <h1 className="m-0 text-2xl font-semibold text-foreground">
        <button
          type="button"
          onClick={() => setState({ kind: 'editing', value: dossier.label, problem: null })}
          aria-label={`${t(`${K}.detail.rename`)}: ${dossier.label}`}
          className="rounded-md text-left hover:bg-muted"
        >
          {dossier.label}
        </button>
      </h1>
    );
  }

  return <TitleInput editor={editor} state={state} />;
}
