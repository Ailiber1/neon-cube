import 'react';

export enum GameState {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  SOLVED = 'SOLVED',
}

export interface PlayerRecord {
  nickname: string;
  timeMs: number;
  date: string;
}

export type Vector3Tuple = [number, number, number];

export interface CubeletData {
  id: number;
  initialPos: Vector3Tuple; // Where it belongs
  currentPos: Vector3Tuple; // Logical grid position
  rotation: Vector3Tuple;
}

export interface Move {
  axis: 'x' | 'y' | 'z';
  slice: -1 | 0 | 1;
  direction: 1 | -1;
}

// Augment JSX namespace to include React Three Fiber intrinsic elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      ambientLight: any;
      spotLight: any;
      pointLight: any;
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      ambientLight: any;
      spotLight: any;
      pointLight: any;
    }
  }
}
