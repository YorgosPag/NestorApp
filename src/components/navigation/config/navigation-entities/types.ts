import type { LucideIcon } from 'lucide-react';

export type NavigationEntityType =
  | 'company'
  | 'project'
  | 'building'
  | 'property'
  | 'floor'
  | 'parking'
  | 'storage'
  | 'procurement'
  | 'quote'
  | 'location'
  | 'area'
  | 'price'
  | 'phone'
  | 'email'
  | 'vat'
  | 'contact'
  | 'contactIndividual'
  | 'contactCompany'
  | 'contactService'
  | 'file'
  | 'opportunity'
  | 'communication'
  | 'task';

export type NavigationActionType =
  | 'delete'
  | 'unlink'
  | 'add'
  | 'link'
  | 'actions'
  | 'view'
  | 'edit'
  | 'share'
  | 'filter';

export interface NavigationEntityConfig {
  readonly icon: LucideIcon;
  readonly color: string;
  readonly label: string;
  readonly pluralLabel: string;
  readonly description: string;
}

export type NavigationEntitiesConfig = {
  readonly [K in NavigationEntityType]: NavigationEntityConfig;
};

export interface NavigationActionConfig {
  readonly icon: LucideIcon;
  readonly color: string;
  readonly label: string;
  readonly description: string;
}

export type NavigationActionsConfig = {
  readonly [K in NavigationActionType]: NavigationActionConfig;
};
