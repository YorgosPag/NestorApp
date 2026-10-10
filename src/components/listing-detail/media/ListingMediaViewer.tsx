'use client';

/**
 * @fileoverview **Ο ΠΡΟΒΟΛΕΑΣ ΜΕΣΩΝ ΤΗΣ ΑΓΓΕΛΙΑΣ** — ο **δημόσιος** προσαρμογέας του `MediaViewerShell`: φωτογραφίες · κάτοψη ·
 * κάτοψη ορόφου · βίντεο · τρισδιάστατο μοντέλο · περιήγηση 360°, σε καρτέλες μέσα στη σελίδα (πρότυπο Zillow/Idealista: ένας προβολέας στην κορυφή).
 * @related components/shared/media/viewer/MediaViewerShell · features/read-only-viewer (ο εταιρικός προσαρμογέας) · ADR-884 §4.12 Μέρος Δ
 * @module components/listing-detail/media/ListingMediaViewer
 *
 * 🔑 **ΙΔΙΟ ΚΕΛΥΦΟΣ, ΑΛΛΑ ΔΕΔΟΜΕΝΑ.** Η εμφάνιση είναι αυτή των «Διαθέσιμων Ακινήτων» του χώρου· τα δεδομένα είναι **μόνο**
 * η κλειστή προβολή `PublicListing`. Ο ανώνυμος επισκέπτης δεν έχει χώρο, άρα εδώ δεν διαβάζεται ποτέ αρχείο εταιρείας.
 *
 * ⚠️ **Οι σκηνές είναι τα ΙΔΙΑ φύλλα** που είχε η σελίδα στοιβαγμένα (`ListingGallery` · `ListingFloorplans` ·
 * `ListingModels` · `ListingTour`) — με τους κανόνες τους ακέραιους: πρώτο καρέ ποτέ `lazy`, προέλευση κάτω από κάθε υλικό,
 * η απουσία φωτογραφίας **ονομάζεται**, η απουσία κάτοψης/μοντέλου/περιήγησης **σιωπά** (η καρτέλα απλώς δεν υπάρχει).
 *
 * ⚠️ **«Φωτογραφίες» είναι πάντα η προεπιλογή**: εκεί ζει το στοιχείο LCP της σελίδας. Και όταν είναι η **μόνη** όψη, δεν
 * ζωγραφίζεται λωρίδα με μία καρτέλα — η συλλογή αποδίδεται γυμνή, όπως πριν.
 *
 * 🔗 Οι σελίδες πλήρους παραθύρου του ADR-884 (`/photos` · `/floorplan` · `/tour`) **μένουν**: κάθε σκηνή κρατά τον σύνδεσμό
 * της προς αυτές. Οι καρτέλες εδώ είναι η ενσωματωμένη όψη, όχι αντικατάστασή τους.
 */

import type { ReactElement, ReactNode } from 'react';
import { Box, Camera, Compass, Layers, Map as MapIcon, Video } from 'lucide-react';

import { MediaViewerShell, type MediaViewerTab } from '@/components/shared/media/viewer/MediaViewerShell';
import { useActiveMediaTab } from '@/components/shared/media/viewer/useMediaTabParam';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { presentableFloorPlate } from '@/lib/listings/floor-plate/floor-plate-publication';
import { listingGalleryImages } from '@/lib/listings/listing-images';
import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import { useTourPresenceAvailable } from '@/lib/spatial-tour/useTourPresenceAvailable';
import type { PublicListing } from '@/types/public-listing';

import { ListingFloorPlates } from '../ListingFloorPlates';
import { ListingFloorplans } from '../ListingFloorplans';
import { ListingGallery } from '../ListingGallery';
import { ListingModels } from '../ListingModels';
import { ListingTour } from '../ListingTour';
import { ListingVideos } from '../ListingVideos';

/** Η προεπιλεγμένη όψη — πάντα **πρώτη** καρτέλα, άρα δεν γράφεται στη διεύθυνση (`useActiveMediaTab`). */
const PHOTOS_TAB = 'photos';

/** Η κάτοψη **ορόφου** — άλλη καρτέλα από την `floorplan` (η κάτοψη της μονάδας)· η τιμή ζει στη διεύθυνση (`?mediaTab=`). */
const FLOOR_PLATE_TAB = 'floorPlate';

/** Το εσωτερικό περιθώριο κάθε σκηνής: το κέλυφος είναι πλαίσιο χωρίς γέμισμα (στον χώρο η σκηνή είναι καμβάς ως την άκρη). */
function Stage({ children }: { readonly children: ReactNode }): ReactElement {
  return <div className="p-3 sm:p-4">{children}</div>;
}

