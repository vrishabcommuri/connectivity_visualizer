import React from 'react';

export const CameraTwoPanelIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="12" y1="12" x2="21" y2="12" />
    <circle cx="7.5" cy="12" r="2.5" />
    <path d="M15 7.5 a1.5 1.5 0 1 0 0 3 a1.5 1.5 0 1 0 0 -3" />
    <path d="M15 13.5 a1.5 1.5 0 1 0 0 3 a1.5 1.5 0 1 0 0 -3" />
  </svg>
);
