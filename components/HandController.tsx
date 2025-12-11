import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { useGameStore } from '../store';

const HandController: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const setBirdX = useGameStore((state) => state.setBirdX);
  const setBirdY = useGameStore((state) => state.setBirdY);
  const setIsFist = useGameStore((state) => state.setIsFist);
  const setHandDetected = useGameStore((state) => state.setHandDetected);
  const setCameraPermission = useGameStore((state) => state.setCameraPermission);

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        setLoaded(true);
        startWebcam();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
      }
    };

    const startWebcam = async () => {
      if (!videoRef.current) return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictWebcam);
        setCameraPermission(true);
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setCameraPermission(false);
      }
    };

    let lastVideoTime = -1;
    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current) return;
      
      const startTimeMs = performance.now();
      
      if (videoRef.current.currentTime !== lastVideoTime) {
        lastVideoTime = videoRef.current.currentTime;
        const detections = handLandmarker.detectForVideo(videoRef.current, startTimeMs);
        
        if (detections.landmarks && detections.landmarks.length > 0) {
          setHandDetected(true);
          const landmarks = detections.landmarks[0];
          
          // Movement Logic (Middle Finger Knuckle - Point 9)
          const mcp = landmarks[9]; 
          
          // X Mapping: 0.5 center. Range 0-1.
          const rawX = mcp.x;
          // Invert X because of mirror effect, and scale for sensitivity
          const targetX = (0.5 - rawX) * 2.5; 
          
          // Y Mapping: 0 top, 1 bottom.
          const rawY = mcp.y;
          // Invert Y so up is positive in 3D space
          const targetY = (0.5 - rawY) * 3.0;

          setBirdX(Math.max(-1, Math.min(1, targetX)));
          setBirdY(Math.max(-1, Math.min(1, targetY)));

          // Fist Detection Logic
          // Check if finger tips are close to wrist (landmark 0)
          // Tips: 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
          // Wrist: 0
          
          const wrist = landmarks[0];
          
          const getDist = (idx: number) => {
            const dx = landmarks[idx].x - wrist.x;
            const dy = landmarks[idx].y - wrist.y;
            return Math.sqrt(dx*dx + dy*dy);
          };

          const tips = [8, 12, 16, 20];
          const tipDistances = tips.map(getDist);
          const avgTipDist = tipDistances.reduce((a, b) => a + b, 0) / 4;
          
          // PIP joints (knuckles in middle of finger): 6, 10, 14, 18
          const pips = [6, 10, 14, 18];
          const pipDistances = pips.map(getDist);
          const avgPipDist = pipDistances.reduce((a, b) => a + b, 0) / 4;

          // If tips are closer to wrist than PIPs, fingers are curled
          const isFistDetected = avgTipDist < avgPipDist * 0.9; // 0.9 tolerance
          
          setIsFist(isFistDetected);

        } else {
          setHandDetected(false);
          setIsFist(false);
        }
      }
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setupMediaPipe();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      cancelAnimationFrame(animationFrameId);
      if (handLandmarker) handLandmarker.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute top-4 right-4 z-50 w-32 h-24 bg-black/50 border border-blue-500/30 rounded-lg overflow-hidden backdrop-blur-sm hidden md:block">
      <video
        ref={videoRef}
        className="w-full h-full object-cover transform -scale-x-100" // Mirror the video for user feedback
        autoPlay
        playsInline
        muted
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-blue-200">
          Loading...
        </div>
      )}
    </div>
  );
};

export default HandController;