/**
 * Avatar Controller State Machine
 * Manages 3D teacher states, gestures, idle breathing, blinking,
 * facial expressions, and audio-driven lip sync according to SPEC.md.
 */

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'pointing_board';
export type AttentionState = 'STUDENT_FACING' | 'BOARD_TRANSITION' | 'BOARD_WRITING' | 'BOARD_POINTING' | 'RETURN_TO_STUDENT';

export type AvatarExpression =
  | 'neutral'
  | 'smile'
  | 'concerned'
  | 'focused'
  | 'raised_brows'
  | 'celebrate';

export type LipSyncWeights = {
  aa: number;
  ih: number;
  ou: number;
  ee: number;
  oh: number;
};

export type BoneRotation = {
  x: number;
  y: number;
  z: number;
};

export type AvatarPose = {
  head: BoneRotation;
  neck: BoneRotation;
  spine: BoneRotation;
  chest: BoneRotation;
  leftUpperArm: BoneRotation;
  leftForearm: BoneRotation;
  rightUpperArm: BoneRotation;
  rightForearm: BoneRotation;
  leftEye: BoneRotation;
  rightEye: BoneRotation;
};

export type AvatarAnimationOutput = {
  rootRotationY: number;
  rootPositionX: number;
  rootPositionZ: number;
  state: AvatarState;
  expression: AvatarExpression;
  pose: AvatarPose;
  blink: number; // 0 to 1
  lipSync: LipSyncWeights;
  expressionWeights: {
    happy: number;
    sad: number;
    surprised: number;
    relaxed: number;
    neutral: number;
  };
};

/**
 * Maps teaching moves and verdicts to facial expressions per SPEC.md:
 * - encourage -> smile
 * - hint_1..hint_3 / socratic_question -> raised_brows
 * - worked_example -> focused
 * - wrong answer -> concerned (warm, empathetic, never negative)
 * - advance / correct -> celebrate
 */
export function mapMoveToExpression(move?: string | null, verdict?: string | null): AvatarExpression {
  if (verdict === 'correct' || move === 'advance') {
    return 'celebrate';
  }
  if (verdict === 'wrong') {
    return 'concerned';
  }
  switch (move) {
    case 'encourage':
      return 'smile';
    case 'worked_example':
      return 'focused';
    case 'hint_1':
    case 'hint_2':
    case 'hint_3':
    case 'socratic_question':
      return 'raised_brows';
    case 'practice_problem':
      return 'focused';
    default:
      return 'neutral';
  }
}

export class AvatarController {
  private state: AvatarState = 'idle';
  private expression: AvatarExpression = 'neutral';
  private reducedMotion = false;

  // Timers
  private time = 0;
  private blinkTimer = 0;
  private nextBlinkInterval = 3.5;
  private blinkProgress = 0;
  private isBlinking = false;

  // Eye saccade timer
  private eyeTimer = 0;
  private targetEyeX = 0;
  private targetEyeY = 0;
  private currentEyeX = 0;
  private currentEyeY = 0;

  // Pointing timer
  private pointingTimer = 0;
  private pointingDuration = 2.5;

  // Gestures
  private activeGesture: 'none' | 'explain' | 'emphasize' | 'compare' | 'open_palm' = 'none';
  public attention: AttentionState = 'STUDENT_FACING';
  private attentionTimer: number = 0;
  private rootRotY: number = Math.PI;
  private rootPosX: number = 0;
  private rootPosZ: number = 0;
  private gestureTimer = 0;
  private gestureDuration = 0;
  private timeSinceLastGesture = 0;

