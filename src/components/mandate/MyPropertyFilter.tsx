'use client';

/**
 * @fileoverview **«ΤΟ ΑΚΙΝΗΤΟ ΜΟΥ»** — ο συνδεδεμένος κάτοχος διαλέγει ακίνητο ⇒ ο κατάλογος φιλτράρεται στην περιοχή του
 *   (ADR-896 §7.2).
 * @related lib/agency/owner-property-where.ts (ο κριτής) · AgencyDirectoryFilters (`WhereControl`)
 * @module components/mandate/MyPropertyFilter
 *
 * 🔑 **ΤΡΙΤΗ ΠΗΓΗ ΤΟΥ ΙΔΙΟΥ ΑΞΟΝΑ, ΟΧΙ ΝΕΟ ΦΙΛΤΡΟ**: γράφει στο **ίδιο** `where` με τον επιλογέα περιοχής και το κλικ
 * στον χάρτη — άρα ο επιλογέας δείχνει αμέσως την περιοχή, το σημάδι αφαίρεσης δουλεύει, και ο χάρτης ζωγραφίζει το
 * όριο. Δύο πεδία θα ήταν «δύο αλήθειες για το πού ψάχνεις».
 *
 * 🔒 **Η θέση του ακινήτου δεν φεύγει ποτέ από τη μνήμη της σελίδας**: στη διεύθυνση γράφεται μόνο η **ταυτότητα
 * περιοχής** — ο σύνδεσμος που μοιράζεται ο άνθρωπος δεν προδίδει το σπίτι του.
 *
 * ⚡ Ανώνυμος επισκέπτης ⇒ **κανένας** listener (`useMyOwnerProperties(null)` = `anonymous`) και σιωπή. Κάτοχος χωρίς
 * ακίνητα ⇒ σιωπή. Ακίνητο χωρίς αποδείξιμη περιοχή ⇒ **απενεργοποιημένη** επιλογή με τον λόγο — ποτέ εξαφάνιση.
 */

import React, { useMemo } from 'react';

import { useAuthOptional } from '@/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminFootprints } from '@/hooks/useAdminFootprints';
import { lineageIdsOf, useAdministrativeHierarchy } from '@/hooks/useAdministrativeHierarchy';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ownerPropertyWhere } from '@/lib/agency/owner-property-where';
import { useMyOwnerProperties } from '@/services/realtime/hooks/useMyOwnerProperties';
import { isAdministrativeWhere, type ShowcaseWhere } from '@/types/agency-coverage';

import { AGENCY_PUBLIC_NS, DIRECTORY_MY_PROPERTY_KEYS } from './agency-directory-labels';

interface PropertyChoice {
  readonly id: string;
  readonly title: string;
  readonly where: ShowcaseWhere | null;
  readonly declared: boolean;
}

/** Τα ακίνητα του κατόχου ως επιλογές — η περιοχή μετριέται **εδώ, μία φορά** ανά αλλαγή δεδομένων. */
function usePropertyChoices(): readonly PropertyChoice[] {
  // Δημόσια επιφάνεια: χωρίς provider (ή χωρίς σύνδεση) ⇒ ανώνυμος ⇒ κανένας listener.
  const state = useMyOwnerProperties(useAuthOptional()?.user?.uid ?? null);
  const { entries } = useAdminFootprints();
  // `findById` ΣΤΙΣ ΕΞΑΡΤΗΣΕΙΣ: το `lineageIdsOf` είναι module-level και δεν αλλάζει όταν φτάνει η ιεραρχία (§6.2).
  const { findById } = useAdministrativeHierarchy();

  return useMemo(() => {
    if (state.state !== 'ready') return [];
    return state.properties.map((property) => ({
      id: property.id,
      title: property.title,
      where: ownerPropertyWhere(property.place, entries, lineageIdsOf),
      declared: property.place.kind === 'declared',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `findById` = σήμα «έφτασε η ιεραρχία» (βλ. πάνω)
  }, [state, entries, findById]);
}

export interface MyPropertyFilterProps {
  readonly where: ShowcaseWhere | null;
  readonly onPick: (where: ShowcaseWhere) => void;
}

export function MyPropertyFilter({ where, onPick }: MyPropertyFilterProps): React.ReactElement | null {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const choices = usePropertyChoices();
  const fieldId = React.useId();
  if (choices.length === 0) return null;

  // Η επιλογή **παράγεται** από το φίλτρο — καμία δεύτερη κατάσταση που θα μπορούσε να μείνει πίσω.
  const activeAdminId = where !== null && isAdministrativeWhere(where) ? where.adminId : null;
  const active = choices.find((choice) => choice.where !== null && isAdministrativeWhere(choice.where) && choice.where.adminId === activeAdminId);

  return (
    <div className="flex min-w-field max-w-72 flex-col gap-1 text-sm">
      <label htmlFor={fieldId} className="font-medium text-foreground">
        {t(DIRECTORY_MY_PROPERTY_KEYS.label)}
      </label>
      <Select
        value={active?.id}
        onValueChange={(id) => {
          const chosen = choices.find((choice) => choice.id === id);
          if (chosen?.where) onPick(chosen.where);
        }}
      >
        {/* `size="md"` (36px): το ίδιο ύψος με το πεδίο «Περιοχή» δίπλα — ίδια σειρά, ίδια γραμμή βάσης. */}
        <SelectTrigger id={fieldId} size="md" className="min-w-56">
          <SelectValue placeholder={t(DIRECTORY_MY_PROPERTY_KEYS.placeholder)} />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.id} value={choice.id} disabled={choice.where === null}>
              {choice.where !== null
                ? choice.title
                : `${choice.title} · ${t(choice.declared ? DIRECTORY_MY_PROPERTY_KEYS.noArea : DIRECTORY_MY_PROPERTY_KEYS.noPlace)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
