
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { PerspectiveCamera, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useGameStore } from '../store';
import { GameStatus, DangerStatus, GamePhase } from '../types';

// --- Constants ---
const ROAD_WIDTH = 10;
const SPEED = 40;
const NUM_BUILDINGS = 160;
const BUILDING_RANGE = 300;
const FLOCK_COUNT = 16;
// Phase 1 Laser Config - Increased Density
const LASER_SPAWN_INTERVAL_MIN_P1 = 300; 
const LASER_SPAWN_INTERVAL_MAX_P1 = 600;
// Phase 2 Laser Config - Increased Density
const LASER_SPAWN_INTERVAL_MIN_P2 = 400;
const LASER_SPAWN_INTERVAL_MAX_P2 = 700;

const LASER_SPEED = 60;

// --- Custom Bird Shader Material ---
const BirdMaterial = shaderMaterial(
  {
    time: 0,
    color: new THREE.Color(0xffffff),
  },
  // Vertex Shader
  `
    uniform float time;
    attribute float aRandom;
    varying vec2 vUv;
    varying float vOffset;
    
    void main() {
      vUv = uv;
      vOffset = aRandom;
      vec3 pos = position;
      
      // Flapping Animation
      float flapSpeed = 12.0 + aRandom * 2.0;
      float flapAmp = 0.5;
      float wing = abs(pos.x); 
      float flap = sin(time * flapSpeed + aRandom * 5.0) * wing * flapAmp;
      
      pos.y += flap;
      pos.y += sin(time * flapSpeed * 0.5) * 0.1;

      vec4 modelViewPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * modelViewPosition;
    }
  `,
  // Fragment Shader
  `
    uniform vec3 color;
    varying vec2 vUv;
    
    void main() {
      float alpha = 1.0;
      vec3 finalColor = color + vec3(0.2 * (1.0 - abs(vUv.x - 0.5) * 2.0));
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
);

// --- Custom Particle Shader Material ---
const ParticleMaterial = shaderMaterial(
  {
    time: 0,
    speed: SPEED,
  },
  // Vertex Shader
  `
    uniform float time;
    uniform float speed;
    attribute float aSpeed;
    attribute float aSize;
    attribute vec3 aColor;
    varying vec3 vColor;
    
    void main() {
      vColor = aColor;
      vec3 pos = position;
      
      // Endless loop simulation moving +Z (towards camera) relative to world origin logic
      // Actually standard logic here: Camera is fixed, world moves +Z. 
      // So particles should also move +Z.
      
      float zRange = 400.0;
      // Offset time by random start pos.z effectively? 
      // We take initial pos.z, add speed*time, then modulo.
      
      float zCurrent = mod(pos.z + (speed + aSpeed) * time, zRange);
      pos.z = zCurrent - 200.0; // Keep them centered around the scene depth
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      
      // Size attenuation
      gl_PointSize = aSize * (80.0 / -mvPosition.z);
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment Shader
  `
    varying vec3 vColor;
    void main() {
      // Soft circular particle
      vec2 coord = gl_PointCoord - vec2(0.5);
      float r = length(coord) * 2.0;
      if (r > 1.0) discard;
      
      float glow = 1.0 - pow(r, 1.5);
      gl_FragColor = vec4(vColor, glow);
    }
  `
);

extend({ BirdMaterial, ParticleMaterial });

// --- Camera Controller ---
const CameraRig: React.FC = () => {
  const { phase } = useGameStore();
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 5, 15));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, -50));
  
  useFrame((state, delta) => {
    if (phase === GamePhase.CORRIDOR) {
      targetPos.current.set(0, 5, 15);
      targetLookAt.current.set(0, 0, -50);
    } else {
      // High Altitude Mode: Higher up, looking steeper down
      targetPos.current.set(0, 40, 20);
      targetLookAt.current.set(0, -20, -60);
    }

    // Smooth Interpolation
    camera.position.lerp(targetPos.current, 1.5 * delta);
    
    const currentLook = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    currentLook.lerp(targetLookAt.current, 1.5 * delta);
    camera.lookAt(currentLook);
  });
  
  return null;
};

