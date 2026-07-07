const HIGH_PROTEIN_THRESHOLD_G = 30;

export function isHighProtein(macros: { protein_g: number } | undefined): boolean {
  return macros !== undefined && macros.protein_g >= HIGH_PROTEIN_THRESHOLD_G;
}
