'use client';

export function AdvancedFiltersPanel({
  show,
  priceRange, setPriceRange,
  areaRange, setAreaRange,
}: {
  show: boolean;
  priceRange: { min: string; max: string };
  setPriceRange: (r: { min: string; max: string }) => void;
  areaRange: { min: string; max: string };
  setAreaRange: (r: { min: string; max: string }) => void;
}) {
  return (
    <>
      {show && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-muted/30 rounded-lg border border-gray-200 dark:border-border">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-muted-foreground mb-1 block">Εύρος Τιμής (€)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Από"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-border dark:bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Έως"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-border dark:bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-muted-foreground mb-1 block">Εμβαδόν (m²)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Από"
                  value={areaRange.min}
                  onChange={(e) => setAreaRange({ ...areaRange, min: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-border dark:bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Έως"
                  value={areaRange.max}
                  onChange={(e) => setAreaRange({ ...areaRange, max: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-border dark:bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
