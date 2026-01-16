import React from 'react';

export const CameraFrontIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    {/* Top Face */}
    <path d="M4 8 l8 -4 l8 4 l-8 4 Z" />
    {/* Left Face (Highlighted) */}
    <path d="M4 8 v8 l8 4 v-8 Z" fill="currentColor" />
    {/* Right Face */}
    <path d="M12 12 v8 l8 -4 v-8 Z" />
  </svg>
);
