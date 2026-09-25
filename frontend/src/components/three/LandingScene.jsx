import { useRef, useEffect } from "react";

import { Canvas, useThree } from "@react-three/fiber";
import { Text3D, Environment, PerspectiveCamera } from "@react-three/drei";

const ResponsiveCamera = () => {
  const { camera, size } = useThree();

  useEffect(() => {
    const isMobile = size.width < 768;

    camera.position.set(0, isMobile ? 1.5 : 2.5, isMobile ? 11 : 5);

    camera.updateProjectionMatrix();
  }, [camera, size.width]);

  return null;
};

//* Landing Scene
const LandingScene = () => {
  return (
    <Canvas shadows>
      <PerspectiveCamera makeDefault position={[0, 2.5, 5]} fov={50} />

      <ambientLight intensity={1} />
      <directionalLight castShadow position={[3, 3, 5]} intensity={2} />

      <Environment preset="studio" />

      <ResponsiveCamera />
      <Word />
      <Floor />
    </Canvas>
  );
};

//* Letter
const Letter = ({ char, position, size }) => {
  const meshRef = useRef();

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
  const wordRef = useRef();
  const { size: canvasSize } = useThree();

  const isMobile = canvasSize.width < 768;
  const letterSize = isMobile ? 0.75 : 1.5;

  return (
    <group ref={wordRef}>
      <Letter char={"L"} position={[-5.24, 0, 0]} size={letterSize} />
      <Letter char={"A"} position={[-4.05, 0, 0]} size={letterSize} />
      <Letter char={"S"} position={[-2.4, 0, 0]} size={letterSize} />
      <Letter char={"T"} position={[-0.97, 0, 0]} size={letterSize} />
      <Letter char={"D"} position={[0.42, 0, 0]} size={letterSize} />
      <Letter char={"R"} position={[1.92, 0, 0]} size={letterSize} />
      <Letter char={"I"} position={[3.39, 0, 0]} size={letterSize} />
      <Letter char={"P"} position={[3.99, 0, 0]} size={letterSize} />
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
