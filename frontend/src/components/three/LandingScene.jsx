import { useRef } from "react";

import { Canvas, useFrame } from "@react-three/fiber";
import { Text3D, Environment } from "@react-three/drei";

//* Landing Scene
const LandingScene = () => {
  return (
    <Canvas shadows camera={{ position: [0, 2.5, 5], fov: 50 }}>
      <ambientLight intensity={1} />
      <directionalLight castShadow position={[3, 3, 5]} intensity={2} />

      <Environment preset="studio" />

      <Word />
      <Floor />
    </Canvas>
  );
};

//* Letter
const Letter = ({ char, position }) => {
  const meshRef = useRef();

  // useFrame(() => {
  //   meshRef.current.rotation.y += 0.01;
  // });

  return (
    <group ref={meshRef} position={position} castShadow>
      <Text3D
        font="/fonts/helvetiker_bold.typeface.json"
        size={1.5}
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

const Word = () => {
  const wordRef = useRef();

  useFrame(() => {
    wordRef.current.rotation.y += 0.01;
  });

  return (
    <group ref={wordRef}>
      <Letter char={"L"} position={[-5.25, 0, 0]} />
      <Letter char={"A"} position={[-3.75, 0, 0]} />
      <Letter char={"S"} position={[-2.25, 0, 0]} />
      <Letter char={"T"} position={[-0.75, 0, 0]} />
      <Letter char={"D"} position={[0.75, 0, 0]} />
      <Letter char={"R"} position={[2.25, 0, 0]} />
      <Letter char={"I"} position={[3.75, 0, 0]} />
      <Letter char={"P"} position={[5.25, 0, 0]} />
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
