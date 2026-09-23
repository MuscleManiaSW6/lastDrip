import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";

const LandingScene = () => {
  return (
    <Canvas>
      <ambientLight intensity={1} />
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
      <meshStandardMaterial />
    </mesh>
  );
};

export default LandingScene;
