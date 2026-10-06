import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM, VRMUtils } from '@pixiv/three-vrm';
import { AvatarController, mapMoveToExpression } from '@/services/avatarController';
import { createProceduralTeacher, type ProceduralTeacher } from './proceduralTeacher';
import { globalAudioQueue } from '@/services/audioQueue';
import { BoardSystem } from '@/services/boardSystem';
import { useTutorStore } from '@/store/tutorStore';

export type AvatarDebugData = {
  modelType: string;
  currentState: string;
  vowels: { aa: number; oh: number; ou: number; ee: number; ih: number };
  blink: number;
};

export type AvatarCanvasProps = {
  isListening: boolean;
  isPlayingAudio: boolean;
  audioLevel: number;
  loading: boolean;
  hasInterrupted?: boolean;
  move?: string | null;
  expression?: string | null;
  boardEventCount?: number;
  className?: string;
  onDebugUpdate?: (data: AvatarDebugData) => void;
};

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  isListening,
  isPlayingAudio,
  audioLevel,
  loading,
  hasInterrupted,
  move,
  expression,
  boardEventCount = 0,
  className = '',
  onDebugUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<AvatarController | null>(null);
  const [modelType, setModelType] = useState<'vrm' | 'procedural' | 'loading'>('loading');
  const modelTypeRef = useRef<'vrm' | 'procedural' | 'loading'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    modelTypeRef.current = modelType;
  }, [modelType]);

  // Track props in refs for animation loop
  const propsRef = useRef({
    isListening,
    isPlayingAudio,
    audioLevel,
    loading,
    hasInterrupted,
    move,
    expression,
    boardEventCount,
    onDebugUpdate,
  });

  useEffect(() => {
    propsRef.current = {
      isListening,
      isPlayingAudio,
      audioLevel,
      loading,
      hasInterrupted,
      move,
      expression,
      boardEventCount,
      onDebugUpdate,
    };
  }, [isListening, isPlayingAudio, audioLevel, loading, hasInterrupted, move, expression, boardEventCount, onDebugUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Detect reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const controller = new AvatarController(prefersReducedMotion);
    controllerRef.current = controller;
    

    // 1. Scene Setup
    const scene = new THREE.Scene();
    const boardSystem = new BoardSystem();
    scene.add(boardSystem.mesh);

    
    const studentTarget = new THREE.Object3D();
    studentTarget.position.set(0, 1.35, 1.55); // near camera
    scene.add(studentTarget);

    const boardTarget = new THREE.Object3D();
    boardTarget.position.set(-1.4, 1.6, -1.5);
    scene.add(boardTarget);

    // 2. Camera Setup (Portrait framing upper torso and head)
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 1.35, 1.55);
    camera.lookAt(0, 1.25, 0);

    // 3. Renderer Setup (Capped at pixel ratio 2 per SPEC.md)
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
    } catch (err: any) {
      console.warn('[AvatarCanvas] WebGL context failed:', err);
      setLoadError('WebGL not available');
      return;
    }

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    keyLight.position.set(1.2, 2.5, 2.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.7);
    fillLight.position.set(-1.5, 1.5, 1.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef3c7, 0.5);
    rimLight.position.set(0, 2.0, -1.8);
    scene.add(rimLight);

    // 5. Model Loading (VRM or Fallback Procedural)
    let currentVrm: VRM | null = null;
    let proceduralTeacher: ProceduralTeacher | null = null;
    let isDisposed = false;

    const setupProcedural = () => {
      console.warn('[AvatarCanvas] setupProcedural() is being executed! Stack trace:', new Error().stack);
      if (isDisposed) return;
      proceduralTeacher = createProceduralTeacher();
      scene.add(proceduralTeacher.group);
      camera.position.set(0, 1.25, 1.6);
      camera.lookAt(0, 1.15, 0);
      setModelType('procedural');
    };

    // Load VRM model (with procedural fallback if missing or error)
    const vrmUrl = '/avatars/teacher.vrm';
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      vrmUrl,
      (gltf) => {
        if (isDisposed) return;
        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) {
          console.warn('[AvatarCanvas] No VRM in gltf. Using 3D procedural teacher fallback.');
          setupProcedural();
          return;
        }

        try {
          VRMUtils.combineSkeletons(gltf.scene);
          VRMUtils.rotateVRM0(vrm);
        } catch (e) {
          console.warn('[AvatarCanvas] VRMUtils error (safe to ignore if model looks fine):', e);
        }

        console.log(`[AvatarCanvas] VRM loaded successfully! Version: ${vrm.meta?.metaVersion || 'Unknown'}`);
        currentVrm = vrm;
        scene.add(vrm.scene);

        // Frame camera to VRM head and upper torso
        const headNode = vrm.humanoid?.getNormalizedBoneNode('head');
        if (headNode) {
          const headPos = new THREE.Vector3();
          headNode.getWorldPosition(headPos);
          camera.position.set(0, headPos.y + 0.05, 1.4);
          camera.lookAt(0, headPos.y - 0.05, 0);
        }

        setModelType('vrm');
      },
      undefined,
      (err) => {
        console.warn('[AvatarCanvas] VRM load error. Using 3D procedural teacher fallback:', err);
        setupProcedural();
      }
    );

    // 6. Resize Observer
    const handleResize = () => {
      if (!container || !renderer) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    // 7. Animation Loop
    let lastTime = performance.now();
    let prevBoardCount = propsRef.current.boardEventCount;
    let animFrameId: number;
    let frameCount = 0;

    const freqData = new Uint8Array(32);

    const animate = (currentTime: number) => {
      animFrameId = requestAnimationFrame(animate);

      const delta = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      const p = propsRef.current;

      // Check board pointing trigger
      if (p.boardEventCount > prevBoardCount) {
        controller.triggerBoardPoint(2.5);
        prevBoardCount = p.boardEventCount;
      }

      // Check interruption
      if (p.hasInterrupted) {
        controller.handleInterruption();
        useTutorStore.getState().board.forEach(e => e.isComplete = true); // Clear board queue
      } else if (p.isPlayingAudio) {
        controller.setState('speaking');
      } else if (p.isListening) {
        controller.setState('listening');
      } else if (p.loading) {
        controller.setState('thinking');
      } else if (controller.getState() !== 'pointing_board') {
        controller.setState('idle');
      }

      // Update expression from meta move or explicit expression
      if (p.expression) {
        controller.setExpression(p.expression as any);
      } else if (p.move) {
        controller.setExpression(mapMoveToExpression(p.move));
      }

      // Read audio frequency data for formant-driven lip sync
      const analyser = globalAudioQueue.getAnalyser();
      if (analyser && p.isPlayingAudio) {
        analyser.getByteFrequencyData(freqData);
      }

      // Update board system
      const boardEvents = useTutorStore.getState().board;
      boardSystem.update(delta, boardEvents);
      
      // Update attention state
      if (boardSystem.isWriting) {
         if (controller.attention === 'STUDENT_FACING' || controller.attention === 'RETURN_TO_STUDENT') {
            controller.setAttention('BOARD_TRANSITION');
         }
      } else {
         if (controller.attention === 'BOARD_WRITING' || controller.attention === 'BOARD_POINTING') {
            controller.setAttention('RETURN_TO_STUDENT');
         }
      }
      
      // Update state machine
      const anim = controller.update(delta, p.audioLevel, freqData);

      frameCount++;
      if (frameCount % 6 === 0 && p.onDebugUpdate) {
        p.onDebugUpdate({
          modelType: modelTypeRef.current,
          currentState: controller.getState(),
          vowels: { ...anim.lipSync },
          blink: anim.blink,
        });
      }

      // Apply to 3D Character
      if (currentVrm) {
        // Handle teacher body movement
        currentVrm.scene.position.x = anim.rootPositionX;
        currentVrm.scene.position.z = anim.rootPositionZ;
        currentVrm.scene.rotation.y = anim.rootRotationY;

        // Explicitly control VRM native LookAt
        if (currentVrm.lookAt) {
          if (controller.attention === 'STUDENT_FACING' || controller.attention === 'RETURN_TO_STUDENT') {
             currentVrm.lookAt.target = studentTarget;
          } else {
             // Track chalk
             boardTarget.position.set(
                -1.4 + (boardSystem.normalizedPenPos.x * 2.88) - 1.44, 
                1.6 - (boardSystem.normalizedPenPos.y * 1.8) + 0.9, 
                -1.4
             );
             currentVrm.lookAt.target = boardTarget;
          }
        }

        // Apply humanoid bone rotations
        const head = currentVrm.humanoid?.getNormalizedBoneNode('head');
        const neck = currentVrm.humanoid?.getNormalizedBoneNode('neck');
        const spine = currentVrm.humanoid?.getNormalizedBoneNode('spine');
        const chest = currentVrm.humanoid?.getNormalizedBoneNode('chest');
        const rightUpperArm = currentVrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
        const rightForearm = currentVrm.humanoid?.getNormalizedBoneNode('rightLowerArm');
        const leftUpperArm = currentVrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
        const leftForearm = currentVrm.humanoid?.getNormalizedBoneNode('leftLowerArm');
        const leftEye = currentVrm.humanoid?.getNormalizedBoneNode('leftEye');
        const rightEye = currentVrm.humanoid?.getNormalizedBoneNode('rightEye');

        if (head) head.rotation.set(anim.pose.head.x, anim.pose.head.y, anim.pose.head.z);
        if (neck) neck.rotation.set(anim.pose.neck.x, anim.pose.neck.y, anim.pose.neck.z);
        if (spine) spine.rotation.set(anim.pose.spine.x, anim.pose.spine.y, anim.pose.spine.z);
        if (chest) chest.rotation.set(anim.pose.chest.x, anim.pose.chest.y, anim.pose.chest.z);

        if (rightUpperArm) {
          if (boardSystem.isWriting) {
            // Fake IK / mapped writing pose towards board
            const targetX = boardSystem.normalizedPenPos.x; // 0 to 1
            const targetY = boardSystem.normalizedPenPos.y; // 0 to 1
            rightUpperArm.rotation.set(
              0.2 + targetY * 0.8, // Arm up
              0.8 - targetX * 1.5, // Arm left/right
              -0.3 // Keep it away from body
            );
          } else {
            rightUpperArm.rotation.set(
              anim.pose.rightUpperArm.x,
              anim.pose.rightUpperArm.y,
              -1.25 - anim.pose.rightUpperArm.z
            );
          }
        }
        if (rightForearm) {
          rightForearm.rotation.set(anim.pose.rightForearm.x * 0.4, 0, 0);
        }
        if (leftUpperArm) {
          leftUpperArm.rotation.set(
            anim.pose.leftUpperArm.x,
            anim.pose.leftUpperArm.y,
            1.25 + anim.pose.leftUpperArm.z
          );
        }
        if (leftForearm) {
          leftForearm.rotation.set(anim.pose.leftForearm.x * 0.4, 0, 0);
        }
        if (leftEye) leftEye.rotation.set(anim.pose.leftEye.x, anim.pose.leftEye.y, anim.pose.leftEye.z);
        if (rightEye) rightEye.rotation.set(anim.pose.rightEye.x, anim.pose.rightEye.y, anim.pose.rightEye.z);

        // Apply morph targets via expression manager
        if (currentVrm.expressionManager) {
          currentVrm.expressionManager.setValue('aa', anim.lipSync.aa);
          currentVrm.expressionManager.setValue('ih', anim.lipSync.ih);
          currentVrm.expressionManager.setValue('ou', anim.lipSync.ou);
          currentVrm.expressionManager.setValue('ee', anim.lipSync.ee);
          currentVrm.expressionManager.setValue('oh', anim.lipSync.oh);
          currentVrm.expressionManager.setValue('blink', anim.blink);

          currentVrm.expressionManager.setValue('happy', anim.expressionWeights.happy);
          currentVrm.expressionManager.setValue('surprised', anim.expressionWeights.surprised);
          currentVrm.expressionManager.setValue('sad', anim.expressionWeights.sad);
          currentVrm.expressionManager.setValue('neutral', anim.expressionWeights.neutral);

          try {
            currentVrm.expressionManager.setValue('A', anim.lipSync.aa);
            currentVrm.expressionManager.setValue('I', anim.lipSync.ih);
            currentVrm.expressionManager.setValue('U', anim.lipSync.ou);
            currentVrm.expressionManager.setValue('E', anim.lipSync.ee);
            currentVrm.expressionManager.setValue('O', anim.lipSync.oh);
            currentVrm.expressionManager.setValue('Blink', anim.blink);
            currentVrm.expressionManager.setValue('Joy', anim.expressionWeights.happy);
          } catch (_) {}

          currentVrm.expressionManager.update();
        }

        currentVrm.update(delta);
      } else if (proceduralTeacher) {
        proceduralTeacher.update(anim);
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

    // 8. Cleanup
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();

      if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
      }
      if (proceduralTeacher) {
        scene.remove(proceduralTeacher.group);
        proceduralTeacher.dispose();
      }

      renderer.dispose();
    };
  }, []);

  if (loadError) {
    return null; // Signals parent to render 2D fallback
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      {modelType === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs text-xs text-slate-300">
          Loading 3D Teacher...
        </div>
      )}
    </div>
  );
};
