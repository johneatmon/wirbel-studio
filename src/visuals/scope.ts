/** Oscilloscope-style waveform line, drawn first so the hap lane composites
 * on top of it. */
export function drawScope(
  ctx: CanvasRenderingContext2D,
  waveform: Float32Array,
  width: number,
  height: number,
): void {
  if (waveform.length === 0) return;
  const midY = height / 2;
  const step = width / waveform.length;

  ctx.beginPath();
  for (let i = 0; i < waveform.length; i++) {
    const x = i * step;
    const y = midY + waveform[i] * midY * 0.9;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)'; // emerald-400, low opacity underlay
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
