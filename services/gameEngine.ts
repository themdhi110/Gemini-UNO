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
  private shoutedUno: boolean[] = [];
  private wildColorChoicePending: boolean = false;

  constructor() {
    this.players = [{ name: 'You', isAi: false }, { name: 'Bot 1', isAi: true }, { name: 'Bot 2', isAi: true }];
  }

  onChange(cb: (state: PublicGameState) => void) { this.changeCb = cb; }

  private emit() {
    if (this.changeCb) this.changeCb(this.getPublicState());
  }

  init() {
    this.drawPile = this._makeDeck();
    this._shuffle(this.drawPile);
    this.hands = this.players.map(() => this._drawMultiple(7));
    this.discardPile = [this.drawPile.pop()!];
    // Ensure the first card is not a wild card to avoid initial color choice
    while (this.discardPile[0].color === 'black') {
        this.drawPile.push(this.discardPile.pop()!);
        this._shuffle(this.drawPile);
        this.discardPile.push(this.drawPile.pop()!);
    }
    this.currentPlayerIndex = 0;
    this.direction = 1;
    this.isGameOver = false;
    this.winner = null;
    this.shoutedUno = this.players.map(() => false);
    this.wildColorChoicePending = false;
    this.emit();
  }

  getPublicState(): PublicGameState {
    const state = {
      players: this.players.map((p, i) => ({ ...p, cardCount: this.hands[i].length })),
      playerHand: this.players[this.currentPlayerIndex].isAi ? this.hands[this.currentPlayerIndex] : this.hands[0],
      opponentHands: this.hands.slice(1).map(hand => hand.length),
      topCard: this.discardPile[this.discardPile.length - 1],
      drawCount: this.drawPile.length,
      currentPlayerIndex: this.currentPlayerIndex,
      isPlayerTurn: this.currentPlayerIndex === 0,
      currentPlayerIsAi: this.players[this.currentPlayerIndex].isAi,
      isGameOver: this.isGameOver,
      winner: this.winner,
      shoutedUno: this.shoutedUno,
      isWildColorChoicePending: this.wildColorChoicePending && this.currentPlayerIndex === 0,
    };

    if (state.currentPlayerIsAi) {
        state.playerHand = this.hands[this.currentPlayerIndex];
    } else {
        state.playerHand = this.hands[0];
    }
    
    return state;
  }

  private _makeDeck(): Card[] {
    const colors: ('red' | 'green' | 'blue' | 'yellow')[] = ['red', 'green', 'blue', 'yellow'];
    const deck: Card[] = [];
    colors.forEach(color => {
      for (let n = 0; n <= 9; n++) deck.push({ color, type: 'number', value: n });
      ['skip', 'reverse', 'draw2'].forEach(t => deck.push({ color, type: t as any }));
    });
    for (let i = 0; i < 4; i++) deck.push({ color: 'black', type: 'wild' });
    for (let i = 0; i < 4; i++) deck.push({ color: 'black', type: 'wild_draw4' });
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
    if (this.isGameOver || this.currentPlayerIndex !== 0 || this.wildColorChoicePending) return;

    const card = this.hands[this.currentPlayerIndex][cardIndex];
    if (!card || !this._isPlayable(card)) return;

    this.discardPile.push(this.hands[this.currentPlayerIndex].splice(cardIndex, 1)[0]);
    
    if (this.hands[this.currentPlayerIndex].length === 0) {
        this.isGameOver = true;
        this.winner = this.players[this.currentPlayerIndex].name;
        this.emit();
        return;
    }

    if (this.hands[this.currentPlayerIndex].length > 1) {
        this.shoutedUno[this.currentPlayerIndex] = false;
    }

    if (card.type === 'wild' || card.type === 'wild_draw4') {
        this.wildColorChoicePending = true;
        this.emit(); // Wait for player to choose a color
    } else {
        this._applyCardEffect(card);
        this._advanceTurn();
        this.emit();
    }
  }

  playerChoosesColor(color: 'red' | 'green' | 'blue' | 'yellow') {
    if (!this.wildColorChoicePending || this.currentPlayerIndex !== 0) return;

    const wildCard = this.discardPile[this.discardPile.length - 1];
    if (wildCard.type !== 'wild' && wildCard.type !== 'wild_draw4') return;

    wildCard.color = color;
    this.wildColorChoicePending = false;

    this._applyCardEffect(wildCard);
    this._advanceTurn();
    this.emit();
  }

  applyAiMove(move: AIMove) {
    if (this.isGameOver || !this.players[this.currentPlayerIndex].isAi) return;
    
    if (move.shoutUno) {
        this.shoutedUno[this.currentPlayerIndex] = true;
    }

    if (move.type === 'play' && typeof move.cardIndex === 'number') {
      const card = this.hands[this.currentPlayerIndex][move.cardIndex];
      if (!card || !this._isPlayable(card)) {
          console.warn("AI attempted invalid move. Drawing instead.");
          this.drawCard();
          return;
      }
      
      this.discardPile.push(this.hands[this.currentPlayerIndex].splice(move.cardIndex, 1)[0]);

      if (this.hands[this.currentPlayerIndex].length === 0) {
        this.isGameOver = true;
        this.winner = this.players[this.currentPlayerIndex].name;
        this.emit();
        return;
      }

      if (this.hands[this.currentPlayerIndex].length > 1) {
        this.shoutedUno[this.currentPlayerIndex] = false;
      }

      if (card.type === 'wild' || card.type === 'wild_draw4') {
        if (move.chosenColor && ['red', 'green', 'blue', 'yellow'].includes(move.chosenColor)) {
          card.color = move.chosenColor;
        } else {
          const colorCounts: { [key: string]: number } = { red: 0, green: 0, blue: 0, yellow: 0 };
          this.hands[this.currentPlayerIndex].forEach(c => {
            if (c.color !== 'black') colorCounts[c.color]++;
          });
          const bestColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b, 'red');
          card.color = bestColor as CardColor;
        }
      }

      this._applyCardEffect(card);
      this._advanceTurn();
      this.emit();
    } else {
      this.drawCard();
    }
  }

  drawCard() {
    if (this.isGameOver || this.wildColorChoicePending) return;
    if (this.drawPile.length === 0) this._reshuffleDiscard();
    if (this.drawPile.length > 0) {
        const c = this.drawPile.pop()!;
        this.hands[this.currentPlayerIndex].push(c);
    }
    this.shoutedUno[this.currentPlayerIndex] = false;
    this._advanceTurn();
    this.emit();
  }
  
  playerShoutsUno() {
    if (this.hands[0].length === 1) {
        this.shoutedUno[0] = true;
        this.emit();
    }
  }

  callOutAndPenalize(targetIndex: number) {
    if (this.hands[targetIndex].length === 1 && !this.shoutedUno[targetIndex]) {
        this.hands[targetIndex].push(...this._drawMultiple(2));
        this.shoutedUno[targetIndex] = false;
        this.emit();
    }
  }

  private _applyCardEffect(card: Card) {
      if (card.type === 'reverse') {
          this.direction *= -1;
      } else if (card.type === 'skip') {
          this._advanceTurn();
      } else if (card.type === 'draw2' || card.type === 'wild_draw4') {
          const nextPlayerIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
          const cardsToDraw = card.type === 'draw2' ? 2 : 4;
          this.hands[nextPlayerIndex].push(...this._drawMultiple(cardsToDraw));
          this.shoutedUno[nextPlayerIndex] = false;
      }
  }

  private _reshuffleDiscard() {
    const top = this.discardPile.pop();
    if (!top) return;
    
    this.discardPile.forEach(card => {
        if (card.type === 'wild' || card.type === 'wild_draw4') {
            card.color = 'black';
        }
    });

    this.drawPile = this.discardPile;
    this.discardPile = [top];
    this._shuffle(this.drawPile);
  }

  private _isPlayable(card: Card): boolean {
    const top = this.discardPile[this.discardPile.length - 1];
    return card.color === 'black' || card.color === top.color || (card.type === 'number' && top.type === 'number' && card.value === top.value);
  }

  private _advanceTurn() { this.currentPlayerIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length; }
}