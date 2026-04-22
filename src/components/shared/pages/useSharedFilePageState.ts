/**
 * =============================================================================
 * useSharedFilePageState — state + IO controller for SharedFilePageContent
 * =============================================================================
 *
 * SRP split from SharedFilePageContent.tsx: owns the public-share validation
 * flow, password gate, file-info loading and download counter writes. The
 * component becomes a pure presentation shell over the hook output (ADR-315).
 *
 * @module components/shared/pages/useSharedFilePageState
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileShareService, type FileShareRecord } from '@/services/file-share.service';
import { UnifiedSharingService } from '@/services/sharing/unified-sharing.service';
import type { ShareRecord } from '@/types/sharing';
// Side-effect import: registers resolvers with ShareEntityRegistry
import {
  contactShareResolver,
  propertyShowcaseShareResolver,
  type ContactShareResolvedData,
  type PropertyShowcaseResolvedData,
} from '@/services/sharing/resolvers';
import { openRemoteUrlInNewTab } from '@/lib/exports/trigger-export-download';

export interface FileInfo {
  displayName: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  ext: string;
}

export type PageState =
  | 'loading'
  | 'password'
  | 'ready'
  | 'error'
  | 'expired'
  | 'contact'
  | 'showcase'
  | 'project_showcase';

export interface SharedFilePageState {
  token: string;
  state: PageState;
  share: FileShareRecord | null;
  fileInfo: FileInfo | null;
  errorMessage: string;
  password: string;
  passwordError: boolean;
  downloading: boolean;
  contactData: ContactShareResolvedData | null;
  contactExpiresAt: string;
  showcaseData: PropertyShowcaseResolvedData | null;
  showcaseExpiresAt: string;
  pendingUnifiedShare: ShareRecord | null;
  setPassword: (v: string) => void;
  setPasswordError: (v: boolean) => void;
  handlePasswordSubmit: (e: React.FormEvent) => Promise<void>;
  handleDownload: () => Promise<void>;
}

export function useSharedFilePageState(): SharedFilePageState {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [share, setShare] = useState<FileShareRecord | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // ADR-315: unified contact share data (null unless entityType=contact)
  const [contactData, setContactData] = useState<ContactShareResolvedData | null>(null);
  const [contactExpiresAt, setContactExpiresAt] = useState<string>('');
  // ADR-315: unified showcase share data (null unless entityType=property_showcase)
  const [showcaseData, setShowcaseData] = useState<PropertyShowcaseResolvedData | null>(null);
  const [showcaseExpiresAt, setShowcaseExpiresAt] = useState<string>('');
  // ADR-315: when non-null, share was resolved via unified `shares` collection
  // and access/revoke operations must go through UnifiedSharingService.
  const [unifiedShareId, setUnifiedShareId] = useState<string | null>(null);
  // ADR-315: held across password gate so post-verify we can resolve the
  // appropriate entity type (contact / showcase) from the unified ShareRecord.
  const [pendingUnifiedShare, setPendingUnifiedShare] = useState<ShareRecord | null>(null);

  const loadFileInfo = useCallback(async (fileId: string) => {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    const { COLLECTIONS } = await import('@/config/firestore-collections');

    const fileDoc = await getDoc(doc(db, COLLECTIONS.FILES, fileId));
    if (!fileDoc.exists()) {
      setState('error');
      setErrorMessage('File not found');
      return;
    }

    const data = fileDoc.data();
    setFileInfo({
      displayName: data.displayName ?? data.originalFilename ?? 'File',
      originalFilename: data.originalFilename ?? 'file',
      contentType: data.contentType ?? '',
      sizeBytes: data.sizeBytes ?? 0,
      downloadUrl: data.downloadUrl ?? '',
      ext: data.ext ?? '',
    });
    setState('ready');
  }, []);

  // Validate share token
  useEffect(() => {
    async function validate() {
      try {
        // ADR-315: unified dispatcher — try new `shares` collection first
        const unified = await UnifiedSharingService.validateShare(token);
        if (unified.valid && unified.share) {
          const u = unified.share;
          // ADR-315: universal password gate — applies to every entityType.
          // Hold the ShareRecord until verification, then resolve per type.
          if (u.requiresPassword) {
            setPendingUnifiedShare(u);
            setState('password');
            return;
          }
          if (u.entityType === 'property_showcase') {
            setShowcaseExpiresAt(u.expiresAt);
            const data = await propertyShowcaseShareResolver.resolve(u);
            setShowcaseData(data);
            await UnifiedSharingService.incrementAccessCount(u.id);
            setState('showcase');
            return;
          }
          if (u.entityType === 'project_showcase') {
            await UnifiedSharingService.incrementAccessCount(u.id);
            setState('project_showcase');
            return;
          }
          if (u.entityType === 'contact') {
            setContactExpiresAt(u.expiresAt);
            // Resolve contact via registered resolver (respects includedFields)
            const data = await contactShareResolver.resolve(u);
            setContactData(data);
            await UnifiedSharingService.incrementAccessCount(u.id);
            setState('contact');
            return;
          }
          // entityType === 'file' — adapt unified ShareRecord → FileShareRecord shape
          const adapted: FileShareRecord = {
            id: u.id,
            fileId: u.entityId,
            token: u.token,
            createdBy: u.createdBy,
            createdAt: u.createdAt as string,
            expiresAt: u.expiresAt,
            isActive: u.isActive,
            passwordHash: u.passwordHash ?? undefined,
            requiresPassword: u.requiresPassword,
            downloadCount: u.accessCount,
            maxDownloads: u.maxAccesses,
            note: u.note ?? undefined,
            companyId: u.companyId,
          };
          setShare(adapted);
          setUnifiedShareId(u.id);
          if (u.requiresPassword) {
            setState('password');
            return;
          }
          await loadFileInfo(u.entityId);
          await UnifiedSharingService.incrementAccessCount(u.id);
          return;
        }

        // Legacy fallback — `file_shares` collection (FileShareService)
        const validation = await FileShareService.validateShare(token);

        if (!validation.valid || !validation.share) {
          setState(validation.reason?.includes('expired') ? 'expired' : 'error');
          setErrorMessage(validation.reason ?? 'Invalid share link');
          return;
        }

        setShare(validation.share);

        if (validation.share.requiresPassword) {
          setState('password');
          return;
        }

        await loadFileInfo(validation.share.fileId);
      } catch (err) {
        setState('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load');
      }
    }

    validate();
  }, [token, loadFileInfo]);

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // ADR-315: unified path — verify via UnifiedSharingService, then resolve
    // per entityType (file adapter / contact / showcase). Falls back to the
    // legacy FileShareService.verifyPassword for `file_shares`-only shares.
    if (pendingUnifiedShare) {
      const valid = await UnifiedSharingService.verifyPassword(pendingUnifiedShare, password);
      if (!valid) {
        setPasswordError(true);
        return;
      }
      setPasswordError(false);
      const u = pendingUnifiedShare;
      if (u.entityType === 'property_showcase') {
        setShowcaseExpiresAt(u.expiresAt);
        const data = await propertyShowcaseShareResolver.resolve(u);
        setShowcaseData(data);
        await UnifiedSharingService.incrementAccessCount(u.id);
        setPendingUnifiedShare(null);
        setState('showcase');
        return;
      }
      if (u.entityType === 'project_showcase') {
        await UnifiedSharingService.incrementAccessCount(u.id);
        setPendingUnifiedShare(null);
        setState('project_showcase');
        return;
      }
      if (u.entityType === 'contact') {
        setContactExpiresAt(u.expiresAt);
        const data = await contactShareResolver.resolve(u);
        setContactData(data);
        await UnifiedSharingService.incrementAccessCount(u.id);
        setPendingUnifiedShare(null);
        setState('contact');
        return;
      }
      // entityType === 'file'
      const adapted: FileShareRecord = {
        id: u.id,
        fileId: u.entityId,
        token: u.token,
        createdBy: u.createdBy,
        createdAt: u.createdAt as string,
        expiresAt: u.expiresAt,
        isActive: u.isActive,
        passwordHash: u.passwordHash ?? undefined,
        requiresPassword: u.requiresPassword,
        downloadCount: u.accessCount,
        maxDownloads: u.maxAccesses,
        note: u.note ?? undefined,
        companyId: u.companyId,
      };
      setShare(adapted);
      setUnifiedShareId(u.id);
      setPendingUnifiedShare(null);
      await loadFileInfo(u.entityId);
      await UnifiedSharingService.incrementAccessCount(u.id);
      return;
    }

    if (!share) return;
    const valid = await FileShareService.verifyPassword(share, password);
    if (!valid) {
      setPasswordError(true);
      return;
    }

    setPasswordError(false);
    await loadFileInfo(share.fileId);
  }, [pendingUnifiedShare, share, password, loadFileInfo]);

  const handleDownload = useCallback(async () => {
    if (!fileInfo?.downloadUrl || !share) return;

    setDownloading(true);
    try {
      // ADR-315: route counter write to the collection the share actually lives in
      if (unifiedShareId) {
        await UnifiedSharingService.incrementAccessCount(unifiedShareId);
      } else {
        await FileShareService.incrementDownloadCount(share.id);
      }
      openRemoteUrlInNewTab(fileInfo.downloadUrl);
    } finally {
      setDownloading(false);
    }
  }, [fileInfo, share, unifiedShareId]);

  return {
    token,
    state,
    share,
    fileInfo,
    errorMessage,
    password,
    passwordError,
    downloading,
    contactData,
    contactExpiresAt,
    showcaseData,
    showcaseExpiresAt,
    pendingUnifiedShare,
    setPassword,
    setPasswordError,
    handlePasswordSubmit,
    handleDownload,
  };
}
