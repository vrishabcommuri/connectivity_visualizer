import React from 'react';

export const CameraHemispheresIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <path d="M10 12 A1.5 1.5 0 1 0 10 14 A1.5 1.5 0 1 0 10 12" />
    <path d="M14 12 A1.5 1.5 0 1 0 14 14 A1.5 1.5 0 1 0 14 12" />
    <line x1="12" y1="10" x2="12" y2="16" />
  </svg>
);