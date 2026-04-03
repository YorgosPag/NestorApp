import {
  Eye,
  Filter,
  Link2,
  MapPin,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Unlink2,
} from 'lucide-react';
import type { NavigationActionsConfig } from './types';

export const NAVIGATION_ACTIONS: NavigationActionsConfig = {
  delete: {
    icon: Trash2,
    color: 'text-destructive',
    label: 'actions.delete.label',
    description: 'actions.delete.description',
  },
  unlink: {
    icon: Unlink2,
    color: 'text-orange-500',
    label: 'actions.unlink.label',
    description: 'actions.unlink.description',
  },
  add: {
    icon: Plus,
    color: 'text-green-600',
    label: 'actions.add.label',
    description: 'actions.add.description',
  },
  link: {
    icon: Link2,
    color: 'text-blue-600',
    label: 'actions.link.label',
    description: 'actions.link.description',
  },
  actions: {
    icon: MapPin,
    color: 'text-red-600',
    label: 'actions.actions.label',
    description: 'actions.actions.description',
  },
  view: {
    icon: Eye,
    color: 'text-cyan-600',
    label: 'actions.view.label',
    description: 'actions.view.description',
  },
  edit: {
    icon: Pencil,
    color: 'text-cyan-600',
    label: 'actions.edit.label',
    description: 'actions.edit.description',
  },
  share: {
    icon: Share2,
    color: 'text-violet-600',
    label: 'actions.share.label',
    description: 'actions.share.description',
  },
  filter: {
    icon: Filter,
    color: 'text-orange-500',
    label: 'actions.filter.label',
    description: 'actions.filter.description',
  },
} as const;
