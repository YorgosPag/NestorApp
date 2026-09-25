'use client';

/**
 * **Το όνομα της ζήτησης, μετονομάσιμο επιτόπου** — ο τίτλος της σελίδας λεπτομέρειας.
 *
 * @related ADR-886 · services/demand/property-demand.service.ts (`renameDemand`) · lib/demand/demand-title.ts
 * @module components/demand/DemandTitleEditor
 *
 * 🏆 Πρότυπο **Google Docs**: ο τίτλος **είναι** το πεδίο. Enter αποθηκεύει, Esc ακυρώνει· κενό ⇒
 * επιστροφή στο **αυτόματο** όνομα (που δεν παλιώνει ποτέ). Το Idealista σε στέλνει σε άλλη οθόνη για
 * να αλλάξεις ένα όνομα· εδώ αλλάζει εκεί που το διαβάζεις.
 *
 * 🔑 **ΑΙΣΙΟΔΟΞΟ, ΚΑΙ ΞΑΝΑΓΥΡΝΑ ΑΝ ΑΠΟΤΥΧΕΙ** (N.7): το νέο όνομα φαίνεται **αμέσως**· αν η εγγραφή
 * αποτύχει, επιστρέφει το προηγούμενο **και λέγεται** — ποτέ σιωπηλή απώλεια.
 *
 * ⚠️ **Καμία κούρσα**: κάθε αποθήκευση παίρνει αύξοντα αριθμό, και μόνο η **τελευταία** επιτρέπεται να
 * γράψει κατάσταση. Δύο γρήγορες μετονομασίες με την πρώτη να απαντά αργότερα δεν μπορούν να αφήσουν
 * στην οθόνη το **πρώτο** όνομα.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { handleInlineRenameKey } from '@/lib/ui/inline-rename-keyboard';
import { useDemandName } from '@/hooks/demand/useDemandName';
import { DEMAND_TITLE_MAX_LENGTH, normalizeDemandLabel } from '@/lib/demand/demand-title';
import { renameDemand } from '@/services/demand/property-demand.service';
import type { PropertyDemand } from '@/types/property-demand';

const K = 'property-market:demand.rename';

/** Η εκκρεμής (αισιόδοξη) τιμή — `null` = καμία· `{ title: null }` = «πίσω στο αυτόματο». */
type Pending = { readonly title: string | null } | null;

/** Αισιόδοξη μετονομασία με επαναφορά — η λογική χωρίς τη διάταξη. */
function useOptimisticRename(demandId: string) {
  const [pending, setPending] = React.useState<Pending>(null);
  const [failed, setFailed] = React.useState(false);
  const sequence = React.useRef(0);

  const rename = React.useCallback(
    async (raw: string | null) => {
      const title = normalizeDemandLabel(raw);
      const mine = ++sequence.current;
      setPending({ title });
      setFailed(false);
      const outcome = await renameDemand(demandId, title);
      if (mine !== sequence.current) return; // νεότερη μετονομασία κατέχει πλέον την οθόνη
      // Επιτυχία ⇒ ο realtime αναγνώστης φέρνει ήδη το νέο όνομα· αποτυχία ⇒ πίσω στο αποθηκευμένο.
      setPending(null);
      setFailed(outcome.kind !== 'done');
    },
    [demandId],
  );

  return { pending, failed, rename };
}

/** Η προβολή: το όνομα ως `h1`, το κουμπί μετονομασίας, και γιατί είναι «αυτόματο» όταν είναι. */
function TitleView({
  shown,
  isAuto,
  failed,
  onEdit,
}: {
  shown: string;
  isAuto: boolean;
  failed: boolean;
  onEdit: () => void;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    <header className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold text-foreground">{shown}</h1>
        <button type="button" onClick={onEdit} className="text-sm font-medium text-foreground underline">
          {t(`${K}.action`)}
        </button>
      </div>
      {isAuto && <p className="text-sm text-muted-foreground">{t('property-market:demand.name.autoNote')}</p>}
      {failed && <p className="text-sm text-foreground">{t(`${K}.failed`)}</p>}
    </header>
  );
}

/** Η φόρμα: Enter αποθηκεύει, Esc ακυρώνει· placeholder = το **ζωντανό** αυτόματο όνομα. */
function TitleForm({
  initial,
  placeholder,
  canUseAuto,
  onCommit,
  onCancel,
}: {
  initial: string;
  placeholder: string;
  canUseAuto: boolean;
  onCommit: (value: string | null) => void;
  onCancel: () => void;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const [draft, setDraft] = React.useState(initial);
  const inputId = React.useId();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onCommit(draft);
      }}
    >
      <label htmlFor={inputId} className="text-sm text-muted-foreground">
        {t(`${K}.inputLabel`)}
      </label>
      <input
        id={inputId}
        autoFocus
        value={draft}
        maxLength={DEMAND_TITLE_MAX_LENGTH}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) =>
          handleInlineRenameKey(event, { onConfirm: () => onCommit(draft), onCancel })
        }
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xl font-semibold text-foreground placeholder:text-muted-foreground"
      />
      <p className="text-xs text-muted-foreground">{t(`${K}.tooLong`, { max: DEMAND_TITLE_MAX_LENGTH })}</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground">
          {t(`${K}.save`)}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-foreground">
          {t(`${K}.cancel`)}
        </button>
        {canUseAuto && (
          <button type="button" onClick={() => onCommit(null)} className="rounded-md px-3 py-1.5 text-sm text-foreground underline">
            {t(`${K}.useAuto`)}
          </button>
        )}
      </div>
    </form>
  );
}

export function DemandTitleEditor({ demand }: { demand: PropertyDemand }): React.ReactElement {
  const { autoName, displayName } = useDemandName();
  const { pending, failed, rename } = useOptimisticRename(demand.id);
  const [editing, setEditing] = React.useState(false);

  const title = pending === null ? demand.title : pending.title;

  function commit(value: string | null): void {
    setEditing(false);
    if (normalizeDemandLabel(value) !== normalizeDemandLabel(title)) void rename(value);
  }

  return editing ? (
    <TitleForm
      initial={title ?? ''}
      placeholder={autoName(demand)}
      canUseAuto={title !== null}
      onCommit={commit}
      onCancel={() => setEditing(false)}
    />
  ) : (
    <TitleView
      shown={displayName({ ...demand, title })}
      isAuto={title === null}
      failed={failed}
      onEdit={() => setEditing(true)}
    />
  );
}
