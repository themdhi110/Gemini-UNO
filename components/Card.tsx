
import React from 'react';
import type { Card } from '../types';
import { motion } from 'framer-motion';

interface CardProps {
  card?: Card;
  compact?: boolean;
  isCardBack?: boolean;
}

const CardNumber = ({ value, className }: { value: string, className?: string }) => (
    <div className={`absolute font-black text-white/80 ${className}`}>
        {value}
    </div>
);

const CardComponent: React.FC<CardProps> = ({ card, compact = false, isCardBack = false }) => {
  if (isCardBack) {
    return (
        <div className={`relative flex items-center justify-center font-bold text-white rounded-lg shadow-lg border-2 border-gray-600 bg-gray-800
            ${compact ? 'w-12 h-[72px]' : 'w-20 h-28 md:w-24 md:h-36'}`}>
             <div className="absolute w-12 h-12 rounded-full bg-red-600 flex items-center justify-center -rotate-12 shadow-inner">
                <span className="text-2xl font-black italic">UNO</span>
             </div>
        </div>
    );
  }
  
  if (!card) return null;

  const colorClasses: { [key: string]: string } = {
    red: 'bg-red-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-400',
    black: 'bg-gray-800',
  };

  const baseClasses = `relative flex items-center justify-center font-bold text-white rounded-lg shadow-lg overflow-hidden`;
  const sizeClasses = compact ? 'w-12 h-18 text-xl' : 'w-20 h-28 md:w-24 md:h-36';
  const backgroundClass = colorClasses[card.color];

  const renderContent = () => {
    let content: React.ReactNode;
    let cornerValue: string = '';

    switch (card.type) {
        case 'number':
            cornerValue = card.value!.toString();
            content = <span className="text-6xl font-black drop-shadow-lg">{card.value}</span>;
            break;
        case 'skip':
             cornerValue = '⊘';
             content = <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-current"><div style={{width: '3rem', height: '0.75rem', backgroundColor: 'currentColor', transform: 'rotate(45deg)', borderRadius: '99px'}}></div></div>;
            break;
        case 'reverse':
            cornerValue = '⇄';
            content = <motion.div animate={{ rotate: [0, 360]}} transition={{ duration: 0.5, ease: 'linear', repeat: Infinity, repeatDelay: 2}} className="text-5xl font-black flex items-center">&#x21C4;</motion.div>;
            break;
        case 'draw2':
            cornerValue = '+2';
            content = <div className="relative font-black text-4xl drop-shadow-lg">
                <div className="w-8 h-12 rounded border-2 bg-white/80 border-current absolute -top-2 -left-2 transform -rotate-12"></div>
                <div className="w-8 h-12 rounded border-2 bg-white/80 border-current absolute transform rotate-12"></div>
            </div>;
            break;
        case 'wild':
             content = <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500"></div>;
             break;
        case 'wild_draw4':
            cornerValue = '+4';
            content = <div className="relative flex space-x-1">
                <div className="w-5 h-8 bg-blue-500 rounded-sm border-2 border-white/50 transform -rotate-12"></div>
                <div className="w-5 h-8 bg-green-500 rounded-sm border-2 border-white/50 transform rotate-6"></div>
                <div className="w-5 h-8 bg-yellow-400 rounded-sm border-2 border-white/50 transform -rotate-6"></div>
                <div className="w-5 h-8 bg-red-500 rounded-sm border-2 border-white/50 transform rotate-12"></div>
            </div>;
            break;
        default:
            content = card.type;
    }
    return <>
        {cornerValue && <CardNumber value={cornerValue} className="top-1 left-2 text-2xl"/>}
        <div className="absolute w-full h-full bg-white/20 rounded-full transform scale-150 -rotate-45"></div>
        <div className="relative z-10">
            {content}
        </div>
        {cornerValue && <CardNumber value={cornerValue} className="bottom-1 right-2 text-2xl transform rotate-180"/>}
    </>;
  };


  return (
    <div className={`${baseClasses} ${sizeClasses} ${backgroundClass}`}>
      {renderContent()}
    </div>
  );
};

export default CardComponent;
