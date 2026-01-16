import React from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Tube } from '@react-three/drei';
import * as THREE from 'three';
import type { BrainSurface, VertexLocations, AdjacencyMatrixData, BrainSurfaceData, ConnectivityGroup, VoronoiData } from '../types';
import { BundledConnections } from './BundledConnections';

interface BrainViewerProps {
  brainSurfaces: BrainSurfaceData[];
  connectivityGroups: ConnectivityGroup[];
  voronoiOverlays: VoronoiData[];
  currentTimeIndex: number;
  showConnections: boolean;
  useCurvature: boolean;
  curvature: number;
  backgroundColor: string;
  presentationMode: boolean;
}

export type BrainView = 'top' | 'front' | 'side' | 'manual';
export type ScreenshotMode = 'standard' | 'rotation' | 'hemispheres';

export interface BrainViewerRef {
  setView: (view: BrainView) => void;
  takeScreenshot: (callback: (blob: Blob | null) => void, mode?: ScreenshotMode) => void;
}

const VIEW_DISTANCE = 220;
const VIEWS: Record<Exclude<BrainView, 'manual'>, { position: [number, number, number], up: [number, number, number] }> = {
  top: { position: [0, 0, VIEW_DISTANCE], up: [0, 1, 0] },
  front: { position: [0, -VIEW_DISTANCE, 0], up: [0, 0, 1] },
  side: { position: [VIEW_DISTANCE, 0, 0], up: [0, 0, 1] },
};

