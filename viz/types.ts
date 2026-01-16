export interface BrainSurface {
  verts: number[][];
  tris: number[][];
}

export interface BrainSurfaceData {
  id: string;
  file: File | null;
  surface: BrainSurface | null;
  color: string;
  opacity: number;
}

export interface VertexLocations {
  verts: number[][];
}

export interface AdjacencyMatrix {
  J: number[][];
}

export interface AdjacencyMatrixData {
  id: string;
  file: File | null;
  matrix: AdjacencyMatrix | null;
  color: string; // hex color string
  maxOpacity: number;
  thickness: number;
}

export interface ConnectivityGroup {
  id: string;
  vertexLocationsFile: File | null;
  vertexLocations: VertexLocations | null;
  adjacencyMatrices: AdjacencyMatrixData[];
}

export interface VoronoiInfo {
  verts: number[][];
  colors: number[][]; // [vertex][time]
  times: number[];
}

export interface VoronoiData {
  id: string;
  file: File | null;
  data: VoronoiInfo | null;
  enabled: boolean;
  maxAbsValue?: number;
  colormap: 'viridis' | 'redblue';
  opacity: number;
}
