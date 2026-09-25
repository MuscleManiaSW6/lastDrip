import { useRef } from "react";

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
const Letter = ({ char, position, size, index }) => {
  const meshRef = useRef();

  useFrame(() => {
    const offset = (index - 3.5) * 0.015;

    meshRef.current.position.z += (offset - meshRef.current.position.z) * 0.05;
  });

  return (
    <group ref={meshRef} position={position} castShadow>
      <Text3D
        font="/fonts/helvetiker_bold.typeface.json"
        size={size}
        height={0.25}
        bevelEnabled
        bevelSize={0.03}
        bevelThickness={0.03}
        bevelSegments={3}
      >
        {char}
        <meshStandardMaterial color="#626B52" metalness={1} roughness={0.25} />
      </Text3D>
    </group>
  );
};

//* Word
const Word = ({ anchorRef }) => {
  const wordRef = useRef();

  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const pointer = useThree((state) => state.pointer);

  const raycaster = useRef(new THREE.Raycaster());
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));

  const centerPoint = useRef(new THREE.Vector3());
  const leftPoint = useRef(new THREE.Vector3());
  const rightPoint = useRef(new THREE.Vector3());

  const baseWidth = 9.75;

  useFrame(() => {
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
      (worldWidth / baseWidth) * 1.1,
      0.04,
      0.8,
    );

    wordRef.current.scale.setScalar(scale);

    wordRef.current.position.lerp(centerPoint.current, 0.12);

    const targetRotationY = pointer.x * 0.18;
    const targetRotationX = -pointer.y * 0.08;

    wordRef.current.rotation.y +=
      (targetRotationY - wordRef.current.rotation.y) * 0.06;

    wordRef.current.rotation.x +=
      (targetRotationX - wordRef.current.rotation.x) * 0.06;
  });

  return (
    <group ref={wordRef}>
      <Letter char="L" position={[-4.63, 0, 0]} size={1.5} index={0} />
      <Letter char="A" position={[-3.48, 0, 0]} size={1.5} index={1} />
      <Letter char="S" position={[-2.15, 0, 0]} size={1.5} index={2} />
      <Letter char="T" position={[-0.88, 0, 0]} size={1.5} index={3} />
      <Letter char="D" position={[0.42, 0, 0]} size={1.5} index={4} />
      <Letter char="R" position={[1.72, 0, 0]} size={1.5} index={5} />
      <Letter char="I" position={[3.02, 0, 0]} size={1.5} index={6} />
      <Letter char="P" position={[3.62, 0, 0]} size={1.5} index={7} />
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
