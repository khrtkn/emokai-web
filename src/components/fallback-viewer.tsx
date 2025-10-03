"use client";

import { useEffect, useRef, useState } from "react";

const INITIAL_CAMERA_POSITION: [number, number, number] = [0, 1.2, 2.8];

type ViewerStatus = "loading" | "ready" | "error";

type Props = {
  modelUrl: string;
  loadingLabel: string;
  errorLabel: string;
};

export function FallbackViewer({ modelUrl, loadingLabel, errorLabel }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!modelUrl || !container) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;
    let animationId = 0;

    setStatus("loading");

    (async () => {
      try {
        const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
          import("three"),
          import("three/examples/jsm/loaders/GLTFLoader.js"),
          import("three/examples/jsm/controls/OrbitControls.js"),
        ]);

        if (disposed) return;

        const {
          Scene,
          Color,
          PerspectiveCamera,
          AmbientLight,
          DirectionalLight,
          GridHelper,
          Vector3,
          Box3,
          Object3D,
          WebGLRenderer,
          SRGBColorSpace,
        } = THREE;

        const scene = new Scene();
        scene.background = new Color(0x0f1115);

        const renderer = new WebGLRenderer({ antialias: true, alpha: true });
        renderer.outputColorSpace = SRGBColorSpace;
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        const camera = new PerspectiveCamera(
          45,
          container.clientWidth / container.clientHeight,
          0.1,
          100,
        );
        camera.position.set(...INITIAL_CAMERA_POSITION);

        const ambientLight = new AmbientLight(0xffffff, 1.1);
        scene.add(ambientLight);
        const directional = new DirectionalLight(0xffffff, 1.4);
        directional.position.set(2.5, 4, 1.5);
        scene.add(directional);

        const grid = new GridHelper(6, 18, 0x404040, 0x202020);
        grid.position.y = -0.75;
        scene.add(grid);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, 0.4, 0);

        let currentModel: InstanceType<typeof Object3D> | null = null;

        const loader = new GLTFLoader();
        try {
          const proxiedUrl = `/api/tripo/model-file?url=${encodeURIComponent(modelUrl)}`;
          const response = await fetch(proxiedUrl);
          if (!response.ok) {
            throw new Error(`Viewer proxy failed: ${response.status}`);
          }
          const buffer = await response.arrayBuffer();

          loader.parse(
            buffer,
            '',
            (gltf) => {
              if (disposed) return;
              currentModel = gltf.scene;
              const box = new Box3().setFromObject(currentModel);
              const size = new Vector3();
              box.getSize(size);
              const center = new Vector3();
              box.getCenter(center);
              currentModel.position.sub(center);
              const maxAxis = Math.max(size.x, size.y, size.z) || 1;
              const scale = 1.6 / maxAxis;
              currentModel.scale.setScalar(scale);
              scene.add(currentModel);
              setStatus("ready");
            },
            (err) => {
              if (disposed) return;
              console.error("Failed to parse GLB model", err);
              setStatus("error");
            }
          );
        } catch (error) {
          if (disposed) return;
          console.error("Failed to load GLB model", error);
          setStatus("error");
        }

        const handleResize = () => {
          if (!container) return;
          camera.aspect = container.clientWidth / container.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(container.clientWidth, container.clientHeight);
        };

        window.addEventListener("resize", handleResize);

        const animate = () => {
          if (disposed) return;
          animationId = window.requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        cleanup = () => {
          window.cancelAnimationFrame(animationId);
          window.removeEventListener("resize", handleResize);
          controls.dispose();
          if (currentModel) {
            scene.remove(currentModel);
          }
          renderer.dispose();
          if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
          scene.clear();
        };
      } catch (error) {
        console.error("Failed to initialise 3D viewer", error);
        if (!disposed) {
          setStatus("error");
        }
      }
    })();

    return () => {
      disposed = true;
      if (cleanup) {
        cleanup();
      }
    };
  }, [modelUrl]);

  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-3xl border border-divider bg-[rgba(15,17,21,0.85)]">
      <div ref={containerRef} className="h-full w-full" />
      {status !== "ready" ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-textSecondary">
          {status === "loading" ? loadingLabel : errorLabel}
        </div>
      ) : null}
    </div>
  );
}
