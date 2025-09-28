// src/hooks/useTongueSwitch.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver, NormalizedLandmark } from '@mediapipe/tasks-vision';

const INNER_LIP_LANDMARKS = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const v = max; 
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, v * 100];
}

export const useTongueSwitch = () => {
  const [tongueOut, setTongueOut] = useState(false);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const animationFrameId = useRef<number | null>(null);
  const lastState = useRef(false);
  
  const minOpenPx = 8;
  const fracThreshold = 0.06;

  const predictWebcam = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const processCanvas = processCanvasRef.current;

    if (!overlayCanvas || !processCanvas || !faceLandmarkerRef.current) {
        animationFrameId.current = requestAnimationFrame(predictWebcam);
        return;
    };

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const results = faceLandmarkerRef.current.detectForVideo(video, Date.now());
      
      const overlayCtx = overlayCanvas.getContext('2d');
      if (!overlayCtx) return;
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      let isTongueOut = false;
      let openPx = 0;
      let frac = 0.0;
      
      if (results.faceLandmarks?.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const w = video.videoWidth;
        const h = video.videoHeight;
        
        const innerLipPoints = INNER_LIP_LANDMARKS.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));

        if (innerLipPoints.length > 2) {
            const xs = innerLipPoints.map(p => p.x), ys = innerLipPoints.map(p => p.y);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);

            const clampedMinX = Math.max(0, Math.floor(minX)), clampedMinY = Math.max(0, Math.floor(minY));
            const clampedMaxX = Math.min(w, Math.ceil(maxX)), clampedMaxY = Math.min(h, Math.ceil(maxY));
            const roiWidth = clampedMaxX - clampedMinX, roiHeight = clampedMaxY - clampedMinY;

            processCanvas.width = w; processCanvas.height = h;
            const processCtx = processCanvas.getContext('2d', { willReadFrequently: true });
            if (!processCtx) return;
            processCtx.drawImage(video, 0, 0, w, h);

            let tonguePx = 0, mouthPx = 0;
            const mouthMaskCanvas = document.createElement('canvas');
            mouthMaskCanvas.width = w; mouthMaskCanvas.height = h;
            const maskCtx = mouthMaskCanvas.getContext('2d');

            if(maskCtx) {
                maskCtx.beginPath();
                maskCtx.moveTo(innerLipPoints[0].x, innerLipPoints[0].y);
                for (let i = 1; i < innerLipPoints.length; i++) maskCtx.lineTo(innerLipPoints[i].x, innerLipPoints[i].y);
                maskCtx.closePath();
                maskCtx.fill();
            }

            if (roiWidth > 0 && roiHeight > 0) {
                const roiImageData = processCtx.getImageData(clampedMinX, clampedMinY, roiWidth, roiHeight);
                for (let y = clampedMinY; y < clampedMaxY; y++) {
                    for (let x = clampedMinX; x < clampedMaxX; x++) {
                        if (maskCtx?.isPointInPath(x, y)) {
                            mouthPx++;
                            const i = ((y - clampedMinY) * roiWidth + (x - clampedMinX)) * 4;
                            const r = roiImageData.data[i], g = roiImageData.data[i+1], b = roiImageData.data[i+2];
                            const [hsvH, hsvS, hsvV] = rgbToHsv(r, g, b);
                            const isRed = (hsvH >= 0 && hsvH <= 12) || (hsvH >= 340 && hsvH <= 360);
                            if (isRed && hsvS > 40 && hsvV > 50) tonguePx++;
                        }
                    }
                }
            }
            
            frac = tonguePx / Math.max(1, mouthPx);
            openPx = Math.abs(landmarks[14].y * h - landmarks[13].y * h);
            isTongueOut = (openPx >= minOpenPx) && (frac >= fracThreshold);
        }
        
        drawOverlay(landmarks, overlayCtx, overlayCanvas.width, overlayCanvas.height, isTongueOut, openPx, frac);
      }
      setTongueOut(isTongueOut);
    }
    animationFrameId.current = requestAnimationFrame(predictWebcam);
  }, []);

  useEffect(() => {
    let isMounted = true;
    overlayCanvasRef.current = document.createElement('canvas');
    processCanvasRef.current = document.createElement('canvas');

    const createFaceLandmarker = async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
      const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numFaces: 1
      });
      
      if (isMounted) {
        faceLandmarkerRef.current = landmarker;
        await startWebcam();
      }
    };

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        const videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.srcObject = stream;
        
        if (isMounted) {
          videoRef.current = videoElement;
          videoElement.onloadedmetadata = () => {
            setIsWebcamReady(true);
            predictWebcam();
          };
        }
      } catch (err) { console.error("Error accessing webcam:", err); }
    };
    
    createFaceLandmarker();
    
    return () => {
      isMounted = false;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      faceLandmarkerRef.current?.close();
    };
  }, [predictWebcam]);

  const drawOverlay = (landmarks: NormalizedLandmark[], ctx: CanvasRenderingContext2D, width: number, height: number, isDetected: boolean, open: number, frac: number) => {
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    const relevantLandmarks = INNER_LIP_LANDMARKS.map(index => landmarks[index]);
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (const mark of relevantLandmarks) {
        minX = Math.min(minX, mark.x * width); maxX = Math.max(maxX, mark.x * width);
        minY = Math.min(minY, mark.y * height); maxY = Math.max(maxY, mark.y * height);
    }
    ctx.strokeStyle = isDetected ? '#22c55e' : '#facc15';
    ctx.lineWidth = 2;
    const padding = 5;
    ctx.strokeRect(minX - padding, minY - padding, (maxX - minX) + padding * 2, (maxY - minY) + padding * 2);

    ctx.restore();
    const txt = `tongue=${isDetected}  frac=${frac.toFixed(2)}  open=${open.toFixed(0)}px`;
    ctx.font = '18px Arial';
    ctx.fillStyle = 'white';
    const textWidth = ctx.measureText(txt).width;
    ctx.fillText(txt, width - textWidth - 10, 25);
  };
  
  const consumeRisingEdge = (): boolean => {
    if (tongueOut && !lastState.current) {
      lastState.current = true;
      return true;
    }
    if (!tongueOut) {
      lastState.current = false;
    }
    return false;
  };

  return { consumeRisingEdge, videoRef, overlayCanvasRef, isWebcamReady, tongueOut };
};
