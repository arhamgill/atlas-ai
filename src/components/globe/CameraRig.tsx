"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { geoCentroid } from "d3-geo";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { latLngToVector3 } from "@/lib/geo/sphere";
import { getCountryFeatures } from "@/lib/geo/topology";
import { useGlobeStore } from "@/lib/state/globe";

type Controls = {
  update: () => void;
  autoRotate: boolean;
  enabled: boolean;
  target: THREE.Vector3;
};

/**
 * How much of the tighter viewport axis the globe should occupy. Tuned so a
 * landscape desktop lands at the ~3.55 distance the design was built around.
 */
const FILL_FACTOR = 0.818;

/**
 * Distance at which the globe fits the viewport.
 *
 * A fixed distance is only ever right for one aspect ratio. On a tall phone
 * the limiting dimension is width, and the horizontal field of view is much
 * narrower than the vertical one — a camera framed for a 16:9 desktop puts the
 * globe well outside the screen. Framing off whichever axis is tighter keeps
 * it correct everywhere.
 */
function restDistanceFor(aspect: number, fovDeg: number): number {
  const vFov = (fovDeg * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(aspect, 0.05));
  const target = Math.min(vFov, hFov) * FILL_FACTOR;
  return 1 / Math.sin(target / 2);
}
/** Where the intro starts: far enough out that the globe reads as small. */
const INTRO_DISTANCE = 13;
const INTRO_SECONDS = 2.4;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Slow out, quick through the middle, slow in. An ease-out alone front-loads
 * almost all the motion into the first half second, so the globe appears to
 * snap into place and then crawl — this keeps it visibly travelling for the
 * whole flight, which is what reads as cinematic.
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Orbit controls, the opening flight, and a damped flight to whichever country
 * is selected.
 *
 * The globe mesh itself never rotates — the camera orbits instead. That keeps
 * world space and globe space identical, so a raycast hit can be converted
 * straight to lat/lng without unwinding a rotation.
 */
