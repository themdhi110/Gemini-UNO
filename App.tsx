import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { GameEngine } from './services/gameEngine';
import { requestAiMove } from './services/aiService';
import CardComponent from './components/Card';
import type { PublicGameState, Card } from './types';
import { motion, AnimatePresence } from 'framer-motion';

const PlayerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
    </svg>
);

const BotIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
        <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.787.243 2.5.466A6.75 6.75 0 0 1 21 8.652c.223.713.414 1.533.466 2.5s.052.967 0 1.933a49.52 49.52 0 0 1-5.312 0c-.967-.052-1.787-.243-2.5-.466A6.75 6.75 0 0 1 3 15.348c-.223-.713-.414-1.533-.466-2.5s-.052-.967 0-1.933a49.52 49.52 0 0 1 5.312 0c.967.052 1.787.243 2.5.466A6.75 6.75 0 0 1 21 8.652c.223-.713.414-1.533.466-2.5s.052-.967 0-1.933ZM10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM12 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
    </svg>
);

const ColorPicker = ({ onSelect }: { onSelect: (color: 'red' | 'green' | 'blue' | 'yellow') => void }) => {
    const colors: ('red' | 'green' | 'blue' | 'yellow')[] = ['red', 'green', 'blue', 'yellow'];
    const colorClasses = {
        red: 'bg-red-600 hover:bg-red-500',
        green: 'bg-green-600 hover:bg-green-500',
        blue: 'bg-blue-600 hover:bg-blue-500',
        yellow: 'bg-yellow-500 hover:bg-yellow-400',
    };
  
    return (
      <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 flex items-center justify-center z-50"
      >
          <div className="bg-gray-700 p-6 rounded-xl shadow-2xl text-center">
              <h3 className="text-2xl font-bold mb-4">Choose a color</h3>
              <div className="grid grid-cols-2 gap-4">
                  {colors.map(color => (
                      <motion.button
                          key={color}
                          onClick={() => onSelect(color)}
                          className={`w-24 h-24 rounded-lg ${colorClasses[color]}`}
                          aria-label={`Choose ${color}`}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                      />
                  ))}
              </div>
          </div>
      </motion.div>
    );
};

