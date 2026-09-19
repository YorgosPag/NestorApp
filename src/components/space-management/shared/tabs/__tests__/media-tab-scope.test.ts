/**
 * Α38.1 — ADR-866 §2.10 Β1: «ό,τι ανεβαίνει από μια καρτέλα, φαίνεται σε αυτήν» (κέλυφος ADR-588).
 *
 * 🔴 Η βλάβη (ζωντανή επαλήθευση 2026-09-19): ο φάκελος ακινήτου δεν είχε **καμία** γραμμή στον κατάλογο τύπων ⇒
 * «Επιλέξτε πρώτα τον τύπο» πάνω από **μηδέν** τύπους, σε όλες τις καρτέλες. Και η καρτέλα διάβαζε `domain`/`category`
 * διαφορετικό από αυτό που θα έγραφε το ανέβασμα ⇒ ακόμη κι αν υπήρχαν τύποι, το αρχείο θα ανέβαινε **αόρατο**.
 *
 * 🔑 Η άγκυρα ρωτά **μόνο** συναρτήσεις παραγωγής: τι προσφέρει η καρτέλα (`mediaTabOfferedEntryPoints`), πού γράφει
 * (`resolveUploadScope` με `mediaTabUploadDefaults` — ό,τι φτάνει στο `useFileUpload`) και τι βλέπει (στένωση ερωτήματος
 * `readQueryNarrowing` + το ΕΝΑ φίλτρο `buildFileReadFilter` — η σύνθεση του `useEntityFiles`).
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  PROPERTY_DOSSIER_ENTRY_POINTS,
  PROPERTY_DOSSIER_VIEW,
  type PropertyDossierFileTab,
} from '@/config/upload-entry-points/entries-property-dossier';
import {
  buildFileReadFilter,
  readQueryNarrowing,
  resolveUploadScope,
  type FileScope,
} from '@/components/shared/files/utils/upload-scope';
import { propertyDossierMediaTab } from '@/components/property-dossier/property-dossier-media';
import type { PropertyDossier } from '@/types/property-dossier';
import { propertyDossierMediaBinding } from '../entity-media-binding';
import {
  DOCUMENTS_MEDIA_CONFIG,
  FLOORPLAN_MEDIA_CONFIG,
  PHOTOS_MEDIA_CONFIG,
  VIDEOS_MEDIA_CONFIG,
  type MediaTabConfig,
} from '../media-tab-configs';
import {
  mediaTabOfferedEntryPoints,
  mediaTabScopePolicy,
  mediaTabUploadDefaults,
} from '../media-tab-scope';

type ScopeBinding = Parameters<typeof mediaTabScopePolicy>[0];

const DOSSIER = propertyDossierMediaBinding({ id: 'pdos_test', label: 'Δοκιμή', userId: 'uid_owner' });
const TABS: readonly PropertyDossierFileTab[] = ['floorplan', 'documents', 'photos', 'videos'];
const KINDS: readonly NonNullable<PropertyDossier['type']>[] = ['apartment', 'plot'];

/** Βλέπει η καρτέλα αρχείο με αυτό το εύρος; — η σύνθεση του `useEntityFiles` (ερώτημα, μετά φίλτρο). */
function visibleIn(binding: ScopeBinding, media: MediaTabConfig, written: FileScope): boolean {
  const policy = mediaTabScopePolicy(binding, media);
  const narrowing = readQueryNarrowing({ domain: media.domain, category: media.category }, policy?.readScopes);
  if (narrowing.domain !== undefined && narrowing.domain !== written.domain) return false;
  if (narrowing.category !== undefined && narrowing.category !== written.category) return false;
  return buildFileReadFilter(mediaTabUploadDefaults(binding, media).purpose, policy?.readScopes)(written);
}

/** Κάθε εύρος που μπορεί να γράψει η καρτέλα — κάθε προσφερόμενος τύπος **και** «χωρίς επιλογή» (λήψη/σημείωση). */
function writtenScopes(binding: ScopeBinding, media: MediaTabConfig): FileScope[] {
  const defaults = mediaTabUploadDefaults(binding, media);
  return [...mediaTabOfferedEntryPoints(binding, media).map((ep) => resolveUploadScope(ep, defaults)), resolveUploadScope(null, defaults)];
}

describe('Α38.1 — ο κατάλογος του φακέλου είναι ΟΨΗ, όχι αντίγραφο', () => {
  it('κάθε ταυτότητα της όψης λύνεται στον κατάλογο (ακίνητο + μελέτες)', () => {
    const resolved = new Set(PROPERTY_DOSSIER_ENTRY_POINTS.map((ep) => ep.id));
    const declared = Object.values(PROPERTY_DOSSIER_VIEW).flatMap((entries) => entries.map((entry) => entry.id));
    expect(declared.filter((id) => !resolved.has(id))).toEqual([]);
  });

  it('επίπεδη λίστα: καμία ομάδα μελέτης (αλλιώς ο ιεραρχικός επιλογέας έργου)', () => {
    expect(PROPERTY_DOSSIER_ENTRY_POINTS.filter((ep) => ep.group !== undefined || ep.visibleIn !== undefined)).toEqual([]);
  });
});

