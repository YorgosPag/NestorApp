import type { ProjectStructure } from "@/services/projects.service";

export const getTotals = (structure: ProjectStructure) => {
  const totalUnits = structure.buildings.reduce((s, b) => s + b.units.length, 0);
  const soldUnits = structure.buildings.reduce((s, b) => s + b.units.filter(u => u.status === "sold").length, 0);
  const totalArea = structure.buildings.reduce((s, b) => s + b.units.reduce((x, u) => x + (u.area || 0), 0), 0);
  const soldArea = structure.buildings.reduce(
    (s, b) => s + b.units.filter(u => u.status === "sold").reduce((x, u) => x + (u.area || 0), 0),
    0
  );
  const soldPct = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0;
  return { totalUnits, soldUnits, totalArea, soldArea, soldPct };
};
