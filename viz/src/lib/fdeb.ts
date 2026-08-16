import * as THREE from 'three';

export interface FDEBNode {
    x: number;
    y: number;
    z: number;
}

export interface FDEBEdge {
    source: number;
    target: number;
    weight: number;
}

export class ForceEdgeBundling {
    private nodes: FDEBNode[] = [];
    private edges: FDEBEdge[] = [];
    private compatibilityList: number[][] = [];
    private subdivisionPoints: THREE.Vector3[][] = [];
    
    private K = 0.1; // global bundling constant controlling edge stiffness
    private S_initial = 0.1; // init. distance to move points
    private P_initial = 1; // init. subdivision number
    private P_rate = 2; // subdivision rate increase
    private C = 6; // number of cycles to perform
    private I_initial = 90; // init. number of iterations for cycle
    private I_rate = 0.6666667; // rate at which iteration number decreases i.e. 2/3
    private compatibilityThreshold = 0.6;
    private eps = 1e-6;

    constructor() {}

    setNodes(nodes: FDEBNode[] | Record<string, FDEBNode>) {
        if (Array.isArray(nodes)) {
            this.nodes = nodes;
        } else {
            // If it's a record, we assume keys are indices or we map them
            this.nodes = Object.values(nodes);
        }
        return this;
    }

    setEdges(edges: { source: string | number; target: string | number; weight?: number }[]) {
        this.edges = edges.map(e => ({
            source: typeof e.source === 'string' ? parseInt(e.source) : e.source,
            target: typeof e.target === 'string' ? parseInt(e.target) : e.target,
            weight: e.weight ?? 1.0
        })).filter(e => {
            const s = this.nodes[e.source];
            const t = this.nodes[e.target];
            if (!s || !t) return false;
            return Math.abs(s.x - t.x) > this.eps || Math.abs(s.y - t.y) > this.eps || Math.abs(s.z - t.z) > this.eps;
        });
        return this;
    }

    setK(k: number) { this.K = k; return this; }
    setStiffness(k: number) { this.K = k; return this; }
    setCycles(c: number) { this.C = c; return this; }
    setIterations(i: number) { this.I_initial = i; return this; }
    setSubdivisions(p: number) { this.P_initial = p; return this; }
    setStepSize(s: number) { this.S_initial = s; return this; }
    setCompatibilityThreshold(t: number) { this.compatibilityThreshold = t; return this; }

    run() {
        return this.bundle();
    }

    private edgeLength(e: FDEBEdge): number {
        const s = this.nodes[e.source];
        const t = this.nodes[e.target];
        return Math.sqrt(Math.pow(s.x - t.x, 2) + Math.pow(s.y - t.y, 2) + Math.pow(s.z - t.z, 2));
    }

    private edgeAsVector(e: FDEBEdge): THREE.Vector3 {
        const s = this.nodes[e.source];
        const t = this.nodes[e.target];
        return new THREE.Vector3(t.x - s.x, t.y - s.y, t.z - s.z);
    }

    private edgeMidpoint(e: FDEBEdge): THREE.Vector3 {
        const s = this.nodes[e.source];
        const t = this.nodes[e.target];
        return new THREE.Vector3((s.x + t.x) / 2, (s.y + t.y) / 2, (s.z + t.z) / 2);
    }

    private projectPointOnLine(p: THREE.Vector3, source: THREE.Vector3, target: THREE.Vector3): THREE.Vector3 {
        const L = source.distanceTo(target);
        if (L < this.eps) return source.clone();
        
        const v = target.clone().sub(source).divideScalar(L);
        const w = p.clone().sub(source);
        const dot = w.dot(v);
        return source.clone().add(v.multiplyScalar(dot));
    }

    private compatibilityScore(P_idx: number, Q_idx: number): number {
        const P = this.edges[P_idx];
        const Q = this.edges[Q_idx];
        
        const vP = this.edgeAsVector(P);
        const vQ = this.edgeAsVector(Q);
        const lP = vP.length();
        const lQ = vQ.length();
        
        // 1. Angle compatibility
        const cosAlpha = vP.dot(vQ) / (lP * lQ);
        if (cosAlpha < this.compatibilityThreshold) return 0;

        // 2. Scale compatibility
        const lavg = (lP + lQ) / 2;
        const scaleComp = 2 / (lavg / Math.min(lP, lQ) + Math.max(lP, lQ) / lavg);

        // 3. Position compatibility
        const midP = this.edgeMidpoint(P);
        const midQ = this.edgeMidpoint(Q);
        const posComp = lavg / (lavg + midP.distanceTo(midQ));

        // 4. Visibility compatibility
        const sP = new THREE.Vector3(this.nodes[P.source].x, this.nodes[P.source].y, this.nodes[P.source].z);
        const tP = new THREE.Vector3(this.nodes[P.target].x, this.nodes[P.target].y, this.nodes[P.target].z);
        const sQ = new THREE.Vector3(this.nodes[Q.source].x, this.nodes[Q.source].y, this.nodes[Q.source].z);
        const tQ = new THREE.Vector3(this.nodes[Q.target].x, this.nodes[Q.target].y, this.nodes[Q.target].z);

        const V = (E1_s: THREE.Vector3, E1_t: THREE.Vector3, E2_s: THREE.Vector3, E2_t: THREE.Vector3) => {
            const I0 = this.projectPointOnLine(E2_s, E1_s, E1_t);
            const I1 = this.projectPointOnLine(E2_t, E1_s, E1_t);
            const midI = I0.clone().add(I1).divideScalar(2);
            const midE1 = E1_s.clone().add(E1_t).divideScalar(2);
            return Math.max(0, 1 - 2 * midE1.distanceTo(midI) / I0.distanceTo(I1));
        };
        
        const visComp = Math.min(V(sP, tP, sQ, tQ), V(sQ, tQ, sP, tP));

        return cosAlpha * scaleComp * posComp * visComp;
    }

