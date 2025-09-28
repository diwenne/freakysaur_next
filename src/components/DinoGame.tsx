// src/components/DinoGame.tsx
'use client';

import React, { useRef, useEffect, useCallback } from 'react';

// --- Type Definitions, Asset Paths, Helper, Constants... ---
interface DinoImages { RUN: HTMLImageElement[]; JUMP: HTMLImageElement[]; DUCK: HTMLImageElement[]; DEAD: HTMLImageElement; }
interface GameImages {
    DINO: DinoImages;
    OBSTACLES: { CACTUS_SMALL: HTMLImageElement[]; CACTUS_LARGE: HTMLImageElement[]; BIRD: HTMLImageElement[]; };
    OTHER: { GROUND: HTMLImageElement; CLOUD: HTMLImageElement; GAME_OVER: HTMLImageElement; RESET: HTMLImageElement; };
}
const ASSETS = {
  DINO: { RUN: ['/assets/Dino/DinoRun1.png', '/assets/Dino/DinoRun2.png'], JUMP: ['/assets/Dino/DinoJump1.png', '/assets/Dino/DinoJump2.png', '/assets/Dino/DinoJump3.png', '/assets/Dino/DinoJump4.png'], DUCK: ['/assets/Dino/DinoDuck1.png', '/assets/Dino/DinoDuck2.png'], DEAD: '/assets/Dino/DinoDead.png' },
  OBSTACLES: { CACTUS_SMALL: ['/assets/Cactus/SmallCactus1.png', '/assets/Cactus/SmallCactus2.png', '/assets/Cactus/SmallCactus3.png'], CACTUS_LARGE: ['/assets/Cactus/LargeCactus1.png', '/assets/Cactus/LargeCactus2.png', '/assets/Cactus/LargeCactus3.png'], BIRD: ['/assets/Bird/Bird1.png', '/assets/Bird/Bird2.png'] },
  OTHER: { GROUND: '/assets/Other/Track.png', CLOUD: '/assets/Other/Cloud.png', GAME_OVER: '/assets/Other/GameOver.png', RESET: '/assets/Other/Reset.png' },
};
const loadImage = (src: string): Promise<HTMLImageElement> => { return new Promise((resolve, reject) => { const img = new Image(); img.src = src; img.onload = () => resolve(img); img.onerror = (err) => reject(err); }); };
const GAME_WIDTH = 900; const GAME_HEIGHT = 300; const GROUND_Y = 258; const DINO_INITIAL_X = 40;

interface DinoGameProps {
    consumeRisingEdgeRef: React.MutableRefObject<() => boolean>;
    tongueOut: boolean;
    bestScore: number;
    setBestScore: React.Dispatch<React.SetStateAction<number>>;
}

