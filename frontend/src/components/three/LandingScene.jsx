import { Canvas } from "@react-three/fiber";

const LandingScene = () => {
  return (
    <Canvas>
      <ambientLight intensity={1} />
      <mesh>
        <boxGeometry />
        <meshStandardMaterial />
      </mesh>
    </Canvas>
  );
};

export default LandingScene;
