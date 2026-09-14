'use client';

/**
 * @fileoverview **ΤΑ ΔΟΜΙΚΑ ΠΕΔΙΑ ΤΗΣ ΦΟΡΜΑΣ ΤΟΥ Σ1** — ετικέτα, υπόδειξη, αμοιβή.
 * @related components/mandate/MandateRequestFormContent.tsx · ADR-827 §9.17
 * @module components/mandate/mandate-request-form-fields
 *
 * 🔑 **ΕΞΗΧΘΗΣΑΝ ΓΙΑΤΙ ΤΟ ΑΡΧΕΙΟ ΧΤΥΠΗΣΕ ΤΟ ΟΡΙΟ, ΚΑΙ ΤΟ ΟΡΙΟ ΕΧΕΙ ΔΙΚΙΟ** (N.7.1):
 * η προσθήκη των δύο πεδίων της κατάληψης (ADR-832 §5) έφερε το
 * `MandateRequestFormContent` στις **575** γραμμές. Το κόψιμο **δεν είναι αυθαίρετο**:
 * εδώ μένει ό,τι είναι **παρουσίαση πεδίου** και δεν ξέρει τίποτα για τη ροή —
 * καμία υποβολή, καμία έκβαση, κανένα `fetch`. Ό,τι έμεινε πίσω **ξέρει τη ροή**.
 *
 * ⛔ **ΜΗΝ φέρεις εδώ την επικύρωση.** Ο κριτής είναι το `mandate-request-form-values`
 * και ο διακομιστής· ένα τρίτο σημείο θα ήταν τρίτη απάντηση (ADR-749).
 */

import React from 'react';
import type { useForm } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormOptionsField } from '@/components/shared/forms/form-field-primitives';
import { isMandateOfferKind, mandateOfferKindsFor } from '@/constants/mandate-offer-kinds';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatList } from '@/lib/intl-formatting';
import type { MandateRequestFormValues } from '@/lib/mandate/mandate-request-form-values';
import type { OwnerProperty } from '@/types/owner-property';
import type { OfferKind } from '@/types/property-offers';

import { MANDATE_REQUEST_NS, SCREEN_KEYS } from './mandate-request-form-labels';
import { OFFER_KIND_I18N_KEYS } from './offer-kind-labels';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint !== undefined && <p className="m-0 text-xs text-muted-foreground">{hint}</p>}
    </section>
  );
}

/**
 * **Για ποιες πράξεις** — μόνο όσες ανατίθενται με μεσιτική εντολή **και** έχουν νόημα
 * στο είδος του επιλεγμένου ακινήτου (ADR-832 §8).
 *
 * 🔑 **Οι επιλογές παράγονται από δύο πίνακες, ποτέ από λίστα γραμμένη εδώ**:
 * `OFFER_KIND_ENGAGEMENT` (μεσιτεία ή διαχείριση) ∧ `OFFER_KIND_CLASSES` (είδος).
 *
 * ⚠️ **Αλλαγή ακινήτου ΚΛΑΔΕΥΕΙ ό,τι δεν ισχύει πια — δεν το κρύβει.** Μια τσεκαρισμένη
 * «Αντιπαροχή» που εξαφανίζεται όταν διαλέξεις διαμέρισμα δεν θα ξε-τσεκαριζόταν ποτέ,
 * και θα ταξίδευε αόρατη στο αίτημα. Το κλάδεμα **αφαιρεί** δικαίωμα, ποτέ δεν δίνει —
 * άρα δεν είναι σιωπηλή μαντεψιά.
 *
 * 🏆 **Και λέει ΤΙ έμεινε έξω και ΓΙΑΤΙ**: αν η αγγελία έχει βραχυχρόνια, ο ιδιοκτήτης
 * μαθαίνει ότι ανήκει σε σύμβαση διαχείρισης — αντί να αναρωτιέται πού πήγε η επιλογή.
 */
