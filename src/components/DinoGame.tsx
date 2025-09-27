// src/components/DinoGame.tsx
'use client';

import React, { useRef, useEffect } from 'react';
import { useTongueSwitch } from '@/hooks/useTongueSwitch';

// --- Helper to load images & Game Asset Paths ---
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
  });
};
const ASSETS = {
  DINO: { RUN: ['/assets/Dino/DinoRun1.png', '/assets/Dino/DinoRun2.png'], JUMP: ['/assets/Dino/DinoJump1.png', '/assets/Dino/DinoJump2.png', '/assets/Dino/DinoJump3.png', '/assets/Dino/DinoJump4.png'], DUCK: ['/assets/Dino/DinoDuck1.png', '/assets/Dino/DinoDuck2.png'], DEAD: '/assets/Dino/DinoDead.png' },
  OBSTACLES: { CACTUS_SMALL: ['/assets/Cactus/SmallCactus1.png', '/assets/Cactus/SmallCactus2.png', '/assets/Cactus/SmallCactus3.png'], CACTUS_LARGE: ['/assets/Cactus/LargeCactus1.png', '/assets/Cactus/LargeCactus2.png', '/assets/Cactus/LargeCactus3.png'], BIRD: ['/assets/Bird/Bird1.png', '/assets/Bird/Bird2.png'] },
  OTHER: { GROUND: '/assets/Other/Track.png', CLOUD: '/assets/Other/Cloud.png', GAME_OVER: '/assets/Other/GameOver.png', RESET: '/assets/Other/Reset.png' },
};

// --- Game Constants ---
const GAME_WIDTH = 900;
const GAME_HEIGHT = 300;
const GROUND_Y = 258;
const DINO_INITIAL_X = 40;

