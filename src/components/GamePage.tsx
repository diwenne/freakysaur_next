// src/components/GamePage.tsx
'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useTongueSwitch } from '@/hooks/useTongueSwitch';
import useTongueSwitch2P from '@/hooks/useTongueSwitch2P';
import DinoGame from './DinoGame';
import DinoGame2P from './DinoGame2P';
import FlappyBird from './FlappyBird';

type Game = 'dino' | 'dino2p' | 'flappy';

// Props interface with corrected types to resolve compiler errors
interface OnePlayerGamesProps {
    activeGame: 'dino' | 'flappy';
    dinoBestScore: number;
    setDinoBestScore: React.Dispatch<React.SetStateAction<number>>;
    flappyBestScore: number;
    setFlappyBestScore: React.Dispatch<React.SetStateAction<number>>;
}

// Manages the 1-Player games and their shared webcam hook.
const OnePlayerGames: React.FC<OnePlayerGamesProps> = ({ activeGame, dinoBestScore, setDinoBestScore, flappyBestScore, setFlappyBestScore }) => {
    const webcamContainerRef = useRef<HTMLDivElement>(null);
    const { consumeRisingEdge, videoRef, overlayCanvasRef, isWebcamReady, tongueOut } = useTongueSwitch();
    
    const consumeRisingEdgeRef = useRef(consumeRisingEdge);
    useEffect(() => {
        consumeRisingEdgeRef.current = consumeRisingEdge;
    }, [consumeRisingEdge]);

    useEffect(() => {
        const container = webcamContainerRef.current;
        if (isWebcamReady && videoRef.current && overlayCanvasRef.current && container) {
            const videoElement = videoRef.current;
            const canvasElement = overlayCanvasRef.current;
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

            if (!container.contains(videoElement)) container.appendChild(videoElement);
            if (!container.contains(canvasElement)) container.appendChild(canvasElement);
        }
    }, [isWebcamReady, videoRef, overlayCanvasRef]);

    return (
        <>
            <div ref={webcamContainerRef} className="relative mb-4 border-2 border-gray-400 w-[900px] h-[240px] bg-gray-900 flex items-center justify-center overflow-hidden rounded-md">
                {!isWebcamReady && <p className="text-white animate-pulse">Starting webcam...</p>}
            </div>
            {!isWebcamReady ? (
                 <div className="w-[900px] h-[560px] bg-gray-200 flex items-center justify-center border-2 border-gray-400 rounded-md">
                    <p className="text-gray-600 text-xl animate-pulse">Loading Game and Webcam...</p>
                </div>
            ) : (
                activeGame === 'dino' ? 
                <DinoGame consumeRisingEdgeRef={consumeRisingEdgeRef} bestScore={dinoBestScore} setBestScore={setDinoBestScore} tongueOut={tongueOut} /> :
                <FlappyBird consumeRisingEdgeRef={consumeRisingEdgeRef} bestScore={flappyBestScore} setBestScore={setFlappyBestScore} />
            )}
        </>
    );
};

// Manages the 2-Player game and its dedicated webcam hook.
const TwoPlayerGame = () => {
    const webcamContainerRef = useRef<HTMLDivElement>(null);
    const { consumeRisingEdge, videoRef, overlayCanvasRef, isWebcamReady, tongueOutStates } = useTongueSwitch2P();
    const consumeRisingEdgeRef = useRef(consumeRisingEdge);
    useEffect(() => {
        consumeRisingEdgeRef.current = consumeRisingEdge;
    }, [consumeRisingEdge]);
    
    useEffect(() => {
        const container = webcamContainerRef.current;
        if (isWebcamReady && videoRef.current && overlayCanvasRef.current && container) {
            const videoElement = videoRef.current;
            const canvasElement = overlayCanvasRef.current;
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

            if (!container.contains(videoElement)) container.appendChild(videoElement);
            if (!container.contains(canvasElement)) container.appendChild(canvasElement);
        }
    }, [isWebcamReady, videoRef, overlayCanvasRef]);

    return (
         <>
            <div ref={webcamContainerRef} className="relative mb-4 border-2 border-gray-400 w-[900px] h-[240px] bg-gray-900 flex items-center justify-center overflow-hidden rounded-md">
                {!isWebcamReady && <p className="text-white animate-pulse">Starting webcam...</p>}
            </div>
            {!isWebcamReady ? (
                 <div className="w-[900px] h-[560px] bg-gray-200 flex items-center justify-center border-2 border-gray-400 rounded-md">
                    <p className="text-gray-600 text-xl animate-pulse">Loading Game and Webcam...</p>
                </div>
            ) : (
                <DinoGame2P consumeRisingEdgeRef={consumeRisingEdgeRef} tongueOutStates={tongueOutStates} isCalibrating={!isWebcamReady} />
            )}
        </>
    );
};


const GamePage = () => {
    const [activeGame, setActiveGame] = useState<Game>('dino');
    const [dinoBestScore, setDinoBestScore] = useState(0);
    const [flappyBestScore, setFlappyBestScore] = useState(0);

    const getGameTitle = () => {
        switch(activeGame) {
            case 'dino': return 'Steve the 𝓕𝓻𝓮𝓪𝓴𝔂saur ❤️';
            case 'dino2p': return 'Steve the 𝓕𝓻𝓮𝓪𝓴𝔂saur ❤️ (2P)';
            case 'flappy': return '𝓕𝓻𝓮𝓪𝓴𝔂 Bird ❤️';
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="mb-4 p-4 bg-gray-800 text-white rounded-lg shadow-lg text-center w-[900px]">
                <h1 className="text-3xl font-bold font-serif italic mb-2">
                    {getGameTitle()}
                </h1>
                <p className="text-lg font-mono text-cyan-300">
                   {activeGame === 'dino2p' ? 'P1 (Left): Tongue/Space/Up | P2 (Right): Tongue/W' : 'Stick out your tongue to JUMP!'}
                </p>
            </div>
    
            {activeGame === 'dino2p' ? (
                <TwoPlayerGame />
            ) : (
                <OnePlayerGames 
                    activeGame={activeGame} 
                    dinoBestScore={dinoBestScore} 
                    setDinoBestScore={setDinoBestScore} 
                    flappyBestScore={flappyBestScore} 
                    setFlappyBestScore={setFlappyBestScore} 
                />
            )}

            <div className="grid grid-cols-3 gap-4 mt-4 w-[900px]">
                <button 
                    onClick={() => setActiveGame('dino')}
                    disabled={activeGame === 'dino'}
                    className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  Steve 1P
                </button>
                 <button 
                    onClick={() => setActiveGame('dino2p')}
                    disabled={activeGame === 'dino2p'}
                    className="px-6 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors disabled:bg-orange-300 disabled:cursor-not-allowed"
                >
                  Steve 2P
                </button>
                <button 
                    onClick={() => setActiveGame('flappy')}
                    disabled={activeGame === 'flappy'}
                    className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-400 disabled:cursor-not-allowed"
                >
                  Play Freaky Bird
                </button>
            </div>
        </div>
    );
};

export default GamePage;

