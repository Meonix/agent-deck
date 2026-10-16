/** Share of state changes within 3 s, floored to one decimal so 999 of 1000 never reads as 100%. */
export function formatShare(within: number, total: number): string {
  const tenths = Math.floor((within * 1000) / total);
  return `${tenths % 10 === 0 ? tenths / 10 : (tenths / 10).toFixed(1)}%`;
}
