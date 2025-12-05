import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Environment } from '@react-three/drei';
import { Cube3D } from './components/Cube3D';
import { GameState } from './types';
import { checkNicknameAvailability, saveScore, getPlayerRank } from './services/rankingService';
import { generateVictoryMessage } from './services/geminiService';
import { playWinSound, audioManager } from './constants';

export default function App() {
  // Game State
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isScrambling, setIsScrambling] = useState(false);
  const [finalRank, setFinalRank] = useState<number | null>(null);
  const [aiMessage, setAiMessage] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Timer
  useEffect(() => {
    let interval: any;
    if (gameState === GameState.PLAYING) {
      interval = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [gameState, startTime]);

  // Handlers
  const handleStart = () => {
    if (!nickname.trim()) {
      setNicknameError('Please enter a nickname');
      return;
    }
    if (!checkNicknameAvailability(nickname.trim())) {
      setNicknameError('Nickname already taken. Choose another.');
      return;
    }
    setNicknameError('');
    
    // Start BGM on user interaction
    if (!isMuted) {
      audioManager.startBGM();
    }

    startSequence();
  };

  const startSequence = () => {
    setIsScrambling(true);
    // Hide UI by setting IDLE (combined with isScrambling check in render)
    setGameState(GameState.IDLE); 
    setElapsed(0);

    // Scramble for 2 seconds then start
    setTimeout(() => {
        setIsScrambling(false);
        setGameState(GameState.PLAYING);
        setStartTime(Date.now());
        setElapsed(0);
    }, 2000);
  };

  const handleSolve = async () => {
    if (gameState !== GameState.PLAYING) return;
    const finalTime = Date.now() - startTime;
    setElapsed(finalTime);
    setGameState(GameState.SOLVED);
    playWinSound();

    // Save Score
    saveScore(nickname, finalTime);
    const rank = getPlayerRank(finalTime);
    setFinalRank(rank);

    // Get AI Message
    setLoadingAi(true);
    const msg = await generateVictoryMessage(nickname, finalTime, rank);
    setAiMessage(msg);
    setLoadingAi(false);
  };

  const handleReset = () => {
      setGameState(GameState.IDLE);
      setElapsed(0);
      setFinalRank(null);
      setAiMessage('');
      audioManager.stopBGM();
  };

  const handleRetry = () => {
      // Re-trigger start sequence without checking nickname again
      startSequence();
  };

  const toggleMute = () => {
    const playing = audioManager.toggleBGM();
    setIsMuted(!playing);
  };

  // Format time
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const remS = s % 60;
    const dec = Math.floor((ms % 1000) / 100);
    return `${m}:${remS.toString().padStart(2, '0')}.${dec}`;
  };

  return (
    <div className="relative w-full h-screen bg-navy-900 text-white font-sans overflow-hidden">
      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [5, 5, 5], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} castShadow intensity={1.5} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#00f3ff" />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <Environment preset="city" />
          
          <Suspense fallback={null}>
            <Cube3D 
                gameState={gameState} 
                onSolve={handleSolve} 
                scramble={isScrambling}
            />
          </Suspense>
          
          <OrbitControls makeDefault enablePan={false} minDistance={3} maxDistance={15} />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Header */}
        <header className="flex justify-between items-center pointer-events-auto">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-pink drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]">
                  NEON CUBE
              </h1>
              <button 
                onClick={toggleMute}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-neon-blue"
                title={isMuted ? "Play Music" : "Mute Music"}
              >
                {isMuted ? (
                   // Muted Icon
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                   </svg>
                ) : (
                   // Speaker Icon
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                   </svg>
                )}
              </button>
            </div>
            <div className="text-xl font-mono text-neon-green">
                {formatTime(elapsed)}
            </div>
        </header>

        {/* Center UI based on State */}
        <div className="pointer-events-auto flex flex-col items-center justify-center space-y-4">
            
            {gameState === GameState.IDLE && !isScrambling && (
                <div className="bg-navy-800/90 backdrop-blur-md p-8 rounded-2xl border border-neon-blue/30 shadow-[0_0_30px_rgba(0,243,255,0.1)] max-w-sm w-full text-center">
                    <h2 className="text-xl mb-6 font-light">Enter Protocol</h2>
                    <input 
                        type="text" 
                        placeholder="CODENAME (Nickname)" 
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="w-full bg-navy-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-pink focus:shadow-[0_0_10px_rgba(255,0,255,0.3)] transition-all mb-2"
                        maxLength={12}
                    />
                    {nicknameError && <p className="text-red-400 text-xs mb-4">{nicknameError}</p>}
                    
                    <button 
                        onClick={handleStart}
                        className="w-full bg-gradient-to-r from-neon-blue to-blue-600 hover:from-neon-pink hover:to-purple-600 text-white font-bold py-3 rounded-lg shadow-[0_0_15px_rgba(0,243,255,0.4)] hover:shadow-[0_0_25px_rgba(255,0,255,0.6)] transition-all transform hover:scale-105"
                    >
                        INITIATE SEQUENCE
                    </button>
                    
                    <p className="mt-4 text-xs text-gray-500">
                        Instructions: Click & Drag faces to rotate. Drag background to rotate view.
                    </p>
                </div>
            )}

            {isScrambling && (
                <div className="text-neon-pink font-mono text-2xl animate-pulse">
                    SCRAMBLING SYSTEM...
                </div>
            )}

            {gameState === GameState.SOLVED && (
                <div className="bg-navy-800/90 backdrop-blur-md p-8 rounded-2xl border border-neon-green/30 shadow-[0_0_50px_rgba(0,255,157,0.2)] max-w-md w-full text-center animate-in fade-in zoom-in duration-300">
                    <h2 className="text-3xl font-bold text-white mb-2">SYSTEM CLEARED</h2>
                    <div className="text-4xl font-mono text-neon-green mb-4">{formatTime(elapsed)}</div>
                    
                    <div className="bg-navy-900/50 p-4 rounded-lg mb-4">
                        <p className="text-gray-400 text-sm uppercase tracking-widest">Global Ranking</p>
                        <p className="text-2xl text-white">#{finalRank}</p>
                    </div>

                    <div className="min-h-[80px] flex items-center justify-center mb-6">
                        {loadingAi ? (
                            <span className="animate-pulse text-neon-blue text-sm">Analyzing performance data...</span>
                        ) : (
                            <p className="text-sm italic text-gray-300">"{aiMessage}"</p>
                        )}
                    </div>

                    <button 
                        onClick={handleReset}
                        className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-full text-white font-medium transition-colors"
                    >
                        Reboot System
                    </button>
                </div>
            )}

        </div>

        {/* Footer */}
        <footer className="relative h-10 w-full">
           <div className="text-center text-gray-600 text-xs pointer-events-auto absolute bottom-0 w-full pb-2">
              Neon Rubik's v1.0 • Powered by React Three Fiber
           </div>
           
           {/* In-Game Controls */}
           {gameState === GameState.PLAYING && (
               <div className="absolute bottom-4 right-4 flex gap-3 pointer-events-auto">
                   <button 
                       onClick={handleReset}
                       className="group flex items-center gap-2 bg-navy-800/80 backdrop-blur border border-gray-600 hover:border-neon-blue rounded-lg px-4 py-2 transition-all duration-300 hover:shadow-[0_0_10px_rgba(0,243,255,0.3)]"
                       title="Return Home"
                   >
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-300 group-hover:text-neon-blue transition-colors">
                         <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                       </svg>
                       <span className="text-sm font-medium text-gray-300 group-hover:text-neon-blue transition-colors">HOME</span>
                   </button>
                   <button 
                       onClick={handleRetry}
                       className="group flex items-center gap-2 bg-navy-800/80 backdrop-blur border border-gray-600 hover:border-neon-pink rounded-lg px-4 py-2 transition-all duration-300 hover:shadow-[0_0_10px_rgba(255,0,255,0.3)]"
                       title="Reset / Retry"
                   >
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-300 group-hover:text-neon-pink transition-colors">
                         <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                       </svg>
                       <span className="text-sm font-medium text-gray-300 group-hover:text-neon-pink transition-colors">RESET</span>
                   </button>
               </div>
           )}
        </footer>
      </div>
    </div>
  );
}