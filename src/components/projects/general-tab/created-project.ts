/**
 * **ΤΟ ΕΡΓΟ ΠΟΥ ΜΟΛΙΣ ΓΕΝΝΗΘΗΚΕ, ΟΠΩΣ ΤΟ ΞΕΡΕΙ Η ΦΟΡΜΑ** — «Fill then Create» (ADR-742).
 *
 * 🔴 Ως τις 2026-10-04 η σελίδα κρατούσε το πρόχειρο και άλλαζε **μόνο** την ταυτότητα
 * (`{ ...selectedProject, id }`). Το πρόχειρο όμως έχει `name: ''` και `company: ''` ⇒ ο
 * breadcrumb έπεφτε στο ωμό `cont_…` και η φόρμα, μόλις ξαναστηνόταν, άδειαζε ως την ενυδάτωση.
 *
 * 🔑 Η φόρμα **ξέρει ήδη** ό,τι έγραψε ο άνθρωπος — και το όνομα της εταιρείας, από τις επιλογές
 * του πεδίου. Το παραδίδει μαζί με την ταυτότητα· η ενυδάτωση (`useProjectDetail`) παραμένει η
 * αυθεντία και το αντικαθιστά μόλις φτάσει.
 *
 * @module components/projects/general-tab/created-project
 */

import type { Project } from '@/types/project';
import type { ProjectFormData } from './types';

/** Ό,τι γνωρίζει η φόρμα για το νέο έργο — υποσύνολο του `Project`, ποτέ ταυτότητα. */
export type CreatedProjectFields = Partial<Omit<Project, 'id'>>;

/** Η εταιρεία που επέλεξε ο άνθρωπος — το όνομα από τις επιλογές του πεδίου, `''` αν άγνωστο. */
export interface CreatedProjectCompany {
  readonly id: string;
  readonly name: string;
}

/** Το `''` της φόρμας σημαίνει «δεν δηλώθηκε» — δεν γίνεται τιμή του έργου. */
function declared<T>(value: T | ''): T | undefined {
  return value === '' ? undefined : value;
}

/** Ο αντίστροφος χάρτης του `projectFormValuesFrom`: φόρμα → πεδία έργου. */
export function createdProjectFields(
  form: ProjectFormData,
  company: CreatedProjectCompany,
): CreatedProjectFields {
  const fields: CreatedProjectFields = {
    name: form.name.trim(),
    title: form.licenseTitle,
    description: form.description,
    buildingBlock: form.buildingBlock,
    protocolNumber: form.protocolNumber,
    licenseNumber: form.licenseNumber,
    issuingAuthority: form.issuingAuthority,
    issueDate: form.issueDate,
    status: declared(form.status),
    type: declared(form.type),
    priority: declared(form.priority),
    riskLevel: declared(form.riskLevel),
    complexity: declared(form.complexity),
    budget: declared(form.budget),
    totalValue: declared(form.totalValue),
    totalArea: declared(form.totalArea),
    duration: declared(form.duration),
    startDate: form.startDate,
    completionDate: form.completionDate,
    client: form.client,
    location: form.location,
    linkedCompanyId: company.id,
    company: company.name,
  };
  // Απόν ≠ `undefined`: το `{ ...draft, ...fields }` της σελίδας δεν πρέπει να σβήσει τιμή του πρόχειρου.
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as CreatedProjectFields;
}
