// src/components/FlappyBird.tsx
'use client';

import React, { useRef, useEffect } from 'react';

const FLAP_ASSETS = { BG: '/assets/Flap/background-day.png', BASE: '/assets/Flap/base.png', PIPE: '/assets/Flap/pipe-green.png', MSG: '/assets/Flap/message.png', GAMEOVER: '/assets/Flap/gameover.png', BIRD: ['/assets/Flap/yellowbird-downflap.png', '/assets/Flap/yellowbird-midflap.png', '/assets/Flap/yellowbird-upflap.png'], };
interface FlapImages { BG: HTMLImageElement; BASE: HTMLImageElement; PIPE: HTMLImageElement; MSG: HTMLImageElement; GAMEOVER: HTMLImageElement; BIRD: HTMLImageElement[]; }
const loadImage = (src: string): Promise<HTMLImageElement> => { return new Promise((resolve, reject) => { const img = new Image(); img.src = src; img.onload = () => resolve(img); img.onerror = (err) => reject(err); }); };
const NATIVE_WIDTH = 288;
const NATIVE_HEIGHT = 512;

class Bird {
    frames: HTMLImageElement[]; index = 0; animTimer = 0; animRate = 0.1; x: number; y: number; vel = 0; gravity = 900.0; flapSpeed = -320.0; rotation = 0.0; width: number; height: number;
    constructor(frames: HTMLImageElement[], x: number, y: number) { this.frames = frames; this.x = x; this.y = y; this.width = frames[0].width; this.height = frames[0].height; }
    flap() { this.vel = this.flapSpeed; }
    update(dt: number) { this.vel += this.gravity * dt; this.y += this.vel * dt; this.animTimer += dt; if (this.animTimer > this.animRate) { this.animTimer = 0; this.index = (this.index + 1) % this.frames.length; } this.rotation = Math.max(-25, Math.min(90, (this.vel / 400.0) * 90)); }
    getHitbox() { return { x: this.x + 5, y: this.y + 5, width: this.width - 10, height: this.height - 10 }; }
    draw(ctx: CanvasRenderingContext2D) { ctx.save(); ctx.translate(this.x + this.width / 2, this.y + this.height / 2); ctx.rotate((this.rotation * Math.PI) / 180); ctx.drawImage(this.frames[this.index], -this.width / 2, -this.height / 2); ctx.restore(); }
}
class PipePair { pipeImg: HTMLImageElement; x: number; y: number; gapSize: number; speed: number; width: number; height: number; passed = false; isOffscreen = false; constructor(x: number, gapY: number, gapSize: number, speed: number, pipeImg: HTMLImageElement) { this.x = x; this.y = gapY; this.gapSize = gapSize; this.speed = speed; this.pipeImg = pipeImg; this.width = pipeImg.width; this.height = pipeImg.height; }
    update(dt: number) { this.x -= this.speed * dt; if (this.x + this.width < 0) this.isOffscreen = true; }
    getHitboxes() { const topPipe = { x: this.x, y: this.y - this.gapSize / 2 - this.height, width: this.width, height: this.height }; const bottomPipe = { x: this.x, y: this.y + this.gapSize / 2, width: this.width, height: this.height }; return [topPipe, bottomPipe]; }
    draw(ctx: CanvasRenderingContext2D) { const [topPipe, bottomPipe] = this.getHitboxes(); ctx.save(); ctx.translate(topPipe.x + this.width / 2, topPipe.y + this.height / 2); ctx.scale(1, -1); ctx.drawImage(this.pipeImg, -this.width / 2, -this.height / 2); ctx.restore(); ctx.drawImage(this.pipeImg, bottomPipe.x, bottomPipe.y); }
}
class BaseScroller { img: HTMLImageElement; y: number; speed: number; x1: number; x2: number; width: number; constructor(img: HTMLImageElement, y: number, speed: number) { this.img = img; this.y = y; this.speed = speed; this.width = img.width; this.x1 = 0; this.x2 = this.width; }
    update(dt: number) { this.x1 -= this.speed * dt; this.x2 -= this.speed * dt; if (this.x1 + this.width <= 0) this.x1 = this.x2 + this.width; if (this.x2 + this.width <= 0) this.x2 = this.x1 + this.width; }
    draw(ctx: CanvasRenderingContext2D) { ctx.drawImage(this.img, this.x1, this.y); ctx.drawImage(this.img, this.x2, this.y); }
}

