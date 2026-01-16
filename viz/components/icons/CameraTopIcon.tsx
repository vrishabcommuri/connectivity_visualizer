import React from 'react';

export const CameraTopIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    {/* Top Face (Highlighted) */}
    <path d="M4 8 l8 -4 l8 4 l-8 4 Z" fill="currentColor" />
    {/* Left Face */}
    <path d="M4 8 v8 l8 4 v-8 Z" />
    {/* Right Face */}
    <path d="M12 12 v8 l8 -4 v-8 Z" />
  </svg>
);
