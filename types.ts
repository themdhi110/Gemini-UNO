
export type CardColor = 'red' | 'green' | 'blue' | 'yellow' | 'black';
export type CardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild_draw4';

export interface Card {
  color: CardColor;
  type: CardType;
  value?: number;
}

export interface Player {
  name: string;
  isAi: boolean;
}

export interface PublicPlayerState extends Player {
    cardCount: number;
}

export interface PublicGameState {
  players: PublicPlayerState[];
  playerHand: Card[];
  opponentHands: number[];
  topCard: Card;
  drawCount: number;
  currentPlayerIndex: number;
  isPlayerTurn: boolean;
  currentPlayerIsAi: boolean;
  isGameOver: boolean;
  winner: string | null;
  isAwaitingColorChoice: boolean;
}

export interface AIMove {
  type: 'play' | 'draw';
  cardIndex?: number;
  chosenColor?: CardColor;
}

export interface ChatMessage {
  sender: string;
  text: string;
}