interface FlappyBirdProps {
    consumeRisingEdgeRef: React.MutableRefObject<() => boolean>;
    bestScore: number;
    setBestScore: React.Dispatch<React.SetStateAction<number>>;
}

const FlappyBird: React.FC<FlappyBirdProps> = ({ consumeRisingEdgeRef, bestScore, setBestScore }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameImages = useRef<Partial<FlapImages>>({}).current;
    const gameState = useRef({
        bird: null as Bird | null, pipes: [] as PipePair[], base: null as BaseScroller | null, status: 'ready' as 'ready' | 'playing' | 'dead', spawnTimer: 0, speed: 100.0, score: 0, lastTime: 0
    }).current;

    useEffect(() => {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = NATIVE_WIDTH;
        offscreenCanvas.height = NATIVE_HEIGHT;
        let animationFrameId: number;

        const resetGame = () => {
            if (!gameImages.BIRD || !gameImages.BASE) return;
            gameState.bird = new Bird(gameImages.BIRD, 60, NATIVE_HEIGHT / 2);
            gameState.pipes = [];
            gameState.base = new BaseScroller(gameImages.BASE, NATIVE_HEIGHT - 112, 100.0);
            gameState.status = 'ready';
            gameState.spawnTimer = 0;
            gameState.speed = 100.0;
            gameState.score = 0;
        };
        
        const handleInput = () => {
            if (gameState.status === 'dead') {
                resetGame();
            } else {
                gameState.bird?.flap();
                gameState.status = 'playing';
            }
        };

        const gameLoop = (timestamp: number) => {
            animationFrameId = requestAnimationFrame(gameLoop);
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = offscreenCanvas.getContext('2d');
            if (!ctx) return;
            
            if (gameState.lastTime === 0) gameState.lastTime = timestamp;
            const dt = (timestamp - gameState.lastTime) / 1000;
            gameState.lastTime = timestamp;

            if (consumeRisingEdgeRef.current()) handleInput();

            if (gameState.status === 'playing') {
                gameState.spawnTimer += dt;
                if (gameState.spawnTimer > 1.8) {
                    gameState.spawnTimer = 0;
                    const margin = 80;
                    const gapY = Math.random() * (NATIVE_HEIGHT - margin * 2) + margin;
                    if(gameImages.PIPE) gameState.pipes.push(new PipePair(NATIVE_WIDTH + 20, gapY, 160, gameState.speed, gameImages.PIPE));
                }
                gameState.bird?.update(dt);
                gameState.pipes.forEach(p => p.update(dt));
                gameState.base?.update(dt);
                gameState.pipes.forEach(p => {
                    if (!p.passed && gameState.bird && p.x + p.width < gameState.bird.x) {
                        p.passed = true;
                        gameState.score++;
                        gameState.speed = 100.0 + gameState.score * 2.0;
                        if(gameState.base) gameState.base.speed = gameState.speed;
                    }
                });
                gameState.pipes = gameState.pipes.filter(p => !p.isOffscreen);

                const birdBox = gameState.bird?.getHitbox();
                if(birdBox) {
                    if(birdBox.y + birdBox.height > NATIVE_HEIGHT - 112 || birdBox.y < 0) {
                        gameState.status = 'dead';
                        setBestScore(prevBest => Math.max(gameState.score, prevBest));
                    }
                    for(const pipe of gameState.pipes) {
                        for(const pipeBox of pipe.getHitboxes()) {
                            if (birdBox.x < pipeBox.x + pipeBox.width && birdBox.x + birdBox.width > pipeBox.x && birdBox.y < pipeBox.y + pipeBox.height && birdBox.y + birdBox.height > pipeBox.y) {
                                gameState.status = 'dead';
                                setBestScore(prevBest => Math.max(gameState.score, prevBest));
                            }
                        }
                    }
                }
            }
            if (gameState.status === 'ready') gameState.base?.update(dt);
            
            ctx.drawImage(gameImages.BG as HTMLImageElement, 0, 0);
            gameState.pipes.forEach(p => p.draw(ctx));
            gameState.base?.draw(ctx);
            gameState.bird?.draw(ctx);
            
            const scoreText = gameState.score.toString();
            ctx.font = '30px Arial'; ctx.fillStyle = 'white'; ctx.strokeStyle = 'black'; ctx.lineWidth = 3;
            ctx.strokeText(scoreText, NATIVE_WIDTH / 2 - ctx.measureText(scoreText).width / 2, 50);
            ctx.fillText(scoreText, NATIVE_WIDTH / 2 - ctx.measureText(scoreText).width / 2, 50);
            
            if (gameState.status === 'ready' && gameImages.MSG) ctx.drawImage(gameImages.MSG, NATIVE_WIDTH / 2 - gameImages.MSG.width / 2, NATIVE_HEIGHT / 2 - gameImages.MSG.height / 2 - 50);
            if (gameState.status === 'dead' && gameImages.GAMEOVER) {
                 ctx.drawImage(gameImages.GAMEOVER, NATIVE_WIDTH / 2 - gameImages.GAMEOVER.width / 2, NATIVE_HEIGHT / 2 - 100);
                 const bestScoreText = `Best: ${bestScore}`;
                 ctx.strokeText(bestScoreText, NATIVE_WIDTH / 2 - ctx.measureText(bestScoreText).width / 2, NATIVE_HEIGHT / 2 - 20);
                 ctx.fillText(bestScoreText, NATIVE_WIDTH / 2 - ctx.measureText(bestScoreText).width / 2, NATIVE_HEIGHT / 2 - 20);
            }

            const mainCtx = canvas.getContext('2d');
            if(mainCtx) {
                mainCtx.clearRect(0, 0, canvas.width, canvas.height);
                mainCtx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
            }
        };

        const handleKeyEvent = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') handleInput();
        };
        const handleMouseEvent = () => handleInput();
        window.addEventListener('keydown', handleKeyEvent);
        window.addEventListener('mousedown', handleMouseEvent);

        let isMounted = true;
        const loadAssets = async () => {
            try {
                gameImages.BG = await loadImage(FLAP_ASSETS.BG);
                gameImages.BASE = await loadImage(FLAP_ASSETS.BASE);
                gameImages.PIPE = await loadImage(FLAP_ASSETS.PIPE);
                gameImages.MSG = await loadImage(FLAP_ASSETS.MSG);
                gameImages.GAMEOVER = await loadImage(FLAP_ASSETS.GAMEOVER);
                gameImages.BIRD = await Promise.all(FLAP_ASSETS.BIRD.map(loadImage));
                if (isMounted) {
                    resetGame();
                    gameState.lastTime = performance.now();
                    animationFrameId = requestAnimationFrame(gameLoop);
                }
            } catch (error) { console.error("Failed to load Flappy Bird assets:", error); }
        };
        
        loadAssets();

        return () => {
            isMounted = false;
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('keydown', handleKeyEvent);
            window.removeEventListener('mousedown', handleMouseEvent);
        };
    }, [consumeRisingEdgeRef, gameImages, gameState, bestScore, setBestScore]);

    return <canvas ref={canvasRef} width={900} height={560} className="border-2 border-gray-400" />;
};

export default FlappyBird;