// --- Atmosphere Particles ---
const AtmosphereParticles: React.FC = () => {
  const count = 1000;
  // @ts-ignore
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, colors, sizes, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const spd = new Float32Array(count);

    const palette = [
      new THREE.Color('#0ea5e9'), // Sky Blue
      new THREE.Color('#22d3ee'), // Cyan
      new THREE.Color('#818cf8'), // Indigo
      new THREE.Color('#ffffff'), // White
    ];

    for (let i = 0; i < count; i++) {
      // Spread wide X and Y, deep Z
      pos[i * 3] = (Math.random() - 0.5) * 100;     // x
      pos[i * 3 + 1] = (Math.random() - 0.5) * 80;  // y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 400; // z initial
      
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      
      siz[i] = Math.random() * 3.0 + 1.0;
      spd[i] = Math.random() * 20.0;
    }

    return { positions: pos, colors: col, sizes: siz, speeds: spd };
  }, []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aColor" count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-aSpeed" count={count} array={speeds} itemSize={1} />
      </bufferGeometry>
      {/* @ts-ignore */}
      <particleMaterial 
        ref={materialRef} 
        transparent 
        depthWrite={false} 
        blending={THREE.AdditiveBlending} 
      />
    </points>
  );
};

// --- City Component (Phase 1 Buildings) ---
const City: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { phase } = useGameStore();
  
  const { instances, colors } = useMemo(() => {
    const tempInstances = [];
    const tempColors = new Float32Array(NUM_BUILDINGS * 3);
    const baseColors = [
      new THREE.Color('#0f172a'),
      new THREE.Color('#172554'), 
      new THREE.Color('#1e1b4b'), 
    ];

    for (let i = 0; i < NUM_BUILDINGS; i++) {
      const x = (Math.random() > 0.5 ? 1 : -1) * (ROAD_WIDTH + 5 + Math.random() * 60);
      const z = -BUILDING_RANGE + Math.random() * BUILDING_RANGE * 2;
      const y = -20; 
      const height = 40 + Math.random() * 80;
      const width = 8 + Math.random() * 10;
      const depth = 8 + Math.random() * 10;
      
      tempInstances.push({ position: [x, y + height / 2, z], scale: [width, height, depth] });
      
      const color = baseColors[Math.floor(Math.random() * baseColors.length)].clone();
      if (Math.random() > 0.7) {
        const neon = Math.random() > 0.5 ? new THREE.Color('#06b6d4') : new THREE.Color('#8b5cf6');
        color.lerp(neon, 0.3);
      }
      
      tempColors[i * 3] = color.r;
      tempColors[i * 3 + 1] = color.g;
      tempColors[i * 3 + 2] = color.b;
    }
    return { instances: tempInstances, colors: tempColors };
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    
    instances.forEach((data, i) => {
      dummy.position.set(data.position[0] as number, data.position[1] as number, data.position[2] as number);
      dummy.scale.set(data.scale[0] as number, data.scale[1] as number, data.scale[2] as number);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    if (meshRef.current.instanceColor) {
      for (let i = 0; i < NUM_BUILDINGS; i++) {
        meshRef.current.setColorAt(i, new THREE.Color(colors[i*3], colors[i*3+1], colors[i*3+2]));
      }
      meshRef.current.instanceColor.needsUpdate = true;
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [instances, colors]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let i = 0; i < NUM_BUILDINGS; i++) {
      meshRef.current.getMatrixAt(i, matrix);
      matrix.decompose(position, quaternion, scale);
      
      position.z += SPEED * delta;

      if (position.z > 50) {
        position.z -= BUILDING_RANGE * 2;
      }

      dummy.position.copy(position);
      dummy.quaternion.copy(quaternion);
      dummy.scale.copy(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, NUM_BUILDINGS]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial 
        roughness={0.2} 
        metalness={0.8}
        emissive="#1e3a8a"
        emissiveIntensity={0.5}
        transparent
        opacity={phase === GamePhase.HIGH_ALTITUDE ? 0.3 : 1.0} 
      />
    </instancedMesh>
  );
};

// --- City Floor (Dense Top-Down Lights for Phase 2) ---
const CityFloor: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { phase } = useGameStore();
  const COUNT = 3000;
  const RANGE = 250;

  const { instances, colors } = useMemo(() => {
    const tempInstances = [];
    const tempColors = new Float32Array(COUNT * 3);
    
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * RANGE;
      const z = (Math.random() - 0.5) * RANGE;
      const h = 0.5;
      const w = 0.5 + Math.random() * 2; 
      
      // Lay them flat on the ground (-50) to act as street grid lights
      tempInstances.push({ position: [x, -50, z], scale: [w, h, w] }); 
      
      // Colors: Strictly Warm City Lights (Gold, Amber, Orange)
      // HSL: Hue ~0.08 (Orange) to 0.14 (Yellow)
      const hue = 0.05 + Math.random() * 0.09;
      const sat = 0.8 + Math.random() * 0.2;
      const light = 0.5 + Math.random() * 0.5;
      
      const color = new THREE.Color().setHSL(hue, sat, light);
      
      tempColors[i * 3] = color.r;
      tempColors[i * 3 + 1] = color.g;
      tempColors[i * 3 + 2] = color.b;
    }
    return { instances: tempInstances, colors: tempColors };
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    
    instances.forEach((data, i) => {
      dummy.position.set(data.position[0] as number, data.position[1] as number, data.position[2] as number);
      dummy.scale.set(data.scale[0] as number, data.scale[1] as number, data.scale[2] as number);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    if (meshRef.current.instanceColor) {
        for (let i = 0; i < COUNT; i++) {
          meshRef.current.setColorAt(i, new THREE.Color(colors[i*3], colors[i*3+1], colors[i*3+2]));
        }
        meshRef.current.instanceColor.needsUpdate = true;
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [instances, colors]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let i = 0; i < COUNT; i++) {
      meshRef.current.getMatrixAt(i, matrix);
      matrix.decompose(position, quaternion, scale);
      
      position.z += SPEED * delta;
      if (position.z > 50) position.z -= RANGE; 

      dummy.position.copy(position);
      dummy.quaternion.copy(quaternion);
      dummy.scale.copy(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Hide in Phase 1 (Corridor) to preserve original background
  if (phase === GamePhase.CORRIDOR) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial 
        vertexColors
        toneMapped={false}
      />
    </instancedMesh>
  );
};

// --- Flock Component (Birds) ---
const Flock: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  // @ts-ignore
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const birdX = useGameStore((state) => state.birdX);
  const birdY = useGameStore((state) => state.birdY);
  const isFist = useGameStore((state) => state.isFist);
  const birdCount = useGameStore((state) => state.birdCount);
  const dangerStatus = useGameStore((state) => state.dangerStatus);
  const resolveDanger = useGameStore((state) => state.resolveDanger);
  
  const targetPos = useRef(new THREE.Vector2(0, 0));
  const currentSpread = useRef(1.5); 
  
  // Handle recovery gesture
  useEffect(() => {
    if (dangerStatus === DangerStatus.WARNING && isFist) {
      resolveDanger(true);
    }
  }, [dangerStatus, isFist, resolveDanger]);

  const birdGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2, 1, 8, 4); 
    geo.rotateX(-Math.PI / 2); 
    geo.rotateY(Math.PI); 
    return geo;
  }, []);

  const randomAttributes = useMemo(() => {
    const randoms = new Float32Array(FLOCK_COUNT);
    for (let i = 0; i < FLOCK_COUNT; i++) {
      randoms[i] = Math.random();
    }
    return randoms;
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    if (materialRef.current) {
        materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }

    const SCENE_WIDTH = 20;
    const SCENE_HEIGHT = 12;
    const desiredX = birdX * SCENE_WIDTH;
    const desiredY = birdY * SCENE_HEIGHT + 5; 

    // Smooth follow
    const followSpeed = dangerStatus === DangerStatus.WARNING ? 1 : 5;
    targetPos.current.x += (desiredX - targetPos.current.x) * followSpeed * delta;
    targetPos.current.y += (desiredY - targetPos.current.y) * followSpeed * delta;

    // Spread Control
    const targetSpread = isFist ? 0.4 : 1.5;
    currentSpread.current += (targetSpread - currentSpread.current) * 3 * delta;

    const dummy = new THREE.Object3D();
    const spreadX = currentSpread.current;
    const spreadZ = currentSpread.current * 0.8;
    
    // Warning Flicker
    const isWarning = dangerStatus === DangerStatus.WARNING;
    const warningPulse = isWarning ? Math.sin(state.clock.elapsedTime * 20) : 0;

    for (let i = 0; i < FLOCK_COUNT; i++) {
      // Visibility Check
      if (i >= birdCount) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        continue;
      }

      let offsetX = 0;
      let offsetZ = 0;
      
      if (i > 0) {
        const row = Math.floor((i + 1) / 2);
        const side = i % 2 === 0 ? 1 : -1;
        offsetX = side * row * spreadX;
        offsetZ = row * spreadZ;
      }

      // Normal Banking
      const bankAngle = -(birdX * 0.5);
      const pitchAngle = (birdY * 0.5);
      
      let posX = targetPos.current.x + offsetX;
      let posY = targetPos.current.y;
      let posZ = 0 + offsetZ;
      
      // Scatter logic during warning
      if (isWarning) {
          const noiseX = Math.sin(state.clock.elapsedTime * 10 + i * 123) * 3;
          const noiseY = Math.cos(state.clock.elapsedTime * 12 + i * 321) * 3;
          posX += noiseX;
          posY += noiseY;
          dummy.rotation.set(pitchAngle + noiseX*0.1, noiseY*0.1, bankAngle + noiseX*0.1);
      } else {
          // Normal flight noise
          const noise = Math.sin(state.clock.elapsedTime * 2 + i) * (spreadX * 0.1);
          posX += noise;
          posZ += noise;
          dummy.rotation.set(pitchAngle, 0, bankAngle);
      }
      
      dummy.position.set(posX, posY, posZ);
      
      // Scale pulse
      if (isWarning && warningPulse > 0) {
         dummy.scale.setScalar(0.8);
      } else {
         dummy.scale.setScalar(1);
      }

      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[birdGeo, undefined, FLOCK_COUNT]}>
      {/* @ts-ignore */}
      <birdMaterial ref={materialRef} transparent side={THREE.DoubleSide} />
      <instancedBufferAttribute attach="geometry-attributes-aRandom" args={[randomAttributes, 1]} />
    </instancedMesh>
  );
};

// --- Refined Laser Beam (Yellow-White, Cleaner, No Messy Rays) ---
const LaserBeamVisual: React.FC<{ length: number, side: number, angle: number }> = ({ length, side, angle }) => {
  return (
    <group rotation={[0, side === 1 ? Math.PI : 0, angle]}> 
        {/* Source Glow - Bright White Core - No Depth Test to shine through buildings */}
        <mesh position={[0, 0, 0]}>
             <sphereGeometry args={[2.0, 16, 16]} />
             <meshBasicMaterial 
                color="#ffffff" 
                transparent 
                opacity={0.8} 
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                depthTest={false} 
             />
        </mesh>
        
        {/* Main Solid Beam - Sharp, Yellow-White */}
        <mesh position={[length/2, 0, 0]}>
            <boxGeometry args={[length, 0.3, 0.3]} />
            <meshBasicMaterial color="#fefce8" transparent opacity={1.0} blending={THREE.AdditiveBlending} />
        </mesh>

        {/* Outer Glow Beam - Soft Yellow - No Depth Test */}
        <mesh position={[length/2, 0, 0]}>
            <boxGeometry args={[length, 2.0, 2.0]} />
            <meshBasicMaterial 
              color="#fcd34d" 
              transparent 
              opacity={0.15} 
              blending={THREE.AdditiveBlending} 
              depthWrite={false}
              depthTest={false}
            />
        </mesh>
        
        {/* Secondary Inner Glow for intensity */}
        <mesh position={[length/2, 0, 0]}>
             <boxGeometry args={[length, 0.8, 0.8]} />
             <meshBasicMaterial color="#fef08a" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
    </group>
  );
};

// --- Pillar Visual Component (Phase 2) ---
const PillarVisual: React.FC<{ height: number }> = ({ height }) => {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.3; // Slow rotation
    }
  });

  return (
    <group>
        <group ref={meshRef} rotation={[0, 0, -Math.PI / 2]} position={[height / 2, 0, 0]}>
            {/* Core Cylinder */}
            <mesh>
                <cylinderGeometry args={[1.5, 1.5, height, 12, 1]} />
                <meshStandardMaterial
                    color="#fefce8" 
                    emissive="#fde047" 
                    emissiveIntensity={2.0}
                    transparent
                    opacity={0.9}
                    toneMapped={false}
                />
            </mesh>
            {/* Halo Cylinder - No Depth Test for visibility */}
             <mesh>
                 <cylinderGeometry args={[3, 3, height, 12, 1]} />
                 <meshBasicMaterial 
                    color="#fef08a" 
                    transparent 
                    opacity={0.15} 
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    depthTest={false}
                    side={THREE.DoubleSide}
                 />
            </mesh>
        </group>
         {/* Base Launch Glow - No Depth Test */}
         <mesh position={[0, 0, 0]}>
             <sphereGeometry args={[5, 16, 16]} />
             <meshBasicMaterial 
                color="#fef08a" 
                transparent 
                opacity={0.6} 
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                depthTest={false}
             />
        </mesh>
    </group>
  );
};

