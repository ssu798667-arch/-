
import { create } from 'zustand';
import { GameStatus, GameState, DangerStatus, GamePhase } from './types';

export const useGameStore = create<GameState>((set, get) => ({
  status: GameStatus.MENU,
  dangerStatus: DangerStatus.SAFE,
  phase: GamePhase.CORRIDOR,
  score: 0,
  birdCount: 16,
  
  birdX: 0,
  birdY: 0,
  
  cameraPermissionGranted: false,
  handDetected: false,
  isFist: false,

  lastHitTime: 0,
  dangerTimer: 0,

  setStatus: (status) => set({ status }),
  
  setBirdX: (x) => set({ birdX: x }),
  setBirdY: (y) => set({ birdY: y }),
  setIsFist: (isFist) => set({ isFist }),
  
  incrementScore: (amount) => set((state) => {
    const newScore = state.score + amount;
    let newPhase = state.phase;
    let newStatus = state.status;
    
    // Transition to High Altitude map after 300m
    if (newScore > 300 && state.phase === GamePhase.CORRIDOR) {
      newPhase = GamePhase.HIGH_ALTITUDE;
    }

    // Win Condition at 800m
    if (newScore >= 800 && state.status !== GameStatus.GAME_WON) {
      newStatus = GameStatus.GAME_WON;
    }

    return { 
      score: newScore,
      phase: newPhase,
      status: newStatus
    };
  }),
  
  triggerDanger: () => set((state) => {
    const now = Date.now();
    // Cooldown check (cannot trigger if already in warning or recently hit)
    if (state.dangerStatus === DangerStatus.WARNING || now - state.lastHitTime < 2000) {
      return {};
    }
    return {
      dangerStatus: DangerStatus.WARNING,
      dangerTimer: 3000, // 3 seconds to rescue
      lastHitTime: now
    };
  }),

  resolveDanger: (success) => set((state) => {
    if (state.dangerStatus !== DangerStatus.WARNING) return {};

    let newCount = state.birdCount;
    if (!success) {
      newCount = Math.max(0, state.birdCount - 1); // Lose 1 bird on failure
    }

    const newStatus = newCount <= 0 ? GameStatus.GAME_OVER : state.status;
    const newDanger = DangerStatus.SAFE;

    return {
      birdCount: newCount,
      status: newStatus,
      dangerStatus: newDanger,
      lastHitTime: Date.now() // Reset cooldown
    };
  }),

  tickDangerTimer: (deltaMs) => set((state) => {
    if (state.dangerStatus !== DangerStatus.WARNING) return {};
    
    const newTime = state.dangerTimer - deltaMs;
    if (newTime <= 0) {
      // Timer expired, trigger failure
      // We need to call logic similar to resolveDanger(false)
      // Since we are inside set(), we replicate the logic:
      const newCount = Math.max(0, state.birdCount - 1);
      return {
        dangerTimer: 0,
        dangerStatus: DangerStatus.SAFE,
        birdCount: newCount,
        status: newCount <= 0 ? GameStatus.GAME_OVER : state.status,
        lastHitTime: Date.now()
      };
    }
    return { dangerTimer: newTime };
  }),
  
  resetGame: () => set({
    status: GameStatus.PLAYING,
    dangerStatus: DangerStatus.SAFE,
    phase: GamePhase.CORRIDOR,
    score: 0,
    birdCount: 16,
    birdX: 0,
    birdY: 0,
    lastHitTime: 0,
    dangerTimer: 0
  }),

  setCameraPermission: (granted) => set({ cameraPermissionGranted: granted }),
  setHandDetected: (detected) => set({ handDetected: detected }),
}));
