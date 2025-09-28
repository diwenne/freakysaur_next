// src/components/DinoGame2P.tsx
'use client';

import React, { useRef, useEffect, useState } from 'react';

// --- Type Definitions, Asset Paths, Helper, Constants... ---
interface DinoImages { RUN: HTMLImageElement[]; JUMP: HTMLImageElement[]; DUCK: HTMLImageElement[]; DEAD: HTMLImageElement; }
const ASSETS = {
  DINO: { RUN: ['/assets/Dino/DinoRun1.png', '/assets/Dino/DinoRun2.png'], JUMP: ['/assets/Dino/DinoJump1.png', '/assets/Dino/DinoJump2.png', '/assets/Dino/DinoJump3.png', '/assets/Dino/DinoJump4.png'], DUCK: ['/assets/Dino/DinoDuck1.png', '/assets/Dino/DinoDuck2.png'], DEAD: '/assets/Dino/DinoDead.png' },
  OBSTACLES: { CACTUS_SMALL: ['/assets/Cactus/SmallCactus1.png', '/assets/Cactus/SmallCactus2.png', '/assets/Cactus/SmallCactus3.png'], CACTUS_LARGE: ['/assets/Cactus/LargeCactus1.png', '/assets/Cactus/LargeCactus2.png', '/assets/Cactus/LargeCactus3.png'], BIRD: ['/assets/Bird/Bird1.png', '/assets/Bird/Bird2.png'] },
  OTHER: { GROUND: '/assets/Other/Track.png', CLOUD: '/assets/Other/Cloud.png', GAME_OVER: '/assets/Other/GameOver.png', RESET: '/assets/Other/Reset.png' },
};
interface GameImages {
  DINO: DinoImages;
  OBSTACLES: { CACTUS_SMALL: HTMLImageElement[]; CACTUS_LARGE: HTMLImageElement[]; BIRD: HTMLImageElement[]; };
  OTHER: { GROUND: HTMLImageElement; CLOUD: HTMLImageElement; GAME_OVER: HTMLImageElement; RESET: HTMLImageElement; };
}
const loadImage = (src: string): Promise<HTMLImageElement> => { return new Promise((resolve, reject) => { const img = new Image(); img.src = src; img.onload = () => resolve(img); img.onerror = (err) => reject(err); }); };
const GAME_WIDTH = 900; const GAME_HEIGHT = 560; const DINO_INITIAL_X = 40; const LANE_HEIGHT = GAME_HEIGHT / 2; const GROUND_Y_IN_LANE = 258;
const DEBUG_MODE = false; 