// Viridis colormap data (Standard scientific colormap)
const viridis_data = [
    [0.267004, 0.004874, 0.329415], [0.268565, 0.021591, 0.344422], [0.269922, 0.037497, 0.359369],
    [0.271138, 0.052857, 0.374244], [0.272253, 0.06788, 0.389052], [0.27329, 0.08264, 0.403798],
    [0.274268, 0.097183, 0.418485], [0.275199, 0.111536, 0.433114], [0.276092, 0.12571, 0.447683],
    [0.276951, 0.139718, 0.46219], [0.277775, 0.153569, 0.476634], [0.27856, 0.16727, 0.490998],
    [0.279304, 0.180829, 0.505274], [0.280004, 0.19425, 0.519451], [0.280654, 0.20754, 0.533519],
    [0.281245, 0.220703, 0.547464], [0.28177, 0.233742, 0.561273], [0.282216, 0.24666, 0.574933],
    [0.28257, 0.25946, 0.588431], [0.282819, 0.272144, 0.601756], [0.28295, 0.284715, 0.614896],
    [0.28295, 0.297173, 0.62784], [0.282806, 0.30952, 0.640578], [0.282506, 0.321758, 0.653099],
    [0.282038, 0.333888, 0.665395], [0.281389, 0.345912, 0.677457], [0.280549, 0.35783, 0.689279],
    [0.279507, 0.369644, 0.700856], [0.278251, 0.381354, 0.712185], [0.27677, 0.392962, 0.72326],
    [0.275054, 0.404468, 0.734079], [0.27309, 0.415873, 0.74464], [0.270868, 0.427177, 0.754942],
    [0.268377, 0.43838, 0.764984], [0.265608, 0.449484, 0.774765], [0.262551, 0.460488, 0.784286],
    [0.259198, 0.471393, 0.793547], [0.255541, 0.4822, 0.802551], [0.251576, 0.492909, 0.811299],
    [0.247296, 0.503522, 0.819794], [0.2427, 0.514041, 0.827999], [0.237788, 0.524467, 0.835921],
    [0.23256, 0.534802, 0.843564], [0.227018, 0.545047, 0.850935], [0.221167, 0.555204, 0.858041],
    [0.21501, 0.565274, 0.864889], [0.208554, 0.575258, 0.871488], [0.201808, 0.585158, 0.877848],
    [0.194781, 0.594975, 0.883978], [0.187484, 0.60471, 0.889888], [0.179929, 0.614364, 0.895588],
    [0.172128, 0.623938, 0.901088], [0.164096, 0.633433, 0.906397], [0.155848, 0.64285, 0.911524],
    [0.147399, 0.65219, 0.916477], [0.138767, 0.661453, 0.921264], [0.130002, 0.670642, 0.92589],
    [0.121131, 0.679758, 0.930361], [0.112203, 0.68879, 0.934681], [0.103284, 0.69774, 0.938853],
    [0.09446, 0.706606, 0.942878], [0.08581, 0.715386, 0.946755], [0.07741, 0.724079, 0.950482],
    [0.069324, 0.732683, 0.954058], [0.06161, 0.741193, 0.957479], [0.054318, 0.749609, 0.96074],
    [0.047494, 0.757927, 0.963836], [0.04117, 0.766143, 0.966761], [0.035372, 0.774254, 0.969509],
    [0.03011, 0.782256, 0.972076], [0.02538, 0.790146, 0.974455], [0.02117, 0.79792, 0.97664],
    [0.01746, 0.805576, 0.978625], [0.014216, 0.81311, 0.980404], [0.01141, 0.82052, 0.981973],
    [0.00901, 0.827805, 0.983328], [0.006986, 0.834963, 0.984466], [0.00531, 0.842002, 0.985387],
    [0.003953, 0.84892, 0.986092], [0.002884, 0.85572, 0.98658], [0.002074, 0.862402, 0.986854],
    [0.0015, 0.868969, 0.986915], [0.001133, 0.875422, 0.986766], [0.000947, 0.881765, 0.986411],
    [0.000914, 0.888, 0.985854], [0.00101, 0.89413, 0.985098], [0.001207, 0.900157, 0.984148],
    [0.001477, 0.906083, 0.982991], [0.001797, 0.91191, 0.981642], [0.002144, 0.91764, 0.980108],
    [0.0025, 0.923275, 0.978396], [0.00284, 0.928818, 0.976517], [0.003141, 0.93427, 0.974482],
    [0.0033, 0.939634, 0.972298], [0.003534, 0.94491, 0.969974], [0.00358, 0.950101, 0.96752],
    [0.0035, 0.955208, 0.964943], [0.003273, 0.960233, 0.962252], [0.00288, 0.965177, 0.959453],
    [0.0023, 0.970042, 0.956554], [0.001516, 0.974828, 0.953561], [0.00051, 0.979538, 0.95048],
    [0.0033, 0.98417, 0.947318], [0.0166, 0.98872, 0.94408], [0.033, 0.9932, 0.94077],
    [0.0494, 0.9976, 0.93738], [0.0658, 0.9999, 0.93392], [0.0822, 0.9999, 0.93038],
    [0.0986, 0.9999, 0.92677], [0.115, 0.9999, 0.92308], [0.1314, 0.9999, 0.91932],
    [0.1478, 0.9999, 0.91548], [0.1642, 0.9999, 0.91157], [0.1806, 0.9999, 0.90758],
    [0.197, 0.9999, 0.90352], [0.2134, 0.9999, 0.89938], [0.2298, 0.9999, 0.89517],
    [0.2462, 0.9999, 0.89088], [0.2626, 0.9999, 0.88652], [0.279, 0.9999, 0.88208],
    [0.2462, 0.9999, 0.89088], [0.2626, 0.9999, 0.88652], [0.279, 0.9999, 0.88208],
    [0.2954, 0.9999, 0.87756], [0.3118, 0.9999, 0.87298], [0.3282, 0.9999, 0.86831],
    [0.3446, 0.9999, 0.86358], [0.361, 0.9999, 0.85877], [0.3774, 0.9999, 0.85388],
    [0.3938, 0.9999, 0.84892], [0.4102, 0.9999, 0.84388], [0.4266, 0.9999, 0.83876],
    [0.443, 0.9999, 0.83358], [0.4594, 0.9999, 0.82832], [0.4758, 0.9999, 0.82298],
    [0.4922, 0.9999, 0.81758], [0.5086, 0.9999, 0.81211], [0.525, 0.9999, 0.80656],
    [0.5414, 0.9999, 0.80094], [0.5578, 0.9999, 0.79525], [0.5742, 0.9999, 0.78948],
    [0.5906, 0.9999, 0.78364], [0.607, 0.9999, 0.77774], [0.6234, 0.9999, 0.77176],
    [0.6398, 0.9999, 0.76571], [0.6562, 0.9999, 0.75959], [0.6726, 0.9999, 0.7534],
    [0.689, 0.9999, 0.74714], [0.7054, 0.9999, 0.74081], [0.7218, 0.9999, 0.73441],
    [0.7382, 0.9999, 0.72795], [0.7546, 0.9999, 0.72142], [0.771, 0.9999, 0.71482],
    [0.7874, 0.9999, 0.70816], [0.8038, 0.9999, 0.70143], [0.8202, 0.9999, 0.69464],
    [0.8366, 0.9999, 0.68778], [0.853, 0.9999, 0.68086], [0.8694, 0.9999, 0.67388],
    [0.8858, 0.9999, 0.66683], [0.9022, 0.9999, 0.65972], [0.9186, 0.9999, 0.65255],
    [0.935, 0.9999, 0.64532], [0.9514, 0.9999, 0.63803], [0.9678, 0.9999, 0.63068],
    [0.9842, 0.9999, 0.62327], [0.999, 0.99, 0.6]
];
function viridis(t: number): [number, number, number] {
    const n = viridis_data.length;
    const i = Math.min(n - 1, Math.max(0, Math.floor(t * (n - 1))));
    return viridis_data[i] as [number, number, number];
}

