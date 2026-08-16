import React from 'react';
// @ts-ignore
import type { ThreeElements } from '@react-three/fiber';
import { Tube } from '@react-three/drei';
import * as THREE from 'three';
import type { VertexLocations, AdjacencyMatrixData } from '../types';
import { ForceEdgeBundling } from '../src/lib/fdeb';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      cylinderGeometry: any;
      meshStandardMaterial: any;
      coneGeometry: any;
      sphereGeometry: any;
      ambientLight: any;
      pointLight: any;
      color: any;
      tubeGeometry: any;
      torusGeometry: any;
    }
  }
}

interface BundledConnectionsProps {
  locationsData: VertexLocations;
  adjacencyMatrices: AdjacencyMatrixData[];
  scale: number;
  curvature: number;
  centerArrowheads?: boolean;
  useFDEB?: boolean;
  fdebStiffness?: number;
  fdebCompatibility?: number;
  fdebCycles?: number;
  fdebIterations?: number;
  fdebSubdivisions?: number;
  fdebStepSize?: number;
  useBundleColoring?: boolean;
  cartoonMode?: boolean;
}

interface CurvedConnection {
  id: string;
  path: THREE.Vector3[];
  weight: number;
  color: string;
  maxOpacity: number;
  thickness: number;
  curveLength: number;
}

