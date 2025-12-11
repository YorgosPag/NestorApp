// -----------------------------------------------------------------------------
// Obligations Barrel - Κεντρικό Entry Point
// Επανα-εξάγει όλες τις λειτουργίες από τα θεματικά sub-modules.
// -----------------------------------------------------------------------------

// Core
export * from './types';
export * from './components';
export * from './config';
export * from './pdf';

// Re-export services & hooks
export { obligationsService } from '@/services/obligations.service';
export { useObligations, useObligation, useObligationTemplates, useObligationStats } from '@/hooks/use-obligations';

// Re-export mock data
export {
  MOCK_OBLIGATIONS,
  DEFAULT_TEMPLATE_SECTIONS,
  COMPLETE_SECTIONS,
  MOCK_SECTIONS,
} from '@/types/obligation-services';
