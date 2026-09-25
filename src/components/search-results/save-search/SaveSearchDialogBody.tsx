'use client';

/**
 * Το σώμα του «Αποθήκευση αναζήτησης» (ADR-888) — φορτώνεται δυναμικά από το `SaveSearchButton`.
 *
 * 🔑 **ΤΑ ΙΔΙΑ πεδία και ο ΙΔΙΟΣ κριτής με τη φόρμα `/demands/new`**: `FormProvider` πάνω σε `DemandFormValues`
 * από την αντίστροφη προβολή (`demandFormFromListingFilters`) → `DemandTitleField` (ADR-886, ζωντανό αυτόματο
 * όνομα) → `validateDemandForm` → `createPersonalDemand`. Καμία δεύτερη επικύρωση, κανένας δεύτερος γραφέας.
 *
 * ⚠️ **Διάθεση που λείπει ρωτιέται ΕΔΩ** (`DemandSeeksField`): η αναζήτηση χωρίς «αγορά/ενοικίαση» δεν
 * μπορεί να γίνει ζήτηση (`seeks-empty`), και η μαντεψιά θα ειδοποιούσε για λάθος συναλλαγή.
 *
 * 🔒 **Ιδεμπότητα UI**: το κουμπί κλειδώνει όσο γράφει και η επιτυχία αντικαθιστά τη φόρμα — δεύτερο
 * κλικ δεν γεννά δεύτερη ζήτηση.
 */

import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useAuth } from '@/auth/hooks/useAuth';
import { DemandSeeksField } from '@/components/demand/form/DemandAxisFields';
import { DemandTitleField } from '@/components/demand/form/DemandTitleField';
import { useDemandFormText } from '@/components/demand/demand-form-labels';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { criterionLabel } from '@/lib/criteria/listing-criterion-labels';
import { demandFormFromListingFilters, type FiltersNotCarried } from '@/lib/demand/demand-form-from-filters';
import { validateDemandForm } from '@/lib/demand/demand-form-validation';
import type { DemandFormValues } from '@/lib/demand/demand-form-values';
import { SAVE_SEARCH_INTENT_PARAM, demandDetailHref, newDemandFromSearchHref } from '@/lib/demand/demand-routes';
import { formatList } from '@/lib/intl-formatting';
import { parseListingFilters } from '@/lib/listings/listing-filters';
import { loginHref } from '@/lib/routes/return-path';
import { Link, usePathname } from '@/lib/workspace/navigation';
import { createPersonalDemand } from '@/services/demand/property-demand.service';

const NS = 'property-market';
const K = `${NS}:demand.saveSearch`;
const NAMESPACES = [NS, 'search-filters', 'listing-detail'] as const;

export interface SaveSearchDialogBodyProps {
  /** Το query της αναζήτησης (χωρίς `save`) — η αυθεντία. */
  readonly searchQuery: string;
  readonly onClose: () => void;
}

type SaveState = { readonly kind: 'editing' | 'saving' | 'failed' } | { readonly kind: 'saved'; readonly id: string };

export function SaveSearchDialogBody({ searchQuery, onClose }: SaveSearchDialogBodyProps): React.ReactElement {
  const { user, loading } = useAuth();
  const initial = React.useMemo(
    () => demandFormFromListingFilters(parseListingFilters(new URLSearchParams(searchQuery))),
    [searchQuery],
  );

  return (
    <>
      <SaveSearchHeader />
      {/* Όσο φορτώνει η σύνδεση, ούτε «συνδεθείτε» (ψευδές για τον συνδεδεμένο) ούτε φόρμα. */}
      {loading ? null : user === null ? (
        <SaveSearchSignIn searchQuery={searchQuery} />
      ) : (
        <SaveSearchForm initial={initial} searchQuery={searchQuery} userId={user.uid} onClose={onClose} />
      )}
    </>
  );
}

/** Η περιγραφή· ο **τίτλος** ζει στατικά στο `SaveSearchButton` (Radix: τίτλος από το πρώτο καρέ). */
function SaveSearchHeader(): React.ReactElement {
  const { t } = useTranslation([NS]);
  return <DialogDescription>{t(`${K}.lead`)}</DialogDescription>;
}

