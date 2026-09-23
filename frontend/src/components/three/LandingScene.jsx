import { useRef } from "react";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";

const LandingScene = () => {
  return (
    <Canvas shadows camera={{ position: [0, 2.5, 5], fov: 50 }}>
      <ambientLight intensity={1} />
      <directionalLight castShadow position={[3, 3, 5]} intensity={2} />

      <Environment preset="studio" />

      <Cube />
      <Floor />
    </Canvas>
  );
};

const Cube = () => {
  const meshRef = useRef();

  useFrame(() => {
    meshRef.current.rotation.y += 0.01;
  });

  return (
    <mesh castShadow ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial color="#626B52" metalness={1} roughness={0.25} />
    </mesh>
  );
};

const Floor = () => {
  return (
    <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[10, 10]} />
      <meshStandardMaterial color="#d8d2c7" />
    </mesh>
  );
};

export default LandingScene;
