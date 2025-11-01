
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { GameEngine } from './services/gameEngine';
import { requestAiMove, requestAiChatMessage } from './services/aiService';
import CardComponent from './components/Card';
import ColorPicker from './components/ColorPicker';
import type { PublicGameState, Card, CardColor, ChatMessage, AIMove } from './types';
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

const ChatBox: React.FC<{ messages: ChatMessage[], typingUser: string | null }> = ({ messages, typingUser }) => (
    <div className="absolute top-28 left-4 w-72 h-1/2 bg-black/30 backdrop-blur-sm rounded-lg p-3 flex flex-col space-y-2 shadow-lg">
        <h3 className="font-bold border-b border-gray-500 pb-2 text-lg">Game Chat</h3>
        <div className="flex-grow overflow-y-auto pr-2">
            <AnimatePresence>
                {messages.map((msg, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="mb-2"
                    >
                        <span className="font-bold text-yellow-300">{msg.sender}: </span>
                        <span className="text-gray-200">{msg.text}</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
        {typingUser && (
            <div className="flex-shrink-0 text-gray-400 italic">
                {typingUser} is typing...
            </div>
        )}
    </div>
);


export default function App() {
  const [engine] = useState(() => new GameEngine());
  const [state, setState] = useState<PublicGameState | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [gamePhase, setGamePhase] = useState<'lobby' | 'searching' | 'playing'>('lobby');
  const [playerNames, setPlayerNames] = useState<string[]>(['You', '', '']);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiChatting, setIsAiChatting] = useState<string | null>(null);

  useEffect(() => {
    const prefixes = ['Cyber', 'Quantum', 'Data', 'Pixel', 'Glitch', 'Logic', 'Void', 'Hex'];
    const suffixes = ['Ninja', 'Ghost', 'Wraith', 'Prowler', 'Gambit', 'Slinger', 'Runner', 'Jester'];
    const randomName = () => `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffixes[Math.floor(Math.random() * suffixes.length)]}${Math.floor(Math.random() * 90) + 10}`;
    setPlayerNames(['You', randomName(), randomName()]);
  }, []);

  const handleStartGame = () => {
    setGamePhase('searching');
    setChatMessages([]);
    setTimeout(() => {
        engine.init(playerNames);
        setGamePhase('playing');
    }, 3000);
  };

  useEffect(() => {
    engine.onChange((s) => {
        setState(s);
        if(s.currentPlayerIsAi) {
            setIsAiThinking(true);
        } else {
            setIsAiThinking(false);
        }
    });
  }, [engine]);

  const handleAiTurn = useCallback(async (currentState: PublicGameState) => {
    const aiHand = engine.getHandForPlayer(currentState.currentPlayerIndex);
    const move = await requestAiMove(currentState, aiHand);
    const playerName = currentState.players[currentState.currentPlayerIndex].name;
    
    let moveDescription = '';
    if (move.type === 'play' && typeof move.cardIndex === 'number') {
        const card = aiHand[move.cardIndex];
        moveDescription = `played a ${card.color} ${card.type}${card.value ? ` ${card.value}`: ''}`;
        if (card.color === 'black' && move.chosenColor) {
            moveDescription += ` and chose ${move.chosenColor}`;
        }
    } else {
        moveDescription = 'drew a card';
    }

    engine.applyAiMove(move);
    setIsAiChatting(playerName);
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 800));
        
    try {
        const newState = engine.getPublicState();
        const chatText = await requestAiChatMessage(playerName, moveDescription, newState);
        if(chatText && chatText.length > 1) {
            setChatMessages(prev => [...prev, { sender: playerName, text: chatText }]);
        }
    } finally {
        setIsAiChatting(null);
    }
  }, [engine]);

  useEffect(() => {
    if (state?.currentPlayerIsAi && !state.isGameOver) {
      const timeoutId = setTimeout(() => {
        handleAiTurn(state);
      }, Math.random() * 1500 + 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [state, handleAiTurn]);

  const onPlayCard = (cardIndex: number) => {
    if(state?.isPlayerTurn) {
        engine.playCard(cardIndex);
    }
  };
  
  const onDrawCard = () => {
    if(state?.isPlayerTurn) {
        engine.drawCard();
    }
  }
  
  const onColorSelect = (color: CardColor) => {
    engine.playerChoseColor(color);
  }

  const getPlayerStatus = (playerIndex: number) => {
    if (!state) return '';
    if (state.currentPlayerIndex === playerIndex) {
      if (state.currentPlayerIsAi && isAiThinking) {
        return "Thinking...";
      }
      return "Active Turn";
    }
    return "Waiting...";
  };

  const getPlayerStatusColor = (playerIndex: number) => {
    if(state?.currentPlayerIndex === playerIndex) return "text-yellow-300";
    return "text-gray-400";
  }

  if (gamePhase === 'lobby' || gamePhase === 'searching') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 bg-[radial-gradient(#4b5563_1px,transparent_1px)] [background-size:24px_24px] text-white">
        <h1 className="text-6xl font-bold text-white tracking-wider drop-shadow-[0_0_15px_rgba(74,222,128,0.5)] mb-8">Gemini UNO: Online Arena</h1>
        <div className="bg-black/30 backdrop-blur-sm p-8 rounded-lg w-full max-w-md text-center">
            <h2 className="text-2xl font-semibold mb-6">Players in Lobby</h2>
            <div className="space-y-4 mb-8">
                {playerNames.map((name, i) => (
                    <div key={name} className="flex items-center justify-between bg-gray-800/50 p-3 rounded-md">
                        <div className="flex items-center space-x-3">
                            {i === 0 ? <PlayerIcon /> : <BotIcon />}
                            <span className="text-lg font-medium">{name}</span>
                        </div>
                        <span className="text-green-400 font-semibold">Online</span>
                    </div>
                ))}
            </div>
            {gamePhase === 'lobby' ? (
                <button onClick={handleStartGame} className="w-full px-6 py-4 rounded-lg bg-emerald-600 text-white font-bold text-xl hover:bg-emerald-500 transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(74,222,128,0.4)]">
                    Find Match
                </button>
            ) : (
                <div className="text-xl font-semibold text-yellow-300 animate-pulse">
                    Searching for match...
                </div>
            )}
        </div>
      </div>
    );
  }

  if (!state) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <h1 className="text-4xl font-bold animate-pulse">Loading Game...</h1>
        </div>
    );
  }
  
  const opponents = state.players.filter((_, i) => i !== 0);

  return (
    <div className="relative flex flex-col min-h-screen p-4 bg-gray-900 bg-[radial-gradient(#4b5563_1px,transparent_1px)] [background-size:24px_24px] font-sans overflow-hidden">
      
      <AnimatePresence>
        {state.isGameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
          >
            <div className="bg-gray-700 p-8 rounded-xl shadow-2xl text-center">
              <h2 className="text-4xl font-bold mb-4">{state.winner} Wins!</h2>
              <button
                className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors"
                onClick={handleStartGame}
              >
                Find New Match
              </button>
            </div>
          </motion.div>
        )}
        {state.isAwaitingColorChoice && state.isPlayerTurn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ColorPicker onColorSelect={onColorSelect} />
          </motion.div>
        )}
      </AnimatePresence>
      
      <ChatBox messages={chatMessages} typingUser={isAiChatting} />

      <header className="relative w-full flex justify-center items-start mb-4 h-24">
        <h1 className="absolute top-0 left-4 text-3xl font-bold text-white tracking-wider drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">Gemini UNO</h1>
        <div className="flex space-x-8">
          {opponents.map((p, i) => (
             <div key={p.name} className={`relative flex flex-col items-center space-y-1 p-3 rounded-lg transition-all duration-300 w-48 ${state.currentPlayerIndex === (i+1) ? 'bg-yellow-500/20 ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'bg-black/30'}`}>
                <div className="flex items-center space-x-2">
                  <BotIcon />
                  <div className="text-left">
                    <span className="font-semibold block">{p.name}</span>
                    <span className={`text-xs block ${getPlayerStatusColor(i+1)}`}>{getPlayerStatus(i+1)}</span>
                  </div>
                </div>
                <div className="flex -space-x-4">
                  {Array.from({ length: state.opponentHands[i] }).map((_, cardIdx) => (
                    <div key={cardIdx} style={{ transform: `rotate(${cardIdx*5-((state.opponentHands[i]-1)*2.5)}deg)`}}>
                      <CardComponent isCardBack={true} compact={true} />
                    </div>
                  ))}
                </div>
            </div>
          ))}
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center relative my-4">
        <div className="flex items-center space-x-8">
            <div className="flex flex-col items-center space-y-2">
                <p className="font-semibold text-lg drop-shadow-md">Draw Pile</p>
                 <button onClick={onDrawCard} disabled={!state.isPlayerTurn || isAiThinking || state.isAwaitingColorChoice} className="transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                    <CardComponent isCardBack={true}/>
                </button>
                <span className="text-sm text-gray-300">{state.drawCount} cards left</span>
            </div>
            <div className="flex flex-col items-center space-y-2">
                <p className="font-semibold text-lg drop-shadow-md">Discard Pile</p>
                <CardComponent card={state.topCard} />
            </div>
        </div>
      </main>

      <footer className="mt-auto h-48">
        <div className="flex flex-col items-center">
          <div className={`flex items-center space-x-3 mb-4 p-3 rounded-lg transition-all duration-300 ${state.isPlayerTurn ? 'bg-green-500/20 ring-2 ring-green-400 shadow-[0_0_15px_rgba(74,222,128,0.5)]' : 'bg-black/30'}`}>
            <PlayerIcon />
            <div>
              <h2 className="text-xl font-bold">{state.players[0].name}</h2>
              <span className={`text-sm ${getPlayerStatusColor(0)}`}>{getPlayerStatus(0)}</span>
            </div>
          </div>
          <div className="relative flex justify-center items-end h-40 w-full px-4">
            <AnimatePresence>
            {state.playerHand.map((c, i) => (
              <motion.div
                key={`${c.color}-${c.type}-${c.value}-${i}`}
                layout
                initial={{ opacity: 0, y: 50, rotate: 0 }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  x: (i - state.playerHand.length / 2) * 40,
                  rotate: (i - state.playerHand.length / 2) * 5,
                  transition: { type: 'spring', stiffness: 300, damping: 20 }
                }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                whileHover={{ y: -25, scale: 1.1, zIndex: 10, rotate: 0 }}
                className={`absolute cursor-pointer`}
                onClick={() => onPlayCard(i)}
                style={{ originY: 1 }}
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