function redblue(t: number): [number, number, number] {
  t = Math.max(-1, Math.min(1, t)); 
  if (t < 0) {
    // Transition from Pure Blue [-1] to White [0]
    const v = 1 + t;
    return [v * v, v * v, 1]; // Use power for more saturation at the edges
  } else {
    // Transition from White [0] to Pure Red [1]
    const v = 1 - t;
    return [1, v * v, v * v];
  }
}

const ThickArrow: React.FC<{
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  opacity: number;
  thickness: number;
}> = ({ start, end, color, opacity, thickness }) => {
  const groupRef = React.useRef<THREE.Group>(null!);

  const { bodyLength, headLength, headWidth, cylinderRadius } = React.useMemo(() => {
    const totalLength = start.distanceTo(end);
    const calculatedCylinderRadius = thickness * 0.5;

    const proposedHeadWidth = calculatedCylinderRadius * 3;
    const proposedHeadLength = proposedHeadWidth * 2.4;
    
    const finalHeadLength = Math.min(proposedHeadLength, totalLength * 0.5);
    const scaleRatio = proposedHeadLength > 0 ? finalHeadLength / proposedHeadLength : 1;
    const finalHeadWidth = proposedHeadWidth * scaleRatio;

    const finalBodyLength = totalLength - finalHeadLength;

    return {
      headLength: finalHeadLength,
      headWidth: finalHeadWidth,
      cylinderRadius: calculatedCylinderRadius,
      bodyLength: finalBodyLength,
    };
  }, [start, end, thickness]);

  React.useLayoutEffect(() => {
    if (!groupRef.current || bodyLength <= 0) return;

    groupRef.current.position.copy(start);
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    groupRef.current.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction
    );
  }, [start, end, bodyLength]);

  if (bodyLength <= 0) return null;

  return (
    <group ref={groupRef}>
      <mesh position={[0, bodyLength / 2, 0]} renderOrder={1}>
        <cylinderGeometry args={[cylinderRadius, cylinderRadius, bodyLength, 8]} />
        <meshStandardMaterial
          color={color}
          transparent={true}
          opacity={opacity}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      <mesh position={[0, bodyLength + headLength / 2, 0]} renderOrder={1}>
        <coneGeometry args={[headWidth, headLength, 8]} />
        <meshStandardMaterial
          color={color}
          transparent={true}
          opacity={opacity}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  );
};

