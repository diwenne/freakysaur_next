// src/components/GamePage.tsx
'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useTongueSwitch } from '@/hooks/useTongueSwitch';
import DinoGame from './DinoGame';
import FlappyBird from './FlappyBird';

const GamePage = () => {
    const [activeGame, setActiveGame] = useState<'dino' | 'flappy'>('dino');
    const [dinoBestScore, setDinoBestScore] = useState(0);
    const [flappyBestScore, setFlappyBestScore] = useState(0);
    
    const webcamContainerRef = useRef<HTMLDivElement>(null);
    const { consumeRisingEdge, videoRef, overlayCanvasRef, isWebcamReady } = useTongueSwitch();
    
    const consumeRisingEdgeRef = useRef(consumeRisingEdge);
    useEffect(() => {
      consumeRisingEdgeRef.current = consumeRisingEdge;
    }, [consumeRisingEdge]);

    useEffect(() => {
      const videoElement = videoRef.current;
      const canvasElement = overlayCanvasRef.current;
      const containerElement = webcamContainerRef.current;
  
      if (isWebcamReady && videoElement && canvasElement && containerElement) {
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'fill';
        videoElement.muted = true;
        videoElement.style.transform = 'scaleX(-1)';
        canvasElement.width = 900;
        canvasElement.height = 240;
        canvasElement.style.position = 'absolute';
        canvasElement.style.top = '0';
        canvasElement.style.left = '0';
        if (!containerElement.contains(videoElement)) containerElement.appendChild(videoElement);
        if (!containerElement.contains(canvasElement)) containerElement.appendChild(canvasElement);
      }
    }, [isWebcamReady, videoRef, overlayCanvasRef]);

    const renderGame = () => {
        if (activeGame === 'dino') {
            return <DinoGame consumeRisingEdgeRef={consumeRisingEdgeRef} bestScore={dinoBestScore} setBestScore={setDinoBestScore} />;
        }
        if (activeGame === 'flappy') {
            return <FlappyBird consumeRisingEdgeRef={consumeRisingEdgeRef} bestScore={flappyBestScore} setBestScore={setFlappyBestScore} />;
        }
        return null;
    }
    
    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className="mb-4 p-4 bg-gray-800 text-white rounded-lg shadow-lg text-center w-[900px]">
                <h1 className="text-3xl font-bold font-serif italic mb-2">
                    {activeGame === 'flappy' ? '𝓕𝓻𝓮𝓪𝓴𝔂 Bird ❤️' : 'Steve the 𝓕𝓻𝓮𝓪𝓴𝔂saur ❤️'}
                </h1>
                <p className="text-lg font-mono text-cyan-300">
                    Stick out your tongue to JUMP!
                </p>
            </div>
    
            <div 
                ref={webcamContainerRef}
                className="relative mb-4 border-2 border-gray-400 w-[900px] h-[240px] bg-gray-900 flex items-center justify-center overflow-hidden"
            >
                {!isWebcamReady && <p className="text-white">Starting webcam...</p>}
            </div>
            
            {renderGame()}

            <button 
                onClick={() => setActiveGame(activeGame === 'dino' ? 'flappy' : 'dino')} 
                className="mt-4 px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors"
            >
              {activeGame === 'dino' ? 'Play Freaky Bird' : 'Play Steve the Freakysaur'}
            </button>
        </div>
    );
};

export default GamePage;