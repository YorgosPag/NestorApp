/**
 * OVERPASS QUERY BUILDER
 * Extracted from OverpassApiService.ts (ADR-065 SRP split)
 *
 * Static methods for building Overpass QL queries targeting
 * Greek administrative boundaries (regions, municipalities, postal codes).
 */

import { GreekAdminLevel } from '../../types/administrative-types';
import type { BoundingBox } from '../../types/administrative-types';

export class OverpassQueryBuilder {

  static getMunicipalityByName(municipalityName: string): string {
    return `
      [out:json][timeout:25];
      area["ISO3166-1"="GR"]->.greece;
      (
        rel(area.greece)[boundary=administrative][admin_level=8]["name"="${municipalityName}"];
        rel(area.greece)[boundary=administrative][admin_level=8]["name:el"="${municipalityName}"];
        rel(area.greece)[boundary=administrative][admin_level=8]["alt_name"~"${municipalityName}"];
      );
      out geom;
    `.trim();
  }

  static getRegionByName(regionName: string): string {
    return `
      [out:json][timeout:25];
      area["ISO3166-1"="GR"]->.greece;
      (
        rel(area.greece)[boundary=administrative][admin_level=4]["name"="${regionName}"];
        rel(area.greece)[boundary=administrative][admin_level=4]["name:el"="${regionName}"];
        rel(area.greece)[boundary=administrative][admin_level=4]["name:en"="${regionName}"];
      );
      out geom;
    `.trim();
  }

  static getMunicipalitiesInRegion(regionName: string): string {
    return `
      [out:json][timeout:30];
      area["ISO3166-1"="GR"]->.greece;
      area(area.greece)["name"="${regionName}"][admin_level=4]->.region;
      (
        rel(area.region)[boundary=administrative][admin_level=8];
      );
      out geom;
    `.trim();
  }

  static getAllRegions(): string {
    return `
      [out:json][timeout:30];
      area["ISO3166-1"="GR"]->.greece;
      rel(area.greece)[boundary=administrative][admin_level=4];
      out geom;
    `.trim();
  }

  static getAllMunicipalities(): string {
    return `
      [out:json][timeout:60];
      area["ISO3166-1"="GR"]->.greece;
      rel(area.greece)[boundary=administrative][admin_level=8];
      out geom;
    `.trim();
  }

  static getAdminLevelInBounds(adminLevel: GreekAdminLevel, bounds: BoundingBox): string {
    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
    return `
      [out:json][timeout:25][bbox:${bbox}];
      (
        rel[boundary=administrative][admin_level=${adminLevel}]["ISO3166-1"="GR"];
      );
      out geom;
    `.trim();
  }

  static searchAdministrative(searchTerm: string, adminLevel?: GreekAdminLevel): string {
    const levelFilter = adminLevel ? `[admin_level=${adminLevel}]` : '';
    return `
      [out:json][timeout:25];
      area["ISO3166-1"="GR"]->.greece;
      (
        rel(area.greece)[boundary=administrative]${levelFilter}[~"name"~"${searchTerm}",i];
        rel(area.greece)[boundary=administrative]${levelFilter}[~"name:el"~"${searchTerm}",i];
        rel(area.greece)[boundary=administrative]${levelFilter}[~"alt_name"~"${searchTerm}",i];
      );
      out geom;
    `.trim();
  }

  static getPostalCodeByNumber(postalCode: string): string {
    return `
      [out:json][timeout:25];
      area["ISO3166-1"="GR"]->.greece;
      (
        rel(area.greece)[boundary=administrative][admin_level=12]["postal_code"="${postalCode}"];
        rel(area.greece)[boundary=postal_code]["postal_code"="${postalCode}"];
        way(area.greece)[postal_code="${postalCode}"][boundary];
        node(area.greece)[postal_code="${postalCode}"];
      );
      out geom;
    `.trim();
  }

  static getPostalCodesInMunicipality(municipalityName: string): string {
    return `
      [out:json][timeout:30];
      area["ISO3166-1"="GR"]->.greece;
      area(area.greece)["name"="${municipalityName}"][admin_level=8]->.municipality;
      (
        rel(area.municipality)[boundary=administrative][admin_level=12];
        rel(area.municipality)[boundary=postal_code];
        way(area.municipality)[postal_code][boundary];
        node(area.municipality)[postal_code];
      );
      out geom;
    `.trim();
  }

  static searchPostalCodes(searchTerm: string): string {
    return `
      [out:json][timeout:25];
      area["ISO3166-1"="GR"]->.greece;
      (
        rel(area.greece)[boundary~"(administrative|postal_code)"][admin_level=12][postal_code~"^${searchTerm}"];
        way(area.greece)[postal_code~"^${searchTerm}"][boundary];
        node(area.greece)[postal_code~"^${searchTerm}"];
      );
      out geom;
    `.trim();
  }

  static getPostalCodesInBounds(bounds: BoundingBox): string {
    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
    return `
      [out:json][timeout:25][bbox:${bbox}];
      (
        rel[boundary~"(administrative|postal_code)"][admin_level=12]["ISO3166-1"="GR"];
        way[postal_code][boundary];
        node[postal_code];
      );
      out geom;
    `.trim();
  }
}
