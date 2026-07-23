// Mirrors apps/api/src/clusters/cluster-colors.ts — light/pastel swatches
// for the cluster color picker. Kept light so the color works as a
// background tint (e.g. behind a tab label) without needing special-cased
// text contrast handling.
export const CLUSTER_COLORS = [
  "#fca5a5", // red-300
  "#fdba74", // orange-300
  "#fcd34d", // amber-300
  "#bef264", // lime-300
  "#86efac", // green-300
  "#5eead4", // teal-300
  "#67e8f9", // cyan-300
  "#7dd3fc", // sky-300
  "#93c5fd", // blue-300
  "#a5b4fc", // indigo-300
  "#c4b5fd", // violet-300
  "#f9a8d4", // pink-300
] as const;

export function pickRandomClusterColor(): string {
  return CLUSTER_COLORS[Math.floor(Math.random() * CLUSTER_COLORS.length)];
}