const SelfLoopArrow: React.FC<{
  position: THREE.Vector3;
  color: string;
  opacity: number;
  thickness: number;
  scale: number;
}> = ({ position, color, opacity, thickness, scale }) => {
  const invScale = scale > 0 ? 1 / scale : 1;
  const finalThickness = thickness * invScale;

  const { curve, headLength, headWidth, cylinderRadius } = React.useMemo(() => {
    const loopRadius = finalThickness * 5;
    const calculatedCylinderRadius = finalThickness * 0.5;

    const direction = position.clone().normalize();
    const arbitraryVec = Math.abs(direction.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(direction, arbitraryVec).normalize();
    const v = new THREE.Vector3().crossVectors(direction, u).normalize();

    const points = Array.from({ length: 32 }, (_, i) => {
      const angle = (i / 31) * Math.PI * 2;
      const offset = u.clone().multiplyScalar(Math.cos(angle)).add(v.clone().multiplyScalar(Math.sin(angle))).multiplyScalar(loopRadius);
      return position.clone().add(offset);
    });

    const loopCurve = new THREE.CatmullRomCurve3(points, true);
    const totalLength = loopCurve.getLength();

    const proposedHeadWidth = calculatedCylinderRadius * 3;
    const proposedHeadLength = proposedHeadWidth * 2.4;
    const finalHeadLength = Math.min(proposedHeadLength, totalLength * 0.3);
    const scaleRatio = proposedHeadLength > 0 ? finalHeadLength / proposedHeadLength : 1;
    const finalHeadWidth = proposedHeadWidth * scaleRatio;

    return {
      curve: loopCurve,
      headLength: finalHeadLength,
      headWidth: finalHeadWidth,
      cylinderRadius: calculatedCylinderRadius,
    };
  }, [position, finalThickness]);

  const tubeCurve = React.useMemo(() => {
    const curveLength = curve.getLength();
    if (headLength >= curveLength) return null;

    const tubeLength = curveLength - headLength;
    const t_end = tubeLength / curveLength;
    const points = curve.getPoints(50);
    const numTubePoints = Math.max(2, Math.floor(50 * t_end));
    const tubePoints = points.slice(0, numTubePoints);
    return new THREE.CatmullRomCurve3(tubePoints);
  }, [curve, headLength]);
  
  const coneRef = React.useRef<THREE.Mesh>(null!);
  React.useLayoutEffect(() => {
    if (!coneRef.current || !tubeCurve) return;
    const endPoint = tubeCurve.getPointAt(1);
    const tangent = curve.getTangentAt(1).normalize();
    
    coneRef.current.position.copy(endPoint);
    
    const offset = tangent.clone().multiplyScalar(headLength / 2);
    coneRef.current.position.add(offset);
    
    const up = new THREE.Vector3(0, 1, 0);
    coneRef.current.quaternion.setFromUnitVectors(up, tangent);
  }, [tubeCurve, curve, headLength]);

  if (!tubeCurve) return null;

  return (
    <group>
      <Tube args={[tubeCurve, 32, cylinderRadius, 8, false]} renderOrder={1}>
        <meshStandardMaterial color={color} transparent={true} opacity={opacity} depthWrite={false} depthTest={false} />
      </Tube>
      <mesh ref={coneRef} renderOrder={1}>
        <coneGeometry args={[headWidth, headLength, 8]} />
        <meshStandardMaterial color={color} transparent={true} opacity={opacity} depthWrite={false} depthTest={false} />
      </mesh>
    </group>
  );
};

const BrainMesh: React.FC<{ 
  surfaceData: BrainSurfaceData;
  activeVoronoi: VoronoiData | undefined;
  currentTimeIndex: number;
  index: number;
}> = ({ surfaceData, activeVoronoi, currentTimeIndex, index }) => {
  const { surface, color, opacity } = surfaceData;

  const geometry = React.useMemo(() => {
    if (!surface) return null;
    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array(surface.verts.flat());
    const indices = new Uint32Array(surface.tris.flat());
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeVertexNormals();
    return geom;
  }, [surface]);

  const voronoiIndices = React.useMemo(() => {
      if (!surface || !activeVoronoi?.data) return null;
      const brainVerts = surface.verts;
      const voronoiVerts = activeVoronoi.data.verts;
      const indices = new Int32Array(brainVerts.length);
      const vVoronoi = voronoiVerts.map(v => new THREE.Vector3(...v));

      for (let i = 0; i < brainVerts.length; i++) {
          const brainVert = new THREE.Vector3(...brainVerts[i]);
          let min_dist_sq = Infinity;
          let closest_idx = -1;
          for (let j = 0; j < vVoronoi.length; j++) {
              const dist_sq = brainVert.distanceToSquared(vVoronoi[j]);
              if (dist_sq < min_dist_sq) {
                  min_dist_sq = dist_sq;
                  closest_idx = j;
              }
          }
          indices[i] = closest_idx;
      }
      return indices;
  }, [surface, activeVoronoi]);

  React.useLayoutEffect(() => {
    if (!geometry || !surface) return;
    const numVertices = surface.verts.length;
    let colorAttribute = geometry.getAttribute('voronoiColor') as THREE.BufferAttribute | undefined;
    if (!colorAttribute || colorAttribute.array.length !== numVertices * 4) {
      colorAttribute = new THREE.BufferAttribute(new Float32Array(numVertices * 4), 4);
      geometry.setAttribute('voronoiColor', colorAttribute);
    }

    const colors = colorAttribute.array as Float32Array;
    if (!voronoiIndices || !activeVoronoi?.data) {
      for (let i = 0; i < numVertices; i++) colors[i * 4 + 3] = 0.0;
    } else {
      const { data: voronoiData, maxAbsValue, colormap, opacity: voronoiOpacity } = activeVoronoi;
      const maxVal = maxAbsValue || 1;
      for (let i = 0; i < numVertices; i++) {
        const voronoiIndex = voronoiIndices[i];
        if (voronoiIndex !== -1) {
          const value = voronoiData.colors[voronoiIndex]?.[currentTimeIndex] ?? 0;
          if (value !== 0) {
            let r, g, b;
            if (colormap === 'viridis') [r, g, b] = viridis(Math.min(1, Math.max(0, value)));
            else [r, g, b] = redblue(value / maxVal);
            colors[i * 4 + 0] = r; colors[i * 4 + 1] = g; colors[i * 4 + 2] = b; 
            colors[i * 4 + 3] = voronoiOpacity;
          } else colors[i * 4 + 3] = 0.0;
        } else colors[i * 4 + 3] = 0.0;
      }
    }
    colorAttribute.needsUpdate = true;
  }, [geometry, surface, voronoiIndices, activeVoronoi, currentTimeIndex]);

  const onBeforeCompile = (shader: any) => {
    shader.vertexShader = 'attribute vec4 voronoiColor;\nvarying vec4 vVoronoiColor;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\nvVoronoiColor = voronoiColor;\n');
    shader.fragmentShader = 'varying vec4 vVoronoiColor;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', 
      `
      #include <color_fragment>
      float voronoiMask = step(0.001, vVoronoiColor.a);
      
      // Independent Color Blending
      diffuseColor.rgb = mix(diffuseColor.rgb, vVoronoiColor.rgb, voronoiMask);
      
      // Independent Opacity Blending
      diffuseColor.a = mix(opacity, vVoronoiColor.a, voronoiMask);
      `
    );
    // Add vibrancy pop by injecting some of the voronoi color into the emission
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', 
      `
      #include <emissivemap_fragment>
      // Add a small emissive boost to Voronoi regions to make them vibrant and "glow"
      float voronoiMaskPop = step(0.001, vVoronoiColor.a);
      totalEmissiveRadiance += vVoronoiColor.rgb * voronoiMaskPop * vVoronoiColor.a * 0.4;
      `
    );
  };
  
  if (!geometry) return null;

  return (
    <group>
      {/* 1. Back-face Pass: Render internal shell */}
      <mesh geometry={geometry} renderOrder={index * 10}>
        <meshStandardMaterial
          color={color}
          transparent={true}
          opacity={opacity}
          side={THREE.BackSide}
          metalness={0.2}
          roughness={0.8}
          depthWrite={false}
          depthTest={true}
          onBeforeCompile={onBeforeCompile}
        />
      </mesh>
      
      {/* 2. Front-face Pass: Render external shell */}
      <mesh geometry={geometry} renderOrder={index * 10 + 1}>
        <meshStandardMaterial
          color={color}
          transparent={true}
          opacity={opacity}
          side={THREE.FrontSide}
          metalness={0.3}
          roughness={0.6}
          depthWrite={true}
          depthTest={true}
          depthFunc={THREE.LessEqualDepth}
          onBeforeCompile={onBeforeCompile}
        />
      </mesh>
    </group>
  );
};

