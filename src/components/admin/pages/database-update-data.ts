/**
 * Database Update — Data Definitions
 * Extracted for SRP: data configuration separate from UI component
 *
 * @module components/admin/pages/database-update-data
 * @performance ADR-294 Batch 5 — SRP split
 */

import { CONTACT_INFO, ContactInfoUtils } from '@/config/contact-info-config';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('DatabaseUpdateData');

// 🏢 ENTERPRISE: Load contact IDs from environment configuration
export const getExistingContactIds = (): string[] => {
  const envContactIds = process.env.NEXT_PUBLIC_EXISTING_CONTACT_IDS;
  if (envContactIds) {
    const parsed = safeJsonParse<string[]>(envContactIds, null as unknown as string[]);
    if (parsed !== null) return parsed;
    logger.warn('Invalid EXISTING_CONTACT_IDS format, using fallback');
  }

  return [
    '6MkpFeW54dG03cbWUzRf',
    '6vpnjcpN5ICjCyrsUs8x',
    'DBbvKi3DYxBHbDipqfCv',
    'IjTAcUZ3eJm5zT7EA4q7',
    'JIwIiksQwG9469SByKIJ',
    'QpWvu0Jrw4DGxDqFC2xW',
    'SVgqNOX1vLM7gFZO9Vy4',
    'VJpvrADTve31letX5ob7',
    'ZxLWN7HXsZHcMfoozVL5',
    'fdhyCgd9l4cxXX0XhtyG',
    'j1xYkN18jqGMA18c600g',
    'oGHblMcwDKM4SM67mlgN',
    'sx9QlhtQelyE1LZHwBOg',
    'zX0jNOzy0GAmAhUjSdeQ'
  ];
};

export const EXISTING_CONTACT_IDS = getExistingContactIds();

export const NEW_CONTACTS = [
  {
    type: 'individual',
    firstName: 'Ελένη',
    lastName: 'Παπαδόπουλος',
    tags: ['οικοπεδούχος', 'αντιπαροχή'],
    status: 'active',
    isFavorite: false,
    emails: [{ email: ContactInfoUtils.generateEmail('Eleni', 'Papadopoulos'), type: 'personal', isPrimary: true }],
    phones: [{ phone: ContactInfoUtils.generatePhone('mobile'), type: 'mobile', isPrimary: true }],
    profession: 'Συνταξιούχος',
    notes: 'Οικοπεδούχος με αντιπαροχή 3 διαμερισμάτων'
  },
  {
    type: 'individual',
    firstName: 'Γιάννης',
    lastName: 'Κωνσταντίνου',
    tags: ['οικοπεδούχος', 'αντιπαροχή'],
    status: 'active',
    isFavorite: false,
    emails: [{ email: ContactInfoUtils.generateEmail('Giannis', 'Konstantinou'), type: 'personal', isPrimary: true }],
    phones: [{ phone: ContactInfoUtils.generatePhone('mobile'), type: 'mobile', isPrimary: true }],
    profession: 'Μηχανικός',
    notes: 'Οικοπεδούχος με αντιπαροχή 2 διαμερισμάτων'
  },
  {
    type: 'individual',
    firstName: 'Μαρία',
    lastName: 'Αλεξάνδρου',
    tags: ['αγοραστής', 'πελάτης'],
    status: 'active',
    isFavorite: true,
    emails: [{ email: ContactInfoUtils.generateEmail('Maria', 'Alexandrou'), type: 'personal', isPrimary: true }],
    phones: [{ phone: ContactInfoUtils.generatePhone('mobile'), type: 'mobile', isPrimary: true }],
    profession: 'Ιατρός',
    notes: 'Αγόρασε διαμέρισμα 85τμ στον 4ο όροφο'
  },
  {
    type: 'company',
    companyName: 'TechStart Solutions',
    tags: ['εταιρεία', 'ενοικιαστής', 'γραφεία'],
    status: 'active',
    isFavorite: true,
    emails: [{ email: CONTACT_INFO.DEMO_EMAIL_BUSINESS, type: 'business', isPrimary: true }],
    phones: [{ phone: ContactInfoUtils.generatePhone('business'), type: 'business', isPrimary: true }],
    industry: 'Τεχνολογία',
    vatNumber: '999888777',
    notes: 'Ενοικιάζει γραφειακό χώρο 150τμ'
  }
];

export const CONTACT_ASSIGNMENTS = {
  '6MkpFeW54dG03cbWUzRf': { role: 'landowner', tags: ['οικοπεδούχος', 'αντιπαροχή'] },
  '6vpnjcpN5ICjCyrsUs8x': { role: 'landowner', tags: ['οικοπεδούχος', 'αντιπαροχή'] },
  'DBbvKi3DYxBHbDipqfCv': { role: 'buyer', tags: ['αγοραστής', 'πελάτης'] },
  'IjTAcUZ3eJm5zT7EA4q7': { role: 'buyer', tags: ['αγοραστής', 'πελάτης'] },
  'JIwIiksQwG9469SByKIJ': { role: 'buyer', tags: ['αγοραστής', 'πελάτης'] },
  'QpWvu0Jrw4DGxDqFC2xW': { role: 'long_term_renter', tags: ['ενοικιαστής', 'μακροχρόνια μίσθωση'] },
  'SVgqNOX1vLM7gFZO9Vy4': { role: 'long_term_renter', tags: ['ενοικιαστής', 'μακροχρόνια μίσθωση'] },
  'VJpvrADTve31letX5ob7': { role: 'short_term_renter', tags: ['ενοικιαστής', 'βραχυχρόνια μίσθωση'] },
  'ZxLWN7HXsZHcMfoozVL5': { role: 'short_term_renter', tags: ['ενοικιαστής', 'βραχυχρόνια μίσθωση'] },
  'fdhyCgd9l4cxXX0XhtyG': { role: 'corporate', tags: ['εταιρεία', 'γραφεία'] },
  'j1xYkN18jqGMA18c600g': { role: 'prospect', tags: ['προοπτικός', 'ενδιαφέρον'] },
  'oGHblMcwDKM4SM67mlgN': { role: 'prospect', tags: ['προοπτικός', 'ενδιαφέρον'] },
  'sx9QlhtQelyE1LZHwBOg': { role: 'prospect', tags: ['προοπτικός', 'ενδιαφέρον'] },
  'zX0jNOzy0GAmAhUjSdeQ': { role: 'prospect', tags: ['προοπτικός', 'ενδιαφέρον'] }
} as const;

export const STATUS_ASSIGNMENTS = {
  'landowner': 'owner-compensation',
  'buyer': 'sold',
  'long_term_renter': 'long-term-rented',
  'short_term_renter': 'short-term-rented',
  'corporate': 'company-owned',
  'prospect': 'for-sale'
} as const;
