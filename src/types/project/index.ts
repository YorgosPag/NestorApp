// 🏢 ENTERPRISE: Project Types Central Export
// ADR-167: Enterprise Project Address System

// Address types and interfaces
export type {
  ProjectAddress,
  ProjectAddressType,
  BlockSideDirection,
  BuildingAddressReference,
} from './addresses';

// Address runtime enums (SSoT)
export {
  PROJECT_ADDRESS_TYPES,
  BLOCK_SIDE_DIRECTIONS,
} from './addresses';

// Address helper functions
export {
  getPrimaryAddress,
  formatAddressLine,
  formatBlockSide,
  createProjectAddress,
  migrateLegacyAddress,
  resolveBuildingAddresses,
  getBuildingPrimaryAddress,
  resolveBuildingPrimaryAddress, // Enterprise primary resolver
} from './address-helpers';