export function CameraRig() {
  const controlsRef = useRef<Controls | null>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  const restDistance = useMemo(
    () => restDistanceFor(size.width / size.height, camera.fov ?? 40),
    [size.width, size.height, camera.fov],
  );

  const selected = useGlobeStore((s) => s.selected);
  const interacted = useGlobeStore((s) => s.interacted);
  const markInteracted = useGlobeStore((s) => s.markInteracted);
  const introDone = useGlobeStore((s) => s.introDone);
  const finishIntro = useGlobeStore((s) => s.finishIntro);

  const flightTarget = useRef<THREE.Vector3 | null>(null);
  const flying = useRef(false);

  // --- Opening flight ------------------------------------------------------
  const introStart = useRef(0);
  const introFrom = useRef(new THREE.Vector3());
  const introTo = useRef(new THREE.Vector3());
  const introActive = useRef(false);

  useEffect(() => {
    if (introDone) return;

    if (prefersReducedMotion()) {
      camera.position.setFromSphericalCoords(restDistance, Math.PI / 2 - 0.12, 0);
      finishIntro();
      return;
    }

    // Start further out and swung round, so the flight covers distance *and*
    // longitude — a pure dolly reads as a zoom, not an arrival.
    const from = new THREE.Vector3(-0.55, 0.3, 1)
      .normalize()
      .multiplyScalar(INTRO_DISTANCE * Math.max(1, restDistance / 3.55));
    const to = new THREE.Vector3(0, 0.42, 1).normalize().multiplyScalar(restDistance);

    introFrom.current.copy(from);
    introTo.current.copy(to);
    camera.position.copy(from);
    introStart.current = performance.now();
    introActive.current = true;

    // Controls would fight us for the camera during the flight.
    if (controlsRef.current) controlsRef.current.enabled = false;
  }, [introDone, camera, finishIntro, restDistance]);

  // --- Flight to a selected country ---------------------------------------
  useEffect(() => {
    if (!selected) {
      flying.current = false;
      return;
    }
    const feature = getCountryFeatures().find((f) => f.iso3 === selected);
    if (!feature) return;

    const [lng, lat] = geoCentroid(feature);
    const distance = camera.position.length();
    const [x, y, z] = latLngToVector3(lat, lng, distance);
    const target = new THREE.Vector3(x, y, z);

    if (prefersReducedMotion()) {
      camera.position.copy(target);
      controlsRef.current?.update();
      flying.current = false;
      return;
    }

    flightTarget.current = target;
    flying.current = true;
  }, [selected, camera]);

  // An opening animation the user cannot skip is an obstacle. Any pointer or
  // key press lands the camera immediately.
  useEffect(() => {
    if (introDone) return;
    const skip = () => {
      if (!introActive.current) return;
      introActive.current = false;
      camera.position.copy(introTo.current);
      camera.lookAt(0, 0, 0);
      const controls = controlsRef.current;
      if (controls) {
        controls.enabled = true;
        controls.update();
      }
      finishIntro();
    };
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    window.addEventListener("wheel", skip, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
    };
  }, [introDone, camera, finishIntro]);

  useFrame((_, rawDelta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // The first frame after mount can carry seconds of accumulated startup
    // stall. Left unclamped that consumed the entire opening flight in one
    // frame, so the animation simply never played on a slow device.
    const delta = Math.min(rawDelta, 1 / 30);

    // --- Opening flight owns the camera until it lands ---------------------
    if (introActive.current) {
      controls.enabled = false;
      // Wall clock, not accumulated frame deltas. A timed cinematic should
      // last the same three seconds whether the device renders it at 120 fps
      // or at 8 — deltas make it either skip or crawl.
      const t = Math.min(
        1,
        (performance.now() - introStart.current) / (INTRO_SECONDS * 1000),
      );
      const eased = easeInOutCubic(t);

      // Interpolate along the arc rather than the chord, so the camera swings
      // around the globe instead of cutting toward it in a straight line.
      const from = introFrom.current;
      const to = introTo.current;
      const dir = from
        .clone()
        .normalize()
        .lerp(to.clone().normalize(), eased)
        .normalize();
      const dist = THREE.MathUtils.lerp(from.length(), to.length(), eased);
      camera.position.copy(dir.multiplyScalar(dist));
      camera.lookAt(0, 0, 0);

      if (t >= 1) {
        introActive.current = false;
        controls.enabled = true;
        controls.update();
        finishIntro();
      }
      // Deliberately NOT calling controls.update() mid-flight: it clamps the
      // orbit radius to maxDistance and rewrites camera.position from its own
      // spherical state, which snapped the intro to its final framing on the
      // very first frame. The rig owns the camera until the flight lands.
      return;
    }

    // Idle presentation: rotate until the user takes over, then never again.
    controls.autoRotate = !interacted && !selected;

    // Re-frame on resize / orientation change, but only while the user has
    // not taken control — otherwise this would fight their chosen zoom.
    if (!interacted && !flying.current) {
      const d = camera.position.length();
      if (Math.abs(d - restDistance) > 0.01) {
        camera.position.setLength(
          THREE.MathUtils.lerp(d, restDistance, 1 - Math.pow(0.01, delta)),
        );
      }
    }

    if (flying.current && flightTarget.current) {
      // Frame-rate independent damping, so the flight feels the same at 60
      // and 144 Hz.
      const t = 1 - Math.pow(0.0016, delta);
      camera.position.lerp(flightTarget.current, t);
      if (camera.position.distanceTo(flightTarget.current) < 0.004) {
        camera.position.copy(flightTarget.current);
        flying.current = false;
      }
    }

    controls.update();
  });

  return (
    <OrbitControls
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={controlsRef as any}
      enablePan={false}
      enableDamping
      dampingFactor={0.055}
      rotateSpeed={0.42}
      zoomSpeed={0.6}
      minDistance={restDistance * 0.55}
      maxDistance={restDistance * 1.7}
      autoRotateSpeed={0.32}
      onStart={() => {
        flying.current = false;
        markInteracted();
      }}
    />
  );
}