const DinoGame: React.FC<DinoGameProps> = ({ consumeRisingEdgeRef, tongueOut, bestScore, setBestScore }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameImagesRef = useRef<Partial<GameImages>>({});
  const gameStateRef = useRef({
      dino: null as Dino | null, obstacles: [] as Obstacle[], clouds: [] as Cloud[], ground: null as Ground | null, speed: 420, score: 0, isGameOver: false, spawnTimer: 0, cloudTimer: 0, lastTime: 0, tongueHoldTimer: 0,
  });
  
  const tongueOutRef = useRef(tongueOut);
  useEffect(() => {
    tongueOutRef.current = tongueOut;
  }, [tongueOut]);
  
  const resetGame = useCallback(() => {
    const gameState = gameStateRef.current;
    const gameImages = gameImagesRef.current;
    if (!gameImages.DINO) return;
    gameState.dino = new Dino(gameImages.DINO);
    gameState.obstacles = [];
    gameState.speed = 420;
    gameState.score = 0;
    gameState.isGameOver = false;
    gameState.spawnTimer = 0;
    gameState.lastTime = 0;
    gameState.tongueHoldTimer = 0;
  }, []);

  useEffect(() => {
    const handleInput = (e: KeyboardEvent) => {
        if (e.code !== 'Space' && e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
        e.preventDefault();
        
        const gameState = gameStateRef.current;
        if (e.type === 'keydown') {
            if (gameState.isGameOver) {
                resetGame();
            } else if (gameState.dino) {
                if (e.code === 'Space' || e.code === 'ArrowUp') gameState.dino.startJump();
                if (e.code === 'ArrowDown') gameState.dino.setDuck(true);
            }
        } else if (e.type === 'keyup') {
            if (e.code === 'ArrowDown') gameState.dino?.setDuck(false);
        }
    };
    
    window.addEventListener('keydown', handleInput);
    window.addEventListener('keyup', handleInput);

    return () => {
      window.removeEventListener('keydown', handleInput);
      window.removeEventListener('keyup', handleInput);
    };
  }, [resetGame]);


  useEffect(() => {
    let animationFrameId: number;
    let isMounted = true;

    const gameLoop = (timestamp: number) => {
        const ctx = canvasRef.current?.getContext('2d');
        const gameState = gameStateRef.current;
        const gameImages = gameImagesRef.current;
        if (!ctx) {
            if(isMounted) animationFrameId = requestAnimationFrame(gameLoop);
            return;
        };
        
        if (gameState.lastTime === 0) gameState.lastTime = timestamp;
        const dt = (timestamp - gameState.lastTime) / 1000;
        gameState.lastTime = timestamp;

        if (!gameState.isGameOver) {
            if (consumeRisingEdgeRef.current()) gameState.dino?.startJump();
            gameState.ground?.update(dt, gameState.speed);
            gameState.dino?.update(dt);
            gameState.obstacles.forEach(o => o.update(dt, gameState.speed));
            if (gameState.dino && gameState.dino.isAlive) {
                for(const obstacle of gameState.obstacles) {
                    if(obstacle.isColliding(gameState.dino)) {
                        gameState.isGameOver = true;
                        gameState.dino.die();
                        setBestScore(prevBest => Math.max(Math.floor(gameState.score), prevBest));
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
                if (gameImages.OBSTACLES) {
                    const isCactus = Math.random() < 0.7;
                    if (isCactus) {
                        const isSmall = Math.random() < 0.5;
                        const group = isSmall ? gameImages.OBSTACLES.CACTUS_SMALL : gameImages.OBSTACLES.CACTUS_LARGE;
                        gameState.obstacles.push(new Cactus(group[Math.floor(Math.random() * group.length)]));
                    } else {
                        gameState.obstacles.push(new Bird(gameImages.OBSTACLES.BIRD));
                    }
                }
            }
            gameState.cloudTimer += dt;
            if (gameState.cloudTimer > 1.5) {
                gameState.cloudTimer = 0;
                if (gameImages.OTHER) {
                    gameState.clouds.push(new Cloud(gameImages.OTHER.CLOUD));
                }
            }
            gameState.obstacles = gameState.obstacles.filter(o => o.x + o.width > 0);
            gameState.clouds = gameState.clouds.filter(c => c.x + c.width > 0);
        }
        
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#F7F7F7';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        gameState.clouds.forEach(c => c.draw(ctx));
        gameState.ground?.draw(ctx);
        gameState.obstacles.forEach(o => o.draw(ctx));
        gameState.dino?.draw(ctx);
        const scoreText = `Score: ${Math.floor(gameState.score).toString().padStart(5, '0')}   Best: ${Math.floor(bestScore).toString().padStart(5, '0')}`;
        ctx.fillStyle = '#3C3C3C';
        ctx.font = '20px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(scoreText, GAME_WIDTH - 20, 30);

        if (gameState.isGameOver) {
            if (tongueOutRef.current) {
                gameState.tongueHoldTimer += dt;
                if (gameState.tongueHoldTimer >= 3.0) {
                    resetGame();
                }
            } else {
                gameState.tongueHoldTimer = 0;
            }

            if (gameImages.OTHER) {
                ctx.drawImage(gameImages.OTHER.GAME_OVER, GAME_WIDTH / 2 - gameImages.OTHER.GAME_OVER.width / 2, GAME_HEIGHT / 2 - 70);
                ctx.drawImage(gameImages.OTHER.RESET, GAME_WIDTH / 2 - gameImages.OTHER.RESET.width / 2, GAME_HEIGHT / 2 - 25);
                ctx.font = '18px Arial';
                ctx.fillStyle = '#535353';
                ctx.textAlign = 'center';
                ctx.fillText('space bar to play again', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70);
                
                const barWidth = 250, barHeight = 12, barX = GAME_WIDTH / 2 - barWidth / 2, barY = GAME_HEIGHT / 2 + 95;
                ctx.strokeStyle = '#535353';
                ctx.lineWidth = 2;
                ctx.strokeRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
                const progress = Math.min(1, gameState.tongueHoldTimer / 5.0);
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(barX, barY, barWidth * progress, barHeight);
                
                ctx.font = '16px Arial';
                ctx.fillStyle = '#535353';
                ctx.textAlign = 'center';
                const remain = Math.max(0, 5.0 - gameState.tongueHoldTimer);
                const holdText = tongueOutRef.current ? `Hold tongue for ${remain.toFixed(1)}s to restart` : `Hold tongue to restart`;
                ctx.fillText(holdText, GAME_WIDTH / 2, barY + barHeight + 20);
            }
        }
        
        animationFrameId = requestAnimationFrame(gameLoop);
    };

    const loadAllAssets = async () => {
        try {
            const gameImages = gameImagesRef.current;
            const gameState = gameStateRef.current;
            gameImages.DINO = { RUN: await Promise.all(ASSETS.DINO.RUN.map(loadImage)), JUMP: await Promise.all(ASSETS.DINO.JUMP.map(loadImage)), DUCK: await Promise.all(ASSETS.DINO.DUCK.map(loadImage)), DEAD: await loadImage(ASSETS.DINO.DEAD) };
            gameImages.OBSTACLES = { CACTUS_SMALL: await Promise.all(ASSETS.OBSTACLES.CACTUS_SMALL.map(loadImage)), CACTUS_LARGE: await Promise.all(ASSETS.OBSTACLES.CACTUS_LARGE.map(loadImage)), BIRD: await Promise.all(ASSETS.OBSTACLES.BIRD.map(loadImage)) };
            gameImages.OTHER = { GROUND: await loadImage(ASSETS.OTHER.GROUND), CLOUD: await loadImage(ASSETS.OTHER.CLOUD), GAME_OVER: await loadImage(ASSETS.OTHER.GAME_OVER), RESET: await loadImage(ASSETS.OTHER.RESET) };
            if (isMounted) {
                gameState.ground = new Ground(gameImages.OTHER.GROUND);
                resetGame();
                animationFrameId = requestAnimationFrame(gameLoop);
            }
        } catch (error) { console.error("Failed to load game assets:", error); }
    };
    
    loadAllAssets();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [resetGame, setBestScore, consumeRisingEdgeRef]);

  return <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="border-2 border-gray-400" />;
};

// --- Game Object Class Implementations ---
const DEBUG_MODE = false; 
class Dino { x = DINO_INITIAL_X; y = GROUND_Y; velY = 0; gravity = 2500; jumpSpeed = -900; isDucking = false; isAlive = true; images: DinoImages; currentImage: HTMLImageElement; width = 0; height = 0; runAnimTimer = 0; runAnimIndex = 0; runAnimRate = 0.09; jumpAnimTimer = 0; jumpAnimIndex = 0; jumpAnimRate = 0.1; 
    constructor(images: DinoImages) { this.images = images; this.currentImage = this.images.RUN[0]; this.y = GROUND_Y - this.currentImage.height; this.width = this.currentImage.width; this.height = this.currentImage.height; } 
    getHitbox() { return { x: this.x + 20, y: this.y + 15, width: this.width - 35, height: this.height - 25 }; } startJump() { if (this.isAlive && this.y + this.height >= GROUND_Y) { this.velY = this.jumpSpeed; this.jumpAnimIndex = 0; this.jumpAnimTimer = 0; } } setDuck(value: boolean) { if (this.isAlive && this.y + this.height >= GROUND_Y) { this.isDucking = value; } } die() { this.isAlive = false; this.currentImage = this.images.DEAD; } update(dt: number) { if (!this.isAlive) return; this.velY += this.gravity * dt; this.y += this.velY * dt; const onGround = this.y + this.height >= GROUND_Y; if (onGround) { this.y = GROUND_Y - this.height; this.velY = 0; } if (!onGround) { this.jumpAnimTimer += dt; if (this.jumpAnimTimer > this.jumpAnimRate) { this.jumpAnimTimer = 0; this.jumpAnimIndex = (this.jumpAnimIndex + 1) % this.images.JUMP.length; } this.currentImage = this.images.JUMP[this.jumpAnimIndex]; } else if (this.isDucking) { this.runAnimTimer += dt; if (this.runAnimTimer > this.runAnimRate) { this.runAnimTimer = 0; this.runAnimIndex = (this.runAnimIndex + 1) % this.images.DUCK.length; } this.currentImage = this.images.DUCK[this.runAnimIndex]; } else { this.runAnimTimer += dt; if (this.runAnimTimer > this.runAnimRate) { this.runAnimTimer = 0; this.runAnimIndex = (this.runAnimIndex + 1) % this.images.RUN.length; } this.currentImage = this.images.RUN[this.runAnimIndex]; } this.width = this.currentImage.width; this.height = this.currentImage.height; if (onGround) { this.y = GROUND_Y - this.height; } } draw(ctx: CanvasRenderingContext2D) { ctx.drawImage(this.currentImage, this.x, this.y); if (DEBUG_MODE) { const box = this.getHitbox(); ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; ctx.lineWidth = 2; ctx.strokeRect(box.x, box.y, box.width, box.height); } } 
}
class Obstacle { x = GAME_WIDTH; y = 0; width = 0; height = 0; image: HTMLImageElement; constructor(image: HTMLImageElement) { this.image = image; this.width = image.width; this.height = image.height; } getHitbox() { return { x: this.x + 8, y: this.y + 8, width: this.width - 16, height: this.height - 16 }; } isColliding(dino: Dino): boolean { const dinoBox = dino.getHitbox(); const obsBox = this.getHitbox(); return (dinoBox.x < obsBox.x + obsBox.width && dinoBox.x + dinoBox.width > obsBox.x && dinoBox.y < obsBox.y + obsBox.height && dinoBox.y + dinoBox.height > obsBox.y); } update(dt: number, speed: number) { this.x -= speed * dt; } draw(ctx: CanvasRenderingContext2D) { ctx.drawImage(this.image, this.x, this.y); if (DEBUG_MODE) { const box = this.getHitbox(); ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; ctx.lineWidth = 2; ctx.strokeRect(box.x, box.y, box.width, box.height); } } }
class Cactus extends Obstacle { constructor(image: HTMLImageElement) { super(image); this.y = GROUND_Y - this.height; } }
class Bird extends Obstacle { images: HTMLImageElement[]; animTimer = 0; animIndex = 0; animRate = 0.09; constructor(images: HTMLImageElement[]) { super(images[0]); this.images = images; this.y = GROUND_Y - [50, 70, 95][Math.floor(Math.random() * 3)]; } update(dt: number, speed: number) { super.update(dt, speed + 30); this.animTimer += dt; if(this.animTimer > this.animRate) { this.animTimer = 0; this.animIndex = (this.animIndex + 1) % 2; this.image = this.images[this.animIndex]; } } }
class Ground { image: HTMLImageElement; x1 = 0; x2: number; y: number; constructor(image: HTMLImageElement) { this.image = image; this.x2 = image.width; this.y = GROUND_Y - 20; } update(dt: number, speed: number) { this.x1 -= speed * dt; this.x2 -= speed * dt; if(this.x1 <= -this.image.width) this.x1 = this.x2 + this.image.width; if(this.x2 <= -this.image.width) this.x2 = this.x1 + this.image.width; } draw(ctx: CanvasRenderingContext2D) { ctx.drawImage(this.image, this.x1, this.y); ctx.drawImage(this.image, this.x2, this.y); } }
class Cloud { image: HTMLImageElement; x = GAME_WIDTH + Math.random() * 250; y = Math.random() * (GROUND_Y - 180) + 20; width: number; height: number; constructor(image: HTMLImageElement) { this.image = image; this.width = image.width; this.height = image.height; } update(dt: number, speed: number) { this.x -= (speed * 0.4) * dt; } draw(ctx: CanvasRenderingContext2D) { ctx.drawImage(this.image, this.x, this.y); } }
export default DinoGame;

