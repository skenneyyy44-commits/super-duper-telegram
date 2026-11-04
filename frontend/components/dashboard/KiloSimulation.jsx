import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Crosshair,
  Info,
  Maximize2,
  Minimize2,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Zap,
} from 'lucide-react';

const DEFAULT_VIEW = 'orbital';

const getWindowDimensions = () => {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720, dpr: 1 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  };
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const useCanvasDimensions = () => {
  const [dimensions, setDimensions] = useState(getWindowDimensions);

  useEffect(() => {
    const handleResize = () => setDimensions(getWindowDimensions());
    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return dimensions;
};

const createNoiseTable = (length) =>
  new Array(length).fill(0).map((_, index) => {
    const n = Math.sin(index * 12.9898) * 43758.5453;
    return n - Math.floor(n);
  });

const drawBackdrop = (ctx, { width, height }, time) => {
  ctx.save();
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.4,
    width * 0.05,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.8,
  );

  gradient.addColorStop(0, '#0b132b');
  gradient.addColorStop(0.35, '#04091a');
  gradient.addColorStop(0.7, '#02040a');
  gradient.addColorStop(1, '#010207');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const nebulaGradient = ctx.createLinearGradient(0, 0, width, height);
  nebulaGradient.addColorStop(0, 'rgba(92, 120, 255, 0.08)');
  nebulaGradient.addColorStop(0.4, 'rgba(113, 46, 173, 0.12)');
  nebulaGradient.addColorStop(1, 'rgba(16, 185, 129, 0.1)');

  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = nebulaGradient;
  ctx.fillRect(0, 0, width, height);

  // Vignette for cinematic feel
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.2,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75,
  );

  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.65)');

  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // Animated aurora sweep
  const sweepWidth = width * 0.12;
  const sweepX = (Math.sin(time * 0.0007) * 0.5 + 0.5) * (width + sweepWidth * 2) - sweepWidth;
  const sweepGradient = ctx.createLinearGradient(sweepX - sweepWidth, 0, sweepX + sweepWidth, 0);
  sweepGradient.addColorStop(0, 'rgba(16, 185, 129, 0)');
  sweepGradient.addColorStop(0.45, 'rgba(59, 130, 246, 0.15)');
  sweepGradient.addColorStop(0.5, 'rgba(236, 72, 153, 0.25)');
  sweepGradient.addColorStop(0.55, 'rgba(59, 130, 246, 0.15)');
  sweepGradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = sweepGradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

const drawVignette = (ctx, { width, height }) => {
  ctx.save();
  const vignetteGradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.65,
  );
  vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = vignetteGradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

