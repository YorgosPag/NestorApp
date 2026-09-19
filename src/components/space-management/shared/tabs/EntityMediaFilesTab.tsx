/**
 * EntityMediaFilesTab — generic presentational shell for space media/files tabs
 *
 * Collapses the previously copy-pasted Parking/Storage media tabs (Photos,
 * Videos, Documents, Floorplan) into a single shell. Per-entity differences
 * are supplied via an {@link EntityMediaBinding}; per-tab differences via a
 * {@link MediaTabConfig}. The heavy lifting (upload, gallery, CRUD) stays in
 * the centralized {@link EntityFilesManager} (ADR-031) — this shell only wires
 * auth/custody context and the sign-in guard.
 *
 * 🔑 ADR-866 Φ1.2: η θεματοφυλακή έρχεται από τη **σύνδεση** (`binding.custodySource`) — εταιρεία της συνεδρίας
 * (Parking/Storage, αμετάβλητο) **ή** κάτοχος-άνθρωπος (φάκελος ακινήτου). Ένα κέλυφος, όχι δεύτερο.
 *
 * @module components/space-management/shared/tabs/EntityMediaFilesTab
 * @see ADR-588 — Space Media Tab Shell
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { useAuth } from '@/auth/contexts/AuthContext';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import type { FileCustody } from '@/lib/files/file-custody';
import { useEntityFilesTabSession } from '@/components/shared/files/useEntityFilesTabSession';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { EntityMediaBinding } from './entity-media-binding';
import type { MediaTabConfig } from './media-tab-configs';
import { mediaTabAllowedEntryPointIds, mediaTabPurpose, mediaTabScopePolicy } from './media-tab-scope';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface EntityMediaFilesTabProps {
  /** Per-entity binding (Parking spot or Storage unit). */
  binding: EntityMediaBinding;
  /** Per-tab presentational + storage config. */
  media: MediaTabConfig;
}

// ============================================================================
// COMPONENT
// ============================================================================

/** Ό,τι χρειάζεται η απόδοση **αφού** λυθεί η θεματοφυλακή — ένα σημείο, και για τους δύο κλάδους. */
interface ResolvedMediaFilesProps extends EntityMediaFilesTabProps {
  custody: FileCustody;
  currentUserId: string;
  companyName?: string;
}

/** Η **μία** απόδοση του `EntityFilesManager` — οι δύο κλάδοι διαφέρουν **μόνο** στο πώς βρίσκουν τον κάτοχο. */
function ResolvedMediaFiles({ binding, media, custody, currentUserId, companyName }: ResolvedMediaFilesProps) {
  const { t } = useTranslation(binding.i18nNamespace);
  return (
    <section className="p-2">
      <EntityFilesManager
        custody={custody}
        currentUserId={currentUserId}
        entityType={binding.entityType}
        entityId={binding.entityId}
        entityLabel={binding.entityLabel}
        projectId={binding.projectId}
        domain={media.domain}
        category={media.category}
        purpose={mediaTabPurpose(binding, media)}
        entryPointCategoryFilter={media.entryPointCategoryFilter}
        entryPointExcludeCategories={media.entryPointExcludeCategories}
        allowedEntryPointIds={mediaTabAllowedEntryPointIds(media)}
        scopePolicy={mediaTabScopePolicy(binding, media)}
        emptyMessage={media.emptyKey ? t(media.emptyKey) : undefined}
        displayStyle={media.displayStyle}
        acceptedTypes={media.acceptedTypes}
        companyName={companyName}
      />
    </section>
  );
}

/** Χωρίς ταυτότητα (ή εταιρεία, στον εταιρικό κλάδο) — το μήνυμα σύνδεσης της σύνδεσης. */
function SignInNeeded({ binding, media }: EntityMediaFilesTabProps) {
  const { t } = useTranslation(binding.i18nNamespace);
  const colors = useSemanticColors();
  return <p className={cn('p-4 text-center', colors.text.muted)}>{t(media.signInKey)}</p>;
}

/** Εταιρικός κλάδος — η εταιρεία της **συνεδρίας**, ό,τι ίσχυε αυτούσιο (Parking/Storage). */
function SessionCompanyMediaFiles(props: EntityMediaFilesTabProps) {
  const { companyId, currentUserId, companyName } = useEntityFilesTabSession({
    withCompanyName: props.media.needsCompanyName,
  });
  if (!companyId || !currentUserId) return <SignInNeeded {...props} />;
  return <ResolvedMediaFiles {...props} custody={{ companyId }} currentUserId={currentUserId} companyName={companyName} />;
}

/**
 * Προσωπικός κλάδος (ADR-866 Φ1.2) — ο κάτοχος **δηλώνεται** από τη σύνδεση.
 *
 * ⛔ **Καμία** κλήση `useCompanyId`/`useCompanyDisplayName`: ο προσωπικός χώρος δεν ρωτά ποτέ εταιρεία — ούτε για
 * ετικέτα. Ο υπάλληλος που ανοίγει τον φάκελο του **δικού του** σπιτιού δεν βλέπει το όνομα του γραφείου του.
 */
function PersonalMediaFiles(props: EntityMediaFilesTabProps & { custody: Extract<FileCustody, { userId: string }> }) {
  const { user } = useAuth();
  if (!user?.uid) return <SignInNeeded {...props} />;
  return <ResolvedMediaFiles {...props} custody={props.custody} currentUserId={user.uid} />;
}

export function EntityMediaFilesTab({ binding, media }: EntityMediaFilesTabProps) {
  const source = binding.custodySource;
  return source.kind === 'personal'
    ? <PersonalMediaFiles binding={binding} media={media} custody={source.custody} />
    : <SessionCompanyMediaFiles binding={binding} media={media} />;
}

export default EntityMediaFilesTab;
