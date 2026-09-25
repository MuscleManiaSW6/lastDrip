import { useRef } from "react";

import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Text3D, Environment, PerspectiveCamera } from "@react-three/drei";

//* Landing Scene
const LandingScene = () => {
  return (
    <Canvas shadows>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={40} />

      <ambientLight intensity={1} />
      <directionalLight castShadow position={[3, 3, 5]} intensity={2} />

      <Environment preset="studio" />

      <Word />
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
const Word = () => {
  const { viewport, pointer } = useThree((state) => ({
    viewport: state.viewport,
    pointer: state.pointer,
  }));

  const baseWidth = 8.4;
  const scale = Math.min(0.65, (viewport.width * 0.85) / baseWidth);

  const wordRef = useRef();

  useFrame(() => {
    const targetRotationY = pointer.x * 0.18;
    const targetRotationX = -pointer.y * 0.08;

    wordRef.current.rotation.y +=
      (targetRotationY - wordRef.current.rotation.y) * 0.06;

    wordRef.current.rotation.x +=
      (targetRotationX - wordRef.current.rotation.x) * 0.06;
  });

  return (
    <group ref={wordRef} scale={scale}>
      <Letter char="L" position={[-4.2, 0, 0]} size={1.5} index={0} />
      <Letter char="A" position={[-3.05, 0, 0]} size={1.5} index={1} />
      <Letter char="S" position={[-1.72, 0, 0]} size={1.5} index={2} />
      <Letter char="T" position={[-0.45, 0, 0]} size={1.5} index={3} />
      <Letter char="D" position={[0.85, 0, 0]} size={1.5} index={4} />
      <Letter char="R" position={[2.15, 0, 0]} size={1.5} index={5} />
      <Letter char="I" position={[3.45, 0, 0]} size={1.5} index={6} />
      <Letter char="P" position={[4.05, 0, 0]} size={1.5} index={7} />
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