const VertexNodes: React.FC<{ locationsData: VertexLocations }> = ({ locationsData }) => {
  return (
    <group>
      {locationsData.verts.map((vertex, index) => (
        <mesh key={index} position={new THREE.Vector3(...vertex)}>
          <sphereGeometry args={[0.7, 16, 16]} />
          <meshStandardMaterial color="#FBBF24" emissive="#FBBF24" emissiveIntensity={1} />
        </mesh>
      ))}
    </group>
  );
};

const StraightConnections: React.FC<{
  locationsData: VertexLocations;
  adjacencyMatrices: AdjacencyMatrixData[];
  scale: number;
}> = ({ locationsData, adjacencyMatrices, scale }) => {
    const invScale = scale > 0 ? 1 / scale : 1;
    return (
        <group>
            {adjacencyMatrices.map(matrixData => {
                if (!matrixData.matrix) return null;
                const matrix = matrixData.matrix.J;
                const vertices = locationsData.verts;
                const arrows = [];
                for (let i = 0; i < matrix.length; i++) {
                    for (let j = 0; j < matrix[i].length; j++) {
                        if (i === j) continue;
                        const weight = matrix[i][j];
                        if (weight > 0 && vertices[i] && vertices[j]) {
                            arrows.push({
                                id: `${matrixData.id}-${i}-${j}`,
                                start: new THREE.Vector3(...vertices[i]),
                                end: new THREE.Vector3(...vertices[j]),
                                weight: weight,
                            });
                        }
                    }
                }
                return (
                    <group key={matrixData.id}>
                        {arrows.map((arrow) => {
                            const opacity = arrow.weight * matrixData.maxOpacity;
                            if (opacity <= 0) return null;
                            return (
                                <ThickArrow
                                    key={arrow.id}
                                    start={arrow.start}
                                    end={arrow.end}
                                    color={matrixData.color}
                                    opacity={opacity}
                                    thickness={matrixData.thickness * invScale}
                                />
                            );
                        })}
                    </group>
                );
            })}
        </group>
    );
};