const CurvedThickArrow: React.FC<{
  connection: CurvedConnection;
  scale: number;
  centerArrowheads?: boolean;
  cartoonMode?: boolean;
}> = ({ connection, scale, centerArrowheads = false, cartoonMode = false }) => {
  const { path, color, thickness, curveLength } = connection;

  const curve = React.useMemo(() => new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0.5), [path]);

  const invScale = scale > 0 ? 1 / scale : 1;
  const finalThickness = thickness * invScale;

  const { headLength, headWidth, cylinderRadius } = React.useMemo(() => {
    const calculatedCylinderRadius = finalThickness * 0.5;
    const proposedHeadWidth = calculatedCylinderRadius * 3;
    const proposedHeadLength = proposedHeadWidth * 2.4;
    const finalHeadLength = Math.min(proposedHeadLength, curveLength * 0.5);
    const scaleRatio = proposedHeadLength > 0 ? finalHeadLength / proposedHeadLength : 1;
    const finalHeadWidth = proposedHeadWidth * scaleRatio;

    return {
      headLength: finalHeadLength,
      headWidth: finalHeadWidth,
      cylinderRadius: calculatedCylinderRadius,
    };
  }, [curveLength, finalThickness]);

  const tubeCurve = React.useMemo(() => {
    if (curveLength === 0) return null;
    
    if (centerArrowheads) {
      return curve; // Full tail
    }

    if (headLength >= curveLength) {
      return null;
    }
    const tubeLength = curveLength - headLength;
    const t_end = tubeLength / curveLength;

    const points = curve.getPoints(50);
    const numTubePoints = Math.max(2, Math.floor(50 * t_end));
    const tubePoints = points.slice(0, numTubePoints);
    if(tubePoints.length < 2) return null;
    return new THREE.CatmullRomCurve3(tubePoints);
  }, [curve, headLength, curveLength, centerArrowheads]);

  const coneRef = React.useRef<THREE.Mesh>(null!);
  React.useLayoutEffect(() => {
    if (!coneRef.current || !curve) return;
    
    let t = 1;
    if (centerArrowheads) {
      // Offset slightly from center (0.5) to avoid collision
      t = 0.45;
    } else {
      // Position at the end of the tube
      const tubeLength = curveLength - headLength;
      t = curveLength > 0 ? tubeLength / curveLength : 1;
    }

    const position = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();

    // To have the TIP at 'position', the center should be at 'position - tangent * (headLength / 2)'
    const center = position.clone().sub(tangent.clone().multiplyScalar(headLength / 2));
    coneRef.current.position.copy(center);
    
    const up = new THREE.Vector3(0, 1, 0);
    coneRef.current.quaternion.setFromUnitVectors(up, tangent);
  }, [curve, headLength, centerArrowheads, curveLength]);

  const opacity = connection.weight * connection.maxOpacity;
  if (opacity <= 0 || !tubeCurve) return null;

  const MaterialComponent = cartoonMode ? 'meshBasicMaterial' : 'meshStandardMaterial';

  return (
    <group renderOrder={cartoonMode ? 2000 : 2000}>
      <Tube args={[tubeCurve, 32, cylinderRadius, 8, false]}>
        <MaterialComponent
          color={color}
          transparent={true}
          opacity={opacity}
          depthWrite={false}
          depthTest={false}
        />
      </Tube>
      <mesh ref={coneRef}>
        <coneGeometry args={[headWidth, headLength, 8]} />
         <MaterialComponent
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

export const BundledConnections: React.FC<BundledConnectionsProps> = ({
  locationsData,
  adjacencyMatrices,
  scale,
  curvature,
  centerArrowheads = false,
  useFDEB = false,
  fdebStiffness = 0.1,
  fdebCompatibility = 0.6,
  fdebCycles = 6,
  fdebIterations = 90,
  fdebSubdivisions = 1,
  fdebStepSize = 0.1,
  useBundleColoring = false,
  cartoonMode = false
}) => {
  const curvedConnections = React.useMemo(() => {
    const connections: (CurvedConnection & { colorEnd?: string })[] = [];
    const origin = new THREE.Vector3(0, 0, 0);

    const box = new THREE.Box3();
    locationsData.verts.forEach(v => box.expandByPoint(new THREE.Vector3(...v)));
    const size = new THREE.Vector3();
    box.getSize(size);
    const min = box.min;

    const getColorFromPos = (pos: THREE.Vector3) => {
      const r = size.x > 0 ? (pos.x - min.x) / size.x : 0.5;
      const g = size.y > 0 ? (pos.y - min.y) / size.y : 0.5;
      const b = size.z > 0 ? (pos.z - min.z) / size.z : 0.5;
      return new THREE.Color(r, g, b);
    };

    const getBundleColor = (i: number, j: number) => {
      const v1 = locationsData.verts[i]; // source
      const v2 = locationsData.verts[j]; // target
      
      const getNormalized = (v: number[]) => v.map((x, idx) => {
        const minVal = min.getComponent(idx);
        const sizeVal = size.getComponent(idx);
        return sizeVal > 0 ? (x - minVal) / sizeVal : 0.5;
      });

      const n1 = getNormalized(v1);
      const n2 = getNormalized(v2);

      // Map target position to HSL space for continuous "lobe-based" coloring
      // Center the coordinates for radial mapping
      const cx = n2[0] - 0.5;
      const cy = n2[1] - 0.5;
      
      // Hue based on angle in the axial plane (standard for brain mapping)
      const angle = Math.atan2(cy, cx);
      const baseHue = (angle / (2 * Math.PI)) + 0.5;
      
      // Saturation based on radial distance from center
      const dist = Math.sqrt(cx * cx + cy * cy) * 2;
      const saturation = 0.6 + Math.min(0.4, dist * 0.4);
      
      // Lightness based on Z (superior/inferior)
      const lightness = 0.4 + n2[2] * 0.3;

      // Add a small jitter based on the source position to make edges "similar but not the same"
      // We use a small hash of the source to ensure consistent jitter for the same source
      const sHash = (n1[0] * 17 + n1[1] * 31 + n1[2] * 13) % 0.05;
      const finalHue = (baseHue + sHash) % 1.0;
      
      return new THREE.Color().setHSL(finalHue, saturation, lightness);
    };

    if (useFDEB) {
      const fdeb = new ForceEdgeBundling();
      const nodes: Record<string, THREE.Vector3> = {};
      locationsData.verts.forEach((v, i) => {
        nodes[i.toString()] = new THREE.Vector3(...v);
      });
      fdeb.setNodes(nodes);

      const edges: { source: string; target: string; matrixData: AdjacencyMatrixData; i: number; j: number; weight: number }[] = [];
      adjacencyMatrices.forEach(matrixData => {
        if (!matrixData.matrix) return;
        const matrix = matrixData.matrix.J;
        for (let i = 0; i < matrix.length; i++) {
          for (let j = 0; j < matrix[i].length; j++) {
            if (i === j) continue;
            const weight = matrix[i][j];
            if (weight > 0 && locationsData.verts[i] && locationsData.verts[j]) {
              edges.push({ source: i.toString(), target: j.toString(), matrixData, i, j, weight });
            }
          }
        }
      });

      fdeb.setK(fdebStiffness);
      fdeb.setCompatibilityThreshold(fdebCompatibility);
      fdeb.setCycles(fdebCycles);
      fdeb.setIterations(fdebIterations);
      fdeb.setSubdivisions(fdebSubdivisions);
      fdeb.setStepSize(fdebStepSize);
      fdeb.setEdges(edges.map(e => ({ source: e.source, target: e.target, weight: e.weight })));
      const bundledPaths = fdeb.run();

      edges.forEach((e, idx) => {
        const path = bundledPaths[idx];
        const curve = new THREE.CatmullRomCurve3(path);
        
        let finalColor = e.matrixData.color;
        if (useBundleColoring) {
          finalColor = getBundleColor(e.i, e.j).getStyle();
        }

        connections.push({
          id: `${e.matrixData.id}-${e.i}-${e.j}`,
          path: path,
          weight: e.weight,
          color: finalColor,
          maxOpacity: e.matrixData.maxOpacity,
          thickness: e.matrixData.thickness,
          curveLength: curve.getLength(),
        });
      });
    } else {
      adjacencyMatrices.forEach(matrixData => {
        if (!matrixData.matrix) return;
        const matrix = matrixData.matrix.J;
        for (let i = 0; i < matrix.length; i++) {
          for (let j = 0; j < matrix[i].length; j++) {
            if (i === j) continue; // Skip self-loops

            const weight = matrix[i][j];
            if (weight > 0 && locationsData.verts[i] && locationsData.verts[j]) {
              const start = new THREE.Vector3(...locationsData.verts[i]);
              const end = new THREE.Vector3(...locationsData.verts[j]);
              
              const midpoint = new THREE.Vector3().lerpVectors(start, end, 0.5);
              const controlPoint = new THREE.Vector3().lerpVectors(midpoint, origin, curvature);
              const path = [start, controlPoint, end];
              const curve = new THREE.CatmullRomCurve3(path);

              let finalColor = matrixData.color;
              if (useBundleColoring) {
                finalColor = getBundleColor(i, j).getStyle();
              }

              connections.push({
                id: `${matrixData.id}-${i}-${j}`,
                path: path,
                weight: weight,
                color: finalColor,
                maxOpacity: matrixData.maxOpacity,
                thickness: matrixData.thickness,
                curveLength: curve.getLength(),
              });
            }
          }
        }
      });
    }
    
    return connections;
  }, [locationsData, adjacencyMatrices, curvature, centerArrowheads, useFDEB, fdebStiffness, fdebCompatibility, fdebCycles, fdebIterations, fdebSubdivisions, fdebStepSize, useBundleColoring]);

  return (
    <group>
      {curvedConnections.map(conn => (
        <CurvedThickArrow
          key={conn.id}
          connection={conn}
          scale={scale}
          centerArrowheads={centerArrowheads}
          cartoonMode={cartoonMode}
        />
      ))}
    </group>
  );
};