export function ScopeField({
  form,
  values,
  property,
}: {
  form: ReturnType<typeof useForm<MandateRequestFormValues>>;
  values: MandateRequestFormValues;
  property: OwnerProperty | null;
}): React.JSX.Element {
  const { t } = useTranslation([MANDATE_REQUEST_NS]);
  const propertyType = property?.type ?? null;
  const options = mandateOfferKindsFor(propertyType);

  React.useEffect(() => {
    // ⚠️ Οι επιλογές ξαναπαράγονται **μέσα** στο effect, από το είδος: ο πίνακας της
    //    απόδοσης έχει νέα ταυτότητα σε κάθε απόδοση και θα έτρεχε το effect άσκοπα.
    const allowed: readonly OfferKind[] = mandateOfferKindsFor(propertyType);
    const kept = values.scope.filter((kind) => allowed.includes(kind));
    if (kept.length !== values.scope.length) form.setValue('scope', kept);
  }, [form, propertyType, values.scope]);

  const managed = (property?.offers ?? [])
    .map((offer) => offer.kind)
    .filter((kind) => !isMandateOfferKind(kind));

  return (
    <Field label={t(SCREEN_KEYS.scopeLabel)} hint={t(SCREEN_KEYS.scopeHint)}>
      {/* 🔑 **Ο ΥΠΑΡΧΩΝ** πολλαπλός επιλογέας (Α9), ποτέ δεύτερος (CHECK 3.28). */}
      <FormOptionsField<MandateRequestFormValues, OfferKind>
        control={form.control}
        name="scope"
        mode="multiple"
        options={options}
        labelOf={(kind) => t(OFFER_KIND_I18N_KEYS[kind])}
      />
      {managed.length > 0 && (
        <p className="m-0 text-xs text-muted-foreground">
          {t(SCREEN_KEYS.scopeManagementNote, {
            kinds: formatList(managed.map((kind) => t(OFFER_KIND_I18N_KEYS[kind]))),
          })}
        </p>
      )}
    </Field>
  );
}

/** Η αμοιβή — διακριτή ένωση στην οθόνη, όπως και στον τύπο. */
export function CompensationField({
  form,
  values,
}: {
  form: ReturnType<typeof useForm<MandateRequestFormValues>>;
  values: MandateRequestFormValues;
}): React.JSX.Element {
  const { t } = useTranslation([MANDATE_REQUEST_NS]);
  const { compensation } = values;

  return (
    <Field label={t(SCREEN_KEYS.compensationLabel)} hint={t(SCREEN_KEYS.compensationHint)}>
      <Select
        value={compensation.type}
        onValueChange={(next) =>
          form.setValue(
            'compensation',
            // 🔑 Η αλλαγή σκέλους **ξαναχτίζει** το αντικείμενο, δεν το μπαλώνει: ένα
            //    `{...compensation, type: next}` θα κουβαλούσε `percentage` μέσα σε
            //    `fixed` — δηλαδή κατάσταση που ο τύπος δηλώνει **αδύνατη**.
            next === 'percentage'
              ? { type: 'percentage', percentage: 2, vatIncluded: compensation.vatIncluded }
              : { type: 'fixed', amountEUR: 0, vatIncluded: compensation.vatIncluded },
          )
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="percentage">{t(SCREEN_KEYS.compensationPercentage)}</SelectItem>
          <SelectItem value="fixed">{t(SCREEN_KEYS.compensationFixed)}</SelectItem>
        </SelectContent>
      </Select>

      <Label className="text-xs text-muted-foreground">
        {compensation.type === 'percentage'
          ? t(SCREEN_KEYS.percentageLabel)
          : t(SCREEN_KEYS.amountLabel)}
      </Label>
      <Input
        type="number"
        min={0}
        step={compensation.type === 'percentage' ? 0.1 : 1}
        value={compensation.type === 'percentage' ? compensation.percentage : compensation.amountEUR}
        onChange={(event) => {
          const amount = Number(event.target.value);
          form.setValue(
            'compensation',
            compensation.type === 'percentage'
              ? { ...compensation, percentage: amount }
              : { ...compensation, amountEUR: amount },
          );
        }}
      />

      <Label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={compensation.vatIncluded}
          onChange={(event) =>
            form.setValue('compensation', { ...compensation, vatIncluded: event.target.checked })
          }
        />
        {t(SCREEN_KEYS.vatLabel)}
      </Label>
    </Field>
  );
}
