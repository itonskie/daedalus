export interface PaletteColor {
  readonly name: string;
  readonly hex: string;
}

export const PALETTE: readonly PaletteColor[] = [
  { name: "white", hex: "#F4F4F5" },
  { name: "black", hex: "#0A0A0B" },
  { name: "red", hex: "#EF4444" },
  { name: "orange", hex: "#F59E0B" },
  { name: "yellow", hex: "#FBBF24" },
  { name: "green", hex: "#10B981" },
  { name: "blue", hex: "#3B82F6" },
  { name: "indigo", hex: "#5E6AD2" },
  { name: "purple", hex: "#A855F7" },
  { name: "pink", hex: "#EC4899" },
  { name: "brown", hex: "#8B4513" },
  { name: "stone", hex: "#78716C" },
  { name: "wood", hex: "#B08050" },
  { name: "grass", hex: "#65A30D" },
  { name: "water", hex: "#0EA5E9" },
  { name: "gold", hex: "#D4AF37" },
];

const NAME_TO_INDEX = new Map<string, number>(PALETTE.map((c, i) => [c.name, i]));

export function paletteIndexOf(name: string): number {
  const idx = NAME_TO_INDEX.get(name);
  if (idx === undefined) throw new Error(`Unknown color: ${name}`);
  return idx;
}
