import type { ProjectAddress } from '@/types/project/addresses';
import { AddressMap } from '@/components/shared/addresses/AddressMap';

interface BuildingAddressesMapPaneProps {
  addresses: ProjectAddress[];
  onMarkerClick: (address: ProjectAddress) => void;
}

export function BuildingAddressesMapPane({ addresses, onMarkerClick }: BuildingAddressesMapPaneProps) {
  if (addresses.length === 0) {
    return null;
  }

  return (
    <>
      <aside className="hidden lg:block">
        <div className="sticky top-0 h-[calc(100vh-12rem)]">
          <AddressMap
            addresses={addresses}
            highlightPrimary
            showGeocodingStatus
            enableClickToFocus
            onMarkerClick={onMarkerClick}
            heightPreset="viewerFullscreen"
            className="rounded-lg border shadow-sm !h-full"
          />
        </div>
      </aside>
      <section className="lg:hidden">
        <AddressMap
          addresses={addresses}
          highlightPrimary
          showGeocodingStatus
          enableClickToFocus
          onMarkerClick={onMarkerClick}
          heightPreset="viewerStandard"
          className="rounded-lg border shadow-sm"
        />
      </section>
    </>
  );
}
