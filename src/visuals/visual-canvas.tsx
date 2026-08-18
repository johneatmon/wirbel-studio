import { useEffect, useRef } from 'react';
import { onFrame } from '../audio/clock';
import { currentPattern, scopeWaveform } from '../audio/engine';
import { drawHapLane } from './hap-lane';
import { drawScope } from './scope';

/** Both layers share the ClockStore's single rAF (see audio/clock.ts's
 * onFrame) rather than running their own loops — §7 perf budget. */
export function VisualCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const unsubscribe = onFrame((now) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);
      drawScope(ctx, scopeWaveform(), width, height);
      drawHapLane(ctx, currentPattern(), now, width, height);
    });

    return () => {
      unsubscribe();
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
