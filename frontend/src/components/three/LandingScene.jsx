import { useRef, useState } from "react";

import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Text3D, Environment, PerspectiveCamera } from "@react-three/drei";

import * as THREE from "three";

//* Landing Scene
const LandingScene = ({ anchorRef }) => {
  return (
    <Canvas shadows>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={40} />

      <ambientLight intensity={1} />
      <directionalLight castShadow position={[3, 3, 5]} intensity={2} />

      <Environment preset="studio" />

      <Word anchorRef={anchorRef} />
      <Floor />
    </Canvas>
  );
};

//* Letter
const Letter = ({ char, position, size, index, active, onFocus, onBlur }) => {
  const meshRef = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    const idleZ = Math.sin(t * 0.8 + index * 0.55) * 0.025;
    const targetZ = active ? 1.15 : idleZ;

    const targetScale = active ? 1.18 : 1;

    meshRef.current.position.z += (targetZ - meshRef.current.position.z) * 0.08;

    meshRef.current.scale.x += (targetScale - meshRef.current.scale.x) * 0.08;

    meshRef.current.scale.y += (targetScale - meshRef.current.scale.y) * 0.08;

    meshRef.current.scale.z += (targetScale - meshRef.current.scale.z) * 0.08;

    meshRef.current.rotation.y +=
      ((active ? -0.12 : idleZ) - meshRef.current.rotation.y) * 0.08;
  });

  return (
    <group ref={meshRef} position={position} castShadow scale={active ? 0 : 1}>
      <mesh
        position={[0, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onFocus();
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onBlur();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onFocus();
        }}
      >
        <boxGeometry args={[1.15, 1.8, 1.5]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Text3D
        font="/fonts/InstrumentSerif-Regular.typeface.json"
        size={size}
        height={0.35}
        bevelEnabled
        bevelSize={0.06}
        bevelThickness={0.05}
        bevelSegments={4}
      >
        {char}
        <meshStandardMaterial
          color="#626B52"
          metalness={0.85}
          roughness={0.18}
        />
      </Text3D>

      <group scale={active ? 1 : 0} position={[0, 0, 1.1]}>
        <mesh>
          <boxGeometry args={[0.9, 0.5, 0.5]} />
          <meshStandardMaterial
            color="#626B52"
            metalness={0.85}
            roughness={0.18}
          />
        </mesh>
      </group>
    </group>
  );
};

//* Word
const Word = ({ anchorRef }) => {
  const wordRef = useRef();
  const [activeIndex, setActiveIndex] = useState(null);

  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);

  const raycaster = useRef(new THREE.Raycaster());
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));

  const centerPoint = useRef(new THREE.Vector3());
  const leftPoint = useRef(new THREE.Vector3());
  const rightPoint = useRef(new THREE.Vector3());

  const baseWidth = 9.75;

  useFrame((state) => {
    const anchor = anchorRef.current;

    if (!anchor) return;

    const canvasRect = canvas.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();

    const screenToWorld = (x, y, target) => {
      const ndcX = ((x - canvasRect.left) / canvasRect.width) * 2 - 1;

      const ndcY = 1 - ((y - canvasRect.top) / canvasRect.height) * 2;

      raycaster.current.setFromCamera({ x: ndcX, y: ndcY }, camera);

      raycaster.current.ray.intersectPlane(plane.current, target);
    };

    const centerX = anchorRect.left + anchorRect.width / 2;
    const centerY = anchorRect.top + anchorRect.height / 2;

    screenToWorld(centerX, centerY, centerPoint.current);

    screenToWorld(anchorRect.left, centerY, leftPoint.current);

    screenToWorld(anchorRect.right, centerY, rightPoint.current);

    const worldWidth = leftPoint.current.distanceTo(rightPoint.current);

    const scale = THREE.MathUtils.clamp(
      (worldWidth / baseWidth) * 1.35,
      0.04,
      0.95,
    );

    wordRef.current.scale.setScalar(scale);

    wordRef.current.position.lerp(centerPoint.current, 0.12);

    const t = state.clock.elapsedTime;

    wordRef.current.rotation.z +=
      (Math.sin(t * 0.35) * 0.018 - wordRef.current.rotation.z) * 0.04;

    wordRef.current.position.y +=
      (Math.sin(t * 0.5) * 0.025 - wordRef.current.position.y) * 0.04;
  });

  return (
    <group ref={wordRef}>
      <Letter
        char="L"
        position={[-4.63, 0, 0]}
        size={1.5}
        index={0}
        active={activeIndex === 0}
        onFocus={() => setActiveIndex(0)}
        onBlur={() => setActiveIndex(null)}
      />
      <Letter
        char="A"
        position={[-3.48, 0, 0]}
        size={1.5}
        index={1}
        active={activeIndex === 0}
        onFocus={() => setActiveIndex(0)}
        onBlur={() => setActiveIndex(null)}
      />
      <Letter
        char="S"
        position={[-2.15, 0, 0]}
        size={1.5}
        index={2}
        active={activeIndex === 0}
        onFocus={() => setActiveIndex(0)}
        onBlur={() => setActiveIndex(null)}
      />
      <Letter
        char="T"
        position={[-0.88, 0, 0]}
        size={1.5}
        index={3}
        active={activeIndex === 0}
        onFocus={() => setActiveIndex(0)}
        onBlur={() => setActiveIndex(null)}
      />
      <Letter
        char="D"
        position={[0.42, 0, 0]}
        size={1.5}
        index={4}
        active={activeIndex === 0}
        onFocus={() => setActiveIndex(0)}
        onBlur={() => setActiveIndex(null)}
      />
      <Letter
        char="R"
        position={[1.72, 0, 0]}
        size={1.5}
        index={5}
        active={activeIndex === 0}
        onFocus={() => setActiveIndex(0)}
        onBlur={() => setActiveIndex(null)}
      />
      <Letter
        char="I"
        position={[3.02, 0, 0]}
        size={1.5}
        index={6}
        active={activeIndex === 0}
        onFocus={() => setActiveIndex(0)}
        onBlur={() => setActiveIndex(null)}
      />
      <Letter
        char="P"
        position={[3.62, 0, 0]}
        size={1.5}
        index={7}
        active={activeIndex === 0}
        onFocus={() => setActiveIndex(0)}
        onBlur={() => setActiveIndex(null)}
      />
    </group>
  );
};

//* Floor
const Floor = () => {
  return (
    <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[10, 10]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
};

export default LandingScene;
