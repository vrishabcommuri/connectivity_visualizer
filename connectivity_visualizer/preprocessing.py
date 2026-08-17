import json
import numpy as np
from .utils import create_subject_meshes
import mne
from functools import reduce

def save_J_stats_to_json(adj, fname, maxnorm=False, clip=None, 
                         srcs=None, saveweighted=True,
                         outdir="../statmaps"):
    adj = adj.T


    for sign in ['positive', 'negative']:
        if sign == 'negative':
            adj_thresh = -(adj * (adj < 0))
        else:
            adj_thresh = (adj * (adj > 0))            
            
        clipped = ""
        if clip:
            clipped = f"_clipped{clip}"
            adj_thresh = np.clip(0, clip, adj_thresh)
            
        maxnormed = ""
        if maxnorm:
            maxnormed = "_maxnormed"
            if adj_thresh.max() != 0:
                adj_thresh = adj_thresh/adj_thresh.max()
            else:
                adj_thresh = np.zeros_like(adj_thresh)
            
        
        if saveweighted:
            # 4th power is often useful for visualizing strongest connections
            with open(f'{str(outdir)}/adjacency_{fname}_{sign}{maxnormed}{clipped}_quad.json', 'w') as f:
                json.dump({"J":(adj_thresh**4).astype(float).tolist()}, f)

            with open(f'{str(outdir)}/adjacency_{fname}_{sign}{maxnormed}{clipped}_squared.json', 'w') as f:
                json.dump({"J":(adj_thresh**2).astype(float).tolist()}, f)

        with open(f'{str(outdir)}/adjacency_{fname}_{sign}{maxnormed}{clipped}_raw.json', 'w') as f:
            json.dump({"J":(adj_thresh).astype(float).tolist()}, f)

# Usage: 
# create_region_mesh(['parsopercularis', 
#                     'parstriangularis', 
#                     'parsorbitalis', 
#                     'insula'], 'rh', suffix="_IF")
def create_subregion_mesh(subject, regions, hemi, src_target, src_origin, 
                       save=True, suffix=None, 
                       subjects_dir="../mri", parc='aparc'):
    rr_lh_origin, tris, origin_verts, target_verts, = \
        create_subject_meshes(subject, src_origin, src_target)
    
    
    if isinstance(regions, str):
        regions = [regions]
        
    if suffix is None:
        suffix = ""
        for roi in regions:
            suffix += f"_{roi}"
        
    outputs = []
    labs = None
    for region in regions:
        lab = mne.read_labels_from_annot(subject=subject,
                                   parc=parc,
                                   hemi=hemi,
                                   regexp=region,
                                   subjects_dir=subjects_dir)
        if labs is None:
            labs = reduce(lambda x, y: x + y, lab)
        else:
            labs += reduce(lambda x, y: x + y, lab)
        
    if hemi == 'rh':
        hemiidx = 1
    else:
        hemiidx = 0
    inuse = src_origin[hemiidx]['inuse']
    mapping = -np.ones(len(inuse), dtype=int)
    mapping[np.where(inuse)[0]] = np.arange(np.sum(inuse))

    subregionverts = np.intersect1d(np.where(src_origin[hemiidx]['inuse'])[0], 
                                    labs.vertices)
    subregionverts = np.array([mapping[i] for i in subregionverts]).astype(int)
    if hemi == 'rh':
        subregionverts += len(rr_lh_origin)
    subregiontris = np.array([list(i) for i in tris 
                            if np.all(np.in1d(i, subregionverts))]).astype(int)
    
    if save:
        with open(f'../meshes/{subject}_brainmesh_{hemi}{suffix}.json', 'w') \
                as f:
            json.dump({"verts":origin_verts.tolist(), 
                       "tris":subregiontris.tolist()}, f)
        return
    else:
        outputs.append({"verts":origin_verts.tolist(), 
                        "tris":subregiontris.tolist(), 
                        "subregionverts":subregionverts.tolist()})
    
    return outputs


def create_region_mesh(subject, src_target, src_origin, outdir=".."):
    _, tris, origin_verts, target_verts, = \
        create_subject_meshes(subject, src_origin, src_target)

    ###### cortex mesh
    with open(f'{outdir}/meshes/brainmesh{subject}.json', 'w') as f:
        json.dump({"verts":origin_verts.tolist(), "tris":tris.tolist()}, f)
        
    ###### vertex locations
    with open(f'{outdir}/vertices/vertices{subject}_84reg.json', 'w') as f:
        json.dump({"verts":target_verts.tolist()}, f)

