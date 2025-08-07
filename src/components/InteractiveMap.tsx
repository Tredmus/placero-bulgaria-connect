// ThreeJS version of your map with extruded provinces and selectable elevation
// Fixed projection, flat view, and locked rotation for realistic map behavior
// Dependencies: three, @react-three/fiber, @react-three/drei, d3-geo

import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, MapControls } from '@react-three/drei';
import * as THREE from 'three';
import * as d3 from 'd3-geo';

const GEOJSON_URL = '/data/bg_provinces.geojson';

function projectCoord([lng, lat]) {
  const projection = d3.geoMercator().scale(2000).center([25, 42.7]).translate([0, 0]);
  return projection([lng, lat]);
}

function geoJsonToMesh(feature, isSelected) {
  const coords = feature.geometry.coordinates;
  const shapes = [];

  coords.forEach((poly) => {
    poly.forEach((ring) => {
      const shape = new THREE.Shape();
      ring.forEach(([lng, lat], i) => {
        const [x, y] = projectCoord([lng, lat]);
        if (i === 0) shape.moveTo(x, -y);
        else shape.lineTo(x, -y);
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
  const [geometry, setGeometry] = useState();

  useEffect(() => {
    setGeometry(geoJsonToMesh(feature, isSelected));
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
        opacity={0.9}
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
      <Canvas orthographic camera={{ zoom: 5, position: [0, 0, 500], near: 0.1, far: 1000 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[0, 0, 100]} intensity={0.6} />
        <MapControls enableRotate={false} />
        {provinces && (
          <Provinces provinces={provinces} selected={selected} setSelected={setSelected} />
        )}
      </Canvas>
    </div>
  );
}