// --- React Component ---
const DinoGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webcamContainerRef = useRef<HTMLDivElement>(null);
  // CORRECTED: Removed isCalibrating and calibrationProgress
  const { consumeRisingEdge, videoRef, overlayCanvasRef, isWebcamReady } = useTongueSwitch();
  
  const consumeRisingEdgeRef = useRef(consumeRisingEdge);
  useEffect(() => {
    consumeRisingEdgeRef.current = consumeRisingEdge;
  }, [consumeRisingEdge]);

  const gameState = useRef({
      dino: null as Dino | null, obstacles: [] as Obstacle[], clouds: [] as Cloud[], ground: null as Ground | null, speed: 420, score: 0, bestScore: 0, isGameOver: false, spawnTimer: 0, cloudTimer: 0, lastTime: 0,
  }).current;
  const gameImages = useRef<any>({}).current;

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

  const handleInput = (e: KeyboardEvent) => {
    if (!gameState.dino) return;
    if (e.type === 'keydown') {
      if (gameState.isGameOver && (e.code === 'Space' || e.code === 'ArrowUp')) resetGame();
      else if (!gameState.isGameOver) {
        if (e.code === 'Space' || e.code === 'ArrowUp') gameState.dino.startJump();
        if (e.code === 'ArrowDown') gameState.dino.setDuck(true);
      }
    } else if (e.type === 'keyup') {
      if (e.code === 'ArrowDown') gameState.dino.setDuck(false);
    }
  };

  const resetGame = () => {
    if (!gameImages.DINO) return;
    gameState.dino = new Dino(gameImages.DINO);
    gameState.obstacles = [];
    gameState.speed = 420;
    gameState.score = 0;
    gameState.isGameOver = false;
    gameState.spawnTimer = 0;
    gameState.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  };
  
  const gameLoop = (timestamp: number) => {
    if (gameState.isGameOver || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const dt = (timestamp - gameState.lastTime) / 1000;
    gameState.lastTime = timestamp;
    if (consumeRisingEdgeRef.current()) {
      gameState.dino?.startJump();
    }
    gameState.ground?.update(dt, gameState.speed);
    gameState.dino?.update(dt);
    gameState.obstacles.forEach(o => o.update(dt, gameState.speed));
    if (gameState.dino && gameState.dino.isAlive) {
        for(const obstacle of gameState.obstacles) {
            if(obstacle.isColliding(gameState.dino)) {
                gameState.isGameOver = true;
                gameState.dino.die();
                gameState.bestScore = Math.max(gameState.bestScore, Math.floor(gameState.score));
                break;
            }
        }
    }
    gameState.clouds.forEach(c => c.update(dt, gameState.speed));
    gameState.score += dt * 10;
    gameState.speed = 420 + Math.floor(gameState.score / 8);
    gameState.spawnTimer += dt;
    if (gameState.spawnTimer > 1.1) {
        gameState.spawnTimer = 0;
        spawnObstacle();
    }
    gameState.cloudTimer += dt;
    if (gameState.cloudTimer > 1.5) {
        gameState.cloudTimer = 0;
        gameState.clouds.push(new Cloud(gameImages.OTHER.CLOUD));
    }
    gameState.obstacles = gameState.obstacles.filter(o => o.x + o.width > 0);
    gameState.clouds = gameState.clouds.filter(c => c.x + c.width > 0);
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = '#F7F7F7';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    gameState.clouds.forEach(c => c.draw(ctx));
    gameState.ground?.draw(ctx);
    gameState.obstacles.forEach(o => o.draw(ctx));
    gameState.dino?.draw(ctx);
    ctx.fillStyle = '#3C3C3C';
    ctx.font = '20px Arial';
    ctx.textAlign = 'right';
    const scoreText = `Score: ${Math.floor(gameState.score).toString().padStart(5, '0')}   Best: ${gameState.bestScore.toString().padStart(5, '0')}`;
    ctx.fillText(scoreText, GAME_WIDTH - 20, 30);
    if (gameState.isGameOver) {
        ctx.drawImage(gameImages.OTHER.GAME_OVER, GAME_WIDTH / 2 - gameImages.OTHER.GAME_OVER.width / 2, GAME_HEIGHT / 2 - 50);
        ctx.drawImage(gameImages.OTHER.RESET, GAME_WIDTH / 2 - gameImages.OTHER.RESET.width / 2, GAME_HEIGHT / 2);
    } else {
        requestAnimationFrame(gameLoop);
    }
  };

  const spawnObstacle = () => {
    const isCactus = Math.random() < 0.7;
    if (isCactus) {
        const isSmall = Math.random() < 0.5;
        const group = isSmall ? gameImages.OBSTACLES.CACTUS_SMALL : gameImages.OBSTACLES.CACTUS_LARGE;
        const image = group[Math.floor(Math.random() * group.length)];
        gameState.obstacles.push(new Cactus(image));
    } else {
        gameState.obstacles.push(new Bird(gameImages.OBSTACLES.BIRD));
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleInput);
    window.addEventListener('keyup', handleInput);
    let isMounted = true;
    const loadAllAssets = async () => {
        try {
            gameImages.DINO = { RUN: await Promise.all(ASSETS.DINO.RUN.map(loadImage)), JUMP: await Promise.all(ASSETS.DINO.JUMP.map(loadImage)), DUCK: await Promise.all(ASSETS.DINO.DUCK.map(loadImage)), DEAD: await loadImage(ASSETS.DINO.DEAD) };
            gameImages.OBSTACLES = { CACTUS_SMALL: await Promise.all(ASSETS.OBSTACLES.CACTUS_SMALL.map(loadImage)), CACTUS_LARGE: await Promise.all(ASSETS.OBSTACLES.CACTUS_LARGE.map(loadImage)), BIRD: await Promise.all(ASSETS.OBSTACLES.BIRD.map(loadImage)) };
            gameImages.OTHER = { GROUND: await loadImage(ASSETS.OTHER.GROUND), CLOUD: await loadImage(ASSETS.OTHER.CLOUD), GAME_OVER: await loadImage(ASSETS.OTHER.GAME_OVER), RESET: await loadImage(ASSETS.OTHER.RESET) };
            
            if (isMounted) {
                gameState.ground = new Ground(gameImages.OTHER.GROUND);
                resetGame(); // Start the game once assets are loaded
            }
        } catch (error) {
            console.error("Failed to load game assets:", error);
        }
    };
    loadAllAssets();
    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleInput);
      window.removeEventListener('keyup', handleInput);
    };
  }, []); // This effect runs once on mount

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="mb-4 p-4 bg-gray-800 text-white rounded-lg shadow-lg text-center w-[900px]">
        <h1 className="text-3xl font-bold font-serif italic mb-2">Steve the 𝓕𝓻𝓮𝓪𝓴𝔂saur ❤️</h1>
        <p className="text-lg font-mono text-cyan-300">Stick out your tongue to JUMP!</p>
      </div>

      <div 
        ref={webcamContainerRef}
        className="relative mb-4 border-2 border-gray-400 w-[900px] h-[240px] bg-gray-900 flex items-center justify-center overflow-hidden"
      >
        {!isWebcamReady && <p className="text-white">Starting webcam...</p>}
        {/* CORRECTED: Removed the calibration UI */}
      </div>
      
      <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="border-2 border-gray-400" />
    </div>
  );
};