// --- Game Object Classes ---
class Dino { 
    x:number; y:number; ground_y:number; velY=0; gravity=2500; jumpSpeed=-900; ducking=false; alive=true; images:DinoImages; currentImage:HTMLImageElement; width:number; height:number; runAnimTimer=0; runAnimIndex=0; runAnimRate=0.09; jumpAnimTimer=0; jumpAnimIndex=0; jumpAnimRate=0.1; label:string; labelColor:string;
    constructor(groundY:number, x:number, label:string, labelColor:string, images:DinoImages) { this.images = images; this.ground_y = groundY; this.x = x; this.currentImage = this.images.RUN[0]; this.width = this.currentImage.width; this.height = this.currentImage.height; this.y = this.ground_y - this.height; this.label = label; this.labelColor = labelColor; }
    getHitbox() { return { x: this.x + 20, y: this.y + 15, width: this.width - 35, height: this.height - 25 }; }
    isColliding(obs: Obstacle) { const dinoBox = this.getHitbox(); const obsBox = obs.getHitbox(); return (dinoBox.x < obsBox.x + obsBox.width && dinoBox.x + dinoBox.width > obsBox.x && dinoBox.y < obsBox.y + obsBox.height && dinoBox.y + dinoBox.height > obsBox.y); }
    startJump() { if (this.alive && this.y + this.height >= this.ground_y) { this.velY = this.jumpSpeed; this.jumpAnimIndex = 0; this.jumpAnimTimer = 0; } }
    setDuck(value: boolean) { if (this.alive && this.y + this.height >= this.ground_y) this.ducking = value; }
    die() { this.alive = false; this.currentImage = this.images.DEAD; }
    update(dt: number) { if (!this.alive) return; this.velY += this.gravity * dt; this.y += this.velY * dt; if (this.y + this.height >= this.ground_y) { this.y = this.ground_y - this.height; this.velY = 0; } const onGround = this.y + this.height >= this.ground_y; if (!onGround) { this.jumpAnimTimer += dt; if (this.jumpAnimTimer > this.jumpAnimRate) { this.jumpAnimTimer = 0; this.jumpAnimIndex = (this.jumpAnimIndex + 1) % this.images.JUMP.length; } this.currentImage = this.images.JUMP[this.jumpAnimIndex]; } else if (this.ducking) { this.runAnimTimer += dt; if (this.runAnimTimer > this.runAnimRate) { this.runAnimTimer = 0; this.runAnimIndex = (this.runAnimIndex + 1) % this.images.DUCK.length; } this.currentImage = this.images.DUCK[this.runAnimIndex]; } else { this.runAnimTimer += dt; if (this.runAnimTimer > this.runAnimRate) { this.runAnimTimer = 0; this.runAnimIndex = (this.runAnimIndex + 1) % this.images.RUN.length; } this.currentImage = this.images.RUN[this.runAnimIndex]; } this.width = this.currentImage.width; this.height = this.currentImage.height; if (onGround) { this.y = this.ground_y - this.height; } }
    draw(ctx: CanvasRenderingContext2D, font: string) { ctx.drawImage(this.currentImage, this.x, this.y); ctx.font = font; ctx.fillStyle = this.labelColor; ctx.textAlign = 'center'; ctx.fillText(this.label, this.x + this.width/2, this.y - 10); if (DEBUG_MODE) { const box = this.getHitbox(); ctx.strokeStyle = 'rgba(255,0,0,0.7)'; ctx.lineWidth=2; ctx.strokeRect(box.x,box.y,box.width,box.height);}}
}
class Obstacle { 
    x:number; y=0; image:HTMLImageElement; width:number; height:number; speed:number; rect: {x:number, y:number, width:number, height:number, right:number};
    constructor(image: HTMLImageElement, speed: number) { this.image = image; this.width = image.width; this.height = image.height; this.x = GAME_WIDTH; this.speed = speed; this.rect = {x:this.x, y:this.y, width:this.width, height:this.height, right: this.x + this.width};}
    getHitbox() { return { x: this.x + 8, y: this.y + 8, width: this.width - 16, height: this.height - 16 }; }
    update(dt: number) { this.x -= this.speed * dt; this.rect.x = this.x; this.rect.right = this.x + this.width; }
    draw(ctx: CanvasRenderingContext2D) { ctx.drawImage(this.image, this.x, this.y); if (DEBUG_MODE) { const box = this.getHitbox(); ctx.strokeStyle = 'rgba(255,0,0,0.7)'; ctx.lineWidth=2; ctx.strokeRect(box.x,box.y,box.width,box.height);}}
}
class Cactus extends Obstacle { constructor(image: HTMLImageElement, groundY: number, speed: number) { super(image, speed); this.y = groundY - this.height; this.rect.y = this.y; } }
class Bird extends Obstacle {
    images: HTMLImageElement[]; animTimer=0; animIndex=0; animRate=0.09;
    constructor(images: HTMLImageElement[], groundY: number, speed: number) { super(images[0], speed + 30); this.images = images; this.y = groundY - [50, 70, 95][Math.floor(Math.random() * 3)]; this.rect.y = this.y; }
    update(dt: number) { super.update(dt); this.animTimer += dt; if(this.animTimer > this.animRate) { this.animTimer = 0; this.animIndex = (this.animIndex + 1) % this.images.length; this.image = this.images[this.animIndex]; } }
}
class Ground {
    image: HTMLImageElement; x1=0; x2:number; y:number; speed:number; width:number;
    constructor(image:HTMLImageElement, groundY:number, speed:number) { this.image = image; this.y = groundY - 20; this.speed = speed; this.width = image.width; this.x2 = this.width; }
    update(dt: number) { this.x1 -= this.speed * dt; this.x2 -= this.speed * dt; if(this.x1 <= -this.width) this.x1 = this.x2 + this.width; if(this.x2 <= -this.width) this.x2 = this.x1 + this.width; }
    draw(ctx: CanvasRenderingContext2D) { ctx.drawImage(this.image, this.x1, this.y); ctx.drawImage(this.image, this.x2, this.y); }
}
class Cloud {
    image:HTMLImageElement; x:number; y:number; speed:number; rect: { right: number };
    constructor(image:HTMLImageElement, speed:number) { this.image = image; this.x = GAME_WIDTH + Math.random() * 250; this.y = Math.random() * (GROUND_Y_IN_LANE - 180) + 20; this.speed = speed * 0.4; this.rect = { right: this.x + image.width }; }
    update(dt:number) { this.x -= this.speed * dt; this.rect.right = this.x + this.image.width; }
    draw(ctx: CanvasRenderingContext2D) { ctx.drawImage(this.image, this.x, this.y); }
}
class Lane {
    dino: Dino; obstacles = new Set<Obstacle>(); clouds = new Set<Cloud>(); ground: Ground; score = 0; spawnTimer = 0; cloudTimer = 0;
    constructor(public label: string, public labelColor: string, public images: GameImages) {
        this.dino = new Dino(GROUND_Y_IN_LANE, DINO_INITIAL_X, label, labelColor, images.DINO);
        this.ground = new Ground(images.OTHER.GROUND, GROUND_Y_IN_LANE, 420);
    }
    reset(images: GameImages) { this.dino = new Dino(GROUND_Y_IN_LANE, DINO_INITIAL_X, this.label, this.labelColor, images.DINO); this.obstacles.clear(); this.clouds.clear(); this.ground = new Ground(images.OTHER.GROUND, GROUND_Y_IN_LANE, 420); this.score = 0; this.spawnTimer = 0; this.cloudTimer = 0; }
    update(dt: number, speed: number) { 
        this.dino.update(dt); 
        this.ground.speed = speed; 
        this.ground.update(dt); 
        this.obstacles.forEach(o => { o.speed = speed; o.update(dt); if (o.x < -100) this.obstacles.delete(o); }); 
        this.clouds.forEach(c => { c.speed = speed * 0.4; c.update(dt); if (c.x < -100) this.clouds.delete(c); }); 
        if (this.dino.alive) this.score += dt * 10;
        
        this.spawnTimer += dt; 
        if (this.spawnTimer > 1.2) { 
            this.spawnTimer = 0; 
            if (Math.random() < 0.7) { // 70% chance for a cactus
                const isSmall = Math.random() < 0.5;
                const cactusGroup = isSmall ? this.images.OBSTACLES.CACTUS_SMALL : this.images.OBSTACLES.CACTUS_LARGE;
                const randomCactusImage = cactusGroup[Math.floor(Math.random() * cactusGroup.length)];
                this.obstacles.add(new Cactus(randomCactusImage, GROUND_Y_IN_LANE, speed));
            } else { // 30% chance for a bird
                this.obstacles.add(new Bird(this.images.OBSTACLES.BIRD, GROUND_Y_IN_LANE, speed));
            }
        }
        this.cloudTimer += dt; if (this.cloudTimer > 1.5) { this.cloudTimer = 0; this.clouds.add(new Cloud(this.images.OTHER.CLOUD, speed)); }
    }
    draw(ctx: CanvasRenderingContext2D, font: string, fontSmall: string) { this.clouds.forEach(c => c.draw(ctx)); this.ground.draw(ctx); this.obstacles.forEach(o => o.draw(ctx)); this.dino.draw(ctx, fontSmall); const scoreText = `Score: ${Math.floor(this.score).toString().padStart(5, '0')}`; ctx.font = font; ctx.fillStyle = '#3C3C3C'; ctx.textAlign = 'left'; ctx.fillText(scoreText, 10, 25); }
}

