import { GoogleGenAI, Type } from "@google/genai";
import type { AIMove, PublicGameState, Card, CardColor } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

function isCardPlayable(card: Card, topCard: Card): boolean {
    return card.color === 'black' || card.color === topCard.color || (card.type === 'number' && topCard.type === 'number' && card.value === card.value);
}

export async function requestAiMove(publicState: PublicGameState): Promise<AIMove> {
  const botHand = publicState.playerHand;
  const topCard = publicState.topCard;
  
  const playableCardIndices = botHand
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => isCardPlayable(card, topCard))
    .map(({ index }) => index);


  const prompt = `You are an expert UNO AI player. It is your turn.
  The current top card on the discard pile is: ${JSON.stringify(topCard)}.
  
  Your hand is:
  ${botHand.map((card, index) => `Index ${index}: ${JSON.stringify(card)}`).join('\n')}
  
  These are the indices of the cards you can legally play: [${playableCardIndices.join(', ')}].
  If this list is empty, you must draw a card.
  
  Your goal is to win the game. Choose the best card to play from the legal options.
  
  IMPORTANT RULES:
  1. If playing a card will leave you with exactly one card remaining, you MUST shout "UNO". To do this, add "shoutUno": true to your JSON response.
  2. If you play a 'wild' or 'wild_draw4' card, you MUST also specify the color to change to. Choose the color you have the most of in your remaining hand to maximize your chances. Add "chosenColor": "<color>" to your JSON response. The color must be one of 'red', 'green', 'blue', 'yellow'.

  Return ONLY a JSON object with your move.
  - To play a card: {"type": "play", "cardIndex": <index>}
  - To play a card and shout UNO: {"type": "play", "cardIndex": <index>, "shoutUno": true}
  - To play a wild card: {"type": "play", "cardIndex": <index>, "chosenColor": "blue"}
  - To draw a card: {"type": "draw"}
  
  What is your move?`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['play', 'draw'] },
            cardIndex: { type: Type.INTEGER },
            shoutUno: { type: Type.BOOLEAN },
            chosenColor: { type: Type.STRING, enum: ['red', 'green', 'blue', 'yellow'] },
          },
          required: ['type'],
        },
      },
    });

    const moveText = response.text.trim();
    const move = JSON.parse(moveText) as AIMove;

    if (move.type === 'play') {
      if (typeof move.cardIndex !== 'number' || !playableCardIndices.includes(move.cardIndex)) {
        console.warn("AI chose an invalid card index. Defaulting to a valid play or draw.");
        if (playableCardIndices.length > 0) {
            return { type: 'play', cardIndex: playableCardIndices[0] };
        }
        return { type: 'draw' };
      }
      const playedCard = botHand[move.cardIndex];
      if ((playedCard.type === 'wild' || playedCard.type === 'wild_draw4') && !move.chosenColor) {
          console.warn("AI played a wild card but did not choose a color. Choosing one for it.");
          const remainingHand = botHand.filter((_, i) => i !== move.cardIndex);
          const colorCounts: { [key: string]: number } = { red: 0, green: 0, blue: 0, yellow: 0 };
          remainingHand.forEach(c => {
              if (c.color !== 'black') colorCounts[c.color]++;
          });
          const bestColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b, 'red');
          // FIX: Corrected the type assertion. `CardColor` includes 'black', which is not a valid `chosenColor`.
          move.chosenColor = bestColor as 'red' | 'green' | 'blue' | 'yellow';
      }
    }
    
    if (move.shoutUno && botHand.length !== 2) {
        console.warn("AI attempted to shout UNO at the wrong time.");
        delete move.shoutUno;
    }

    return move;
  } catch (err) {
    console.error('AI request failed, defaulting to a safe move.', err);
    if (playableCardIndices.length > 0) {
        return { type: 'play', cardIndex: playableCardIndices[0] };
    }
    return { type: 'draw' };
  }
}