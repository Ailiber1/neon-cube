import { PlayerRecord } from '../types';
import { MOCK_RANKINGS } from '../constants';

const STORAGE_KEY = 'rubiks_rankings_v1';

export const getRankings = (): PlayerRecord[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    // Seed with mock data if empty
    localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_RANKINGS));
    return MOCK_RANKINGS;
  }
  return JSON.parse(stored);
};

export const saveScore = (nickname: string, timeMs: number) => {
  const rankings = getRankings();
  const newRecord: PlayerRecord = {
    nickname,
    timeMs,
    date: new Date().toISOString(),
  };
  rankings.push(newRecord);
  rankings.sort((a, b) => a.timeMs - b.timeMs);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rankings));
  return rankings;
};

export const checkNicknameAvailability = (nickname: string): boolean => {
  const rankings = getRankings();
  // Case insensitive check
  return !rankings.some(r => r.nickname.toLowerCase() === nickname.toLowerCase());
};

export const getPlayerRank = (timeMs: number): number => {
  const rankings = getRankings();
  // Assuming rankings are sorted
  // Rank is index + 1 where this time would fit. 
  // If exact tie, they get the same rank, but let's just count how many are faster.
  return rankings.filter(r => r.timeMs < timeMs).length + 1;
};
