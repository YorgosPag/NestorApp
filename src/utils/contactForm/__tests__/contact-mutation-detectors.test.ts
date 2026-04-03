import { initialFormData, type ContactFormData } from '@/types/ContactFormTypes';
import type { CompanyContact, IndividualContact, ServiceContact } from '@/types/contacts';
import { detectCompanyIdentityChanges } from '../company-identity-guard';
import { detectIndividualIdentityChanges } from '../individual-identity-guard';
import { detectServiceIdentityChanges } from '../service-identity-guard';

const NOW = new Date('2026-04-02T00:00:00.000Z');

function makeBaseFields() {
  return {
    isFavorite: false,
    status: 'active' as const,
    createdAt: NOW,
    updatedAt: NOW,
    customFields: {},
  };
}

function makeIndividualContact(overrides: Partial<IndividualContact> = {}): IndividualContact {
  return {
    ...makeBaseFields(),
    id: 'ind_001',
    type: 'individual',
    firstName: 'Maria',
    lastName: 'Papadopoulou',
    fatherName: 'Giorgos',
    motherName: 'Eleni',
    birthDate: '1990-05-10',
    birthCountry: 'GR',
    gender: 'female',
    amka: '12345678901',
    documentType: 'identity_card',
    documentIssuer: 'Athens Police',
    documentNumber: 'AB123456',
    documentIssueDate: '2015-01-01',
    documentExpiryDate: '2030-01-01',
    vatNumber: '012345678',
    taxOffice: 'Athens',
    ...overrides,
  };
}

function makeCompanyContact(overrides: Partial<CompanyContact> = {}): CompanyContact {
  return {
    ...makeBaseFields(),
    id: 'cmp_001',
    type: 'company',
    companyName: 'Acme SA',
    vatNumber: '099999999',
    registrationNumber: '123456789000',
    taxOffice: 'Athens FAE',
    legalForm: 'ΑΕ',
    tradeName: 'Acme',
    customFields: { gemiStatus: 'active' },
    ...overrides,
  };
}

function makeServiceContact(overrides: Partial<ServiceContact> = {}): ServiceContact {
  return {
    ...makeBaseFields(),
    id: 'srv_001',
    type: 'service',
    serviceName: 'KEP Athens',
    serviceType: 'municipality',
    serviceCode: 'KEP-01',
    responsibleMinistry: 'Interior',
    customFields: { legalStatus: 'Public Law', category: 'Citizen Service', shortName: 'KEP', serviceCode: 'KEP-01' },
    ...overrides,
  };
}

function makeFormData(overrides: Partial<ContactFormData> = {}): ContactFormData {
  return {
    ...initialFormData,
    ...overrides,
  };
}

describe('contact mutation detectors', () => {
  describe('detectIndividualIdentityChanges', () => {
    it('classifies display and regulated changes correctly', () => {
      const contact = makeIndividualContact();
      const formData = makeFormData({
        type: 'individual',
        firstName: 'Marina',
        lastName: 'Papadopoulou',
        fatherName: 'Giorgos',
        motherName: 'Eleni',
        birthDate: '1990-05-10',
        birthCountry: 'GR',
        gender: 'female',
        amka: '10987654321',
        documentType: 'identity_card',
        documentIssuer: 'Athens Police',
        documentNumber: 'AB123456',
        documentIssueDate: '2015-01-01',
        documentExpiryDate: '2030-01-01',
      });

      const result = detectIndividualIdentityChanges(contact, formData);

      expect(result.hasChanges).toBe(true);
      expect(result.requiresImpactPreview).toBe(true);
      expect(result.changedFields).toEqual(['firstName', 'amka']);
      expect(result.changes).toEqual([
        expect.objectContaining({ field: 'firstName', category: 'display', oldValue: 'Maria', newValue: 'Marina', isCleared: false }),
        expect.objectContaining({ field: 'amka', category: 'regulated', oldValue: '12345678901', newValue: '10987654321', isCleared: false }),
      ]);
    });

    it('returns no changes for mismatched contact/form types', () => {
      const contact = makeIndividualContact();
      const formData = makeFormData({ type: 'company', companyName: 'Other Co' });

      const result = detectIndividualIdentityChanges(contact, formData);

      expect(result).toEqual({
        changes: [],
        changedFields: [],
        hasChanges: false,
        requiresImpactPreview: false,
      });
    });
  });

  describe('detectCompanyIdentityChanges', () => {
    it('blocks unsafe clears for category A/B fields', () => {
      const contact = makeCompanyContact();
      const formData = makeFormData({
        type: 'company',
        companyName: 'Acme SA',
        companyVatNumber: '',
        vatNumber: '',
        gemiNumber: '123456789000',
        taxOffice: 'Athens FAE',
        legalForm: 'ΑΕ',
        tradeName: 'Acme',
        gemiStatus: 'active',
      });

      const result = detectCompanyIdentityChanges(contact, formData);

      expect(result.hasChanges).toBe(true);
      expect(result.hasUnsafeClear).toBe(true);
      expect(result.unsafeClearFields).toEqual(['vatNumber']);
      expect(result.requiresImpactPreview).toBe(false);
    });

    it('treats category C display changes as non-preview changes', () => {
      const contact = makeCompanyContact();
      const formData = makeFormData({
        type: 'company',
        companyName: 'Acme SA',
        companyVatNumber: '099999999',
        vatNumber: '099999999',
        gemiNumber: '123456789000',
        taxOffice: 'Athens FAE',
        legalForm: 'ΑΕ',
        tradeName: 'Acme Holdings',
        gemiStatus: 'active',
      });

      const result = detectCompanyIdentityChanges(contact, formData);

      expect(result.hasChanges).toBe(true);
      expect(result.hasUnsafeClear).toBe(false);
      expect(result.requiresImpactPreview).toBe(false);
      expect(result.changes).toEqual([
        expect.objectContaining({ field: 'tradeName', category: 'C', oldValue: 'Acme', newValue: 'Acme Holdings' }),
      ]);
    });
  });

  describe('detectServiceIdentityChanges', () => {
    it('detects display and administrative changes', () => {
      const contact = makeServiceContact();
      const formData = makeFormData({
        type: 'service',
        serviceName: 'KEP Athens Central',
        shortName: 'KEP ATH',
        serviceType: 'municipality',
        serviceCode: 'KEP-02',
        category: 'Citizen Service',
        supervisionMinistry: 'Interior',
        legalStatus: 'Public Law',
      });

      const result = detectServiceIdentityChanges(contact, formData);

      expect(result.hasChanges).toBe(true);
      expect(result.requiresImpactPreview).toBe(true);
      expect(result.changes).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'serviceName', category: 'display', oldValue: 'KEP Athens', newValue: 'KEP Athens Central' }),
        expect.objectContaining({ field: 'shortName', category: 'display', oldValue: '', newValue: 'KEP ATH' }),
        expect.objectContaining({ field: 'serviceCode', category: 'administrative', oldValue: 'KEP-01', newValue: 'KEP-02' }),
        expect.objectContaining({ field: 'category', category: 'administrative', oldValue: '', newValue: 'Citizen Service' }),
      ]));
    });
  });
});
