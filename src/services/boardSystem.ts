import * as THREE from 'three';
import type { BoardEvent, BoardEventAction } from '../store/tutorStore';

export class BoardSystem {
  public mesh: THREE.Mesh;
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;
  
  public isWriting: boolean = false;
  public normalizedPenPos = { x: 0.5, y: 0.5 };
  public lookAtTarget = new THREE.Vector3();

  private currentAction: BoardEventAction | null = null;
  private actionTimer = 0;
  private canvasWidth = 2800;
  private canvasHeight = 1750;
  
  // Board state for persistence
  private lines: { text: string, x: number, y: number, progress: number }[] = [];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.ctx = this.canvas.getContext('2d')!;
    
    // Initial draw
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    
    const geo = new THREE.PlaneGeometry(2.88, 1.8);
    const mat = new THREE.MeshBasicMaterial({ map: this.texture });
    this.mesh = new THREE.Mesh(geo, mat);
    
    // Position blackboard to the left and back
    this.mesh.position.set(-1.4, 1.6, -1.5);
    this.lookAtTarget.copy(this.mesh.position);
    
    // Frame
    const frameGeo = new THREE.BoxGeometry(2.95, 1.87, 0.05);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -0.03;
    this.mesh.add(frame);
  }

  public clear() {
    this.lines = [];
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.texture.needsUpdate = true;
  }

  private redrawStatic() {
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.ctx.fillStyle = 'white';
    this.ctx.font = '100px "Comic Sans MS", cursive, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    
    for (const line of this.lines) {
      const charsToShow = Math.floor(line.progress * line.text.length);
      this.ctx.fillText(line.text.substring(0, charsToShow), line.x, line.y);
    }
  }

  public update(delta: number, events: BoardEvent[]) {
    // Find first incomplete event
    const activeEvent = events.find(e => !e.isComplete);
    
    if (!activeEvent) {
      this.isWriting = false;
      this.currentAction = null;
      return;
    }

    this.isWriting = true;
    const action = activeEvent.action;
    
    if (this.currentAction !== action) {
      this.currentAction = action;
      this.actionTimer = 0;
      
      if (action.type === 'CLEAR_BOARD') {
        this.clear();
        activeEvent.isComplete = true;
        return;
      }
      
      if (action.type === 'WRITE_TEXT' || action.type === 'DRAW_ARRAY') {
        let text = '';
        if (action.type === 'WRITE_TEXT') text = action.text;
        if (action.type === 'DRAW_ARRAY') text = '[ ' + action.values.join(' ] [ ') + ' ]';
        
        // Auto position (simple layout)
        const yPos = 150 + (this.lines.length * 150);
        this.lines.push({ text, x: 100, y: yPos, progress: 0 });
      } else {
        // Dummy complete for others
        activeEvent.isComplete = true;
        return;
      }
    }

    // Progress the action
    const duration = 'duration' in action ? action.duration || 2.0 : 2.0;
    this.actionTimer += delta;
    const p = Math.min(1.0, this.actionTimer / duration);
    
    if (this.lines.length > 0) {
      const currentLine = this.lines[this.lines.length - 1];
      currentLine.progress = p;
      this.redrawStatic();
      this.texture.needsUpdate = true;
      
      // Update pen pos
      const charsToShow = Math.floor(p * currentLine.text.length);
      const textWidth = this.ctx.measureText(currentLine.text.substring(0, charsToShow)).width;
      this.normalizedPenPos.x = (100 + textWidth) / this.canvasWidth;
      this.normalizedPenPos.y = 1.0 - (currentLine.y / this.canvasHeight); // invert Y for 3D space
    }

    if (p >= 1.0) {
      activeEvent.isComplete = true;
    }
  }
}
