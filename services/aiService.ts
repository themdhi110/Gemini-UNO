
import { GoogleGenAI, Type } from "@google/genai";
import type { AIMove, PublicGameState, Card } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

function isCardPlayable(card: Card, topCard: Card): boolean {
    if (card.color === 'black') return true;
    if (card.color === topCard.color) return true;
    if (card.type !== 'number' && card.type === topCard.type) return true;
    if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true;
    return false;
}

export async function requestAiMove(publicState: PublicGameState, botHand: Card[]): Promise<AIMove> {
  const topCard = publicState.topCard;
  
  const playableCardIndices = botHand
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => isCardPlayable(card, topCard))
    .map(({ index }) => index);


  const prompt = `You are a world-class UNO champion playing a strategic game. It's your turn.

**Game State:**
- **Current Top Card:** ${JSON.stringify(topCard)} (If the type is 'wild' or 'wild_draw4', its color was chosen by the previous player and is reflected in the color property).
- **Player Card Counts:** ${publicState.players.map((p, i) => `${p.name} (Player ${i}): ${p.cardCount} cards`).join(', ')}. You are ${publicState.players[publicState.currentPlayerIndex].name}.

**Your Hand:**
${botHand.map((card, index) => `- Index ${index}: ${JSON.stringify(card)}`).join('\n')}

**Your Legal Moves:**
- **Playable Card Indices:** [${playableCardIndices.join(', ')}]
- If the list of playable indices is empty, you MUST draw a card.

**Strategic Instructions:**
1.  **Objective:** Win by emptying your hand.
2.  **Color Strategy:** If you play a Wild card, choose a color that you have the most of in your remaining hand.
3.  **Action Card Strategy:** Use Skip, Reverse, and Draw cards to hinder opponents, especially those with few cards.
4.  **Priority:** Prioritize playing a card over drawing. If you have multiple options, consider which card best disrupts opponents or sets you up for future turns.

**Your Action:**
Respond with ONLY a JSON object representing your move.
- To play a card: \`{"type": "play", "cardIndex": <index>}\`
- To play a Wild card: \`{"type": "play", "cardIndex": <index>, "chosenColor": "<color>"}\` (color must be 'red', 'green', 'blue', or 'yellow')
- To draw a card: \`{"type": "draw"}\`

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
            type: {
              type: Type.STRING,
              enum: ['play', 'draw'],
            },
            cardIndex: {
              type: Type.INTEGER,
            },
            chosenColor: {
              type: Type.STRING,
              enum: ['red', 'green', 'blue', 'yellow'],
            }
          },
          required: ['type'],
        },
      },
    });

    const moveText = response.text.trim();
    const move = JSON.parse(moveText) as AIMove;

    // Validate the move from the AI
    if (move.type === 'play') {
      if (typeof move.cardIndex !== 'number' || !playableCardIndices.includes(move.cardIndex)) {
        console.warn("AI chose an invalid card index. Defaulting to a valid play or draw.");
        return playableCardIndices.length > 0 ? { type: 'play', cardIndex: playableCardIndices[0] } : { type: 'draw' };
      }
      const playedCard = botHand[move.cardIndex];
      if (playedCard.color === 'black' && !move.chosenColor) {
        console.warn("AI played a wild card but didn't choose a color. Defaulting to red.");
        move.chosenColor = 'red';
      }
    }
    
    return move;
  } catch (err) {
    console.error('AI request failed, defaulting to a safe move.', err);
    // Default to a safe move on error
    if (playableCardIndices.length > 0) {
      const cardIndex = playableCardIndices[0];
      const card = botHand[cardIndex];
      if (card.color === 'black') {
        // Simple logic for default color choice
        const colorCounts: Record<string, number> = {red: 0, green: 0, blue: 0, yellow: 0};
        botHand.forEach(c => {
          if (c.color !== 'black') colorCounts[c.color]++;
        });
        const bestColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b);
        return { type: 'play', cardIndex, chosenColor: bestColor as any };
      }
      return { type: 'play', cardIndex: playableCardIndices[0] };
    }
    return { type: 'draw' };
  }
}

export async function requestAiChatMessage(
  playerName: string,
  moveDescription: string,
  gameState: PublicGameState
): Promise<string> {
  const { topCard, players } = gameState;
  const myCardCount = players.find(p => p.name === playerName)?.cardCount ?? '?';

  const prompt = `You are an online UNO player named "${playerName}".
The game is in progress. You just ${moveDescription}.
The top card is now a ${topCard.color} ${topCard.type}${topCard.value !== undefined ? ` ${topCard.value}` : ''}.
You have ${myCardCount} cards left.
Write a very short, casual chat message (5-10 words) reacting to your move or the game state. Your personality is a bit cheeky and competitive. Don't use emojis or hashtags.

Examples of good messages:
- Ouch, that's gonna leave a mark.
- Just what I needed!
- Can't stop me now.
- Feeling the pressure yet?
- Let's see how you handle this.

Respond with ONLY the chat message text.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text.trim().replace(/^"|"$/g, '');
  } catch (error) {
    console.error("Failed to generate AI chat message:", error);
    return "";
  }
}
