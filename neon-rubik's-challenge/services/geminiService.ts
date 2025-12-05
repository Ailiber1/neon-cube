import { GoogleGenAI } from "@google/genai";

const getGeminiClient = () => {
    // In a real app, verify key exists.
    if (!process.env.API_KEY) {
        console.warn("No API_KEY found in environment.");
        return null;
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateVictoryMessage = async (nickname: string, timeMs: number, rank: number) => {
    const ai = getGeminiClient();
    if (!ai) return "Congratulations on solving the cube! (AI features unavailable without API Key)";

    const seconds = (timeMs / 1000).toFixed(2);
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `The user "${nickname}" just solved a Rubik's cube in ${seconds} seconds. They are currently ranked #${rank} on the local leaderboard.
            
            Write a short, witty, and "cyberpunk/futuristic" style congratulatory message (max 2 sentences). 
            If they were fast (< 60s), praise their speed glitches. 
            If they were slow, praise their persistence and mental processing power.
            Sound like a system AI.`,
        });
        
        return response.text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return `System Alert: Puzzle Solved. Time: ${seconds}s. Rank: #${rank}. Excellent processing, ${nickname}.`;
    }
};