export default function App() {
  const [engine] = useState(() => new GameEngine());
  const [state, setState] = useState<PublicGameState | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [unoCalloutTarget, setUnoCalloutTarget] = useState<number | null>(null);
  const [playerNeedsToShout, setPlayerNeedsToShout] = useState(false);
  const penaltyTimerRef = useRef<number | null>(null);
  const prevStateRef = useRef<PublicGameState | null>(null);

  useEffect(() => {
    prevStateRef.current = state;
  }, [state]);

  useEffect(() => {
    engine.onChange((s) => {
        setState(s);
        if(s.currentPlayerIsAi) {
            setIsAiThinking(true);
        } else {
            setIsAiThinking(false);
        }
    });
    engine.init();
  }, [engine]);

  useEffect(() => {
    if (!state || !prevStateRef.current) return;
    const prevState = prevStateRef.current;

    state.players.forEach((player, index) => {
        const prevCardCount = prevState.players[index]?.cardCount;
        if (prevCardCount === 2 && player.cardCount === 1) {
            if (index === 0) { // Human player
                setPlayerNeedsToShout(true);
                penaltyTimerRef.current = window.setTimeout(() => {
                    setPlayerNeedsToShout(false);
                    engine.callOutAndPenalize(0);
                }, 2500);
            } else { // AI player
                if (!state.shoutedUno[index]) {
                    setUnoCalloutTarget(index);
                    setTimeout(() => setUnoCalloutTarget(null), 2500);
                }
            }
        }
    });

    return () => {
        if (penaltyTimerRef.current) {
            clearTimeout(penaltyTimerRef.current);
        }
    };
  }, [state, engine]);

  const handleAiTurn = useCallback(async (currentState: PublicGameState) => {
    const move = await requestAiMove(currentState);
    if (move.shoutUno) {
        const forgets = Math.random() < 0.2; // 20% chance AI forgets
        if (forgets) delete move.shoutUno;
    }
    engine.applyAiMove(move);
  }, [engine]);

  useEffect(() => {
    if (state?.currentPlayerIsAi && !state.isGameOver) {
      const timeoutId = setTimeout(() => {
        handleAiTurn(state);
      }, 1500);
      return () => clearTimeout(timeoutId);
    }
  }, [state, handleAiTurn]);

  const onPlayCard = (cardIndex: number) => {
    if(state?.isPlayerTurn && !state.isWildColorChoicePending) {
        engine.playCard(cardIndex);
    }
  };
  
  const onDrawCard = () => {
    if(state?.isPlayerTurn && !state.isWildColorChoicePending) {
        engine.drawCard();
    }
  }

  const handleShoutUno = () => {
      if (penaltyTimerRef.current) {
          clearTimeout(penaltyTimerRef.current);
          penaltyTimerRef.current = null;
      }
      setPlayerNeedsToShout(false);
      engine.playerShoutsUno();
  };

  const handleCallOut = (targetIndex: number) => {
      engine.callOutAndPenalize(targetIndex);
      setUnoCalloutTarget(null);
  };

  const handleColorSelect = (color: 'red' | 'green' | 'blue' | 'yellow') => {
    engine.playerChoosesColor(color);
  }

  const getPlayerStatus = (playerIndex: number) => {
    if (!state) return '';
    if (state.currentPlayerIndex === playerIndex) {
      if (state.currentPlayerIsAi && isAiThinking) return "Thinking...";
      return "Active Turn";
    }
    return "Waiting...";
  };

  const getPlayerStatusColor = (playerIndex: number) => {
    if(state?.currentPlayerIndex === playerIndex) return "text-yellow-400";
    return "text-gray-400";
  }

  const opponents = useMemo(() => state?.players.filter((_, i) => i !== 0) || [], [state]);

  if (!state) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <h1 className="text-4xl font-bold animate-pulse">Loading UNO...</h1>
        </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-4 bg-gray-800 from-gray-900 to-gray-800 font-sans">
      
      <AnimatePresence>
        {state.isGameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 flex items-center justify-center z-50"
          >
            <div className="bg-gray-700 p-8 rounded-xl shadow-2xl text-center">
              <h2 className="text-4xl font-bold mb-4">{state.winner} Wins!</h2>
              <button
                className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors"
                onClick={() => engine.init()}
              >
                Play Again
              </button>
            </div>
          </motion.div>
        )}
        {state.isWildColorChoicePending && <ColorPicker onSelect={handleColorSelect} />}
      </AnimatePresence>

      <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
        <AnimatePresence>
            {playerNeedsToShout && (
                <motion.button 
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    className="pointer-events-auto px-10 py-6 bg-yellow-500 text-gray-900 font-black text-4xl rounded-2xl shadow-lg hover:bg-yellow-400 transform hover:scale-105 transition-all"
                    onClick={handleShoutUno}>
                    SHOUT UNO!
                </motion.button>
            )}
            {unoCalloutTarget !== null && (
                 <motion.button 
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    className="pointer-events-auto px-8 py-5 bg-red-600 text-white font-bold text-2xl rounded-2xl shadow-lg hover:bg-red-500 transform hover:scale-105 transition-all"
                    onClick={() => handleCallOut(unoCalloutTarget)}>
                    Call Out {state.players[unoCalloutTarget].name}!
                 </motion.button>
            )}
        </AnimatePresence>
      </div>

      <header className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-white tracking-wider">Gemini UNO</h1>
        <div className="flex space-x-4">
          {opponents.map((p, i) => {
            const playerIndex = i + 1;
            return (
             <div key={p.name} className={`relative flex items-center space-x-2 p-2 rounded-lg transition-all duration-300 ${state.currentPlayerIndex === playerIndex ? 'bg-yellow-500/20 ring-2 ring-yellow-500' : 'bg-gray-700'}`}>
                {state.opponentHands[i] === 1 && state.shoutedUno[playerIndex] && (
                    <motion.div initial={{scale:0}} animate={{scale:1}} className="absolute -top-2 -right-2 text-xs font-bold text-gray-900 bg-yellow-400 px-2 py-1 rounded-full shadow-md">UNO!</motion.div>
                )}
                <BotIcon />
                <div className="text-left">
                  <span className="font-semibold block">{p.name}</span>
                  <span className="text-sm text-gray-300">{state.opponentHands[i]} cards</span>
                  <span className={`text-xs block ${getPlayerStatusColor(playerIndex)}`}>{getPlayerStatus(playerIndex)}</span>
                </div>
            </div>
          )})}
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center relative">
        <div className="flex items-center space-x-8">
            <div className="flex flex-col items-center space-y-2">
                <p className="font-semibold">Draw Pile</p>
                 <button onClick={onDrawCard} disabled={!state.isPlayerTurn || isAiThinking || state.isWildColorChoicePending}>
                    <CardComponent isCardBack={true}/>
                </button>
                <span className="text-sm text-gray-400">{state.drawCount} cards left</span>
            </div>
            <div className="flex flex-col items-center space-y-2">
                <p className="font-semibold">Discard Pile</p>
                <CardComponent card={state.topCard} />
            </div>
        </div>
      </main>

      <footer className="mt-4">
        <div className="flex flex-col items-center">
          <div className={`relative flex items-center space-x-3 mb-4 p-3 rounded-lg transition-all duration-300 ${state.isPlayerTurn ? 'bg-green-500/20 ring-2 ring-green-500' : 'bg-gray-700'}`}>
            {state.playerHand.length === 1 && state.shoutedUno[0] && (
                <motion.div initial={{scale:0}} animate={{scale:1}} className="absolute -top-2 -right-2 text-xs font-bold text-gray-900 bg-yellow-400 px-2 py-1 rounded-full shadow-md">UNO!</motion.div>
            )}
            <PlayerIcon />
            <div>
              <h2 className="text-xl font-bold">{state.players[0].name}</h2>
              <span className={`text-sm ${getPlayerStatusColor(0)}`}>{getPlayerStatus(0)}</span>
            </div>
          </div>
          <div className="flex justify-center items-end h-40 w-full px-4">
            <AnimatePresence>
            {state.playerHand.map((c, i) => (
              <motion.div
                key={`${c.color}-${c.type}-${c.value}-${i}`}
                initial={{ opacity: 0, y: 50, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.05 } }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                whileHover={{ y: -20, scale: 1.05, zIndex: 10 }}
                className={`cursor-pointer -mx-3 ${state.isWildColorChoicePending ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => onPlayCard(i)}
                style={{ originX: 0.5, originY: 1 }}
                >
                <CardComponent card={c} />
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        </div>
      </footer>
    </div>
  );
}