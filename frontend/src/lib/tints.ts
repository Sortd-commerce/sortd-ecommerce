export const CARD_TINTS = ["#f8eadb", "#c9e3ce", "#d3e5f3"] as const;

export function cardTint(id: number) {
  return CARD_TINTS[Math.abs(id) % CARD_TINTS.length];
}

export function aisleTint(index: number) {
  return CARD_TINTS[index % CARD_TINTS.length];
}
