/**
 * Κλείδωμα του ΕΝΟΣ συμβολαίου κλήσης για renderer ενότητας (ADR-867 changelog 2026-09-22).
 *
 * ΤΙ ΠΡΟΣΤΑΤΕΥΕΙ: ο χάρτης `customRenderers` είναι ένας χώρος ονομάτων για πεδία ΚΑΙ ενότητες — το
 * `communication` είναι πεδίο (φυσικό πρόσωπο) και ενότητα (εταιρεία/υπηρεσία). Οι tab renderers καλούσαν
 * την ενότητα με `renderer()` χωρίς ορίσματα. Όταν ο `pickerRenderer` άρχισε να διαβάζει `field.id`, ΚΑΘΕ
 * επαφή-εταιρεία έριχνε ολόκληρη τη σελίδα Επαφών (`Cannot read properties of undefined (reading 'id')`),
 * μετρημένο ζωντανά στο nestorconstruct.gr. Ο renderer εδώ διαβάζει `field.id` ΑΚΡΙΒΩΣ όπως ο `pickerRenderer`.
 *
 * Τρέχει τους ΠΡΑΓΜΑΤΙΚΟΥΣ `GenericFormTabRenderer` και `ServiceFormTabRenderer`· μόνο τα φύλλα (κέλυφος
 * καρτελών, renderer πεδίων, εικονίδια, i18n) αντικαθίστανται.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { ContactFormData } from '@/types/ContactFormTypes';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/lib/design-system', () => ({}));
jest.mock('../utils/IconMapping', () => ({ getIconComponent: () => null }));
jest.mock('../GenericFormRenderer', () => ({ GenericFormRenderer: () => null }));
jest.mock('../ServiceFormRenderer', () => ({ ServiceFormRenderer: () => null }));
jest.mock('@/components/ui/form/FormComponents', () => ({
  FormGrid: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/MultiplePhotosUpload', () => ({ MultiplePhotosUpload: () => null }));
// Το κέλυφος αποδίδει ΟΛΑ τα περιεχόμενα — ο έλεγχος αφορά την κλήση του renderer, όχι τις καρτέλες.
jest.mock('@/components/ui/navigation/state-tabs', () => ({
  StateTabs: ({ tabs }: { tabs: Array<{ id: string; content: React.ReactNode }> }) => (
    <>{tabs.map((tab) => <section key={tab.id}>{tab.content}</section>)}</>
  ),
}));
jest.mock('@/components/ui/tabs', () => ({ TabsContent: () => null }));

import { GenericFormTabRenderer } from '../GenericFormTabRenderer';
import { ServiceFormTabRenderer } from '../ServiceFormTabRenderer';
import type { TabCustomFieldData } from '../form-tabs-shell';

const SECTION = { id: 'communication', title: 'communication', icon: 'phone', fields: [] };
const noop = () => undefined;
const base = { formData: {} as ContactFormData, onChange: noop, onSelectChange: noop, disabled: true };

/** Ίδια μορφή με τον `pickerRenderer`: διαβάζει `field.id` και το πέμπτο όρισμα. */
const fieldAware = (field: TabCustomFieldData, _f: unknown, _c: unknown, _s: unknown, disabled: boolean) => (
  <p data-testid="picker">{`${String(field.id)}|${field.name}|${String(disabled)}`}</p>
);
const parameterless = () => <p data-testid="plain">plain</p>;

describe.each([
  ['GenericFormTabRenderer (εταιρεία)', GenericFormTabRenderer],
  ['ServiceFormTabRenderer (υπηρεσία)', ServiceFormTabRenderer],
] as const)('%s — renderer ενότητας με το συμβόλαιο πεδίου', (_label, Renderer) => {
  it('ο renderer που διαβάζει field.id ΔΕΝ ρίχνει τη σελίδα και παίρνει την ενότητα ως πεδίο', () => {
    render(<Renderer {...base} sections={[SECTION]} customRenderers={{ communication: fieldAware }} />);
    expect(screen.getByTestId('picker').textContent).toBe('communication|communication|true');
  });

  it('ο renderer χωρίς παραμέτρους εξακολουθεί να αποδίδεται', () => {
    render(<Renderer {...base} sections={[SECTION]} customRenderers={{ communication: parameterless }} />);
    expect(screen.getByTestId('plain')).toBeTruthy();
  });
});

describe('GenericFormTabRenderer — υποσέλιδο ενότητας', () => {
  it('το υποσέλιδο καλείται κι αυτό με το συμβόλαιο πεδίου', () => {
    render(
      <GenericFormTabRenderer
        {...base}
        sections={[SECTION]}
        customRenderers={{ communication: parameterless }}
        sectionFooterRenderers={{ communication: fieldAware }}
      />,
    );
    expect(screen.getByTestId('picker').textContent).toBe('communication|communication|true');
  });
});
