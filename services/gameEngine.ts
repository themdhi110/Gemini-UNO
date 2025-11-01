
import type { Card, Player, PublicGameState, AIMove, CardColor } from '../types';

export class GameEngine {
  private players: Player[] = [];
  private hands: Card[][] = [];
  private drawPile: Card[] = [];
  private discardPile: Card[] = [];
  private currentPlayerIndex: number = 0;
  private direction: number = 1;
  private changeCb: ((state: PublicGameState) => void) | null = null;
  private isGameOver: boolean = false;
  private winner: string | null = null;
  private isAwaitingColorChoice: boolean = false;
  private chosenColor: CardColor | null = null;

  constructor() { }

  onChange(cb: (state: PublicGameState) => void) { this.changeCb = cb; }

  private emit() {
    if (this.changeCb) this.changeCb(this.getPublicState());
  }

  init(playerNames: string[] = ['You', 'Bot 1', 'Bot 2']) {
    this.players = playerNames.map((name, i) => ({ name, isAi: i !== 0 }));
    this.drawPile = this._makeDeck();
    this._shuffle(this.drawPile);
    this.hands = this.players.map(() => this._drawMultiple(7));
    
    let topCard = this.drawPile.pop()!;
    // Starting card cannot be a wild card
    while(topCard.color === 'black') {
      this.drawPile.push(topCard);
      this._shuffle(this.drawPile);
      topCard = this.drawPile.pop()!;
    }
    this.discardPile = [topCard];

    this.currentPlayerIndex = 0;
    this.direction = 1;
    this.isGameOver = false;
    this.winner = null;
    this.isAwaitingColorChoice = false;
    this.chosenColor = null;

    this.emit();
  }

  getPublicState(): PublicGameState {
    const realTopCard = this.discardPile[this.discardPile.length - 1];
    let topCardForState = realTopCard;
    if (realTopCard.color === 'black' && this.chosenColor) {
        topCardForState = { ...realTopCard, color: this.chosenColor };
    }

    return {
      players: this.players.map((p, i) => ({ ...p, cardCount: this.hands[i].length })),
      playerHand: this.hands[0],
      opponentHands: this.hands.slice(1).map(hand => hand.length),
      topCard: topCardForState,
      drawCount: this.drawPile.length,
      currentPlayerIndex: this.currentPlayerIndex,
      isPlayerTurn: this.currentPlayerIndex === 0,
      currentPlayerIsAi: this.players[this.currentPlayerIndex].isAi,
      isGameOver: this.isGameOver,
      winner: this.winner,
      isAwaitingColorChoice: this.isAwaitingColorChoice,
    };
  }
  
  getHandForPlayer(playerIndex: number): Card[] {
    return this.hands[playerIndex];
  }

  private _makeDeck(): Card[] {
    const colors: ('red' | 'green' | 'blue' | 'yellow')[] = ['red', 'green', 'blue', 'yellow'];
    const deck: Card[] = [];
    colors.forEach(color => {
      // One 0 card
      deck.push({ color, type: 'number', value: 0 });
      // Two of each number 1-9
      for (let n = 1; n <= 9; n++) {
        deck.push({ color, type: 'number', value: n });
        deck.push({ color, type: 'number', value: n });
      }
      // Two of each action card
      ['skip', 'reverse', 'draw2'].forEach(t => {
        deck.push({ color, type: t as any });
        deck.push({ color, type: t as any });
      });
    });
    // Four of each wild card
    for (let i = 0; i < 4; i++) {
      deck.push({ color: 'black', type: 'wild' });
      deck.push({ color: 'black', type: 'wild_draw4' });
    }
    return deck;
  }

