import React, { useState, useRef, useEffect } from 'react';

interface ColorPickerProps {
  value: string; // expecting "#RRGGBB"
  onChange: (value: string) => void;
  popupPosition?: 'bottom' | 'left';
}

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, popupPosition = 'bottom' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const popupPositionClasses = {
    bottom: 'top-full mt-2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-md border-2 border-slate-500"
        style={{ backgroundColor: value }}
        aria-label="Open color picker"
      />
      {isOpen && (
        <div className={`absolute z-10 p-3 bg-slate-800 rounded-lg shadow-2xl border border-slate-600 ${popupPositionClasses[popupPosition]}`}>
          <div className="flex items-center gap-2">
            <label htmlFor={`color-input-${value}`} className="sr-only">Color</label>
            <input
              id={`color-input-${value}`}
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-8 p-0 border-none rounded cursor-pointer bg-slate-700"
            />
            <span className="text-sm font-mono text-slate-300">{value.toUpperCase()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