const SelfLoops: React.FC<{
  locationsData: VertexLocations;
  adjacencyMatrices: AdjacencyMatrixData[];
  scale: number;
}> = ({ locationsData, adjacencyMatrices, scale }) => {
    return (
        <group>
            {adjacencyMatrices.map(matrixData => {
                if (!matrixData.matrix) return null;
                const matrix = matrixData.matrix.J;
                const vertices = locationsData.verts;
                const loops = [];
                for (let i = 0; i < matrix.length; i++) {
                    const weight = matrix[i][i];
                    if (weight > 0 && vertices[i]) {
                         loops.push({
                            id: `${matrixData.id}-${i}-${i}`,
                            position: new THREE.Vector3(...vertices[i]),
                            weight: weight,
                        });
                    }
                }
                return (
                    <group key={matrixData.id}>
                        {loops.map((loop) => {
                            const opacity = loop.weight * matrixData.maxOpacity;
                            if (opacity <= 0) return null;
                            return (
                                <SelfLoopArrow
                                    key={loop.id}
                                    position={loop.position}
                                    color={matrixData.color}
                                    opacity={opacity}
                                    thickness={matrixData.thickness}
                                    scale={scale}
                                />
                            );
                        })}
                    </group>
                );
            })}
        </group>
    );
};

const Scene: React.FC<Omit<BrainViewerProps, 'backgroundColor' | 'presentationMode'>> = ({ 
  brainSurfaces,
  connectivityGroups,
  voronoiOverlays,
  currentTimeIndex,
  showConnections, 
  useCurvature,
  curvature,
}) => {
    const { position, scale } = React.useMemo(() => {
        const allVerts = brainSurfaces.map(s => s.surface?.verts).filter((v): v is number[][] => !!v).flat();
        if (!allVerts || !allVerts.length) return { position: [0, 0, 0] as [number, number, number], scale: 1 };
        const points = allVerts.map(p => new THREE.Vector3(...p));
        const box = new THREE.Box3().setFromPoints(points);
        const centerPoint = new THREE.Vector3(); box.getCenter(centerPoint);
        const sizeVec = new THREE.Vector3(); box.getSize(sizeVec);
        const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
        const targetSize = 130; 
        const scaleFactor = maxDim > 0 ? targetSize / maxDim : 1;
        const positionVec = new THREE.Vector3(-centerPoint.x * scaleFactor, -centerPoint.y * scaleFactor, -centerPoint.z * scaleFactor);
        return { position: [positionVec.x, positionVec.y, positionVec.z] as [number, number, number], scale: scaleFactor };
    }, [brainSurfaces]);

    const activeVoronoi = React.useMemo(() => voronoiOverlays.find(v => v.enabled && v.data), [voronoiOverlays]);

  return (
    <group scale={scale} position={position}>
      {brainSurfaces.map((surfaceData, idx) => (
          <BrainMesh key={surfaceData.id} index={idx} surfaceData={surfaceData} activeVoronoi={activeVoronoi} currentTimeIndex={currentTimeIndex} />
        )
      )}
      {connectivityGroups.map(group => {
        if (!group.vertexLocations) return null;
        return (
          <group key={group.id}>
            <VertexNodes locationsData={group.vertexLocations} />
            {showConnections && (
              <>
                <SelfLoops locationsData={group.vertexLocations} adjacencyMatrices={group.adjacencyMatrices} scale={scale} />
                {useCurvature ? (
                  <BundledConnections locationsData={group.vertexLocations} adjacencyMatrices={group.adjacencyMatrices} scale={scale} curvature={curvature} />
                ) : (
                  <StraightConnections locationsData={group.vertexLocations} adjacencyMatrices={group.adjacencyMatrices} scale={scale} />
                )}
              </>
            )}
          </group>
        )
      })}
    </group>
  );
};