const drawLensArtifacts = (ctx, { width, height }, time) => {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const flareGradient = ctx.createRadialGradient(
    width * 0.2,
    height * 0.2,
    0,
    width * 0.2,
    height * 0.2,
    width * 0.6,
  );

  flareGradient.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
  flareGradient.addColorStop(0.3, 'rgba(239, 68, 68, 0.05)');
  flareGradient.addColorStop(1, 'rgba(12, 74, 110, 0)');

  ctx.fillStyle = flareGradient;
  ctx.fillRect(0, 0, width, height);

  const pulse = Math.sin(time * 0.002) * 0.5 + 0.5;
  ctx.strokeStyle = `rgba(59, 130, 246, ${0.08 + pulse * 0.07})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const drawConstellations = (ctx, { width, height }, constellations, time) => {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.setLineDash([6, 10]);
  ctx.lineWidth = 0.7;

  const oscillation = Math.sin(time * 0.0015) * 0.1;

  constellations.forEach((constellation) => {
    ctx.beginPath();
    constellation.points.forEach(([px, py], index) => {
      const x = px * width + Math.sin((time * 0.0003 + px) * 10) * oscillation;
      const y = py * height + Math.cos((time * 0.0003 + py) * 10) * oscillation;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    constellation.points.forEach(([px, py]) => {
      const x = px * width;
      const y = py * height;

      ctx.beginPath();
      ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
      ctx.arc(x, y, 1.5 + Math.sin(time * 0.002 + px * 4) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  ctx.restore();
};

const useConstellations = () =>
  useMemo(
    () => [
      {
        id: 'arcanum',
        label: 'Arcanum',
        points: [
          [0.1, 0.1],
          [0.16, 0.16],
          [0.22, 0.09],
          [0.28, 0.18],
          [0.32, 0.11],
        ],
      },
      {
        id: 'relay',
        label: 'Relay',
        points: [
          [0.75, 0.12],
          [0.8, 0.18],
          [0.72, 0.22],
          [0.78, 0.3],
        ],
      },
      {
        id: 'veil',
        label: 'Veil',
        points: [
          [0.65, 0.7],
          [0.7, 0.62],
          [0.76, 0.68],
          [0.74, 0.75],
          [0.68, 0.78],
        ],
      },
    ],
    [],
  );

const useScene = () =>
  useRef({
    time: 0,
    particles: [],
    stars: [],
    scanLine: 0,
    autoRotate: true,
    lightSource: { x: -0.45, y: -0.4, z: 1 },
  });

const KiloSimulation = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const sceneRef = useScene();
  const dimensions = useCanvasDimensions();
  const constellations = useConstellations();

  const [isPlaying, setIsPlaying] = useState(true);
  const [viewMode, setViewMode] = useState(DEFAULT_VIEW);
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [speed, setSpeed] = useState(1.2);
  const [isDragging, setIsDragging] = useState(false);
  const [userRotation, setUserRotation] = useState({ x: 0, y: 0 });
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showConstellations, setShowConstellations] = useState(true);
  const [showLens, setShowLens] = useState(true);

  const noiseValues = useMemo(() => createNoiseTable(1024), []);

  const registerParticles = useCallback(() => {
    const particles = [];
    for (let i = 0; i < 700; i += 1) {
      particles.push({
        x: (Math.random() - 0.5) * 1.8,
        y: (Math.random() - 0.5) * 1.8,
        z: (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        vz: Math.random() * 3.8 + 0.4,
        life: Math.random() * 160,
        maxLife: 120 + Math.random() * 120,
        size: Math.random() * 2 + 0.6,
        type: Math.random() > 0.6 ? 'ion' : 'dust',
      });
    }
    return particles;
  }, []);

  const registerStars = useCallback(() => {
    const stars = [];
    for (let i = 0; i < 850; i += 1) {
      const depth = Math.random();
      stars.push({
        x: (Math.random() - 0.5) * 3600,
        y: (Math.random() - 0.5) * 3600,
        z: (Math.random() - 0.5) * 3600,
        size: Math.max(0.6, Math.random() * 1.8),
        hue: 180 + Math.random() * 120,
        saturation: 45 + Math.random() * 30,
        brightness: 0.4 + depth * 0.6,
        flickerSpeed: 0.02 + Math.random() * 0.12,
      });
    }
    return stars;
  }, []);

  useEffect(() => {
    if (!sceneRef.current.particles.length) {
      sceneRef.current.particles = registerParticles();
      sceneRef.current.stars = registerStars();
    }
  }, [registerParticles, registerStars, sceneRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const { width, height, dpr } = dimensions;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const project = (x, y, z) => {
      const fov = 900 * zoom;
      const scale = fov / (fov + z + 30);
      return {
        x: width / 2 + x * scale * 32,
        y: height / 2 + y * scale * 32,
        scale,
        visible: z > -60,
      };
    };

    const rotateX = (x, y, z, angle) => ({
      x,
      y: y * Math.cos(angle) - z * Math.sin(angle),
      z: y * Math.sin(angle) + z * Math.cos(angle),
    });

    const rotateY = (x, y, z, angle) => ({
      x: x * Math.cos(angle) - z * Math.sin(angle),
      y,
      z: x * Math.sin(angle) + z * Math.cos(angle),
    });

    const rotateZ = (x, y, z, angle) => ({
      x: x * Math.cos(angle) - y * Math.sin(angle),
      y: x * Math.sin(angle) + y * Math.cos(angle),
      z,
    });

    const magnitude = (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    const normalize = (v) => {
      const m = magnitude(v);
      return m === 0 ? { x: 0, y: 0, z: 0 } : { x: v.x / m, y: v.y / m, z: v.z / m };
    };
    const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const cross = (a, b) => ({
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    });

    const drawStars = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      sceneRef.current.stars.forEach((star) => {
        let point = rotateY(star.x, star.y, star.z, userRotation.y * 0.18);
        point = rotateX(point.x, point.y, point.z, userRotation.x * 0.18);

        const scale = 850 / (850 + point.z);
        const x = width / 2 + point.x * scale;
        const y = height / 2 + point.y * scale;

        if (scale <= 0) {
          return;
        }

        const flicker = Math.sin(sceneRef.current.time * star.flickerSpeed) * 0.45 + 0.65;
        ctx.fillStyle = `hsla(${star.hue}, ${star.saturation}%, ${clamp(50 * scale, 35, 80)}%, ${
          star.brightness * flicker
        })`;

        const size = star.size * scale;
        ctx.fillRect(x, y, size, size);
      });
      ctx.restore();
    };

    const drawTail = (rotationX, rotationY) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const { particles } = sceneRef.current;

      particles.forEach((particle) => {
        if (particle.life <= 0) {
          particle.x = (Math.random() - 0.5) * 1.5;
          particle.y = (Math.random() - 0.5) * 1.5;
          particle.z = (Math.random() - 0.5) * 6;
          particle.life = particle.maxLife;
        }

        particle.x += particle.vx * speed * 0.8;
        particle.y += particle.vy * speed * 0.8;
        particle.z += particle.vz * speed * 0.8;
        particle.life -= speed;

        let point = { x: particle.x, y: particle.y, z: particle.z + 4 };
        point = rotateY(point.x, point.y, point.z, rotationY);
        point = rotateX(point.x, point.y, point.z, rotationX);

        const projected = project(point.x, point.y, point.z);
        if (!projected.visible) {
          return;
        }

        const dist = Math.abs(particle.z);
        const hue = dist < 3 ? 196 : 28;
        const alpha = (particle.life / particle.maxLife) * 0.55;
        const size = particle.size * projected.scale * (viewMode === 'closeup' ? 1.4 : 0.9);

        ctx.beginPath();
        ctx.fillStyle = `hsla(${hue}, ${particle.type === 'ion' ? 95 : 70}%, 60%, ${alpha})`;
        ctx.arc(projected.x, projected.y, size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    };

    const drawObject = (rotationX, rotationY) => {
      const { time, scanLine, lightSource } = sceneRef.current;

      const rings = 40;
      const segsPerRing = 14;
      const length = 8.6;
      const widthRadius = 1.2;

      const tumbleX = time * 0.0075;
      const tumbleY = time * 0.013;
      const wobble = Math.sin(time * 0.004) * 0.32;

      const segments = [];
      for (let i = 0; i <= rings; i += 1) {
        const t = (i / rings) * 2 - 1;
        const zBase = t * length;
        const radius = widthRadius * Math.sqrt(1 - Math.pow(Math.abs(t), 2.35));
        const spineX = Math.sin(t * 2.6) * 0.25 + Math.cos(t * 3.1) * 0.08;

        for (let j = 0; j < segsPerRing; j += 1) {
          const angle = (j / segsPerRing) * Math.PI * 2;
          const noiseIdx = (i * segsPerRing + j) % noiseValues.length;
          const surfaceDetail = 1 + noiseValues[noiseIdx] * 0.18 - noiseValues[(noiseIdx + 37) % noiseValues.length] * 0.08;
          const craterOffset = Math.sin(t * 6 + j * 0.5) * 0.08;

          const xBase = Math.cos(angle) * radius * surfaceDetail + spineX + craterOffset;
          const yBase = Math.sin(angle) * radius * surfaceDetail + Math.cos(t * 4 + angle * 1.4) * 0.04;

          let point = { x: xBase, y: yBase, z: zBase };
          point = rotateY(point.x, point.y, point.z, tumbleY);
          point = rotateX(point.x, point.y, point.z, tumbleX);
          point = rotateZ(point.x, point.y, point.z, wobble);
          point = rotateY(point.x, point.y, point.z, rotationY);
          point = rotateX(point.x, point.y, point.z, rotationX);

          segments.push({ ...point, ring: i, idx: j });
        }
      }

      const faces = [];
      for (let i = 0; i < rings; i += 1) {
        for (let j = 0; j < segsPerRing; j += 1) {
          const idx1 = i * segsPerRing + j;
          const idx2 = i * segsPerRing + ((j + 1) % segsPerRing);
          const idx3 = (i + 1) * segsPerRing + ((j + 1) % segsPerRing);
          const idx4 = (i + 1) * segsPerRing + j;

          const p1 = segments[idx1];
          const p2 = segments[idx2];
          const p3 = segments[idx3];
          const p4 = segments[idx4];

          const vA = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
          const vB = { x: p4.x - p1.x, y: p4.y - p1.y, z: p4.z - p1.z };
          const normal = normalize(cross(vA, vB));
          const centerZ = (p1.z + p2.z + p3.z + p4.z) / 4;

          faces.push({ p1, p2, p3, p4, normal, centerZ, ring: i });
        }
      }

      faces.sort((a, b) => b.centerZ - a.centerZ);
      const lightDirection = normalize(lightSource);

      faces.forEach((face) => {
        const { p1, p2, p3, p4, normal, ring } = face;
        const projected1 = project(p1.x, p1.y, p1.z);

        if (!projected1.visible) {
          return;
        }

        const projected2 = project(p2.x, p2.y, p2.z);
        const projected3 = project(p3.x, p3.y, p3.z);
        const projected4 = project(p4.x, p4.y, p4.z);

        const dotNL = dot(normal, lightDirection);
        const diffuse = Math.max(0, dotNL);

        const viewDirection = { x: 0, y: 0, z: 1 };
        const reflectDir = {
          x: 2 * dotNL * normal.x - lightDirection.x,
          y: 2 * dotNL * normal.y - lightDirection.y,
          z: 2 * dotNL * normal.z - lightDirection.z,
        };
        const specular = Math.pow(Math.max(0, dot(reflectDir, viewDirection)), 8);

        const occlusion = Math.pow(Math.abs(normal.z), 2.4);
        let fillStyle;
        if (viewMode === 'thermal') {
          const temp = Math.sin(sceneRef.current.time * 0.015 + ring * 0.55) * 0.5 + 0.5;
          const hue = 30 + temp * 50;
          const lightness = 28 + diffuse * 52 + specular * 20;
          fillStyle = `hsl(${hue}, 95%, ${clamp(lightness, 15, 85)}%)`;
        } else if (viewMode === 'closeup') {
          const hueBase = 12 + occlusion * 30;
          const saturation = 22 + occlusion * 35;
          const lightness = 16 + diffuse * 24 + specular * 45;
          fillStyle = `hsl(${hueBase}, ${saturation}%, ${clamp(lightness, 12, 70)}%)`;
        } else {
          const hue = 210 + diffuse * 8 + occlusion * -30;
          const saturation = 14 + occlusion * 40;
          const lightness = 10 + diffuse * 32 + specular * 30;
          fillStyle = `hsl(${hue}, ${clamp(saturation, 6, 52)}%, ${clamp(lightness, 8, 65)}%)`;
        }

        const scanPos = (Math.sin(sceneRef.current.scanLine) + 1) / 2;
        const facePos = ring / rings;
        const inScan = Math.abs(scanPos - facePos) < 0.03;

        ctx.beginPath();
        ctx.moveTo(projected1.x, projected1.y);
        ctx.lineTo(projected2.x, projected2.y);
        ctx.lineTo(projected3.x, projected3.y);
        ctx.lineTo(projected4.x, projected4.y);
        ctx.closePath();

        ctx.fillStyle = fillStyle;
        if (inScan && viewMode !== 'thermal') {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(94, 234, 212, 0.35)';
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fill();
        }

        if (diffuse > 0.55 || inScan) {
          ctx.save();
          ctx.strokeStyle = inScan
            ? 'rgba(165, 243, 252, 0.8)'
            : `rgba(255, 255, 255, ${0.06 + specular * 0.4})`;
          ctx.lineWidth = inScan ? 1 : 0.45;
          ctx.stroke();
          ctx.restore();
        }
      });
    };

    const drawHUD = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.15)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.42, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([6, 18]);
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const render = () => {
      if (!ctx) {
        return;
      }

      const { time } = sceneRef.current;

      drawBackdrop(ctx, dimensions, time);
      drawStars();

      if (isPlaying) {
        sceneRef.current.time += speed * 16;
        sceneRef.current.scanLine += 0.018 * speed;
      }

      let rotationX = userRotation.x;
      let rotationY = userRotation.y;

      if (sceneRef.current.autoRotate && !isDragging) {
        rotationY += sceneRef.current.time * 0.00032;
      }

      drawTail(rotationX, rotationY);
      drawObject(rotationX, rotationY);

      if (showConstellations) {
        drawConstellations(ctx, dimensions, constellations, sceneRef.current.time);
      }

      if (showLens) {
        drawLensArtifacts(ctx, dimensions, time);
      }

      drawHUD();
      drawVignette(ctx, dimensions);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    constellations,
    dimensions,
    isDragging,
    isPlaying,
    sceneRef,
    showConstellations,
    showLens,
    speed,
    userRotation,
    viewMode,
    zoom,
  ]);

  const handleMouseDown = useCallback((event) => {
    setIsDragging(true);
    setLastMousePos({ x: event.clientX, y: event.clientY });
    sceneRef.current.autoRotate = false;
  }, [sceneRef]);

  const handleMouseMove = useCallback(
    (event) => {
      if (!isDragging) {
        return;
      }

      const dx = event.clientX - lastMousePos.x;
      const dy = event.clientY - lastMousePos.y;

      setUserRotation((prev) => ({ x: prev.x + dy * 0.01, y: prev.y + dx * 0.01 }));
      setLastMousePos({ x: event.clientX, y: event.clientY });
    },
    [isDragging, lastMousePos],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((event) => {
    setZoom((prev) => clamp(prev - event.deltaY * 0.001, 0.5, 3));
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const resetView = useCallback(() => {
    sceneRef.current.time = 0;
    sceneRef.current.scanLine = 0;
    setUserRotation({ x: 0, y: 0 });
    setZoom(1);
    sceneRef.current.autoRotate = true;
  }, [sceneRef]);

  const { width, height } = dimensions;

  return (
    <div className="relative flex min-h-screen w-full select-none flex-col overflow-hidden bg-black font-sans text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.15),transparent_45%),radial-gradient(circle_at_80%_15%,rgba(236,72,153,0.1),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(96,165,250,0.08),transparent_60%)]" />

      <div className="absolute top-0 left-0 right-0 z-20 flex h-14 items-center justify-between border-b border-slate-800/60 bg-slate-950/70 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-400 shadow-lg shadow-blue-500/30">
            <Activity className="animate-pulse" size={18} />
          </div>
          <div>
            <h1 className="font-mono text-lg font-semibold tracking-[0.35em] text-slate-100">
              ASO-202X <span className="text-blue-400">KILO</span>
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400/70">
              Autonomous Survey Orbiter // Deep Field Telemetry
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">Live feed</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
          </div>
          <div className="hidden items-center gap-2 text-slate-400 sm:flex">
            <MousePointer2 size={14} className="text-slate-500" />
            <span>Drag to orient / Scroll to zoom</span>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={width * dimensions.dpr}
          height={height * dimensions.dpr}
          className="h-full w-full cursor-move"
          style={{ width: '100%', height: '100%' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 md:p-6">
          {showTelemetry && (
            <div className="mt-16 flex w-full max-w-sm flex-col gap-3 opacity-95">
              <div className="pointer-events-auto overflow-hidden rounded-lg border border-blue-400/40 bg-slate-950/70 shadow-lg">
                <div className="flex items-center gap-2 border-b border-blue-400/30 bg-blue-500/10 px-3 py-2 text-blue-300">
                  <ScanLine size={14} />
                  <span className="font-mono text-[11px] tracking-[0.3em]">Spectrographic Sweep</span>
                </div>
                <div className="space-y-2 px-3 py-3">
                  {[
                    { label: 'H2O ICE', value: 0.12, accent: 'bg-sky-500' },
                    { label: 'ORGANICS', value: 0.48, accent: 'bg-amber-500' },
                    { label: 'METALLICS', value: 0.86, accent: 'bg-cyan-300 animate-pulse' },
                    { label: 'THOLINS', value: 0.33, accent: 'bg-fuchsia-500/80' },
                  ].map((item) => (
                    <div key={item.label} className="grid grid-cols-5 items-center gap-2 font-mono text-[11px]">
                      <span className="col-span-2 text-slate-400">{item.label}</span>
                      <div className="col-span-3 h-1.5 rounded-full bg-slate-800">
                        <div className={`${item.accent} h-full rounded-full`} style={{ width: `${item.value * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pointer-events-auto rounded-lg border border-rose-400/40 bg-slate-950/70 px-3 py-3 font-mono shadow-lg">
                <div className="flex items-center justify-between text-[11px] text-rose-300">
                  <div className="flex items-center gap-2">
                    <Zap size={14} />
                    <span className="tracking-[0.25em]">Delta-V</span>
                  </div>
                  <span className="text-slate-500">perigee drift</span>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <div className="text-2xl font-semibold text-slate-100">
                    4.72<span className="ml-1 text-xs text-slate-500">e-4 m/s²</span>
                  </div>
                  <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-200">
                    Ion stream stable
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pointer-events-auto absolute right-4 top-20 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setViewMode('orbital')}
              className={`rounded border px-2 py-2 text-slate-300 transition-all ${
                viewMode === 'orbital'
                  ? 'border-blue-400 bg-blue-500/20 text-blue-100 shadow-lg shadow-blue-500/30'
                  : 'border-slate-700/60 bg-slate-900/70 hover:border-blue-400/40 hover:text-blue-200'
              }`}
            >
              <Maximize2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('closeup')}
              className={`rounded border px-2 py-2 text-slate-300 transition-all ${
                viewMode === 'closeup'
                  ? 'border-blue-400 bg-blue-500/20 text-blue-100 shadow-lg shadow-blue-500/30'
                  : 'border-slate-700/60 bg-slate-900/70 hover:border-blue-400/40 hover:text-blue-200'
              }`}
            >
              <Crosshair size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('thermal')}
              className={`rounded border px-2 py-2 text-slate-300 transition-all ${
                viewMode === 'thermal'
                  ? 'border-orange-400 bg-orange-500/20 text-orange-100 shadow-lg shadow-orange-500/30'
                  : 'border-slate-700/60 bg-slate-900/70 hover:border-orange-400/40 hover:text-orange-200'
              }`}
            >
              <Activity size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowConstellations((prev) => !prev)}
              className={`rounded border px-2 py-2 text-slate-300 transition-all ${
                showConstellations
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100 shadow-lg shadow-emerald-500/30'
                  : 'border-slate-700/60 bg-slate-900/70 hover:border-emerald-400/40 hover:text-emerald-200'
              }`}
            >
              <Minimize2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowLens((prev) => !prev)}
              className={`rounded border px-2 py-2 text-slate-300 transition-all ${
                showLens
                  ? 'border-sky-400 bg-sky-500/20 text-sky-100 shadow-lg shadow-sky-500/30'
                  : 'border-slate-700/60 bg-slate-900/70 hover:border-sky-400/40 hover:text-sky-200'
              }`}
            >
              <Info size={16} />
            </button>
          </div>

          <div className="pointer-events-auto flex flex-col gap-3 pb-4">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 backdrop-blur">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-700/50 bg-slate-900/60 text-blue-300 transition hover:border-blue-400 hover:bg-blue-500/10 hover:text-blue-100"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                type="button"
                onClick={resetView}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-700/50 bg-slate-900/60 text-slate-400 transition hover:border-slate-300/60 hover:bg-slate-800/70 hover:text-slate-100"
              >
                <RotateCcw size={16} />
              </button>
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Speed</span>
                <input
                  type="range"
                  min="0.2"
                  max="5"
                  step="0.1"
                  value={speed}
                  onChange={(event) => setSpeed(parseFloat(event.target.value))}
                  className="h-1 w-36 cursor-pointer appearance-none rounded-full bg-slate-800 accent-blue-500"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Zoom</span>
                <div className="rounded border border-slate-700/50 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300">
                  {zoom.toFixed(2)}x
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Rotation</span>
                <div className="flex gap-2 text-[11px] text-slate-300">
                  <span>φ {userRotation.y.toFixed(2)}</span>
                  <span>θ {userRotation.x.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowTelemetry((prev) => !prev)}
                className="rounded border border-slate-700/60 bg-slate-950/70 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400 transition hover:border-slate-400/70 hover:text-slate-100"
              >
                {showTelemetry ? 'Hide Telemetry' : 'Show Telemetry'}
              </button>
              <div className="rounded border border-blue-400/30 bg-blue-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-blue-200">
                FOV {Math.round(900 * zoom)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KiloSimulation;

