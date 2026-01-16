import React from 'react';

interface TimeSliderProps {
  label: string;
  id: string;
  times: number[];
  timeIndex: number;
  onChange: (index: number) => void;
}

const TimeSlider: React.FC<TimeSliderProps> = ({ label, id, times, timeIndex, onChange }) => {
  if (!times || times.length === 0) return null;

  const currentTime = times[timeIndex] ?? 0;
  const safeTimeIndex = Math.min(timeIndex, times.length - 1);

  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-sm font-medium text-slate-400 mb-1">
        <span>{label}</span>
        <span>{currentTime.toFixed(3)}s</span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={times.length - 1}
        step={1}
        value={safeTimeIndex}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-sky-500"
      />
    </div>
  );
};

export default TimeSlider;
