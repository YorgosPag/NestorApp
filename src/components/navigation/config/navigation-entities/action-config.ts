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
    color: 'text-[hsl(var(--text-warning))]',
    label: 'actions.unlink.label',
    description: 'actions.unlink.description',
  },
  add: {
    icon: Plus,
    color: 'text-[hsl(var(--text-success))]',
    label: 'actions.add.label',
    description: 'actions.add.description',
  },
  link: {
    icon: Link2,
    color: 'text-primary',
    label: 'actions.link.label',
    description: 'actions.link.description',
  },
  actions: {
    icon: MapPin,
    color: 'text-destructive',
    label: 'actions.actions.label',
    description: 'actions.actions.description',
  },
  view: {
    icon: Eye,
    color: 'text-primary',
    label: 'actions.view.label',
    description: 'actions.view.description',
  },
  edit: {
    icon: Pencil,
    color: 'text-primary',
    label: 'actions.edit.label',
    description: 'actions.edit.description',
  },
  share: {
    icon: Share2,
    color: 'text-primary',
    label: 'actions.share.label',
    description: 'actions.share.description',
  },
  filter: {
    icon: Filter,
    color: 'text-[hsl(var(--text-warning))]',
    label: 'actions.filter.label',
    description: 'actions.filter.description',
  },
} as const;