interface Laser {
    id: number;
    z: number;
    x: number; 
    y: number;
    width: number;
    side: number;
    angle: number; 
    type: 'beam' | 'pillar';
}

const ObstacleManager: React.FC = () => {
  const [lasers, setLasers] = useState<Laser[]>([]);
  const lastSpawnTime = useRef(0);
  const nextSpawnInterval = useRef(1000);
  
  const { 
    status, birdX, birdY, incrementScore, 
    triggerDanger, tickDangerTimer, isFist, phase 
  } = useGameStore();

  useFrame((state, delta) => {
    if (status !== GameStatus.PLAYING) return;

    tickDangerTimer(delta * 1000);

    const time = state.clock.elapsedTime * 1000;

    // 1. Spawn Lasers
    if (time - lastSpawnTime.current > nextSpawnInterval.current) {
      lastSpawnTime.current = time;
      
      const isPhase1 = phase === GamePhase.CORRIDOR;

      // Adjust density based on phase
      const minInterval = isPhase1 ? LASER_SPAWN_INTERVAL_MIN_P1 : LASER_SPAWN_INTERVAL_MIN_P2;
      const maxInterval = isPhase1 ? LASER_SPAWN_INTERVAL_MAX_P1 : LASER_SPAWN_INTERVAL_MAX_P2;
      nextSpawnInterval.current = minInterval + Math.random() * (maxInterval - minInterval);
      
      let originX, spawnY, angle, side, beamLength, type: 'beam' | 'pillar';

      if (isPhase1) {
        // CORRIDOR: Angled beams from sides
        originX = (Math.random() - 0.5) * 30; 
        spawnY = -5 + Math.random() * 20;
        side = Math.random() > 0.5 ? 1 : -1;
        angle = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 4); // 45 degrees
        beamLength = 40 + Math.random() * 10;
        type = 'beam';
      } else {
        // HIGH ALTITUDE: Upward Pillars from city below
        originX = (Math.random() - 0.5) * 60; // Wider spread
        spawnY = -50; // Start deep below on the ground map
        
        // IMPORTANT for Collision: 
        // side=-1 (Left/Standard Vector Base (1,0)) + angle=PI/2 => Direction = (0, 1) = UP
        side = -1; 
        angle = Math.PI / 2; // Vertical Up
        beamLength = 120; // Very tall to reach flight path
        type = 'pillar';
      }

      setLasers(prev => [
        ...prev, 
        { 
          id: Math.random(), 
          z: -200, 
          x: originX,
          y: spawnY,
          width: beamLength,
          side: side,
          angle: angle,
          type: type
        }
      ]);
    }

    // 2. Update Lasers & Detect Collision (OBB Logic)
    setLasers(prev => {
      const nextLasers = [];
      const SCENE_WIDTH = 20;
      const SCENE_HEIGHT = 12;
      const currentBirdX = birdX * SCENE_WIDTH;
      const currentBirdY = birdY * SCENE_HEIGHT + 5;

      const flockRadius = isFist ? 1.0 : 4.0; 

      for (const laser of prev) {
        const newZ = laser.z + LASER_SPEED * delta;
        
        // Z Proximity Check
        const dz = Math.abs(newZ - 0); 
        
        if (dz < 3.0) { 
           const dirBaseX = laser.side === 1 ? -1 : 1;
           const dirBaseY = 0;
           
           const cosA = Math.cos(laser.angle);
           const sinA = Math.sin(laser.angle);
           
           const dirX = dirBaseX * cosA - dirBaseY * sinA;
           const dirY = dirBaseX * sinA + dirBaseY * cosA;
           
           const dx = currentBirdX - laser.x;
           const dy = currentBirdY - laser.y;
           
           const t = dx * dirX + dy * dirY;
           
           let closestX = laser.x + t * dirX;
           let closestY = laser.y + t * dirY;
           
           // Clamp to segment
           if (t < 0) {
               closestX = laser.x;
               closestY = laser.y;
           } else if (t > laser.width) {
               closestX = laser.x + laser.width * dirX;
               closestY = laser.y + laser.width * dirY;
           }
           
           const distSq = (currentBirdX - closestX)**2 + (currentBirdY - closestY)**2;
           // Collision Threshold
           // Increase Pillar radius for easier triggering of the mechanics
           const visualRadius = laser.type === 'pillar' ? 5.0 : 0.8; 
           const threshold = (visualRadius + flockRadius);
           
           if (distSq < threshold * threshold) {
               triggerDanger();
           }
        }

        if (newZ > 20) {
            incrementScore(10);
        } else {
            nextLasers.push({ ...laser, z: newZ });
        }
      }
      return nextLasers;
    });
  });

  return (
    <group>
      {lasers.map(laser => (
        <group key={laser.id} position={[laser.x, laser.y, laser.z]} rotation={[0, laser.side === 1 ? Math.PI : 0, laser.angle]}>
             {laser.type === 'pillar' ? (
                 <PillarVisual height={laser.width} />
             ) : (
                 <LaserBeamVisual length={laser.width} side={1} angle={0} /> 
             )}
        </group>
      ))}
    </group>
  );
};