/** Ανώνυμος: σύνδεση και επιστροφή στο **ίδιο** URL με το παράθυρο ανοιχτό. */
function SaveSearchSignIn({ searchQuery }: { readonly searchQuery: string }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const pathname = usePathname();
  const back = new URLSearchParams(searchQuery);
  back.set(SAVE_SEARCH_INTENT_PARAM, '1');
  return (
    <p className="text-sm text-foreground">
      {t(`${K}.signIn`)}{' '}
      <Link href={loginHref(`${pathname}?${back.toString()}`)} className="underline">
        {t(`${K}.signInLink`)}
      </Link>
    </p>
  );
}

interface SaveSearchFormProps {
  readonly initial: ReturnType<typeof demandFormFromListingFilters>;
  readonly searchQuery: string;
  readonly userId: string;
  readonly onClose: () => void;
}

function SaveSearchForm({ initial, searchQuery, userId, onClose }: SaveSearchFormProps): React.ReactElement {
  const text = useDemandFormText();
  const form = useForm<DemandFormValues>({ defaultValues: initial.values });
  const values = form.watch();
  const validation = React.useMemo(() => validateDemandForm(values), [values]);
  const [state, setState] = React.useState<SaveState>({ kind: 'editing' });
  const askSeeks = initial.values.seeks.length === 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (validation.kind !== 'ready' || state.kind === 'saving' || state.kind === 'saved') return;
    setState({ kind: 'saving' });
    const id = await createPersonalDemand(validation.draft, userId);
    setState(id === null ? { kind: 'failed' } : { kind: 'saved', id });
  }

  if (state.kind === 'saved') return <SaveSearchSaved id={state.id} onClose={onClose} />;

  const issues = validation.kind === 'ready' ? [] : [...validation.blockers, ...validation.violations];
  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {askSeeks && <DemandSeeksField />}
        <DemandTitleField />
        <NotCarriedNotice notCarried={initial.notCarried} />
        {issues.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
            {issues.map((issue) => (
              <li key={issue}>{text(issue)}</li>
            ))}
          </ul>
        )}
        {state.kind === 'failed' && (
          <p role="alert" className="text-sm text-destructive">
            {text('failed')}
          </p>
        )}
        <SaveSearchActions searchQuery={searchQuery} ready={validation.kind === 'ready'} saving={state.kind === 'saving'} />
      </form>
    </FormProvider>
  );
}

function SaveSearchActions({
  searchQuery,
  ready,
  saving,
}: {
  readonly searchQuery: string;
  readonly ready: boolean;
  readonly saving: boolean;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const text = useDemandFormText();
  return (
    <DialogFooter className="gap-2 sm:justify-between">
      <Button asChild variant="ghost" size="sm">
        <Link href={newDemandFromSearchHref(searchQuery)}>{t(`${K}.moreSettings`)}</Link>
      </Button>
      <Button type="submit" disabled={!ready || saving} aria-busy={saving}>
        {saving ? text('saving') : text('save')}
      </Button>
    </DialogFooter>
  );
}

/**
 * 🏆 **Η τίμια λογιστική**: τα κριτήρια της οθόνης που η αποθηκευμένη αναζήτηση **δεν** θα κρίνει. Οι
 * ετικέτες είναι **οι ίδιες** με της γραμμής φίλτρων (`criterionLabel`) — μία λέξη για το ίδιο πεδίο.
 */
function NotCarriedNotice({ notCarried }: { readonly notCarried: readonly FiltersNotCarried[] }): React.ReactElement | null {
  const { t } = useTranslation([...NAMESPACES]);
  if (notCarried.length === 0) return null;
  const labels = notCarried.map((key) => (key === 'region' ? t(`${K}.region`) : criterionLabel(t, key)));
  return <p className="text-sm text-muted-foreground">{t(`${K}.notCarried`, { list: formatList(labels) })}</p>;
}

function SaveSearchSaved({ id, onClose }: { readonly id: string; readonly onClose: () => void }): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <section className="space-y-4" aria-live="polite">
      <p className="text-sm text-foreground">{t(`${K}.saved`)}</p>
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t(`${K}.close`)}
        </Button>
        <Button asChild>
          <Link href={demandDetailHref(id)}>{t(`${K}.view`)}</Link>
        </Button>
      </DialogFooter>
    </section>
  );
}