    bundle() {
        let S = this.S_initial;
        let I = this.I_initial;
        let P = this.P_initial;

        // Initialize subdivisions
        this.subdivisionPoints = this.edges.map(e => {
            const s = this.nodes[e.source];
            const t = this.nodes[e.target];
            return [new THREE.Vector3(s.x, s.y, s.z), new THREE.Vector3(t.x, t.y, t.z)];
        });

        // Initialize compatibility lists
        this.compatibilityList = this.edges.map(() => []);
        for (let i = 0; i < this.edges.length; i++) {
            for (let j = i + 1; j < this.edges.length; j++) {
                if (this.compatibilityScore(i, j) >= this.compatibilityThreshold) {
                    this.compatibilityList[i].push(j);
                    this.compatibilityList[j].push(i);
                }
            }
        }

        // Main loop
        for (let cycle = 0; cycle < this.C; cycle++) {
            // Update subdivisions
            for (let e_idx = 0; e_idx < this.edges.length; e_idx++) {
                const oldPoints = this.subdivisionPoints[e_idx];
                const newPoints: THREE.Vector3[] = [];
                newPoints.push(oldPoints[0]); // source

                if (P === 1) {
                    newPoints.push(this.edgeMidpoint(this.edges[e_idx]));
                } else {
                    // Linear interpolation for new subdivision points
                    const totalDist = this.computeDividedEdgeLength(e_idx);
                    const segmentLength = totalDist / (P + 1);
                    let currentSegmentLength = segmentLength;
                    
                    for (let i = 1; i < oldPoints.length; i++) {
                        let oldSegmentLength = oldPoints[i].distanceTo(oldPoints[i-1]);
                        while (oldSegmentLength > currentSegmentLength) {
                            const percent = currentSegmentLength / oldSegmentLength;
                            const newPt = oldPoints[i-1].clone().lerp(oldPoints[i], percent);
                            newPoints.push(newPt);
                            oldSegmentLength -= currentSegmentLength;
                            currentSegmentLength = segmentLength;
                        }
                        currentSegmentLength -= oldSegmentLength;
                    }
                }
                newPoints.push(oldPoints[oldPoints.length - 1]); // target
                this.subdivisionPoints[e_idx] = newPoints;
            }

            // Iterations
            for (let iter = 0; iter < I; iter++) {
                const forces: THREE.Vector3[][] = this.edges.map((_, e_idx) => {
                    const kP = this.K / (this.edgeLength(this.edges[e_idx]) * (P + 1));
                    const edgeForces: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)]; // source force is 0

                    for (let i = 1; i < P + 1; i++) {
                        const force = new THREE.Vector3(0, 0, 0);
                        
                        // Spring force
                        const prev = this.subdivisionPoints[e_idx][i - 1];
                        const next = this.subdivisionPoints[e_idx][i + 1];
                        const crnt = this.subdivisionPoints[e_idx][i];
                        const springForce = prev.clone().sub(crnt).add(next.clone().sub(crnt)).multiplyScalar(kP);
                        
                        // Electrostatic force
                        const electrostaticForce = new THREE.Vector3(0, 0, 0);
                        const compatibleEdges = this.compatibilityList[e_idx];
                        for (const oe_idx of compatibleEdges) {
                            const otherPt = this.subdivisionPoints[oe_idx][i];
                            const diff = otherPt.clone().sub(crnt);
                            const dist = diff.length();
                            if (dist > this.eps) {
                                // Weight the force by the other edge's weight
                                electrostaticForce.add(diff.divideScalar(dist).multiplyScalar(this.edges[oe_idx].weight));
                            }
                        }
                        
                        force.add(springForce).add(electrostaticForce).multiplyScalar(S);
                        edgeForces.push(force);
                    }
                    edgeForces.push(new THREE.Vector3(0, 0, 0)); // target force is 0
                    return edgeForces;
                });

                // Apply forces
                for (let e_idx = 0; e_idx < this.edges.length; e_idx++) {
                    for (let i = 0; i < P + 2; i++) {
                        this.subdivisionPoints[e_idx][i].add(forces[e_idx][i]);
                    }
                }
            }

            // Prepare for next cycle
            S = S / 2;
            P = P * this.P_rate;
            I = Math.floor(I * this.I_rate);
        }

        return this.subdivisionPoints;
    }

    private computeDividedEdgeLength(e_idx: number): number {
        let length = 0;
        const points = this.subdivisionPoints[e_idx];
        for (let i = 1; i < points.length; i++) {
            length += points[i].distanceTo(points[i - 1]);
        }
        return length;
    }
}