type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * **Εικόνα και κίνηση**: οι φωτογραφίες (πάντα, πρώτες) και το βίντεο αμέσως μετά (ADR-907 §10.3).
 * Το βίντεο χωρίς πλήθος: «Βίντεο (1)» δεν λέει τίποτα όταν το ένα είναι πολιτική.
 */
function pictureTabs(listing: PublicListing, t: Translate): MediaViewerTab[] {
  const tabs: MediaViewerTab[] = [{
    id: PHOTOS_TAB,
    label: t('listing-detail:media.tabs.photos'),
    icon: Camera,
    count: listingGalleryImages(listing).length,
    panel: <Stage><ListingGallery listing={listing} /></Stage>,
  }];
  if (listing.videos.filter(isPubliclyPresentable).length > 0) {
    tabs.push({
      id: 'video',
      label: t('listing-detail:media.tabs.video'),
      icon: Video,
      panel: <Stage><ListingVideos listing={listing} /></Stage>,
    });
  }
  return tabs;
}

/**
 * **Τα σχέδια**: η κάτοψη της μονάδας και, αμέσως μετά, η κάτοψη του ορόφου — από το «πώς είναι μέσα» στο «πού βρίσκεται
 * στον όροφο» (ADR-907 §11.9). Η κάτοψη ορόφου χωρίς πλήθος: είναι πάντα μία.
 */
function planTabs(listing: PublicListing, t: Translate): MediaViewerTab[] {
  const tabs: MediaViewerTab[] = [];
  const floorplanCount = listing.floorplans.filter(isPubliclyPresentable).length;
  if (floorplanCount > 0) {
    tabs.push({
      id: 'floorplan',
      label: t('listing-detail:media.tabs.floorplan'),
      icon: MapIcon,
      count: floorplanCount,
      panel: <Stage><ListingFloorplans listing={listing} embedded /></Stage>,
    });
  }
  // Ο κριτής είναι ο ίδιος με του φύλλου (`presentableFloorPlate`): καρτέλα χωρίς σκηνή δεν γεννιέται.
  if (presentableFloorPlate(listing) !== null) {
    tabs.push({
      id: FLOOR_PLATE_TAB,
      label: t('listing-detail:media.tabs.floorPlate'),
      icon: Layers,
      panel: <Stage><ListingFloorPlates listing={listing} /></Stage>,
    });
  }
  return tabs;
}

/** **Ο χώρος σε τρεις διαστάσεις**: το μοντέλο και η περιήγηση 360° (η δεύτερη εμφανίζεται ασύγχρονα). */
function spatialTabs(listing: PublicListing, t: Translate, tourAvailable: boolean): MediaViewerTab[] {
  const tabs: MediaViewerTab[] = [];
  const modelCount = listing.models.filter(isPubliclyPresentable).length;
  if (modelCount > 0) {
    tabs.push({
      id: 'model',
      label: t('listing-detail:model.heading', { count: modelCount }),
      icon: Box,
      panel: <Stage><ListingModels listing={listing} embedded /></Stage>,
    });
  }
  if (tourAvailable) {
    tabs.push({
      id: 'tour',
      label: t('listing-detail:media.tabs.tour'),
      icon: Compass,
      panel: <Stage><ListingTour listingId={listing.id} /></Stage>,
    });
  }
  return tabs;
}

export function ListingMediaViewer({ listing }: { readonly listing: PublicListing }): ReactElement {
  const { t } = useTranslation(['listing-detail']);
  const tourAvailable = useTourPresenceAvailable(listing.id) === true;

  // Οι **ίδιοι** κριτές με τα φύλλα (ADR-842 Α7): καρτέλα υπάρχει μόνο όταν το φύλλο της θα ζωγράφιζε κάτι.
  const tabs = [...pictureTabs(listing, t), ...planTabs(listing, t), ...spatialTabs(listing, t, tourAvailable)];

  // Άγνωστη ή πια ανύπαρκτη καρτέλα στη διεύθυνση (π.χ. η κάτοψη αποσύρθηκε) ⇒ η προεπιλογή, ποτέ κενή σκηνή.
  // ⚠️ Χωρίς `heal`: η καρτέλα της περιήγησης εμφανίζεται ασύγχρονα — ένα `?mediaTab=tour` δεν πρέπει να σβηστεί πριν ισχύσει.
  const { activeTab, setActiveTab } = useActiveMediaTab(tabs.map((tab) => tab.id));

  // Μία όψη ⇒ καμία λωρίδα με μία καρτέλα: η συλλογή αποδίδεται γυμνή.
  if (tabs.length === 1) return <ListingGallery listing={listing} />;

  return (
    <MediaViewerShell
      tabs={tabs}
      activeTab={activeTab}
      // Η αγγελία είναι **έγγραφο**: το ύψος το κατέχει η ενεργή σκηνή και κυλά η σελίδα, όχι το κέλυφος.
      layout="flow"
      onTabChange={setActiveTab}
    />
  );
}