// --- Game Object Class Implementations (No changes) ---
const DEBUG_MODE = false; 
class Dino { x = DINO_INITIAL_X; y = GROUND_Y; velY = 0; gravity = 2500; jumpSpeed = -900; isDucking = false; isAlive = true; images: { RUN: HTMLImageElement[], JUMP: HTMLImageElement[], DUCK: HTMLImageElement[], DEAD: HTMLImageElement }; currentImage: HTMLImageElement; width = 0; height = 0; runAnimTimer = 0; runAnimIndex = 0; runAnimRate = 0.09; jumpAnimTimer = 0; jumpAnimIndex = 0; jumpAnimRate = 0.1; constructor(images: any) { this.images = images; this.currentImage = this.images.RUN[0]; this.y = GROUND_Y - this.currentImage.height; this.width = this.currentImage.width; this.height = this.currentImage.height; } getHitbox() { return { x: this.x + 20, y: this.y + 15, width: this.width - 35, height: this.height - 25 }; } startJump() { if (this.isAlive && this.y + this.height >= GROUND_Y) { this.velY = this.jumpSpeed; this.jumpAnimIndex = 0; this.jumpAnimTimer = 0; } } setDuck(value: boolean) { if (this.isAlive && this.y + this.height >= GROUND_Y) { this.isDucking = value; } } die() { this.isAlive = false; this.currentImage = this.images.DEAD; } update(dt: number) { if (!this.isAlive) return; this.velY += this.gravity * dt; this.y += this.velY * dt; const onGround = this.y + this.height >= GROUND_Y; if (onGround) { this.y = GROUND_Y - this.height; this.velY = 0; } if (!onGround) { this.jumpAnimTimer += dt; if (this.jumpAnimTimer > this.jumpAnimRate) { this.jumpAnimTimer = 0; this.jumpAnimIndex = (this.jumpAnimIndex + 1) % this.images.JUMP.length; } this.currentImage = this.images.JUMP[this.jumpAnimIndex]; } else if (this.isDucking) { this.runAnimTimer += dt; if (this.runAnimTimer > this.runAnimRate) { this.runAnimTimer = 0; this.runAnimIndex = (this.runAnimIndex + 1) % this.images.DUCK.length; } this.currentImage = this.images.DUCK[this.runAnimIndex]; } else { this.runAnimTimer += dt; if (this.runAnimTimer > this.runAnimRate) { this.runAnimTimer = 0; this.runAnimIndex = (this.runAnimIndex + 1) % this.images.RUN.length; } this.currentImage = this.images.RUN[this.runAnimIndex]; } this.width = this.currentImage.width; this.height = this.currentImage.height; if (onGround) { this.y = GROUND_Y - this.height; } } draw(ctx: CanvasRenderingContext2D) { ctx.drawImage(this.currentImage, this.x, this.y); if (DEBUG_MODE) { const box = this.getHitbox(); ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; ctx.lineWidth = 2; ctx.strokeRect(box.x, box.y, box.width, box.height); } } }
class Obstacle { x = GAME_WIDTH; y = 0; width = 0; height = 0; image: HTMLImageElement; constructor(image: HTMLImageElement) { this.image = image; this.width = image.width; this.height = image.height; } getHitbox() { return { x: this.x + 8, y: this.y + 8, width: this.width - 16, height: this.height - 16 }; } isColliding(dino: Dino): boolean { const dinoBox = dino.getHitbox(); const obsBox = this.getHitbox(); return (dinoBox.x < obsBox.x + obsBox.width && dinoBox.x + dinoBox.width > obsBox.x && dinoBox.y < obsBox.y + obsBox.height && dinoBox.y + dinoBox.height > obsBox.y); } update(dt: number, speed: number) { this.x -= speed * dt; } draw(ctx: CanvasRenderingContext2D) { ctx.drawImage(this.image, this.x, this.y); if (DEBUG_MODE) { const box = this.getHitbox(); ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; ctx.lineWidth = 2; ctx.strokeRect(box.x, box.y, box.width, box.height); } } }
class Cactus extends Obstacle { constructor(image: HTMLImageElement) { super(image); this.y = GROUND_Y - this.height; } }
class Bird extends Obstacle { images: HTMLImageElement[]; animTimer = 0; animIndex = 0; animRate = 0.09; constructor(images: HTMLImageElement[]) { super(images[0]); this.images = images; this.y = GROUND_Y - [50, 70, 95][Math.floor(Math.random() * 3)]; } update(dt: number, speed: number) { super.update(dt, speed + 30); this.animTimer += dt; if(this.animTimer > this.animRate) { this.animTimer = 0; this.animIndex = (this.animIndex + 1) % 2; this.image = this.images[this.animIndex]; } } }
class Ground { image: HTMLImageElement; x1 = 0; x2: number; y: number; constructor(image: HTMLImageElement) { this.image = image; this.x2 = image.width; this.y = GROUND_Y - 20; } update(dt: number, speed: number) { this.x1 -= speed * dt; this.x2 -= speed * dt; if(this.x1 <= -this.image.width) this.x1 = this.x2 + this.image.width; if(this.x2 <= -this.image.width) this.x2 = this.x1 + this.image.width; } draw(ctx: CanvasRenderingContext2D) { ctx.drawImage(this.image, this.x1, this.y); ctx.drawImage(this.image, this.x2, this.y); } }
class Cloud { image: HTMLImageElement; x = GAME_WIDTH + Math.random() * 250; y = Math.random() * (GROUND_Y - 180) + 20; width: number; height: number; constructor(image: HTMLImageElement) { this.image = image; this.width = image.width; this.height = image.height; } update(dt: number, speed: number) { this.x -= (speed * 0.4) * dt; } draw(ctx: CanvasRenderingContext2D) { ctx.drawImage(this.image, this.x, this.y); } }
export default DinoGame;