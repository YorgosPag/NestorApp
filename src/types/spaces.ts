/** A single space returned by batch-resolve */
export interface BatchResolvedSpace {
  id: string;
  spaceType: 'parking' | 'storage';
  area: number;
  commercial?: { askingPrice?: number };
  name?: string;
  buildingId?: string;
  floorId?: string;
  status?: string;
}

/** Response payload for POST /api/spaces/batch-resolve */
export interface BatchResolveResponse {
  spaces: BatchResolvedSpace[];
  notFound: string[];
}
