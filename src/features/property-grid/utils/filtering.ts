type Ranges = {
  priceRange: { min: string; max: string };
  areaRange: { min: string; max: string };
};
export function applyFilters(
  properties: any[],
  filters: { propertyType: string[] },
  searchTerm: string,
  ranges: Ranges
) {
  const { priceRange, areaRange } = ranges;
  return properties.filter((property) => {
    if (filters.propertyType.length > 0 && !filters.propertyType.includes(property.type)) return false;
    if (searchTerm && !property.name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (priceRange.min && property.price < parseInt(priceRange.min)) return false;
    if (priceRange.max && property.price > parseInt(priceRange.max)) return false;
    if (areaRange.min && property.area < parseInt(areaRange.min)) return false;
    if (areaRange.max && property.area > parseInt(areaRange.max)) return false;
    return true;
  });
}
