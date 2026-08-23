'use client';
import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { Calendar, ExternalLink } from 'lucide-react';
import { EscoOccupationPicker } from '@/components/shared/EscoOccupationPicker';
import { EscoSkillPicker } from '@/components/shared/EscoSkillPicker';
import type { EscoPickerValue, EscoSkillValue } from '@/types/contacts/esco-types';
import { EmployerPicker } from '@/components/shared/EmployerPicker';
import type { EmployerPickerValue } from '@/components/shared/EmployerPicker';
import { MinistryPicker } from '@/components/shared/MinistryPicker';
import { PublicServicePicker } from '@/components/contacts/pickers/PublicServicePicker';
import { ContactAddressMapPreview } from '@/components/contacts/details/ContactAddressMapPreview';
import type { RendererContext, CustomRendererField } from './contactRenderersCore';
import '@/lib/design-system';

type RendererFn = (
  field: CustomRendererField,
  fieldFormData: Record<string, unknown>,
  fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  fieldOnSelectChange: (name: string, value: string) => void,
  fieldDisabled: boolean,
) => React.ReactNode;

/**
 * Προσαρμογέας για renderer που χρειάζεται **ΜΟΝΟ** το `fieldDisabled`.
 *
 * Οι πέντε picker renderers αυτού του αρχείου (`profession` · `employer` ·
 * `skills` · `name` · `supervisionMinistry`) διαβάζουν το `formData` από το
 * closure τους και **αγνοούν τις τέσσερις πρώτες παραμέτρους** της
 * {@link RendererFn}. Μέχρι σήμερα καθένας ξανάγραφε ΟΛΟΚΛΗΡΗ την υπογραφή —
 * **έξι γραμμές × πέντε αντίγραφα** — που το CHECK 3.28 (jscpd, token-based)
 * μετρούσε ως πέντε κλώνους του ίδιου μπλοκ.
 *
 * ⚠️ **ΜΗΝ το κάνεις γενικό «προσαρμογέα με options»**: η μόνη παράμετρος που
 * καταναλώνεται πραγματικά είναι το `fieldDisabled`. Ένας προσαρμογέας που
 * δέχεται και τις πέντε θα ήταν η **ίδια boilerplate με άλλο όνομα** — δηλαδή
 * θα μετακινούσε τον κλώνο αντί να τον λύσει.
 *
 * ⚠️ Οι παράμετροι **δεν** φέρουν ρητούς τύπους: τους δίνει το contextual typing
 * από το `: RendererFn` της επιστροφής. Ρητή επανάληψή τους εδώ θα ξαναγεννούσε
 * ακριβώς το μπλοκ που αυτή η συνάρτηση υπάρχει για να εξαλείψει.
 */
const disabledOnly =
  (render: (fieldDisabled: boolean) => React.ReactNode): RendererFn =>
  (_field, _fieldFormData, _onChange, _onSelectChange, fieldDisabled) =>
    render(fieldDisabled);


/**
 * Build individual-specific renderers (profession, employer, skills, clientSince, address).
 */
export function buildIndividualRenderers(ctx: RendererContext): Record<string, RendererFn | (() => React.ReactNode)> {
  if (ctx.contactType !== 'individual') return {};

  const { formData, setFormData, t } = ctx;

  return {
    profession: disabledOnly((fieldDisabled) => (
      <EscoOccupationPicker
        value={formData.profession ?? ''}
        escoUri={formData.escoUri ?? undefined}
        iscoCode={formData.iscoCode ?? undefined}
        disabled={fieldDisabled}
        onChange={(escoValue: EscoPickerValue) => {
          if (setFormData) {
            setFormData({
              ...formData,
              profession: escoValue.profession,
              escoUri: escoValue.escoUri ?? '',
              escoLabel: escoValue.escoLabel ?? '',
              iscoCode: escoValue.iscoCode ?? '',
            });
          }
        }}
      />
    )),

    employer: disabledOnly((fieldDisabled) => (
      <EmployerPicker
        value={formData.employer ?? ''}
        employerId={formData.employerId ?? undefined}
        disabled={fieldDisabled}
        onChange={(empValue: EmployerPickerValue) => {
          if (setFormData) {
            setFormData({
              ...formData,
              employer: empValue.employer,
              employerId: empValue.employerId ?? '',
            });
          }
        }}
      />
    )),

    skills: disabledOnly((fieldDisabled) => (
      <EscoSkillPicker
        value={formData.escoSkills ?? []}
        disabled={fieldDisabled}
        onChange={(skills: EscoSkillValue[]) => {
          if (setFormData) setFormData({ ...formData, escoSkills: skills });
        }}
      />
    )),

    clientSince: () => {
      const rawValue = (formData as unknown as Record<string, unknown>).clientSince as string | null;
      const displayDate = rawValue
        ? new Date(rawValue).toLocaleDateString('el-GR', { year: 'numeric', month: 'long', day: 'numeric' })
        : t('persona.fields.clientSinceEmpty', 'Δεν έχει οριστεί');
      return (
        <section className="col-span-full space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium text-muted-foreground">
              {t('persona.fields.clientSince', 'Πελάτης από')}
            </label>
            <span className="text-sm font-semibold">{displayDate}</span>
          </div>
          <Link href="/sales/available-properties" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" />
            {t('persona.links.viewClientPurchases', 'Προβολή αγορών πελάτη')}
          </Link>
        </section>
      );
    },

  };
}

/**
 * Build service-specific renderers (name/PublicServicePicker, ministry, address).
 */
export function buildServiceRenderers(ctx: RendererContext): Record<string, RendererFn | (() => React.ReactNode)> {
  if (ctx.contactType !== 'service') return {};

  const { formData, setFormData } = ctx;

  return {
    name: disabledOnly((fieldDisabled) => (
      <PublicServicePicker
        value={(formData.name as string) ?? ''}
        disabled={fieldDisabled}
        onNameChange={(name: string) => { if (setFormData) setFormData({ ...formData, name }); }}
        onEntitySelected={(entity) => {
          if (setFormData) setFormData({ ...formData, name: entity.name, supervisionMinistry: entity.supervisingMinistry });
        }}
      />
    )),

    supervisionMinistry: disabledOnly((fieldDisabled) => (
      <MinistryPicker
        value={formData.supervisionMinistry ?? ''}
        disabled={fieldDisabled}
        onChange={(name: string) => { if (setFormData) setFormData({ ...formData, supervisionMinistry: name }); }}
      />
    )),
  };
}

/**
 * Build section footer renderers.
 */
export function buildSectionFooterRenderers(ctx: RendererContext): Record<string, () => React.ReactNode> {
  const { formData } = ctx;
  return {
    contact: () => (
      <ContactAddressMapPreview
        contactId={formData.id}
        street={formData.street}
        streetNumber={formData.streetNumber}
        city={formData.city}
        postalCode={formData.postalCode}
      />
    ),
  };
}