describe.each(KINDS)('Α38.1 — φάκελος «%s»: ό,τι ανεβαίνει, φαίνεται', (kind) => {
  it.each(TABS)('η καρτέλα «%s» προσφέρει τύπους (όχι αδιέξοδο)', (tab) => {
    const media = propertyDossierMediaTab(tab, kind);
    expect(mediaTabOfferedEntryPoints(DOSSIER, media).map((ep) => ep.id)).toEqual([...(media.entryPointScope?.offer ?? [])]);
    expect(mediaTabOfferedEntryPoints(DOSSIER, media).length).toBeGreaterThan(0);
  });

  it.each(TABS)('η καρτέλα «%s» βλέπει ΚΑΘΕ αρχείο που γράφει — και «χωρίς επιλογή»', (tab) => {
    const media = propertyDossierMediaTab(tab, kind);
    expect(writtenScopes(DOSSIER, media).filter((scope) => !visibleIn(DOSSIER, media, scope))).toEqual([]);
  });

  it.each(TABS)('η καρτέλα «%s» κρατά τον σκοπό του ΤΥΠΟΥ (η ταυτότητα του εγγράφου)', (tab) => {
    const media = propertyDossierMediaTab(tab, kind);
    const defaults = mediaTabUploadDefaults(DOSSIER, media);
    for (const ep of mediaTabOfferedEntryPoints(DOSSIER, media)) {
      expect(resolveUploadScope(ep, defaults).purpose).toBe(ep.purpose);
    }
  });

  it('κανένα αρχείο δεν εμφανίζεται σε ΔΥΟ καρτέλες', () => {
    const leaks = TABS.flatMap((source) => TABS.filter((target) => target !== source).flatMap((target) =>
      writtenScopes(DOSSIER, propertyDossierMediaTab(source, kind))
        .filter((scope) => visibleIn(DOSSIER, propertyDossierMediaTab(target, kind), scope))
        .map((scope) => `${source}→${target}: ${scope.domain}/${scope.category}/${scope.purpose ?? '*'}`)));
    expect(leaks).toEqual([]);
  });
});

describe('Α38.1 — αλλαγή είδους φακέλου δεν κρύβει ποτέ αρχείο', () => {
  it.each(TABS)('ό,τι γράφτηκε ως «οικόπεδο» φαίνεται ως «διαμέρισμα» και αντίστροφα (%s)', (tab) => {
    const land = propertyDossierMediaTab(tab, 'plot');
    const building = propertyDossierMediaTab(tab, 'apartment');
    expect(writtenScopes(DOSSIER, land).filter((scope) => !visibleIn(DOSSIER, building, scope))).toEqual([]);
    expect(writtenScopes(DOSSIER, building).filter((scope) => !visibleIn(DOSSIER, land, scope))).toEqual([]);
  });
});

describe('Α38.1 — κέλυφος γραφείου (θέσεις στάθμευσης · αποθήκες): ratchet νεκρών καρτελών', () => {
  const COMPANY_BINDINGS: readonly ScopeBinding[] = [
    { entityType: ENTITY_TYPES.PARKING_SPOT, purposePrefix: 'parking' },
    { entityType: ENTITY_TYPES.STORAGE, purposePrefix: 'storage' },
  ];
  const CONFIGS: Readonly<Record<string, MediaTabConfig>> = {
    floorplan: FLOORPLAN_MEDIA_CONFIG, documents: DOCUMENTS_MEDIA_CONFIG, photos: PHOTOS_MEDIA_CONFIG, videos: VIDEOS_MEDIA_CONFIG,
  };
  /**
   * 🔴 ΚΛΕΙΣΤΟ σύνολο, μόνο μικραίνει (μετρημένο 2026-09-19): ο κατάλογος δεν έχει τύπους **βίντεο** ούτε **εγγράφων**
   * για θέση/αποθήκη ⇒ οι καρτέλες αυτές δεν ανεβάζουν (πλέον το λένε ρητά, όχι αδιέξοδο). Εκκρεμότητα στο
   * `pending-ratchet-work.md` — νέα νεκρή καρτέλα = κόκκινο.
   */
  const KNOWN_DEAD = ['parking_spot:documents', 'parking_spot:videos', 'storage:documents', 'storage:videos'];

  it('οι καρτέλες χωρίς τύπους είναι ΑΚΡΙΒΩΣ οι γνωστές', () => {
    const dead = COMPANY_BINDINGS.flatMap((binding) => Object.entries(CONFIGS)
      .filter(([, media]) => mediaTabOfferedEntryPoints(binding, media).length === 0)
      .map(([tab]) => `${binding.entityType}:${tab}`));
    expect(dead.sort()).toEqual([...KNOWN_DEAD].sort());
  });

  it('στις ζωντανές καρτέλες, ό,τι ανεβαίνει φαίνεται (ιστορική σημασιολογία domain/category/σκοπού)', () => {
    const invisible = COMPANY_BINDINGS.flatMap((binding) => Object.entries(CONFIGS).flatMap(([tab, media]) =>
      writtenScopes(binding, media)
        .filter((scope) => !visibleIn(binding, media, scope))
        .map((scope) => `${binding.entityType}:${tab} ${scope.domain}/${scope.category}/${scope.purpose ?? '*'}`)));
    expect(invisible).toEqual([]);
  });
});
