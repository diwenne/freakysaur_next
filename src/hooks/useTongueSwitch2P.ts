'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver, NormalizedLandmark } from '@mediapipe/tasks-vision';

// Landmark indices for the inner lip contour, used to define the mouth opening.
const INNER_LIP_LANDMARKS = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

// Helper function to convert RGB color to HSV, useful for detecting the tongue's color.
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

const useTongueSwitch2P = () => {
  // State for both players' tongue status.
  const [tongueOutStates, setTongueOutStates] = useState<[boolean, boolean]>([false, false]);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const animationFrameId = useRef<number | null>(null);
  const lastStates = useRef([false, false]);
  
  // Detection thresholds.
  const minOpenPx = 8;
  const fracThreshold = 0.06;

  const processFace = (landmarks: NormalizedLandmark[], video: HTMLVideoElement, processCtx: CanvasRenderingContext2D): { isTongueOut: boolean, openPx: number, frac: number } => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    const innerLipPoints = INNER_LIP_LANDMARKS.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));

    if (innerLipPoints.length < 3) return { isTongueOut: false, openPx: 0, frac: 0 };

    const xs = innerLipPoints.map(p => p.x), ys = innerLipPoints.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    
    const roiWidth = Math.ceil(maxX) - Math.floor(minX);
    const roiHeight = Math.ceil(maxY) - Math.floor(minY);
    
    if (roiWidth <= 0 || roiHeight <= 0) return { isTongueOut: false, openPx: 0, frac: 0 };

    let tonguePx = 0, mouthPx = 0;
    const mouthMaskCanvas = document.createElement('canvas');
    mouthMaskCanvas.width = w; mouthMaskCanvas.height = h;
    const maskCtx = mouthMaskCanvas.getContext('2d');
    if (!maskCtx) return { isTongueOut: false, openPx: 0, frac: 0 };
    
    maskCtx.beginPath();
    maskCtx.moveTo(innerLipPoints[0].x, innerLipPoints[0].y);
    for (let i = 1; i < innerLipPoints.length; i++) maskCtx.lineTo(innerLipPoints[i].x, innerLipPoints[i].y);
    maskCtx.closePath();
    maskCtx.fill();

    const roiImageData = processCtx.getImageData(Math.floor(minX), Math.floor(minY), roiWidth, roiHeight);
    for (let y = 0; y < roiHeight; y++) {
      for (let x = 0; x < roiWidth; x++) {
        if (maskCtx.isPointInPath(Math.floor(minX) + x, Math.floor(minY) + y)) {
          mouthPx++;
          const i = (y * roiWidth + x) * 4;
          const r = roiImageData.data[i], g = roiImageData.data[i+1], b = roiImageData.data[i+2];
          const [hsvH, hsvS, hsvV] = rgbToHsv(r, g, b);
          const isRed = (hsvH >= 0 && hsvH <= 12) || (hsvH >= 340 && hsvH <= 360);
          if (isRed && hsvS > 40 && hsvV > 50) tonguePx++;
        }
      }
    }
            
    const frac = tonguePx / Math.max(1, mouthPx);
    const openPx = Math.abs(landmarks[14].y * h - landmarks[13].y * h);
    const isTongueOut = (openPx >= minOpenPx) && (frac >= fracThreshold);

    return { isTongueOut, openPx, frac };
  };

  const predictWebcam = useCallback(() => {
    if (!videoRef.current || !overlayCanvasRef.current || !processCanvasRef.current || !faceLandmarkerRef.current) {
        animationFrameId.current = requestAnimationFrame(predictWebcam);
        return;
    };
    
    const video = videoRef.current;
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const results = faceLandmarkerRef.current.detectForVideo(video, Date.now());
      
      const overlayCtx = overlayCanvasRef.current.getContext('2d');
      const processCtx = processCanvasRef.current.getContext('2d', { willReadFrequently: true });
      if (!overlayCtx || !processCtx) return;

      overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      processCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      
      let p1Tongue = false, p2Tongue = false;
      
      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        // Sort faces by x-coordinate to assign P1 to left, P2 to right
        results.faceLandmarks.sort((a, b) => a[0].x - b[0].x);

        // Process Player 1 (left face)
        const p1Result = processFace(results.faceLandmarks[0], video, processCtx);
        p1Tongue = p1Result.isTongueOut;
        drawOverlay(results.faceLandmarks[0], overlayCtx, p1Tongue);

        // Process Player 2 (right face), if detected
        if (results.faceLandmarks.length > 1) {
            const p2Result = processFace(results.faceLandmarks[1], video, processCtx);
            p2Tongue = p2Result.isTongueOut;
            drawOverlay(results.faceLandmarks[1], overlayCtx, p2Tongue);
        }
      }

      setTongueOutStates([p1Tongue, p2Tongue]);
      drawStats(overlayCtx, p1Tongue, p2Tongue);
    }
    animationFrameId.current = requestAnimationFrame(predictWebcam);
  }, []);

  useEffect(() => {
    let isMounted = true;
    overlayCanvasRef.current = document.createElement('canvas');
    processCanvasRef.current = document.createElement('canvas');

    const createFaceLandmarker = async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
      // Initialize for 2 faces
      const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numFaces: 2
      });
      
      if (isMounted) faceLandmarkerRef.current = landmarker;
      await startWebcam();
    };

    const startWebcam = async () => {
      if (!isMounted) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        const videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.srcObject = stream;
        
        if (isMounted) {
          videoRef.current = videoElement;
          videoElement.onloadedmetadata = () => {
            if (isMounted) {
                // Set the processing canvas dimensions ONLY after the video metadata has loaded.
                if(processCanvasRef.current) {
                    processCanvasRef.current.width = videoElement.videoWidth;
                    processCanvasRef.current.height = videoElement.videoHeight;
                }
                setIsWebcamReady(true);
                predictWebcam();
            }
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

  const drawOverlay = (landmarks: NormalizedLandmark[], ctx: CanvasRenderingContext2D, isDetected: boolean) => {
    if (!overlayCanvasRef.current) return;
    const { width, height } = overlayCanvasRef.current;
    ctx.save();
    ctx.translate(width, 0); ctx.scale(-1, 1);
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
  };
  
  // Draws the P1/P2 stats text in the top-right corner.
  const drawStats = (ctx: CanvasRenderingContext2D, p1: boolean, p2: boolean) => {
    if (!overlayCanvasRef.current) return;
    const { width } = overlayCanvasRef.current;
    const txt = `P1 Tongue: ${p1}   P2 Tongue: ${p2}`;
    ctx.font = '18px Arial';
    ctx.fillStyle = 'white';
    const textWidth = ctx.measureText(txt).width;
    ctx.fillText(txt, width - textWidth - 10, 25);
  };
  
  const consumeRisingEdge = (playerIndex: 0 | 1): boolean => {
    const isTongueOut = tongueOutStates[playerIndex];
    if (isTongueOut && !lastStates.current[playerIndex]) {
      lastStates.current[playerIndex] = true;
      return true;
    }
    if (!isTongueOut) {
      lastStates.current[playerIndex] = false;
    }
    return false;
  };

  return { consumeRisingEdge, tongueOutStates, videoRef, overlayCanvasRef, isWebcamReady };
};

export default useTongueSwitch2P;

