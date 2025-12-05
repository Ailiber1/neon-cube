import { Vector3Tuple, CubeletData } from "./types";

export const CUBE_COLORS = {
  U: '#ffffff', // Up (White)
  D: '#ffd500', // Down (Yellow)
  F: '#00d936', // Front (Green) - Neon
  B: '#0051ff', // Back (Blue) - Neon
  L: '#ff5900', // Left (Orange)
  R: '#ff0055', // Right (Red) - Neon
  CORE: '#1a1a1a' // Inner plastic
};

export const MOCK_RANKINGS = [
  { nickname: "SpeedDemon", timeMs: 45000, date: new Date().toISOString() },
  { nickname: "CubeMaster", timeMs: 120000, date: new Date().toISOString() },
  { nickname: "RookieOne", timeMs: 300000, date: new Date().toISOString() },
];

/**
 * Audio Manager
 * Handles generative BGM and Sound Effects using Web Audio API.
 * Style: Cyberpunk / Neon Synthwave
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmNodes: AudioNode[] = [];
  
  // BGM State
  public isPlayingBGM: boolean = false;
  private schedulerTimer: number | null = null;
  private nextNoteTime: number = 0;
  private sequenceStep: number = 0;
  private tempo: number = 110;
  private lookahead: number = 25.0; // ms
  private scheduleAheadTime: number = 0.1; // s

  // Effects
  private delayNode: DelayNode | null = null;

  // Scale: D Minor Pentatonic (Frequency Hz)
  private scale = [146.83, 174.61, 196.00, 220.00, 261.63, 293.66]; // D3, F3, G3, A3, C4, D4

  constructor() {}

  private init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; // Master Volume
      this.masterGain.connect(this.ctx.destination);

      // Global Delay Effect for that "Space" feel
      this.delayNode = this.ctx.createDelay();
      this.delayNode.delayTime.value = 0.375; // Sync with tempo roughly
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.3;
      
      this.delayNode.connect(feedback);
      feedback.connect(this.delayNode);
      this.delayNode.connect(this.masterGain);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  startBGM() {
    this.init();
    if (this.isPlayingBGM) return;
    this.isPlayingBGM = true;
    
    // Start the generative loop
    this.playDrone();
    this.nextNoteTime = this.ctx!.currentTime;
    this.scheduler();
  }

  stopBGM() {
    this.isPlayingBGM = false;
    if (this.schedulerTimer) clearTimeout(this.schedulerTimer);
    
    // Stop all tracking nodes
    this.bgmNodes.forEach(n => {
        try { 
            (n as any).stop && (n as any).stop(); 
            n.disconnect();
        } catch(e){}
    });
    this.bgmNodes = [];
  }

  toggleBGM() {
      if (this.isPlayingBGM) this.stopBGM();
      else this.startBGM();
      return this.isPlayingBGM;
  }

  // --- Sound Generators ---

  // 1. Background Drone (Deep Sawtooth)
  private playDrone() {
      if (!this.ctx || !this.masterGain) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.value = 36.71; // D1 (Deep Bass)
      
      // Filter sweep LFO
      filter.type = 'lowpass';
      filter.frequency.value = 100;
      
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.1; // Slow breathing
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 50; 
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      gain.gain.value = 0.3;
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      
      this.bgmNodes.push(osc, gain, filter, lfo, lfoGain);
  }

  // 2. Sequencer Loop
  private scheduler() {
      if (!this.isPlayingBGM || !this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
          this.scheduleNote(this.sequenceStep, this.nextNoteTime);
          this.nextSequence();
      }
      this.schedulerTimer = window.setTimeout(() => this.scheduler(), this.lookahead);
  }

  private nextSequence() {
      const secondsPerBeat = 60.0 / this.tempo;
      this.nextNoteTime += 0.25 * secondsPerBeat; // 16th notes
      this.sequenceStep = (this.sequenceStep + 1) % 16;
  }

  private scheduleNote(step: number, time: number) {
      if (!this.ctx || !this.masterGain) return;

      // Bass Kick/Pulse on beats
      if (step % 4 === 0) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(73.42, time); // D2
          osc.frequency.exponentialRampToValueAtTime(36.71, time + 0.1);
          
          gain.gain.setValueAtTime(0.4, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
          
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(time);
          osc.stop(time + 0.2);
      }

      // Random Arp Melody (High Tech Blips)
      // Play sparsely
      if (Math.random() > 0.6) {
           const osc = this.ctx.createOscillator();
           const gain = this.ctx.createGain();
           osc.type = 'sine';
           
           // Pick random note from scale, potentially shift octave
           let note = this.scale[Math.floor(Math.random() * this.scale.length)];
           if (Math.random() > 0.7) note *= 2; // Octave up

           osc.frequency.value = note;
           
           gain.gain.setValueAtTime(0.1, time);
           gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

           osc.connect(gain);
           gain.connect(this.masterGain);
           // Also send to delay for space
           if (this.delayNode) gain.connect(this.delayNode);

           osc.start(time);
           osc.stop(time + 0.5);
      }
  }

  // --- SFX ---

  playClick() {
      this.init();
      if (!this.ctx || !this.masterGain) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Mechanical click sound
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
  }

  playWin() {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    // Victory Arpeggio
    const notes = [440, 554, 659, 880, 1108, 1318]; // A Major
    notes.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        
        const startTime = this.ctx!.currentTime + i * 0.1;
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);
        
        osc.connect(gain);
        gain.connect(this.masterGain!);
        // Add some reverb/delay to win sound too
        if (this.delayNode) gain.connect(this.delayNode);

        osc.start(startTime);
        osc.stop(startTime + 1.0);
    });
  }
}

export const audioManager = new AudioManager();

// Wrapper functions for backward compatibility with existing code
export const playClickSound = () => audioManager.playClick();
export const playWinSound = () => audioManager.playWin();

export const isSolved = (cubelets: CubeletData[]) => {
    return cubelets.every(c => {
        const rx = Math.round(c.rotation[0] / (Math.PI / 2)) % 4;
        const ry = Math.round(c.rotation[1] / (Math.PI / 2)) % 4;
        const rz = Math.round(c.rotation[2] / (Math.PI / 2)) % 4;
        const isRotZero = rx === 0 && ry === 0 && rz === 0;
        
        const matchesPos = 
            Math.round(c.currentPos[0]) === Math.round(c.initialPos[0]) &&
            Math.round(c.currentPos[1]) === Math.round(c.initialPos[1]) &&
            Math.round(c.currentPos[2]) === Math.round(c.initialPos[2]);

        return isRotZero && matchesPos;
    });
};