  private _shuffle(a: Card[]) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }}

  private _drawMultiple(n: number): Card[] {
    const out: Card[] = [];
    for (let i = 0; i < n; i++) {
        if(this.drawPile.length === 0) this._reshuffleDiscard();
        if(this.drawPile.length > 0) out.push(this.drawPile.pop()!);
    }
    return out;
  }

  playCard(cardIndex: number) {
    if (this.isGameOver || this.isAwaitingColorChoice) return;
    const card = this.hands[this.currentPlayerIndex][cardIndex];
    if (!card || !this._isPlayable(card)) return;

    this.discardPile.push(card);
    this.hands[this.currentPlayerIndex].splice(cardIndex, 1);
    this.chosenColor = null;
    
    if(this.hands[this.currentPlayerIndex].length === 0) {
        this.isGameOver = true;
        this.winner = this.players[this.currentPlayerIndex].name;
        this.emit();
        return;
    }

    if (card.color === 'black') {
        this.isAwaitingColorChoice = true;
    } else {
        this._applyCardEffect(card);
        this._advanceTurn(card);
    }
    this.emit();
  }
  
  playerChoseColor(color: CardColor) {
    if (!this.isAwaitingColorChoice || this.players[this.currentPlayerIndex].isAi) return;
    this.chosenColor = color;
    this.isAwaitingColorChoice = false;

    const card = this.discardPile[this.discardPile.length - 1];
    this._applyCardEffect(card);
    this._advanceTurn(card);
    this.emit();
  }

  applyAiMove(move: AIMove) {
    if (this.isGameOver || !this.players[this.currentPlayerIndex].isAi) return;
    if (move.type === 'draw') {
        this.drawCard();
        return;
    }

    if (typeof move.cardIndex !== 'number') return;
    
    const card = this.hands[this.currentPlayerIndex][move.cardIndex];
    if(!card || !this._isPlayable(card)) {
        console.warn("AI made an invalid move. Drawing instead.");
        this.drawCard();
        return;
    }
    
    this.discardPile.push(card);
    this.hands[this.currentPlayerIndex].splice(move.cardIndex, 1);
    this.chosenColor = null;

    if (this.hands[this.currentPlayerIndex].length === 0) {
        this.isGameOver = true;
        this.winner = this.players[this.currentPlayerIndex].name;
        this.emit();
        return;
    }

    if (card.color === 'black') {
        this.chosenColor = move.chosenColor || ['red', 'green', 'blue', 'yellow'][Math.floor(Math.random() * 4)] as CardColor;
    }

    this._applyCardEffect(card);
    this._advanceTurn(card);
    this.emit();
  }

  drawCard() {
    if (this.isGameOver || this.isAwaitingColorChoice) return;
    if (this.drawPile.length === 0) this._reshuffleDiscard();
    if(this.drawPile.length > 0) {
        const c = this.drawPile.pop()!;
        this.hands[this.currentPlayerIndex].push(c);
    }
    this._advanceTurn(); // Passing no card means default advancement
    this.emit();
  }
  
  private _applyCardEffect(card: Card) {
      const nextPlayerIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
      if (card.type === 'draw2') {
          this.hands[nextPlayerIndex].push(...this._drawMultiple(2));
      } else if (card.type === 'wild_draw4') {
          this.hands[nextPlayerIndex].push(...this._drawMultiple(4));
      } else if (card.type === 'reverse') {
          this.direction *= -1;
      }
  }

  private _reshuffleDiscard() {
    const top = this.discardPile.pop();
    if (!top) return;
    this.drawPile = this.discardPile;
    this.discardPile = [top];
    this._shuffle(this.drawPile);
  }

  private _isPlayable(card: Card): boolean {
    const top = this.discardPile[this.discardPile.length - 1];
    const effectiveTopColor = this.chosenColor || top.color;
    
    if (card.color === 'black') return true;
    if (card.color === effectiveTopColor) return true;
    if (card.type !== 'number' && card.type === top.type) return true;
    if (card.type === 'number' && top.type === 'number' && card.value === top.value) return true;
    
    return false;
  }

  private _advanceTurn(playedCard?: Card) {
    let increment = 1;
    if(playedCard) {
        if (playedCard.type === 'skip' || playedCard.type === 'draw2' || playedCard.type === 'wild_draw4') {
            increment = 2; // The player who draws or is skipped effectively loses their turn.
        }
    }

    // This loop handles reverse direction correctly.
    for (let i = 0; i < increment; i++) {
        this.currentPlayerIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
    }
  }
}