  // Lip sync smoothed values
  private currentLipSync: LipSyncWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };

  constructor(reducedMotion = false) {
    this.reducedMotion = reducedMotion;
    this.resetBlinkTimer();
  }

  public getState(): AvatarState {
    return this.state;
  }

  public setAttention(newAtt: AttentionState) {
    if (this.attention !== newAtt) {
       this.attention = newAtt;
       this.attentionTimer = 0;
    }
  }
  public setState(state: AvatarState): void {
    if (this.state === state) return;
    this.state = state;
    if (state === 'pointing_board') {
      this.pointingTimer = 0;
    }
  }

  public getExpression(): AvatarExpression {
    return this.expression;
  }

  public setExpression(expr: AvatarExpression): void {
    this.expression = expr;
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  public isReducedMotion(): boolean {
    return this.reducedMotion;
  }

  /**
   * Immediate interruption: per SPEC.md, stops speaking and moves
   * to listening within <100ms with mouth shapes zeroed.
   */
  public handleInterruption(): void {
    this.state = 'listening';
    this.currentLipSync = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    this.pointingTimer = 0;
    this.activeGesture = 'none';
    this.gestureTimer = 0;
    this.setAttention('RETURN_TO_STUDENT');
  }

  /**
   * Triggers pointing at digital board
   */
  public triggerBoardPoint(durationSeconds = 2.5): void {
    this.pointingDuration = durationSeconds;
    this.pointingTimer = 0;
    this.state = 'pointing_board';
  }

  private resetBlinkTimer(): void {
    this.blinkTimer = 0;
    // Random interval between 3 and 6 seconds per SPEC.md
    this.nextBlinkInterval = 3.0 + Math.random() * 3.0;
  }

  /**
   * Main per-frame update loop
   * @param delta Delta time in seconds
   * @param audioLevel Overall loudness [0, 1]
   * @param frequencyData Optional frequency bins from Web Audio AnalyserNode
   */
  public update(
    delta: number,
    audioLevel = 0,
    frequencyData?: Uint8Array | number[]
  ): AvatarAnimationOutput {
    this.time += delta;
    const motionScale = this.reducedMotion ? 0.3 : 1.0;

    // 1. Blinking Logic (every 3 to 6s, 150ms duration)
    this.blinkTimer += delta;
    if (!this.isBlinking && this.blinkTimer >= this.nextBlinkInterval) {
      this.isBlinking = true;
      this.blinkProgress = 0;
    }

    let blinkVal = 0;
    if (this.isBlinking) {
      const BLINK_DURATION = 0.15; // 150ms
      this.blinkProgress += delta / BLINK_DURATION;
      if (this.blinkProgress >= 1.0) {
        this.isBlinking = false;
        this.blinkProgress = 0;
        blinkVal = 0;
        this.resetBlinkTimer();
      } else {
        // Fast close, quick open: triangle wave [0 -> 1 -> 0]
        blinkVal = Math.sin(this.blinkProgress * Math.PI);
      }
    }

    // 2. Eye Saccades (small eye movements every 2-4s)
    this.eyeTimer += delta;
    if (this.eyeTimer >= 3.0) {
      this.eyeTimer = 0;
      this.targetEyeX = (Math.random() - 0.5) * 0.08 * motionScale;
      this.targetEyeY = (Math.random() - 0.5) * 0.05 * motionScale;
    }
    this.currentEyeX += (this.targetEyeX - this.currentEyeX) * Math.min(1, delta * 5);
    this.currentEyeY += (this.targetEyeY - this.currentEyeY) * Math.min(1, delta * 5);

    // 3. Lip Sync from Audio Level and Frequencies
    if (this.state === 'speaking' && audioLevel > 0.01) {
      let lowEnergy = 0;
      let midEnergy = 0;
      let highEnergy = 0;

      if (frequencyData && frequencyData.length >= 8) {
        // Calculate formant bands:
        // low: bins 0-2 (~100-500Hz)
        // mid: bins 3-6 (~600-1500Hz)
        // high: bins 7-12 (~1600-3500Hz)
        lowEnergy = (frequencyData[1] + frequencyData[2]) / 512;
        midEnergy = (frequencyData[4] + frequencyData[5]) / 512;
        highEnergy = (frequencyData[8] || frequencyData[7] || 0) / 256;
      } else {
        lowEnergy = audioLevel * 0.7;
        midEnergy = audioLevel * 0.8;
        highEnergy = audioLevel * 0.5;
      }

      // Map loudness and formants to standard VRM vowels: aa, ih, ou, ee, oh
      const targetAa = Math.min(1, Math.max(0, audioLevel * 1.2));
      const targetOh = Math.min(1, Math.max(0, lowEnergy * 1.1));
      const targetOu = Math.min(1, Math.max(0, lowEnergy * 0.8));
      const targetEe = Math.min(1, Math.max(0, highEnergy * 0.9));
      const targetIh = Math.min(1, Math.max(0, midEnergy * 0.85));

      // Smoothing exponential filter (alpha ~ 0.3)
      const smoothing = Math.min(1, delta * 20);
      this.currentLipSync.aa += (targetAa - this.currentLipSync.aa) * smoothing;
      this.currentLipSync.oh += (targetOh - this.currentLipSync.oh) * smoothing;
      this.currentLipSync.ou += (targetOu - this.currentLipSync.ou) * smoothing;
      this.currentLipSync.ee += (targetEe - this.currentLipSync.ee) * smoothing;
      this.currentLipSync.ih += (targetIh - this.currentLipSync.ih) * smoothing;
    } else {
      // Smoothly close mouth
      const closeSpeed = Math.min(1, delta * 25);
      this.currentLipSync.aa += (0 - this.currentLipSync.aa) * closeSpeed;
      this.currentLipSync.oh += (0 - this.currentLipSync.oh) * closeSpeed;
      this.currentLipSync.ou += (0 - this.currentLipSync.ou) * closeSpeed;
      this.currentLipSync.ee += (0 - this.currentLipSync.ee) * closeSpeed;
      this.currentLipSync.ih += (0 - this.currentLipSync.ih) * closeSpeed;
    }

    // 4. Base Pose (Breathing sine wave)
    const breathCycle = Math.sin(this.time * 1.8);
    const spinePitch = breathCycle * 0.015 * motionScale;
    const chestPitch = breathCycle * 0.02 * motionScale;

    const pose: AvatarPose = {
      head: { x: 0, y: 0, z: 0 },
      neck: { x: 0, y: 0, z: 0 },
      spine: { x: spinePitch, y: 0, z: 0 },
      chest: { x: chestPitch, y: 0, z: 0 },
      leftUpperArm: { x: 0.1, y: 0, z: -0.15 },
      leftForearm: { x: 0.2, y: 0, z: 0 },
      rightUpperArm: { x: 0.1, y: 0, z: 0.15 },
      rightForearm: { x: 0.2, y: 0, z: 0 },
      leftEye: { x: this.currentEyeY, y: this.currentEyeX, z: 0 },
      rightEye: { x: this.currentEyeY, y: this.currentEyeX, z: 0 },
    };

    // 5. State Machine Posture & Gesture Modifications
    
    // Attention State Machine
    this.attentionTimer += delta;
    if (this.attention === 'BOARD_TRANSITION') {
       this.rootPosX += (-0.3 - this.rootPosX) * 0.1;
       this.rootPosZ += (-0.4 - this.rootPosZ) * 0.1;
       this.rootRotY += ((Math.PI - 0.7) - this.rootRotY) * 0.1;
       if (this.attentionTimer > 1.0) {
           this.attention = 'BOARD_WRITING';
       }
    } else if (this.attention === 'BOARD_WRITING' || this.attention === 'BOARD_POINTING') {
       this.rootPosX += (-0.3 - this.rootPosX) * 0.1;
       this.rootPosZ += (-0.4 - this.rootPosZ) * 0.1;
       this.rootRotY += ((Math.PI - 0.7) - this.rootRotY) * 0.1;
    } else if (this.attention === 'RETURN_TO_STUDENT') {
       this.rootPosX += (0 - this.rootPosX) * 0.1;
       this.rootPosZ += (0 - this.rootPosZ) * 0.1;
       this.rootRotY += (Math.PI - this.rootRotY) * 0.1;
       if (this.attentionTimer > 1.0) {
           this.attention = 'STUDENT_FACING';
       }
    } else {
       this.rootPosX += (0 - this.rootPosX) * 0.1;
       this.rootPosZ += (0 - this.rootPosZ) * 0.1;
       this.rootRotY += (Math.PI - this.rootRotY) * 0.1;
    }
    
    switch (this.state) {
      case 'idle': {
        // Subtle micro-sway
        pose.head.y = Math.sin(this.time * 0.7) * 0.03 * motionScale;
        pose.head.x = Math.sin(this.time * 1.1) * 0.02 * motionScale;
        break;
      }

      case 'listening': {
        // Head tilted slightly with occasional nod
        const tiltAngle = 0.09 * motionScale; // ~5 degrees tilt
        const nod = Math.sin(this.time * 2.2) > 0.5 ? Math.sin(this.time * 2.2) * 0.05 * motionScale : 0;
        pose.head.z = tiltAngle;
        pose.head.x = 0.04 * motionScale + nod;
        pose.neck.x = nod * 0.5;
        break;
      }

      case 'thinking': {
        // Looks slightly up and aside (pensive)
        pose.head.x = -0.09 * motionScale; // look up
        pose.head.y = 0.12 * motionScale; // look slightly to the right
        pose.leftEye.x = -0.06 * motionScale;
        pose.rightEye.x = -0.06 * motionScale;
        pose.leftEye.y = 0.08 * motionScale;
        pose.rightEye.y = 0.08 * motionScale;
        // Hands down (no chin touching)
        break;
      }

      case 'speaking': {
        // Speech rhythm head gestures
        const speechSway = Math.sin(this.time * 3.5) * 0.04 * motionScale;
        const speechNod = Math.sin(this.time * 4.2) * 0.05 * motionScale * Math.min(1, audioLevel * 2);
        pose.head.x = speechNod;
        pose.head.y = speechSway;
        // Gesture system triggers
        if (this.activeGesture === 'none') {
          this.timeSinceLastGesture += delta;
          if (this.timeSinceLastGesture > 3.0 && Math.random() < delta * 0.4) {
            const gestures: Array<'explain' | 'emphasize' | 'compare' | 'open_palm'> = ['explain', 'emphasize', 'compare', 'open_palm'];
            this.activeGesture = gestures[Math.floor(Math.random() * gestures.length)];
            this.gestureTimer = 0;
            this.gestureDuration = 1.5 + Math.random() * 1.5; // 1.5 to 3.0s
          }
        }
        break;
      }

      case 'pointing_board': {
        // Pointing at the board (to the user's right)
        this.pointingTimer += delta;
        const pointProgress = Math.min(1, this.pointingTimer / 0.5); // 0.5s raise
        const pointRetract = this.pointingTimer > this.pointingDuration - 0.5
          ? Math.max(0, (this.pointingDuration - this.pointingTimer) / 0.5)
          : 1.0;
        const pointFactor = pointProgress * pointRetract * motionScale;

        // Turn head towards board
        pose.head.y = 0.25 * pointFactor;
        pose.neck.y = 0.12 * pointFactor;

        // Outstretched right arm pointing towards digital board
        pose.rightUpperArm.x = 0.7 * pointFactor;
        pose.rightUpperArm.y = -0.3 * pointFactor;
        pose.rightUpperArm.z = 0.6 * pointFactor;
        pose.rightForearm.x = 0.2 * pointFactor;

        if (this.pointingTimer >= this.pointingDuration) {
          this.state = 'idle';
          this.pointingTimer = 0;
        }
        break;
      }
    }

    // Apply active teaching gesture if any
    if (this.activeGesture !== 'none') {
      this.gestureTimer += delta;
      
      // If we are no longer speaking, smoothly cancel the gesture (speed up expiration)
      if (this.state !== 'speaking' && this.gestureTimer < this.gestureDuration * 0.5) {
         this.gestureTimer += delta * 2.0; 
      }

      if (this.gestureTimer >= this.gestureDuration) {
        this.activeGesture = 'none';
        this.timeSinceLastGesture = 0;
      } else {
        // Smooth ease-in and ease-out (sine wave 0 -> 1 -> 0)
        const p = this.gestureTimer / this.gestureDuration;
        const ease = Math.sin(p * Math.PI); 

        switch (this.activeGesture) {
          case 'explain':
            pose.rightUpperArm.x += 0.2 * ease * motionScale;
            pose.rightUpperArm.z += 0.3 * ease * motionScale;
            pose.rightForearm.x += 0.5 * ease * motionScale;
            break;
          case 'emphasize':
            pose.rightUpperArm.x += 0.15 * ease * motionScale;
            pose.rightUpperArm.z += 0.15 * ease * motionScale;
            pose.rightForearm.x += 0.6 * ease * motionScale;
            pose.head.x += 0.05 * ease * motionScale; // nod
            break;
          case 'compare':
            pose.rightUpperArm.x += 0.2 * ease * motionScale;
            pose.rightUpperArm.z += 0.2 * ease * motionScale;
            pose.rightForearm.x += 0.4 * ease * motionScale;
            pose.leftUpperArm.x += 0.2 * ease * motionScale;
            pose.leftUpperArm.z -= 0.2 * ease * motionScale;
            pose.leftForearm.x += 0.4 * ease * motionScale;
            break;
          case 'open_palm':
            pose.leftUpperArm.x += 0.25 * ease * motionScale;
            pose.leftUpperArm.z -= 0.3 * ease * motionScale;
            pose.leftForearm.x += 0.3 * ease * motionScale;
            break;
        }
      }
    }

    // 6. Facial Expression Blend Weights
    const expressionWeights = {
      happy: 0,
      sad: 0,
      surprised: 0,
      relaxed: 0,
      neutral: 0,
    };

    switch (this.expression) {
      case 'smile':
        expressionWeights.happy = 0.85;
        break;
      case 'celebrate':
        expressionWeights.happy = 1.0;
        expressionWeights.surprised = 0.3;
        break;
      case 'concerned':
        expressionWeights.sad = 0.5; // gentle, empathetic concern
        break;
      case 'focused':
        expressionWeights.relaxed = 0.3;
        break;
      case 'raised_brows':
        expressionWeights.surprised = 0.6;
        break;
      case 'neutral':
      default:
        expressionWeights.neutral = 1.0;
        break;
    }

    return {
      state: this.state,
      expression: this.expression,
      pose,
      blink: blinkVal,
      lipSync: { ...this.currentLipSync },
      expressionWeights,
      rootRotationY: this.rootRotY,
      rootPositionX: this.rootPosX,
      rootPositionZ: this.rootPosZ,
    };
  }
}
