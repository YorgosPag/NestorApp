/**
 * =============================================================================
 * EntityAssociationsManager — Κεντρικό UI για σύνδεση Επαφών με Entities
 * =============================================================================
 *
 * Reusable component: Project / Building / Unit → βλέπει & διαχειρίζεται
 * τις συνδεδεμένες επαφές (με ρόλο).
 *
 * @module components/associations/EntityAssociationsManager
 * @enterprise ADR-032, ADR-001 (Radix Select)
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Users, ArrowUpFromLine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import { useEntityContactLinks } from '@/hooks/useEntityAssociations';
import { getRolesForEntityType } from '@/types/entity-associations';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { EntityType } from '@/config/domain-constants';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import '@/lib/design-system';

// ============================================================================
// PROPS
// ============================================================================

export interface EntityAssociationsManagerProps {
  entityType: EntityType;
  entityId: string;
  /** Parent project ID — enables inheritance (Project contacts appear in Building) */
  parentProjectId?: string;
  /**
   * Optional intercept for remove action.
   * When provided, bypasses the default AlertDialog and delegates full control
   * to the caller (e.g. project-specific impact-guard).
   * The caller must call `proceed()` to execute the actual removal.
   */
  onRemoveIntercept?: (contactId: string, role: string, proceed: () => Promise<void>) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EntityAssociationsManager({
  entityType,
  entityId,
  parentProjectId,
  onRemoveIntercept,
}: EntityAssociationsManagerProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const colors = useSemanticColors();
  const { links, isLoading, addLink, removeLink, LinkRemovalBlockedDialog } = useEntityContactLinks(
    entityType,
    entityId,
    parentProjectId ? { parentProjectId } : undefined
  );
  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Remove confirmation state
  const [removeLinkId, setRemoveLinkId] = useState<string | null>(null);

  // Get available roles for this entity type
  const availableRoles = useMemo(
    () => getRolesForEntityType(entityType),
    [entityType]
  );

  // IDs of already-linked contacts (to exclude from search)
  // Include both direct and inherited — no need to add a contact already visible
  const excludeContactIds = useMemo(
    () => links.map((l) => l.contactId),
    [links]
  );

  // -- Handlers --

  const handleOpenAddDialog = () => {
    setSelectedContact(null);
    setSelectedRole('');
    setIsAddDialogOpen(true);
  };

  const handleAddContact = async () => {
    if (!selectedContact || !selectedRole) return;

    setIsSubmitting(true);
    const success = await addLink(selectedContact.id, selectedRole);
    setIsSubmitting(false);

    if (success) {
      setIsAddDialogOpen(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeLinkId) return;
    await removeLink(removeLinkId);
    setRemoveLinkId(null);
  };

  // -- Role label resolver --
  const getRoleLabel = (role: string): string => {
    const key = `associations.roles.${role}`;
    const translated = t(key);
    // If translation returns the key itself, use the raw role
    return translated === key ? role : translated;
  };

  // -- Render --

  return (
    <Card>
      <CardHeader>
        <header className="flex items-center justify-between">
          <div>
            <CardTitle className={typography.card.titleCompact}>
              {t('associations.title')}
            </CardTitle>
            <CardDescription>
              {t('associations.description')}
            </CardDescription>
          </div>
          <Button onClick={handleOpenAddDialog}>
            <Plus className={cn('h-4 w-4', spacing.margin.right.sm)} />
            {t('associations.addContact')}
          </Button>
        </header>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className={cn("text-sm", colors.text.muted)}>
            {t('associations.loading')}
          </p>
        ) : links.length === 0 ? (
          <section className="flex flex-col items-center justify-center py-12 text-center">
            <Users className={cn("h-10 w-10 mb-3", `${colors.text.muted}/40`)} />
            <p className={cn("text-sm", colors.text.muted)}>
              {t('associations.noAssociations')}
            </p>
          </section>
        ) : (
          <ul className={cn('space-y-2')}>
            {links.map((link) => (
              <li
                key={link.inherited ? `inherited-${link.linkId}` : link.linkId}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-3",
                  link.inherited && "border-dashed bg-muted/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">
                    {link.contactName}
                  </span>
                  {link.role && (
                    <Badge variant="secondary">
                      {getRoleLabel(link.role)}
                    </Badge>
                  )}
                  {link.inherited && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <ArrowUpFromLine className="h-3 w-3" />
                      {t('associations.inheritedFromProject')}
                    </Badge>
                  )}
                  <span className={cn("text-xs capitalize", colors.text.muted)}>
                    {link.contactType}
                  </span>
                </div>
                {!link.inherited && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (onRemoveIntercept) {
                        onRemoveIntercept(
                          link.contactId,
                          link.role ?? '',
                          () => removeLink(link.linkId),
                        );
                      } else {
                        setRemoveLinkId(link.linkId);
                      }
                    }}
                    aria-label={t('associations.removeConfirm')}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* ============ ADD CONTACT DIALOG ============ */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('associations.addContact')}</DialogTitle>
          </DialogHeader>

          <section className="space-y-4 py-2">
            {/* Contact Search */}
            <ContactSearchManager
              selectedContactId={selectedContact?.id || ''}
              onContactSelect={setSelectedContact}
              excludeContactIds={excludeContactIds}
              allowedContactTypes={['individual', 'company', 'service']}
              label={t('associations.selectContact')}
              searchConfig={{ maxResults: 200 }}
            />

            {/* Role Select (Radix — ADR-001) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('associations.selectRole')}
              </label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder={t('associations.selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
            >
              {t('associations.cancel')}
            </Button>
            <Button
              onClick={handleAddContact}
              disabled={!selectedContact || !selectedRole || isSubmitting}
            >
              {isSubmitting ? t('associations.adding') : t('associations.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ LINK REMOVAL BLOCKED DIALOG ============ */}
      {LinkRemovalBlockedDialog}

      {/* ============ REMOVE CONFIRMATION ============ */}
      <AlertDialog
        open={removeLinkId !== null}
        onOpenChange={(open) => { if (!open) setRemoveLinkId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('associations.removeTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('associations.removeConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('associations.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove}>
              {t('associations.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