const CameraController: React.FC<{
  view: BrainView;
  setView: (view: BrainView) => void;
  isCapturing: boolean;
}> = ({ view, setView, isCapturing }) => {
  const { camera, controls, clock } = useThree();
  const transitionRef = React.useRef<{ startTime: number; duration: number; startPos: THREE.Vector3; endPos: THREE.Vector3; startTarget: THREE.Vector3; endTarget: THREE.Vector3; startUp: THREE.Vector3; endUp: THREE.Vector3; } | null>(null);
  const wasAutoRotating = React.useRef(false);

  React.useEffect(() => {
    if (view !== 'manual' && controls) {
      const { position, up } = VIEWS[view];
      transitionRef.current = {
        startTime: clock.getElapsedTime(), duration: 0.8,
        startPos: camera.position.clone(), endPos: new THREE.Vector3(...position),
        startTarget: (controls as any).target.clone(), endTarget: new THREE.Vector3(0, 0, 0),
        startUp: camera.up.clone(), endUp: new THREE.Vector3(...up),
      };
      wasAutoRotating.current = (controls as any).autoRotate;
      if ((controls as any).autoRotate) (controls as any).autoRotate = false;
      (controls as any).enabled = false;
    }
  }, [view, controls, camera, clock]);

  useFrame(() => {
    if (isCapturing) { if (transitionRef.current) transitionRef.current = null; return; }
    if (transitionRef.current && controls) {
      const { startTime, duration, startPos, endPos, startTarget, endTarget, startUp, endUp } = transitionRef.current;
      const elapsedTime = clock.getElapsedTime() - startTime;
      let progress = Math.min(elapsedTime / duration, 1);
      progress = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      camera.position.lerpVectors(startPos, endPos, progress);
      (controls as any).target.lerpVectors(startTarget, endTarget, progress);
      camera.up.lerpVectors(startUp, endUp, progress).normalize();
      (controls as any).update();
      if (progress >= 1) {
        transitionRef.current = null;
        (controls as any).enabled = true;
        (controls as any).autoRotate = wasAutoRotating.current;
        setView('manual');
      }
    }
  });

  React.useEffect(() => {
    if (!controls) return;
    const onInteraction = () => {
      if (transitionRef.current) {
        transitionRef.current = null;
        (controls as any).enabled = true;
        (controls as any).autoRotate = wasAutoRotating.current;
        setView('manual');
      }
    };
    (controls as any).addEventListener('start', onInteraction);
    (controls as any).addEventListener('wheel', onInteraction);
    return () => {
      if (controls) {
        (controls as any).removeEventListener('start', onInteraction);
        (controls as any).removeEventListener('wheel', onInteraction);
      }
    };
  }, [controls, setView]);

  return null;
};

