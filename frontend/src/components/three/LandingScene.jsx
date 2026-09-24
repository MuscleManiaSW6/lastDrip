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

      {/* <Cube /> */}
      <Letter />
      <Floor />
    </Canvas>
  );
};

//* Cube
// const Cube = () => {
//   const meshRef = useRef();

//   useFrame(() => {
//     meshRef.current.rotation.y += 0.01;
//   });

//   return (
//     <mesh castShadow ref={meshRef} position={[2, 0, 0]}>
//       <icosahedronGeometry args={[1.4, 3]} />
//       <meshStandardMaterial color="#626B52" metalness={1} roughness={0.25} />
//     </mesh>
//   );
// };

//* Letter
const Letter = () => {
  const meshRef = useRef();

  useFrame(() => {
    meshRef.current.rotation.y += 0.01;
  });

  return (
    <group>
      <Text3D
        font="/fonts/helvetiker_bold.typeface.json"
        size={1.5}
        height={0.25}
        bevelEnabled
        bevelSize={0.03}
        bevelThickness={0.03}
        bevelSegments={3}
        ref={meshRef}
        position={[-3, 0, 0]}
        castShadow
      >
        L
        <meshStandardMaterial color="#626B52" metalness={1} roughness={0.25} />
      </Text3D>
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
