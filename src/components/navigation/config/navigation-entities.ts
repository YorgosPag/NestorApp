/* eslint-disable design-system/enforce-semantic-colors -- config file: defines entity color mapping */

export { NAVIGATION_ENTITIES } from './navigation-entities/entity-config';
export { NAVIGATION_ACTIONS } from './navigation-entities/action-config';
export {
  getEntityConfig,
  getEntityIcon,
  getEntityColor,
  getEntityLabel,
  getEntityPluralLabel,
  isNavigationEntityType,
  getActionConfig,
  getActionIcon,
  getActionColor,
  getActionLabel,
  isNavigationActionType,
} from './navigation-entities/accessors';
export type {
  NavigationEntityType,
  NavigationEntityConfig,
  NavigationEntitiesConfig,
  NavigationActionType,
  NavigationActionConfig,
  NavigationActionsConfig,
} from './navigation-entities/types';

export { NAVIGATION_ENTITIES as default } from './navigation-entities/entity-config';
