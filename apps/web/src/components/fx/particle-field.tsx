"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { usePrefersReducedMotion } from "./use-fx";

/**
 * Three.js particle field for the landing hero (Editorial Mode canvas).
 *
 * Rendered behind the hero content, so it must sit inside the absolutely
 * positioned `.landing-hero-fx` layer. Because it needs WebGL and window,
 * import it with `next/dynamic` and SSR disabled:
 *
 *   const ParticleField = dynamic(
 *     () => import("@/components/fx/particle-field"),
 *     { ssr: false },
 *   );
 *
 * Honor `prefers-reduced-motion`: a single static frame is rendered and no
 * animation loop, listeners or observers are started.
 */

const POINT_COUNT = 180;
// Editorial palette: Signal Orange, soft amber, olive, deep ink.
const PALETTE = ["#dc5000", "#f2a65a", "#445231", "#100904"];

function createDotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.45, "rgba(255, 255, 255, 0.75)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

export default function ParticleField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return; // No WebGL available — hero stays on the plain cream canvas.
    }

    const disposables: Array<{ dispose(): void }> = [];
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
    camera.position.set(0, 0, 42);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    // --- Drifting point field ------------------------------------------------
    const positions = new Float32Array(POINT_COUNT * 3);
    const basePositions = new Float32Array(POINT_COUNT * 3);
    const colors = new Float32Array(POINT_COUNT * 3);
    const phases = new Float32Array(POINT_COUNT);
    const speeds = new Float32Array(POINT_COUNT);
    const tint = new THREE.Color();
    for (let i = 0; i < POINT_COUNT; i += 1) {
      basePositions[i * 3] = (Math.random() - 0.5) * 130;
      basePositions[i * 3 + 1] = (Math.random() - 0.5) * 80;
      basePositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      tint.set(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.2 + Math.random() * 0.5;
    }
    positions.set(basePositions);
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    pointsGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const dotTexture = createDotTexture();
    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.28,
      map: dotTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(points);
    disposables.push(pointsGeometry, pointsMaterial, dotTexture);

    // --- Soft wireframe icosahedra -------------------------------------------
    const shapes: THREE.Mesh[] = [];
    const shapeSpecs = [
      { radius: 7, x: -28, y: 10, z: -14, color: "#dc5000", opacity: 0.1 },
      { radius: 10, x: 30, y: -8, z: -22, color: "#445231", opacity: 0.1 },
      { radius: 5, x: 12, y: 16, z: -30, color: "#100904", opacity: 0.06 },
    ];
    for (const spec of shapeSpecs) {
      const shapeGeometry = new THREE.IcosahedronGeometry(spec.radius, 1);
      const shapeMaterial = new THREE.MeshBasicMaterial({
        color: spec.color,
        wireframe: true,
        transparent: true,
        opacity: spec.opacity,
      });
      const mesh = new THREE.Mesh(shapeGeometry, shapeMaterial);
      mesh.position.set(spec.x, spec.y, spec.z);
      scene.add(mesh);
      shapes.push(mesh);
      disposables.push(shapeGeometry, shapeMaterial);
    }

    // --- Sizing ---------------------------------------------------------------
    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (reduceMotion) renderer.render(scene, camera);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // --- Static frame for reduced motion --------------------------------------
    if (reduceMotion) {
      renderer.render(scene, camera);
      return () => {
        resizeObserver.disconnect();
        for (const item of disposables) item.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    }

    // --- Gentle lerped mouse parallax ------------------------------------------
    const pointer = { x: 0, y: 0 };
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onPointerMove = (event: PointerEvent) => {
      if (!finePointer.matches || event.pointerType !== "mouse") return;
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    // --- Render loop with visibility pause --------------------------------------
    const positionAttribute = pointsGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const timer = new THREE.Timer();
    let raf = 0;
    let running = false;
    let inViewport = true;

    const loop = () => {
      timer.update();
      const delta = Math.min(timer.getDelta(), 0.05);
      const time = timer.getElapsed();
      for (let i = 0; i < POINT_COUNT; i += 1) {
        const base = basePositions[i * 3 + 1];
        positionAttribute.setY(
          i,
          base + Math.sin(time * speeds[i] + phases[i]) * 1.6,
        );
      }
      positionAttribute.needsUpdate = true;
      points.rotation.y += delta * 0.02;
      for (let i = 0; i < shapes.length; i += 1) {
        shapes[i].rotation.x += delta * (0.05 + i * 0.02);
        shapes[i].rotation.y += delta * (0.07 + i * 0.015);
      }
      camera.position.x += (pointer.x * 3 - camera.position.x) * 0.04;
      camera.position.y += (-pointer.y * 2 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running) return;
      running = true;
      timer.reset();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry?.isIntersecting ?? true;
        if (inViewport && !document.hidden) start();
        else stop();
      },
      { threshold: 0 },
    );
    visibilityObserver.observe(container);
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else if (inViewport) start();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    start();

    return () => {
      stop();
      timer.dispose();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointermove", onPointerMove);
      for (const item of disposables) item.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [reduceMotion]);

  return (
    <div ref={containerRef} className="landing-hero-fx" aria-hidden="true" />
  );
}
