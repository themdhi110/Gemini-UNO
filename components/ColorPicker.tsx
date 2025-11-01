
import React from 'react';
import type { CardColor } from '../types';

interface ColorPickerProps {
  onColorSelect: (color: CardColor) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ onColorSelect }) => {
  const colors: Exclude<CardColor, 'black'>[] = ['red', 'green', 'blue', 'yellow'];
  const colorClasses = {
    red: 'bg-red-500 hover:bg-red-400',
    green: 'bg-green-500 hover:bg-green-400',
    blue: 'bg-blue-500 hover:bg-blue-400',
    yellow: 'bg-yellow-400 hover:bg-yellow-300',
  };

  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40">
      <div className="bg-gray-700 p-6 rounded-xl shadow-2xl text-center">
        <h3 className="text-2xl font-bold mb-4">Choose a color</h3>
        <div className="flex space-x-4">
          {colors.map(color => (
            <button
              key={color}
              onClick={() => onColorSelect(color)}
              className={`w-20 h-20 rounded-full transition-transform transform hover:scale-110 shadow-lg ${colorClasses[color]}`}
              aria-label={`Choose ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
export default ColorPicker;
