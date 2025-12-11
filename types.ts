
export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  GAME_WON = 'GAME_WON'
}

export enum DangerStatus {
  SAFE = 'SAFE',
  WARNING = 'WARNING', // Hit obstacle, 3s to recover
}

export enum GamePhase {
  CORRIDOR = 'CORRIDOR',        // Phase 1: Flying between buildings
  HIGH_ALTITUDE = 'HIGH_ALTITUDE' // Phase 2: Flying over the city
}

export interface GameState {
  status: GameStatus;
  dangerStatus: DangerStatus;
  phase: GamePhase;
  score: number;
  birdCount: number;
  
  // Positioning
  birdX: number; // Horizontal -1 to 1
  birdY: number; // Vertical -1 to 1
  
  // Inputs
  cameraPermissionGranted: boolean;
  handDetected: boolean;
  isFist: boolean; // Gesture detection

  // Collision Logic
  lastHitTime: number; 
  dangerTimer: number; // 0 to 3000 ms

  // Actions
  setStatus: (status: GameStatus) => void;
  setBirdX: (x: number) => void;
  setBirdY: (y: number) => void;
  setIsFist: (isFist: boolean) => void;
  
  incrementScore: (amount: number) => void;
  
  // Gameplay Events
  triggerDanger: () => void;
  resolveDanger: (success: boolean) => void;
  tickDangerTimer: (deltaMs: number) => void;

  resetGame: () => void;
  
  setCameraPermission: (granted: boolean) => void;
  setHandDetected: (detected: boolean) => void;
}
