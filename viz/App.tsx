import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { BrainSurfaceData, ConnectivityGroup, AdjacencyMatrixData, VoronoiData, VoronoiInfo } from './types';
import FileUpload from './components/FileUpload';
import BrainViewer, { BrainViewerRef } from './components/BrainViewer';
import ToggleSwitch from './components/ToggleSwitch';
import ColorPicker from './components/ColorPicker';
import Slider from './components/Slider';
import TimeSlider from './components/TimeSlider';
import { FullscreenIcon } from './components/icons/FullscreenIcon';
import { PlusIcon } from './components/icons/PlusIcon';
import { TrashIcon } from './components/icons/TrashIcon';
import { SettingsIcon } from './components/icons/SettingsIcon';
import { ResetIcon } from './components/icons/ResetIcon';
import { CameraTopIcon } from './components/icons/CameraTopIcon';
import { CameraFrontIcon } from './components/icons/CameraFrontIcon';
import { CameraSideIcon } from './components/icons/CameraSideIcon';
import { ScreenshotIcon } from './components/icons/ScreenshotIcon';
import { CameraRotationIcon } from './components/icons/CameraRotationIcon';
import { CameraHemispheresIcon } from './components/icons/CameraHemispheresIcon';

const defaultConnectionColors = [
  '#4ADE80', // green
  '#FACC15', // yellow
  '#F97316', // orange
  '#EF4444', // red
  '#A855F7', // purple
  '#EC4899', // pink
];

const defaultBrainColors = [
  '#60A5FA', // blue
  '#94A3B8', // slate
  '#818CF8', // indigo
  '#F472B6', // pink
];

let matrixCount = 0;
const createNewMatrix = (): AdjacencyMatrixData => {
  matrixCount++;
  return {
    id: `matrix-${Date.now()}-${matrixCount}`,
    file: null,
    matrix: null,
    color: defaultConnectionColors[(matrixCount - 1) % defaultConnectionColors.length],
    maxOpacity: 0.8,
    thickness: 0.5,
  };
};

let surfaceCount = 0;
const createNewBrainSurface = (): BrainSurfaceData => {
  surfaceCount++;
  return {
    id: `surface-${Date.now()}-${surfaceCount}`,
    file: null,
    surface: null,
    color: defaultBrainColors[(surfaceCount - 1) % defaultBrainColors.length],
    opacity: 0.2,
  };
};

let groupCount = 0;
const createNewConnectivityGroup = (): ConnectivityGroup => {
  groupCount++;
  return {
    id: `group-${Date.now()}-${groupCount}`,
    vertexLocationsFile: null,
    vertexLocations: null,
    adjacencyMatrices: [createNewMatrix()],
  };
};

let voronoiCount = 0;
const createNewVoronoiOverlay = (): VoronoiData => {
  voronoiCount++;
  return {
    id: `voronoi-${Date.now()}-${voronoiCount}`,
    file: null,
    data: null,
    enabled: true,
    colormap: 'viridis',
    opacity: 1.0,
  };
};

const DEFAULT_BACKGROUND_COLOR = '#1E293B';

const urlToFile = async (url: string, filename: string, mimeType: string): Promise<File> => {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.blob();
  return new File([data], filename, { type: mimeType });
}

