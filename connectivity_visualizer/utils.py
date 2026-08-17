import numpy as np
import pandas as pd
import json

def src_to_mesh(src):
    rr = src['rr']
    tris = src['tris']

    # some versions provide 'tris' only for in-use verts
    if 'use_tris' in src:  
        inuse = src['inuse'].astype(bool)
        if inuse.any():
            # build remapping
            mapping = -np.ones(len(inuse), dtype=int)
            mapping[np.where(inuse)[0]] = np.arange(np.sum(inuse))

            rr = rr[inuse]
            tris = mapping[src['use_tris']]
            tris = tris[np.all(tris >= 0, axis=1)]

    return rr, tris


def create_subject_meshes(subject, src_target, src_origin):
    ###### ico-4
    rr_lh, tris_lh = src_to_mesh(src_origin[0])
    rr_rh, tris_rh = src_to_mesh(src_origin[1])

    tris_rh += len(rr_lh)  # shift indices for RH
    origin_verts = np.vstack([rr_lh, rr_rh])
    tris = np.vstack([tris_lh, tris_rh])
    rr_lh_origin = rr_lh


    ###### ico-1
    rr_lh, tris_lh = src_to_mesh(src_target[0])
    rr_rh, tris_rh = src_to_mesh(src_target[1])

    tris_rh += len(rr_lh)  # shift indices for RH
    target_verts = np.vstack([rr_lh, rr_rh])

    return rr_lh_origin, tris, origin_verts, target_verts,
            
        
        
            
            