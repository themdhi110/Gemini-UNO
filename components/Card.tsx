
import React from 'react';
import type { Card } from '../types';

interface CardProps {
  card?: Card;
  compact?: boolean;
  isCardBack?: boolean;
}

const CardComponent: React.FC<CardProps> = ({ card, compact = false, isCardBack = false }) => {
  if (isCardBack) {
    return (
        <div className={`relative flex items-center justify-center font-bold text-white rounded-lg shadow-lg
            ${compact ? 'w-12 h-18' : 'w-20 h-28 md:w-24 md:h-36'} bg-gray-800 border-2 border-gray-600`}>
             <div className="absolute w-12 h-12 rounded-full bg-red-600 flex items-center justify-center -rotate-12">
                <span className="text-2xl font-black italic">UNO</span>
             </div>
        </div>
    );
  }
  
  if (!card) return null;

  const colorClasses: { [key: string]: string } = {
    red: 'bg-red-600',
    green: 'bg-green-600',
    blue: 'bg-blue-600',
    yellow: 'bg-yellow-500',
    black: 'bg-gray-900',
  };

  const baseClasses = `flex items-center justify-center font-bold text-white rounded-lg shadow-lg transition-transform duration-200`;
  const sizeClasses = compact ? 'w-12 h-18 text-xl' : 'w-20 h-28 md:w-24 md:h-36 text-5xl';
  const backgroundClass = colorClasses[card.color];

  const renderContent = () => {
    switch (card.type) {
        case 'number':
            return <span className="drop-shadow-lg">{card.value}</span>;
        case 'skip':
            return <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center"><div className="w-8 h-2 bg-current transform rotate-45"></div></div>;
        case 'reverse':
            return <span className="text-4xl">&#x21C4;</span>
        case 'draw2':
            return <span className="font-black drop-shadow-lg">+2</span>;
        case 'wild':
             return <div className="w-12 h-12 bg-gradient-to-br from-red-500 via-yellow-500 to-blue-500 rounded-full"></div>;
        case 'wild_draw4':
            return <span className="font-black drop-shadow-lg">+4</span>;
        default:
            return card.type;
    }
  };


  return (
    <div className={`${baseClasses} ${sizeClasses} ${backgroundClass}`}>
      {renderContent()}
    </div>
  );
};

export default CardComponent;