const App: React.FC = () => {
  const [brainSurfaces, setBrainSurfaces] = useState<BrainSurfaceData[]>([createNewBrainSurface()]);
  const [connectivityGroups, setConnectivityGroups] = useState<ConnectivityGroup[]>([createNewConnectivityGroup()]);
  const [voronoiOverlays, setVoronoiOverlays] = useState<VoronoiData[]>([]);
  
  const [error, setError] = useState<string | null>(null);
  const [showConnections, setShowConnections] = useState(true);
  const [useCurvature, setUseCurvature] = useState(false);
  const [curvature, setCurvature] = useState(0.6);
  const [presentationMode, setPresentationMode] = useState(false);
  
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND_COLOR);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const brainViewerRef = useRef<BrainViewerRef>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Server mode state
  const [isServerMode, setIsServerMode] = useState(false);
  const [serverStatus, setServerStatus] = useState<'Disabled' | 'Disconnected' | 'Connecting...' | 'Connected' | 'Processing...'>('Disabled');
  const pollingInterval = useRef<number | null>(null);
  const [screenshotRequest, setScreenshotRequest] = useState(false);
  const screenshotResolver = useRef<((blob: Blob | null) => void) | null>(null);

  const handleVertexFileSelect = useCallback(async (file: File, groupId: string) => {
    setError(null);
    setConnectivityGroups(prev => prev.map(g => g.id === groupId ? { ...g, vertexLocationsFile: file } : g));
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (isVertexLocations(data)) {
        setConnectivityGroups(prev => prev.map(g => g.id === groupId ? { ...g, vertexLocations: data } : g));
      } else {
        throw new Error(`Invalid JSON structure in ${file.name}`);
      }
    } catch (e) {
      setError(`Error processing file ${file.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setConnectivityGroups(prev => prev.map(g => g.id === groupId ? { ...g, vertexLocationsFile: null, vertexLocations: null } : g));
    }
  }, []);

  const handleVertexFileClear = useCallback((groupId: string) => {
    setConnectivityGroups(prev => prev.map(g => g.id === groupId ? { ...g, vertexLocationsFile: null, vertexLocations: null } : g));
  }, []);

  const handleBrainFileSelect = useCallback(async (file: File, id: string) => {
    setError(null);
    setBrainSurfaces(prev => prev.map(s => s.id === id ? { ...s, file } : s));
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (isBrainSurface(data)) {
        setBrainSurfaces(prev => prev.map(s => s.id === id ? { ...s, surface: data } : s));
      } else {
        throw new Error(`Invalid JSON structure in ${file.name}`);
      }
    } catch (e) {
      setError(`Error processing file ${file.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setBrainSurfaces(prev => prev.map(s => s.id === id ? { ...s, file: null, surface: null } : s));
    }
  }, []);
  
  const handleBrainFileClear = useCallback((id: string) => {
    setBrainSurfaces(prev => prev.map(s => s.id === id ? { ...s, file: null, surface: null } : s));
  }, []);

  const handleAdjacencyFileSelect = useCallback(async (file: File, groupId: string, matrixId: string) => {
    setError(null);
    const updateMatrix = (matrix: AdjacencyMatrixData) => matrix.id === matrixId ? { ...matrix, file } : matrix;
    setConnectivityGroups(prev => prev.map(g => g.id === groupId ? { ...g, adjacencyMatrices: g.adjacencyMatrices.map(updateMatrix) } : g));
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (isAdjacencyMatrix(data)) {
        const updateMatrixWithData = (matrix: AdjacencyMatrixData) => matrix.id === matrixId ? { ...matrix, matrix: data } : matrix;
        setConnectivityGroups(prev => prev.map(g => g.id === groupId ? { ...g, adjacencyMatrices: g.adjacencyMatrices.map(updateMatrixWithData) } : g));
      } else {
        throw new Error(`Invalid JSON structure in ${file.name}`);
      }
    } catch (e) {
      setError(`Error processing file ${file.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      const resetMatrix = (matrix: AdjacencyMatrixData) => matrix.id === matrixId ? { ...matrix, file: null, matrix: null } : matrix;
      setConnectivityGroups(prev => prev.map(g => g.id === groupId ? { ...g, adjacencyMatrices: g.adjacencyMatrices.map(resetMatrix) } : g));
    }
  }, []);

  const handleAdjacencyFileClear = useCallback((groupId: string, matrixId: string) => {
     const resetMatrix = (matrix: AdjacencyMatrixData) => matrix.id === matrixId ? { ...matrix, file: null, matrix: null } : matrix;
      setConnectivityGroups(prev => prev.map(g => g.id === groupId ? { ...g, adjacencyMatrices: g.adjacencyMatrices.map(resetMatrix) } : g));
  }, []);

  const handleVoronoiFileSelect = useCallback(async (file: File, id: string) => {
    setError(null);
    setVoronoiOverlays(prev => prev.map(v => v.id === id ? { ...v, file } : v));
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (isVoronoiInfo(data)) {
        let maxAbsValue = 0;
        if (data.colors) {
          for (const timeSlice of data.colors) {
            for (const val of timeSlice) {
              if (Math.abs(val) > maxAbsValue) {
                maxAbsValue = Math.abs(val);
              }
            }
          }
        }
        setVoronoiOverlays(prev => prev.map(v => v.id === id ? { ...v, data, maxAbsValue: maxAbsValue > 0 ? maxAbsValue : 1 } : v));
        setCurrentTimeIndex(0);
      } else {
        throw new Error(`Invalid JSON structure in ${file.name}`);
      }
    } catch (e) {
      setError(`Error processing file ${file.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setVoronoiOverlays(prev => prev.map(v => v.id === id ? { ...v, file: null, data: null, maxAbsValue: undefined } : v));
    }
  }, []);

  const handleVoronoiFileClear = useCallback((id: string) => {
    setVoronoiOverlays(prev => prev.map(v => v.id === id ? { ...v, file: null, data: null, maxAbsValue: undefined } : v));
  }, []);

  const isBrainSurface = (data: any): data is { verts: number[][], tris: number[][] } => {
    return data && Array.isArray(data.verts) && data.verts.every(Array.isArray) &&
           Array.isArray(data.tris) && data.tris.every(Array.isArray);
  };

  const isVertexLocations = (data: any): data is { verts: number[][] } => {
    return data && Array.isArray(data.verts) && data.verts.every(Array.isArray);
  };

  const isAdjacencyMatrix = (data: any): data is { J: number[][] } => {
    return data && Array.isArray(data.J) && data.J.every(Array.isArray);
  };

  const isVoronoiInfo = (data: any): data is VoronoiInfo => {
    return data && Array.isArray(data.verts) && data.verts.every(Array.isArray) &&
           Array.isArray(data.colors) && data.colors.every(Array.isArray) &&
           Array.isArray(data.times);
  };

  const allFilesReady = useMemo(() => {
    const hasSurface = brainSurfaces.some(s => s.surface);
    return hasSurface;
  }, [brainSurfaces]);

  const activeVoronoi = useMemo(() => voronoiOverlays.find(v => v.enabled && v.data), [voronoiOverlays]);

  const handleFullscreenChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [handleFullscreenChange]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsPanelRef.current && !settingsPanelRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSettingsOpen]);

  const toggleFullscreen = useCallback(() => {
    if (!viewerContainerRef.current) return;

    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  const handleServerCommand = useCallback(async (command: any) => {
    if (command.name === 'stage_surfaces') {
        const { mesh_url, vertices_url, color, opacity } = command.data;
        const meshFile = await urlToFile(mesh_url, 'surface.json', 'application/json');
        const verticesFile = await urlToFile(vertices_url, 'vertices.json', 'application/json');

        const newSurface = createNewBrainSurface();
        if (color) newSurface.color = color;
        if (typeof opacity === 'number') newSurface.opacity = opacity;

        const newGroup = createNewConnectivityGroup();

        let surfaceIdToUpdate = newSurface.id;
        setBrainSurfaces(prev => {
            if (prev.length === 1 && !prev[0].file) {
                surfaceIdToUpdate = prev[0].id;
                newSurface.id = prev[0].id; // Use existing ID for update
                return [newSurface];
            }
            return [...prev, newSurface];
        });

        let groupIdToUpdate = newGroup.id;
        setConnectivityGroups(prev => {
            if (prev.length === 1 && !prev[0].vertexLocationsFile) {
                groupIdToUpdate = prev[0].id;
                newGroup.id = prev[0].id; // Use existing ID for update
                newGroup.adjacencyMatrices = [createNewMatrix()];
                return [newGroup];
            }
            return [...prev, newGroup];
        });

        await new Promise(res => setTimeout(res, 50)); 
        await handleBrainFileSelect(meshFile, surfaceIdToUpdate);
        await handleVertexFileSelect(verticesFile, groupIdToUpdate);

    } else if (command.name === 'stage_adjacency') {
        const { adjacency_url, color, maxOpacity, thickness } = command.data;
        const adjFile = await urlToFile(adjacency_url, 'adjacency.json', 'application/json');

        const newMatrix = createNewMatrix();
        if (color) newMatrix.color = color;
        if (typeof maxOpacity === 'number') newMatrix.maxOpacity = maxOpacity;
        if (typeof thickness === 'number') newMatrix.thickness = thickness;

        const targetGroupId = connectivityGroups.length > 0 ? connectivityGroups[connectivityGroups.length - 1].id : null;

        if (!targetGroupId) {
            console.error("Cannot stage adjacency matrix: No connectivity group is staged.");
            setError("Cannot stage adjacency matrix: No connectivity group is staged.");
            return;
        }
        
        setConnectivityGroups(prev => prev.map(g => {
            if (g.id !== targetGroupId) return g;
            const matrices = g.adjacencyMatrices;
            if (matrices.length === 1 && !matrices[0].file) {
                newMatrix.id = matrices[0].id;
                return { ...g, adjacencyMatrices: [newMatrix] };
            } else {
                return { ...g, adjacencyMatrices: [...matrices, newMatrix] };
            }
        }));
        
        await new Promise(res => setTimeout(res, 50));
        await handleAdjacencyFileSelect(adjFile, targetGroupId, newMatrix.id);

    } else if (command.name === 'screenshot') {
        await new Promise<Blob | null>((resolve) => {
            screenshotResolver.current = resolve;
            setScreenshotRequest(true);
        }).then(async (blob) => {
            if (blob) {
                const formData = new FormData();
                formData.append('screenshot', blob, 'screenshot.png');
                await fetch('http://localhost:5000/upload_screenshot', {
                    method: 'POST',
                    body: formData,
                });
            } else {
                console.error("Screenshot generation failed, received null blob.");
            }
        });
    } else if (command.name === 'clear') {
        setBrainSurfaces([createNewBrainSurface()]);
        setConnectivityGroups([createNewConnectivityGroup()]);
        setVoronoiOverlays([]);
    }
  }, [connectivityGroups, handleBrainFileSelect, handleVertexFileSelect, handleAdjacencyFileSelect]);

  // Effect for polling the server
  useEffect(() => {
    if (!isServerMode) {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      setServerStatus('Disabled');
      return;
    }

    setServerStatus('Connecting...');

    const poll = async () => {
      try {
        const response = await fetch('http://localhost:5000/get_command');
        if (!response.ok) throw new Error('Network response was not ok');

        if (serverStatus === 'Connecting...' || serverStatus === 'Disconnected') {
           setServerStatus('Connected');
        }
        
        const command = await response.json();
        
        if (command && command.name) {
          setServerStatus('Processing...');
          try {
            await handleServerCommand(command);
             await fetch('http://localhost:5000/command_complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: command.id }),
            });
          } catch (e) {
             console.error("Error processing command:", e);
             setError(e instanceof Error ? e.message : 'Unknown processing error');
          } finally {
             setServerStatus('Connected');
          }
        }
      } catch (error) {
        if (serverStatus !== 'Disabled') {
            setServerStatus('Disconnected');
        }
      }
    };

    pollingInterval.current = window.setInterval(poll, 2000);
    return () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, [isServerMode, handleServerCommand]);

  // Effect to trigger screenshot after render
  useEffect(() => {
    if (screenshotRequest && brainViewerRef.current) {
      brainViewerRef.current.takeScreenshot((blob) => {
        if (screenshotResolver.current) {
          screenshotResolver.current(blob);
          screenshotResolver.current = null;
        }
        setScreenshotRequest(false);
      });
    }
  }, [screenshotRequest]);
  
  const addConnectivityGroup = () => {
    setConnectivityGroups(prev => [...prev, createNewConnectivityGroup()]);
  };

  const removeConnectivityGroup = (groupId: string) => {
    setConnectivityGroups(prev => prev.filter(g => g.id !== groupId));
  };
  
  const addAdjacencyMatrix = (groupId: string) => {
    setConnectivityGroups(prev => prev.map(g => g.id === groupId ? { ...g, adjacencyMatrices: [...g.adjacencyMatrices, createNewMatrix()] } : g));
  };

  const removeAdjacencyMatrix = (groupId: string, matrixId: string) => {
    setConnectivityGroups(prev => prev.map(g => g.id === groupId ? { ...g, adjacencyMatrices: g.adjacencyMatrices.filter(m => m.id !== matrixId) } : g));
  };

  const updateMatrixProperty = (groupId: string, matrixId: string, update: Partial<AdjacencyMatrixData>) => {
    setConnectivityGroups(prev => prev.map(g => 
      g.id === groupId 
        ? { 
            ...g, 
            adjacencyMatrices: g.adjacencyMatrices.map(m => 
              m.id === matrixId ? { ...m, ...update } : m
            )
          }
        : g
    ));
  };

  const addBrainSurface = () => {
    setBrainSurfaces(prev => [...prev, createNewBrainSurface()]);
  };
  
  const removeBrainSurface = (id: string) => {
    setBrainSurfaces(prev => prev.filter(s => s.id !== id));
  };

  const handleBrainColorChange = (id: string, color: string) => {
    setBrainSurfaces(prev => prev.map(s => s.id === id ? { ...s, color } : s));
  };

  const handleBrainOpacityChange = (id: string, opacity: number) => {
     setBrainSurfaces(prev => prev.map(s => s.id === id ? { ...s, opacity } : s));
  };
  
  const addVoronoiOverlay = () => {
    setVoronoiOverlays(prev => [...prev, createNewVoronoiOverlay()]);
  };

  const removeVoronoiOverlay = (id: string) => {
    setVoronoiOverlays(prev => prev.filter(v => v.id !== id));
  };

  const updateVoronoiOverlay = (id: string, update: Partial<VoronoiData>) => {
    setVoronoiOverlays(prev => prev.map(v => v.id === id ? {...v, ...update} : v));
  };

  const handleResetBackgroundSettings = () => {
    setBackgroundColor(DEFAULT_BACKGROUND_COLOR);
  };

  const downloadBlob = (blob: Blob | null, filename: string) => {
    if (!blob) {
      console.error("Failed to capture screenshot.");
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="h-screen bg-slate-900 text-slate-200 flex flex-col">
      <div className="w-full max-w-7xl mx-auto flex flex-col px-4 pt-4 pb-6 font-sans flex-grow min-h-0">
        <header className="text-center mb-6 flex-shrink-0">
          <h1 className="text-4xl font-bold text-sky-400">3D Brain Connectivity Visualizer</h1>
          <p className="text-slate-400 mt-2">
            Upload your JSON files to visualize neural connections on a 3D brain surface.
          </p>
        </header>
        
        <main className="flex-grow flex flex-col lg:flex-row gap-6 min-h-0">
          <div className="lg:w-[420px] lg:flex-shrink-0 bg-slate-800 p-6 rounded-lg shadow-2xl flex flex-col gap-6 overflow-y-auto">
            <h2 className="text-2xl font-semibold border-b border-slate-600 pb-2 text-sky-300">Controls</h2>
            
            {error && <div className="bg-red-900 border border-red-700 text-red-200 p-3 rounded-md">{error}</div>}
            
            <fieldset disabled={isServerMode} className="space-y-6 disabled:opacity-50">
              <div className="space-y-4 border-b border-slate-700 pb-4">
                <h3 className="text-lg font-semibold text-slate-300">Brain Surfaces</h3>
                {brainSurfaces.map((surfaceData, index) => (
                    <div key={surfaceData.id} className="p-3 bg-slate-700/50 rounded-lg space-y-4">
                      <div className="flex items-center gap-2">
                        <ColorPicker value={surfaceData.color} onChange={(color) => handleBrainColorChange(surfaceData.id, color)} />
                        <div className="flex-grow min-w-0">
                          <FileUpload
                            label={`Surface ${index + 1}`}
                            onFileSelect={(file) => handleBrainFileSelect(file, surfaceData.id)}
                            acceptedFileType=".json"
                            fileName={surfaceData.file?.name || null}
                            onFileClear={() => handleBrainFileClear(surfaceData.id)}
                          />
                        </div>
                        {brainSurfaces.length > 1 && (
                          <button onClick={() => removeBrainSurface(surfaceData.id)} className="p-2 text-slate-400 hover:text-red-400 transition-colors" aria-label="Remove brain surface">
                              <TrashIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <Slider
                        label="Opacity"
                        id={`brain-opacity-${surfaceData.id}`}
                        min={0} max={1} step={0.01}
                        value={surfaceData.opacity}
                        onChange={(val) => handleBrainOpacityChange(surfaceData.id, val)}
                      />
                    </div>
                ))}
                <button
                    onClick={addBrainSurface}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-sky-300 bg-sky-900/50 hover:bg-sky-900/80 rounded-md transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Brain Surface
                </button>
              </div>
              
              <div className="space-y-4 border-b border-slate-700 pb-4">
                <h3 className="text-lg font-semibold text-slate-300">Voronoi Overlays</h3>
                {voronoiOverlays.map((overlay, index) => (
                  <div key={overlay.id} className="p-3 bg-slate-700/50 rounded-lg space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-grow min-w-0">
                          <FileUpload
                            label={`Overlay ${index + 1}`}
                            onFileSelect={(file) => handleVoronoiFileSelect(file, overlay.id)}
                            acceptedFileType=".json"
                            fileName={overlay.file?.name || null}
                            onFileClear={() => handleVoronoiFileClear(overlay.id)}
                          />
                        </div>
                        {voronoiOverlays.length > 0 && (
                          <button onClick={() => removeVoronoiOverlay(overlay.id)} className="p-2 text-slate-400 hover:text-red-400 transition-colors" aria-label="Remove voronoi overlay">
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <ToggleSwitch
                        id={`voronoi-enabled-${overlay.id}`}
                        label="Enabled"
                        checked={overlay.enabled}
                        onChange={(checked) => updateVoronoiOverlay(overlay.id, { enabled: checked })}
                      />
                      {overlay.data && (
                        <div className="space-y-4 pt-2 border-t border-slate-600/50">
                          <Slider
                              label="Opacity"
                              id={`voronoi-opacity-${overlay.id}`}
                              min={0} max={1} step={0.01}
                              value={overlay.opacity}
                              onChange={(val) => updateVoronoiOverlay(overlay.id, { opacity: val })}
                          />
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-400">Colormap</label>
                            <div className="flex gap-2">
                              <button onClick={() => updateVoronoiOverlay(overlay.id, { colormap: 'viridis' })} className={`w-full text-sm py-1 px-2 rounded transition-colors ${overlay.colormap === 'viridis' ? 'bg-sky-600 text-white font-semibold' : 'bg-slate-600 hover:bg-slate-500'}`}>Viridis</button>
                              <button onClick={() => updateVoronoiOverlay(overlay.id, { colormap: 'redblue' })} className={`w-full text-sm py-1 px-2 rounded transition-colors ${overlay.colormap === 'redblue' ? 'bg-sky-600 text-white font-semibold' : 'bg-slate-600 hover:bg-slate-500'}`}>Red/Blue</button>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                ))}
                <button
                    onClick={addVoronoiOverlay}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-sky-300 bg-sky-900/50 hover:bg-sky-900/80 rounded-md transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Voronoi Overlay
                </button>
                {activeVoronoi && (
                  <div className="pt-4 border-t border-slate-600">
                      <TimeSlider
                          label="Time"
                          id="time-slider"
                          times={activeVoronoi.data!.times}
                          timeIndex={currentTimeIndex}
                          onChange={setCurrentTimeIndex}
                      />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-300">Connectivity Groups</h3>
                {connectivityGroups.map((group, groupIndex) => (
                  <div key={group.id} className="p-3 bg-slate-700/50 rounded-lg space-y-4 border border-slate-600">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-400">Group {groupIndex + 1}</h4>
                      {connectivityGroups.length > 1 && (
                        <button onClick={() => removeConnectivityGroup(group.id)} className="p-1 text-slate-400 hover:text-red-400 transition-colors" aria-label="Remove group">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <FileUpload
                      label="Vertex Locations (.json)"
                      onFileSelect={(file) => handleVertexFileSelect(file, group.id)}
                      acceptedFileType=".json"
                      fileName={group.vertexLocationsFile?.name || null}
                      onFileClear={() => handleVertexFileClear(group.id)}
                    />

                    <div className="space-y-3 pt-2">
                      <h5 className="text-sm font-semibold text-slate-400">Adjacency Matrices</h5>
                      {group.adjacencyMatrices.map((matrixData, matrixIndex) => (
                        <div key={matrixData.id} className="p-2 bg-slate-900/30 rounded-md space-y-3">
                          <div className="flex items-center gap-2">
                            <ColorPicker value={matrixData.color} onChange={(color) => updateMatrixProperty(group.id, matrixData.id, { color })} />
                            <div className="flex-grow min-w-0">
                              <FileUpload
                                label={`Matrix ${matrixIndex + 1}`}
                                onFileSelect={(file) => handleAdjacencyFileSelect(file, group.id, matrixData.id)}
                                acceptedFileType=".json"
                                fileName={matrixData.file?.name || null}
                                onFileClear={() => handleAdjacencyFileClear(group.id, matrixData.id)}
                              />
                            </div>
                            {group.adjacencyMatrices.length > 1 && (
                              <button onClick={() => removeAdjacencyMatrix(group.id, matrixData.id)} className="p-1 text-slate-400 hover:text-red-400" aria-label="Remove matrix">
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <Slider
                            label="Max Opacity"
                            id={`opacity-${matrixData.id}`}
                            min={0} max={1} step={0.01}
                            value={matrixData.maxOpacity}
                            onChange={(val) => updateMatrixProperty(group.id, matrixData.id, { maxOpacity: val })}
                          />
                          <Slider
                            label="Thickness"
                            id={`thickness-${matrixData.id}`}
                            min={0.1} max={2} step={0.05}
                            value={matrixData.thickness}
                            onChange={(val) => updateMatrixProperty(group.id, matrixData.id, { thickness: val })}
                          />
                        </div>
                      ))}
                      <button onClick={() => addAdjacencyMatrix(group.id)} className="w-full flex items-center justify-center gap-2 py-1 px-2 text-xs font-medium text-sky-400 bg-sky-900/40 hover:bg-sky-900/70 rounded">
                        <PlusIcon className="w-3 h-3" /> Add Matrix
                      </button>
                    </div>
                  </div>
                ))}
                <button
                    onClick={addConnectivityGroup}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-sky-300 bg-sky-900/50 hover:bg-sky-900/80 rounded-md transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Connectivity Group
                </button>
              </div>
            </fieldset>
            
            <div className="border-t border-slate-700 pt-4 mt-2 space-y-4">
               <h3 className="text-lg font-semibold text-slate-300">Display Options</h3>
                <ToggleSwitch
                  id="toggle-connections"
                  label="Show Connections"
                  checked={showConnections}
                  onChange={setShowConnections}
                />
                <ToggleSwitch
                  id="toggle-curvature"
                  label="Curvature"
                  checked={useCurvature}
                  onChange={setUseCurvature}
                />
                {useCurvature && (
                  <Slider
                    label="Curvature Strength"
                    id="curvature-strength"
                    min={0} max={1} step={0.01}
                    value={curvature}
                    onChange={setCurvature}
                  />
                )}
                <ToggleSwitch
                  id="toggle-presentation"
                  label="Presentation Mode"
                  checked={presentationMode}
                  onChange={setPresentationMode}
                />
            </div>

            <div className="border-t border-slate-700 pt-4 space-y-4">
              <h3 className="text-lg font-semibold text-slate-300">Server Control</h3>
              <ToggleSwitch
                id="toggle-server-mode"
                label="Server Mode"
                checked={isServerMode}
                onChange={setIsServerMode}
              />
              {isServerMode && (
                <p className="text-sm text-slate-400">
                  Status: <span className={`font-semibold ${
                    serverStatus === 'Connected' ? 'text-green-400' : 
                    serverStatus === 'Processing...' ? 'text-sky-400' :
                    serverStatus === 'Disconnected' ? 'text-red-400' :
                    'text-yellow-400'}`}>{serverStatus}
                  </span>
                </p>
              )}
            </div>

            <div className="mt-auto pt-4 text-slate-400 text-sm">
              <h3 className="font-bold text-slate-200 mb-2">Instructions:</h3>
              <ul className="list-disc list-inside space-y-2">
                <li>Use mouse to rotate and zoom.</li>
                <li>Surface file: 'verts', 'tris'.</li>
                <li>Locations file: 'verts'.</li>
                <li>Matrix file: 'J' (NxN matrix).</li>
                <li>Voronoi file: 'verts', 'colors', 'times'.</li>
              </ul>
            </div>
          </div>

          <div ref={viewerContainerRef} className="flex-grow bg-slate-800 rounded-lg shadow-2xl overflow-hidden relative">
            {allFilesReady ? (
              <div className="w-full h-full">
                <BrainViewer
                  ref={brainViewerRef}
                  brainSurfaces={brainSurfaces}
                  connectivityGroups={connectivityGroups}
                  voronoiOverlays={voronoiOverlays}
                  currentTimeIndex={currentTimeIndex}
                  showConnections={showConnections}
                  useCurvature={useCurvature}
                  curvature={curvature}
                  backgroundColor={backgroundColor}
                  presentationMode={presentationMode}
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <svg className="mx-auto h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-slate-300">Awaiting Files</h3>
                  <p className="mt-1 text-sm">Please upload a Brain Surface JSON file.</p>
                </div>
              </div>
            )}
            {allFilesReady && (
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                 <button onClick={() => brainViewerRef.current?.setView('top')} title="Top View" className="p-2 bg-slate-700/50 hover:bg-slate-600/70 rounded-full text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Set top view"><CameraTopIcon className="w-5 h-5" /></button>
                 <button onClick={() => brainViewerRef.current?.setView('side')} title="Side View" className="p-2 bg-slate-700/50 hover:bg-slate-600/70 rounded-full text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Set side view"><CameraSideIcon className="w-5 h-5" /></button>
                 <button onClick={() => brainViewerRef.current?.setView('front')} title="Front View" className="p-2 bg-slate-700/50 hover:bg-slate-600/70 rounded-full text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" aria-label="Set front view"><CameraFrontIcon className="w-5 h-5" /></button>
                 
                 <div className="w-px bg-slate-600 mx-1"></div>

                 <button 
                  onClick={() => brainViewerRef.current?.takeScreenshot((blob) => downloadBlob(blob, 'brain-views-standard.png'), 'standard')} 
                  title="Capture Standard Views" 
                  className="p-2 bg-slate-700/50 hover:bg-slate-600/70 rounded-full text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" 
                  aria-label="Take screenshot of standard views"
                >
                  <ScreenshotIcon className="w-5 h-5" />
                </button>

                <button 
                  onClick={() => brainViewerRef.current?.takeScreenshot((blob) => downloadBlob(blob, 'brain-views-hemispheres.png'), 'hemispheres')} 
                  title="Capture Lateral Hemispheres" 
                  className="p-2 bg-slate-700/50 hover:bg-slate-600/70 rounded-full text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" 
                  aria-label="Take screenshot of lateral hemisphere views"
                >
                  <CameraHemispheresIcon className="w-5 h-5" />
                </button>

                 <button 
                  onClick={() => brainViewerRef.current?.takeScreenshot((blob) => downloadBlob(blob, 'brain-views-rotation.png'), 'rotation')} 
                  title="Capture Rotation Views" 
                  className="p-2 bg-slate-700/50 hover:bg-slate-600/70 rounded-full text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500" 
                  aria-label="Take screenshot of rotation views"
                >
                  <CameraRotationIcon className="w-5 h-5" />
                </button>
                 
                 <div className="w-px bg-slate-600 mx-1"></div>
                
                <button
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="p-2 bg-slate-700/50 hover:bg-slate-600/70 rounded-full text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
                  aria-label="Open display settings"
                >
                  <SettingsIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 bg-slate-700/50 hover:bg-slate-600/70 rounded-full text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  <FullscreenIcon isFullscreen={isFullscreen} className="w-5 h-5" />
                </button>
              </div>
            )}
             {isSettingsOpen && (
                <div ref={settingsPanelRef} className="absolute top-16 right-4 z-20 bg-slate-800/90 backdrop-blur-sm border border-slate-600 rounded-lg p-4 shadow-2xl w-64">
                   <h4 className="text-lg font-semibold text-sky-300 border-b border-slate-600 pb-2 mb-4">Display Settings</h4>
                   <div className='space-y-4'>
                      <div className="flex items-center justify-between">
                         <label className="text-sm font-medium text-slate-300">Background</label>
                           <div className="flex items-center gap-2">
                              <button onClick={handleResetBackgroundSettings} className="p-1 text-slate-400 hover:text-sky-400 transition-colors" aria-label="Reset background color">
                                <ResetIcon className="w-4 h-4" />
                              </button>
                              <ColorPicker value={backgroundColor} onChange={setBackgroundColor} popupPosition="left" />
                           </div>
                      </div>
                   </div>
                </div>
              )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;