// --- React Component ---
interface DinoGame2PProps {
    consumeRisingEdgeRef: React.MutableRefObject<(playerIndex: 0 | 1) => boolean>;
    tongueOutStates: [boolean, boolean];
    isCalibrating: boolean;
}

const DinoGame2P: React.FC<DinoGame2PProps> = ({ consumeRisingEdgeRef, tongueOutStates, isCalibrating }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameImages = useRef<Partial<GameImages>>({}).current;
    const gameState = useRef({ lanes: [] as Lane[], isGameOver: true, winner: '', speed: 420, lastTime: 0, duoHoldTimer: 0 }).current;
    const animationFrameId = useRef<number | null>(null);

    const [isGameReady, setIsGameReady] = useState(false);
    
    const tongueOutStatesRef = useRef(tongueOutStates);
    useEffect(() => {
        tongueOutStatesRef.current = tongueOutStates;
    }, [tongueOutStates]);

    useEffect(() => {
        let isMounted = true;
        
        const loadAssetsAndInit = async () => {
            try {
                gameImages.DINO = { RUN: await Promise.all(ASSETS.DINO.RUN.map(loadImage)), JUMP: await Promise.all(ASSETS.DINO.JUMP.map(loadImage)), DUCK: await Promise.all(ASSETS.DINO.DUCK.map(loadImage)), DEAD: await loadImage(ASSETS.DINO.DEAD) };
                gameImages.OBSTACLES = { CACTUS_SMALL: await Promise.all(ASSETS.OBSTACLES.CACTUS_SMALL.map(loadImage)), CACTUS_LARGE: await Promise.all(ASSETS.OBSTACLES.CACTUS_LARGE.map(loadImage)), BIRD: await Promise.all(ASSETS.OBSTACLES.BIRD.map(loadImage)) };
                gameImages.OTHER = { GROUND: await loadImage(ASSETS.OTHER.GROUND), CLOUD: await loadImage(ASSETS.OTHER.CLOUD), GAME_OVER: await loadImage(ASSETS.OTHER.GAME_OVER), RESET: await loadImage(ASSETS.OTHER.RESET) };
                
                if (isMounted) {
                    if (gameState.lanes.length === 0) {
                        gameState.lanes.push(new Lane('P1', '#3b82f6', gameImages as GameImages));
                        gameState.lanes.push(new Lane('P2', '#f97316', gameImages as GameImages));
                    }
                    setIsGameReady(true);
                }
            } catch (error) { console.error("Failed to load assets:", error); }
        };
        
        loadAssetsAndInit();

        return () => { isMounted = false; };
    }, [gameImages, gameState.lanes]);

    useEffect(() => {
        if (!isGameReady || isCalibrating) return;

        const resetGame = () => {
            gameState.lanes.forEach(lane => lane.reset(gameImages as GameImages));
            gameState.isGameOver = false;
            gameState.winner = '';
            gameState.duoHoldTimer = 0;
            gameState.lastTime = 0; // Set to 0 to handle dt correctly on first frame after reset
        };

        const handleInput = (e: KeyboardEvent) => {
            if (e.type === 'keydown') {
                if (gameState.isGameOver) {
                    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') resetGame();
                } else {
                    if (e.code === 'Space' || e.code === 'ArrowUp') gameState.lanes[0]?.dino.startJump();
                    if (e.code === 'ArrowDown') gameState.lanes[0]?.dino.setDuck(true);
                    if (e.code === 'KeyW') gameState.lanes[1]?.dino.startJump();
                    if (e.code === 'KeyS') gameState.lanes[1]?.dino.setDuck(true);
                }
            } else if (e.type === 'keyup') {
                if (e.code === 'ArrowDown') gameState.lanes[0]?.dino.setDuck(false);
                if (e.code === 'KeyS') gameState.lanes[1]?.dino.setDuck(false);
            }
        };

        const gameLoop = (timestamp: number) => {
            animationFrameId.current = requestAnimationFrame(gameLoop);
            const ctx = canvasRef.current?.getContext('2d');
            if (!ctx) return;
            
            if (gameState.lastTime === 0) gameState.lastTime = timestamp;
            const dt = (timestamp - gameState.lastTime) / 1000;
            gameState.lastTime = timestamp;

            if (!gameState.isGameOver) {
                if (consumeRisingEdgeRef.current(0)) gameState.lanes[0]?.dino.startJump();
                if (consumeRisingEdgeRef.current(1)) gameState.lanes[1]?.dino.startJump();
                const worldScore = Math.max(gameState.lanes[0]?.score ?? 0, gameState.lanes[1]?.score ?? 0);
                gameState.speed = 420 + Math.floor(worldScore / 10);
                gameState.lanes.forEach(lane => lane.update(dt, gameState.speed));

                const p1Died = gameState.lanes[0] && [...gameState.lanes[0].obstacles].some(o => gameState.lanes[0].dino.isColliding(o));
                const p2Died = gameState.lanes[1] && [...gameState.lanes[1].obstacles].some(o => gameState.lanes[1].dino.isColliding(o));
                if (p1Died) gameState.lanes[0].dino.die();
                if (p2Died) gameState.lanes[1].dino.die();
                if (p1Died || p2Died) {
                    gameState.isGameOver = true;
                    if (gameState.lanes[0].dino.alive && !gameState.lanes[1].dino.alive) gameState.winner = 'PLAYER 1 WINS!';
                    else if (!gameState.lanes[0].dino.alive && gameState.lanes[1].dino.alive) gameState.winner = 'PLAYER 2 WINS!';
                    else gameState.winner = 'TIE!';
                }
            } else {
                if (tongueOutStatesRef.current[0] && tongueOutStatesRef.current[1]) {
                    gameState.duoHoldTimer += dt;
                    if (gameState.duoHoldTimer >= 3.0) resetGame();
                } else {
                    gameState.duoHoldTimer = 0;
                }
            }

            ctx.fillStyle = '#F7F7F7'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            ctx.save();
            gameState.lanes[0]?.draw(ctx, '20px Arial', 'bold 16px Arial');
            ctx.translate(0, LANE_HEIGHT);
            gameState.lanes[1]?.draw(ctx, '20px Arial', 'bold 16px Arial');
            ctx.restore();
            ctx.fillStyle = '#d1d5db'; ctx.fillRect(0, LANE_HEIGHT - 1, GAME_WIDTH, 2);

            if (gameState.isGameOver && gameImages.OTHER) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
                const goImg = gameImages.OTHER.GAME_OVER;
                ctx.drawImage(goImg, GAME_WIDTH/2 - goImg.width/2, GAME_HEIGHT/2 - goImg.height/2 - 80);
                ctx.font = 'bold 40px Arial'; ctx.fillStyle = 'white'; ctx.textAlign = 'center';
                ctx.fillText(gameState.winner, GAME_WIDTH/2, GAME_HEIGHT/2 + 20);
                const barWidth = 300, barHeight = 20, barX = GAME_WIDTH / 2 - barWidth / 2, barY = GAME_HEIGHT / 2 + 60;
                ctx.fillStyle = '#535353'; ctx.fillRect(barX, barY, barWidth, barHeight);
                const progress = gameState.duoHoldTimer / 3.0;
                ctx.fillStyle = '#22c55e'; ctx.fillRect(barX, barY, barWidth * progress, barHeight);
                ctx.font = '16px Arial'; ctx.fillStyle = 'white';
                ctx.fillText(`Hold Both Tongues to Restart: ${Math.floor(progress*100)}%`, GAME_WIDTH/2, barY + 40);
            }
        };
        
        resetGame();
        animationFrameId.current = requestAnimationFrame(gameLoop);
        window.addEventListener('keydown', handleInput); 
        window.addEventListener('keyup', handleInput);
        
        return () => { 
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            window.removeEventListener('keydown', handleInput); 
            window.removeEventListener('keyup', handleInput); 
            gameState.isGameOver = true;
        };
    }, [isGameReady, isCalibrating, consumeRisingEdgeRef, gameImages, gameState]);


    return <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="border-2 border-gray-400" />;
};

export default DinoGame2P;