// --- Main Scene ---
const GameScene: React.FC = () => {
  return (
    <div className="w-full h-full absolute inset-0 bg-slate-950">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 5, 15]} fov={60} />
        <CameraRig />

        {/* Environment */}
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 20, 160]} />
        <ambientLight intensity={0.2} />
        
        {/* City Lights - Adjusted to Warm/Cyan mix for atmosphere */}
        <pointLight position={[20, 50, 0]} intensity={1} color="#fbbf24" distance={200} />
        <pointLight position={[-20, 30, -50]} intensity={1} color="#06b6d4" distance={200} />

        {/* Game Objects */}
        <City />
        <CityFloor />
        {/* Removed CityTraffic */}
        <AtmosphereParticles />
        <Flock />
        <ObstacleManager />
        
        {/* The Cyber Path Grid (Phase 1 Ground) */}
        <group position={[0, -10, -40]}>
            <gridHelper args={[100, 40, 0x0ea5e9, 0x1e1b4b]} position={[0, 0.1, 0]} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[60, 200]} />
            <meshStandardMaterial 
                color="#000000" 
                emissive="#0ea5e9" 
                emissiveIntensity={0.1} 
                transparent 
                opacity={0.8} 
            />
            </mesh>
        </group>
        
        {/* Post Processing */}
        <EffectComposer>
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} intensity={1.5} />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default GameScene;
