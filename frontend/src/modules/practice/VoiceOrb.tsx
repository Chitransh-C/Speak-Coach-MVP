import { useEffect, useRef } from "react";

type VoiceOrbProps = {
  /** 0..1 audio energy */
  level?: number;
  active?: boolean;
  className?: string;
};

type Point3 = { x: number; y: number; z: number };

function fibonacciSphere(count: number): Point3[] {
  const pts: Point3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    });
  }
  return pts;
}

/** Blue point-cloud sphere on transparent/white stage; reacts to `level`. */
export function VoiceOrb({ level = 0, active = false, className }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(level);
  const activeRef = useRef(active);
  const pointsRef = useRef<Point3[]>(fibonacciSphere(720));

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t0 = performance.now();
    let smooth = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = Math.min(canvas.clientWidth || 280, 360);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (now: number) => {
      const w = canvas.clientWidth || 280;
      const h = canvas.clientHeight || 280;
      const cx = w / 2;
      const cy = h / 2;
      const elapsed = (now - t0) / 1000;

      const target = activeRef.current ? Math.min(1, Math.max(0, levelRef.current)) : 0.08;
      smooth += (target - smooth) * 0.18;

      const baseR = Math.min(w, h) * 0.32;
      const pulse = 1 + smooth * 0.22;
      const rotY = elapsed * (0.35 + smooth * 0.55);
      const rotX = Math.sin(elapsed * 0.4) * 0.25;

      ctx.clearRect(0, 0, w, h);

      // Soft concentric rings (light blue)
      ctx.save();
      ctx.translate(cx, cy);
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, baseR * pulse * (1.15 + i * 0.18), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(37, 99, 235, ${0.06 + smooth * 0.08})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const projected: { x: number; y: number; z: number; a: number }[] = [];
      for (const p of pointsRef.current) {
        // rotate Y then X
        let x = p.x * cosY - p.z * sinY;
        let z = p.x * sinY + p.z * cosY;
        let y = p.y * cosX - z * sinX;
        z = p.y * sinX + z * cosX;

        // audio displacement along normal
        const bump = 1 + smooth * 0.14 * (0.6 + 0.4 * Math.sin(elapsed * 6 + p.x * 8));
        x *= bump;
        y *= bump;
        z *= bump;

        const depth = (z + 1.4) / 2.4;
        projected.push({
          x: cx + x * baseR * pulse,
          y: cy + y * baseR * pulse,
          z,
          a: 0.25 + depth * 0.75,
        });
      }
      projected.sort((a, b) => a.z - b.z);

      for (const pt of projected) {
        const size = 1.1 + (pt.z + 1) * 0.9 + smooth * 1.2;
        ctx.beginPath();
        ctx.fillStyle = `rgba(37, 99, 235, ${0.35 + pt.a * 0.55})`;
        ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "voice-orb-canvas"}
      aria-hidden
    />
  );
}
