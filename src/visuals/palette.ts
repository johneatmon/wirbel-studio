// Fixed hue palette (not continuous hash→hue, which tends to look muddy) —
// picked for even spacing and readability on the app's near-black background.
const HUES = [152, 210, 280, 330, 20, 45, 190, 100];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function hueFor(key: string): number {
  return HUES[hashString(key) % HUES.length];
}
