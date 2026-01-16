import React from 'react';
import type { ThreeElements } from '@react-three/fiber';
import { Tube } from '@react-three/drei';
import * as THREE from 'three';
import type { VertexLocations, AdjacencyMatrixData } from '../types';

interface BundledConnectionsProps {
  locationsData: VertexLocations;
  adjacencyMatrices: AdjacencyMatrixData[];
  scale: number;
  curvature: number;
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
}> = ({ connection, scale }) => {
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
    if (headLength >= curveLength || curveLength === 0) {
      return null;
    }
    const tubeLength = curveLength - headLength;
    const t_end = tubeLength / curveLength;

    const points = curve.getPoints(50);
    const numTubePoints = Math.max(2, Math.floor(50 * t_end));
    const tubePoints = points.slice(0, numTubePoints);
    if(tubePoints.length < 2) return null;
    return new THREE.CatmullRomCurve3(tubePoints);
  }, [curve, headLength, curveLength]);

  const coneRef = React.useRef<THREE.Mesh>(null!);
  React.useLayoutEffect(() => {
    if (!coneRef.current || !tubeCurve) return;
    
    const tubeEndPosition = tubeCurve.getPointAt(1);
    const endTangent = curve.getTangentAt(1).normalize();

    coneRef.current.position.copy(tubeEndPosition);

    const offset = endTangent.clone().multiplyScalar(headLength / 2);
    coneRef.current.position.add(offset);
    
    const up = new THREE.Vector3(0, 1, 0);
    coneRef.current.quaternion.setFromUnitVectors(up, endTangent);
  }, [tubeCurve, curve, headLength]);

  const opacity = connection.weight * connection.maxOpacity;
  if (opacity <= 0 || !tubeCurve) return null;

  return (
    <group>
      <Tube args={[tubeCurve, 32, cylinderRadius, 8, false]} renderOrder={1}>
        <meshStandardMaterial
          color={color}
          transparent={true}
          opacity={opacity}
          depthWrite={false}
          depthTest={false}
        />
      </Tube>
      <mesh ref={coneRef} renderOrder={1}>
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

export const BundledConnections: React.FC<BundledConnectionsProps> = ({
  locationsData,
  adjacencyMatrices,
  scale,
  curvature,
}) => {
  const curvedConnections = React.useMemo(() => {
    const connections: CurvedConnection[] = [];
    const origin = new THREE.Vector3(0, 0, 0);

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

            connections.push({
              id: `${matrixData.id}-${i}-${j}`,
              path: path,
              weight: weight,
              color: matrixData.color,
              maxOpacity: matrixData.maxOpacity,
              thickness: matrixData.thickness,
              curveLength: curve.getLength(),
            });
          }
        }
      }
    });
    
    return connections;
  }, [locationsData, adjacencyMatrices, curvature]);

  return (
    <group>
      {curvedConnections.map(conn => (
        <CurvedThickArrow
          key={conn.id}
          connection={conn}
          scale={scale}
        />
      ))}
    </group>
  );
};