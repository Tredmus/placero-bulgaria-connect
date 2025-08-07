// ThreeJS version of your map with extruded provinces and selectable elevation
// Dependencies: three, @react-three/fiber, @react-three/drei, turf

import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import * as turf from '@turf/turf';

const GEOJSON_URL = '/data/bg_provinces.geojson';

// Utility to parse GeoJSON and convert to ThreeJS shapes
function geoJsonToMesh(feature, isSelected) {
  const coords = feature.geometry.coordinates;
  const shapes = [];
  coords.forEach((poly) => {
    poly.forEach((ring) => {
      const shape = new THREE.Shape();
      ring.forEach(([lng, lat], i) => {
        const x = lng;
        const y = lat;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      });
      shapes.push(shape);
    });
  });

  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: isSelected ? 10 : 2,
    bevelEnabled: false
  });
  return geometry;
}

function ProvinceMesh({ feature, isSelected, onClick }) {
  const meshRef = useRef();
  const [geometry, setGeometry] = useState<THREE.ExtrudeGeometry | null>(null);

  useEffect(() => {
    const newGeometry = geoJsonToMesh(feature, isSelected);
    setGeometry(newGeometry);
  }, [feature, isSelected]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[0, 0, 0]}
      onClick={() => onClick(feature)}
    >
      <meshStandardMaterial
        color={isSelected ? '#22c55e' : '#10b981'}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function Provinces({ provinces, selected, setSelected }) {
  return (
    <group>
      {provinces.features.map((f, idx) => (
        <ProvinceMesh
          key={idx}
          feature={f}
          isSelected={
            f.properties.name === selected || f.properties.name_en === selected
          }
          onClick={(f) => setSelected(f.properties.name_en || f.properties.name)}
        />
      ))}
    </group>
  );
}

function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(25, -35, 70);
    camera.lookAt(25, 42, 0);
  }, [camera]);
  return null;
}

export default function ThreeMap() {
  const [provinces, setProvinces] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then((res) => res.json())
      .then(setProvinces);
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Canvas shadows camera={{ position: [0, 0, 50], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        <OrbitControls />
        <CameraSetup />
        {provinces && (
          <Provinces provinces={provinces} selected={selected} setSelected={setSelected} />
        )}
      </Canvas>
    </div>
  );
}