const BrainViewer = React.forwardRef<BrainViewerRef, BrainViewerProps>((props, ref) => {
  const [view, setView] = React.useState<BrainView>('front');
  const [isCapturing, setIsCapturing] = React.useState(false);
  const { gl, scene, camera, controls } = useThree();

  React.useImperativeHandle(ref, () => ({
    setView(newView) { if (!isCapturing) setView(newView); },
    async takeScreenshot(callback, mode = 'standard') {
      if (isCapturing || !controls) { callback(null); return; }
      setIsCapturing(true);
      (controls as any).enabled = false;
      const wasAutoRotating = (controls as any).autoRotate;
      (controls as any).autoRotate = false;
      const originalState = { pos: camera.position.clone(), target: (controls as any).target.clone(), up: camera.up.clone() };

      try {
        const { width, height } = gl.domElement;
        const size = Math.min(width, height);
        const sx = (width - size) / 2;
        const sy = (height - size) / 2;
        let viewsToCapture: { position: THREE.Vector3; up: THREE.Vector3 }[] = [];

        if (mode === 'rotation') {
            const angles = [0, 45, 90, 135];
            for (const angleDeg of angles) {
                const angleRad = (angleDeg * Math.PI) / 180;
                const x = Math.sin(angleRad) * VIEW_DISTANCE;
                const y = -Math.cos(angleRad) * VIEW_DISTANCE;
                viewsToCapture.push({ position: new THREE.Vector3(x, y, 0), up: new THREE.Vector3(0, 0, 1) });
            }
            viewsToCapture.push({ position: new THREE.Vector3(...VIEWS.top.position), up: new THREE.Vector3(...VIEWS.top.up) });
        } else if (mode === 'hemispheres') {
          viewsToCapture = [
            { position: new THREE.Vector3(-VIEW_DISTANCE, 0, 0), up: new THREE.Vector3(0, 0, 1) }, // Left Lateral
            { position: new THREE.Vector3(VIEW_DISTANCE, 0, 0), up: new THREE.Vector3(0, 0, 1) }   // Right Lateral
          ];
        } else {
            viewsToCapture = [
                { position: new THREE.Vector3(...VIEWS.top.position), up: new THREE.Vector3(...VIEWS.top.up) },
                { position: new THREE.Vector3(...VIEWS.side.position), up: new THREE.Vector3(...VIEWS.side.up) },
                { position: new THREE.Vector3(...VIEWS.front.position), up: new THREE.Vector3(...VIEWS.front.up) },
            ];
        }

        const combinedCanvas = document.createElement('canvas');
        combinedCanvas.width = size * viewsToCapture.length;
        combinedCanvas.height = size;
        const ctx = combinedCanvas.getContext('2d');
        if (!ctx) throw new Error("Could not get 2D context");
        ctx.fillStyle = props.backgroundColor;
        ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
        
        for (let i = 0; i < viewsToCapture.length; i++) {
          const { position, up } = viewsToCapture[i];
          camera.position.copy(position.clone().multiplyScalar(0.85));
          camera.up.copy(up);
          (controls as any).target.set(0, 0, 0);
          (controls as any).update();
          gl.render(scene, camera);
          await new Promise(resolve => requestAnimationFrame(resolve));
          ctx.drawImage(gl.domElement, sx, sy, size, size, i * size, 0, size, size);
        }

        combinedCanvas.toBlob(blob => {
          camera.position.copy(originalState.pos); camera.up.copy(originalState.up); (controls as any).target.copy(originalState.target);
          (controls as any).update(); gl.render(scene, camera);
          (controls as any).enabled = true; (controls as any).autoRotate = wasAutoRotating;
          setIsCapturing(false);
          callback(blob);
        }, 'image/png');
      } catch (e) {
        console.error(e);
        camera.position.copy(originalState.pos); (controls as any).update(); gl.render(scene, camera);
        (controls as any).enabled = true; (controls as any).autoRotate = wasAutoRotating;
        setIsCapturing(false);
        callback(null);
      }
    },
  }));
  
  return (
    <>
      <color attach="background" args={[props.backgroundColor]} />
      <ambientLight intensity={0.8} />
      <pointLight position={[100, 100, 100]} intensity={1} />
      <pointLight position={[-100, -100, -100]} intensity={0.5} color="#A78BFA" />
      <React.Suspense fallback={null}><Scene {...props} /></React.Suspense>
      <OrbitControls makeDefault enablePan={false} autoRotate={props.presentationMode && !isCapturing} autoRotateSpeed={2.5} />
      <CameraController view={view} setView={setView} isCapturing={isCapturing} />
    </>
  );
});

const BrainViewerWrapper: React.FC<BrainViewerProps & { ref?: React.Ref<BrainViewerRef> }> = React.forwardRef((props, ref) => {
    return (
        <Canvas camera={{ position: [0, -VIEW_DISTANCE, 0], fov: 50, up: [0, 0, 1] }} gl={{ preserveDrawingBuffer: true }}>
            <BrainViewer {...props} ref={ref} />
        </Canvas>
    );
});

export default BrainViewerWrapper;