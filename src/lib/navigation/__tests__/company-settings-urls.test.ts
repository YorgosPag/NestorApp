/**
 * ⚓ Ο builder συνδέσμων της σελίδας «Ρυθμίσεις Εταιρείας» (ADR-ACC-018 §17.4).
 *
 * Καρφώνει: η προεπιλογή (`info`) δεν γράφει ερώτημα (μία οθόνη = μία διεύθυνση) · κάθε άλλη καρτέλα γράφει ΜΟΝΟ
 * το `tab` · και ό,τι παράγει ο builder το διαβάζει πίσω η ίδια λίστα καρτελών που διαβάζει η σελίδα.
 */

import {
  COMPANY_SETTINGS_ROUTE,
  COMPANY_SETTINGS_TAB_PARAM,
  COMPANY_SETTINGS_TABS,
  DEFAULT_COMPANY_SETTINGS_TAB,
  getCompanySettingsUrl,
} from '../company-settings-urls';
import { COMPANY_SETTINGS_ROUTE as MANDATE_COMPANY_SETTINGS_ROUTE } from '@/lib/mandate/mandate-routes';

describe('getCompanySettingsUrl', () => {
  it('η προεπιλογή είναι τα «Στοιχεία» και δεν γράφει ερώτημα', () => {
    expect(DEFAULT_COMPANY_SETTINGS_TAB).toBe('info');
    expect(getCompanySettingsUrl()).toBe(COMPANY_SETTINGS_ROUTE);
    expect(getCompanySettingsUrl('info')).toBe(COMPANY_SETTINGS_ROUTE);
  });

  it.each(COMPANY_SETTINGS_TABS.filter((tab) => tab !== DEFAULT_COMPANY_SETTINGS_TAB))(
    'η καρτέλα «%s» γυρίζει πίσω ακέραια από τη διεύθυνση',
    (tab) => {
      const [path, query] = getCompanySettingsUrl(tab).split('?');
      expect(path).toBe(COMPANY_SETTINGS_ROUTE);
      const params = new URLSearchParams(query);
      expect([...params.keys()]).toEqual([COMPANY_SETTINGS_TAB_PARAM]);
      expect(params.get(COMPANY_SETTINGS_TAB_PARAM)).toBe(tab);
    },
  );

  it('ΕΝΑ κυριολεκτικό της διαδρομής — το mandate-routes απλώς το επανεξάγει', () => {
    expect(MANDATE_COMPANY_SETTINGS_ROUTE).toBe(COMPANY_SETTINGS_ROUTE);
  });
});
