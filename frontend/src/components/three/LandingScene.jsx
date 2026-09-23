import { useRef } from "react";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";

const LandingScene = () => {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <ambientLight intensity={1} />
      <directionalLight position={[3, 3, 5]} intensity={2} />

      <Environment preset="studio" />

      <Cube />
    </Canvas>
  );
};

const Cube = () => {
  const meshRef = useRef();

  useFrame(() => {
    meshRef.current.rotation.y += 0.01;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial color="#626B52" metalness={1} roughness={0.25} />
    </mesh>
  );
};

export default LandingScene;
