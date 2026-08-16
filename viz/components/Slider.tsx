import React from 'react';

interface SliderProps {
  label: string;
  description?: string;
  id: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ label, description, id, min, max, step, value, onChange }) => {
  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-sm font-medium text-slate-400 mb-1">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </label>
      {description && <p className="text-xs text-slate-500 mb-1 italic">{description}</p>}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-sky-500"
      />
    </div>
  );
};

export default Slider;
