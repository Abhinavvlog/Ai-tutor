import * as THREE from 'three';
import type { AvatarAnimationOutput } from '@/services/avatarController';

export type ProceduralTeacher = {
  group: THREE.Group;
  update: (anim: AvatarAnimationOutput) => void;
  dispose: () => void;
};

export function createProceduralTeacher(): ProceduralTeacher {
  const group = new THREE.Group();
  group.name = 'ProceduralTeacher';

  // Materials
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xdeb887, // Warm golden-tan tone
    roughness: 0.6,
    metalness: 0.05,
  });

  const hairMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f1917, // Dark natural hair
    roughness: 0.8,
  });

  const blazerMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f3a5f, // MyGuru Navy
    roughness: 0.7,
  });

  const shirtMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fafc, // Crisp white shirt
    roughness: 0.5,
  });

  const glassesMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f172a, // Dark stylish frames
    metalness: 0.8,
    roughness: 0.2,
  });

  const eyeWhiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const irisMaterial = new THREE.MeshBasicMaterial({ color: 0x3d271d });
  const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0x882222 });

  // 1. Spine / Torso Root
  const spine = new THREE.Group();
  spine.position.set(0, 0.7, 0);
  group.add(spine);

  // Torso / Blazer
  const torsoGeom = new THREE.CylinderGeometry(0.24, 0.22, 0.6, 16);
  const torsoMesh = new THREE.Mesh(torsoGeom, blazerMaterial);
  torsoMesh.position.set(0, 0.2, 0);
  spine.add(torsoMesh);

  // White shirt collar V-neck inset
  const shirtGeom = new THREE.ConeGeometry(0.12, 0.25, 4);
  const shirtMesh = new THREE.Mesh(shirtGeom, shirtMaterial);
  shirtMesh.rotation.x = Math.PI;
  shirtMesh.position.set(0, 0.42, 0.16);
  spine.add(shirtMesh);

  // Neck
  const neckGeom = new THREE.CylinderGeometry(0.08, 0.09, 0.16, 16);
  const neckMesh = new THREE.Mesh(neckGeom, skinMaterial);
  neckMesh.position.set(0, 0.56, 0);
  spine.add(neckMesh);

  // 2. Head Group
  const head = new THREE.Group();
  head.position.set(0, 0.66, 0);
  spine.add(head);

  // Head base
  const headGeom = new THREE.SphereGeometry(0.21, 24, 24);
  headGeom.scale(1, 1.15, 1);
  const headMesh = new THREE.Mesh(headGeom, skinMaterial);
  headMesh.position.set(0, 0.18, 0);
  head.add(headMesh);

  // Hair
  const hairGeom = new THREE.SphereGeometry(0.23, 20, 20);
  hairGeom.scale(1.04, 1.18, 1.08);
  const hairMesh = new THREE.Mesh(hairGeom, hairMaterial);
  hairMesh.position.set(0, 0.24, -0.02);
  head.add(hairMesh);

  // Hair bangs / front strands
  const bangsGeom = new THREE.SphereGeometry(0.21, 16, 16, 0, Math.PI, 0, Math.PI / 2);
  bangsGeom.scale(1.05, 0.6, 1.05);
  const bangsMesh = new THREE.Mesh(bangsGeom, hairMaterial);
  bangsMesh.rotation.x = 0.5;
  bangsMesh.position.set(0, 0.29, 0.05);
  head.add(bangsMesh);

  // 3. Eyes & Glasses
  const leftEyeGroup = new THREE.Group();
  leftEyeGroup.position.set(-0.075, 0.21, 0.18);
  head.add(leftEyeGroup);

  const rightEyeGroup = new THREE.Group();
  rightEyeGroup.position.set(0.075, 0.21, 0.18);
  head.add(rightEyeGroup);

  const eyeWhiteGeom = new THREE.SphereGeometry(0.035, 12, 12);
  const irisGeom = new THREE.SphereGeometry(0.018, 12, 12);

  const leftEyeWhite = new THREE.Mesh(eyeWhiteGeom, eyeWhiteMaterial);
  const leftIris = new THREE.Mesh(irisGeom, irisMaterial);
  leftIris.position.set(0, 0, 0.025);
  leftEyeGroup.add(leftEyeWhite);
  leftEyeGroup.add(leftIris);

  const rightEyeWhite = new THREE.Mesh(eyeWhiteGeom, eyeWhiteMaterial);
  const rightIris = new THREE.Mesh(irisGeom, irisMaterial);
  rightIris.position.set(0, 0, 0.025);
  rightEyeGroup.add(rightEyeWhite);
  rightEyeGroup.add(rightIris);

  // Eyelids for blinking
  const eyelidGeom = new THREE.SphereGeometry(0.038, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const leftEyelid = new THREE.Mesh(eyelidGeom, skinMaterial);
  leftEyelid.position.set(-0.075, 0.22, 0.18);
  leftEyelid.rotation.x = Math.PI;
  head.add(leftEyelid);

  const rightEyelid = new THREE.Mesh(eyelidGeom, skinMaterial);
  rightEyelid.position.set(0.075, 0.22, 0.18);
  rightEyelid.rotation.x = Math.PI;
  head.add(rightEyelid);

  // Glasses frames
  const glassesGroup = new THREE.Group();
  glassesGroup.position.set(0, 0.21, 0.22);
  head.add(glassesGroup);

  const rimGeom = new THREE.TorusGeometry(0.045, 0.005, 8, 20);
  const leftRim = new THREE.Mesh(rimGeom, glassesMaterial);
  leftRim.position.set(-0.075, 0, 0);
  glassesGroup.add(leftRim);

  const rightRim = new THREE.Mesh(rimGeom, glassesMaterial);
  rightRim.position.set(0.075, 0, 0);
  glassesGroup.add(rightRim);

  const bridgeGeom = new THREE.CylinderGeometry(0.004, 0.004, 0.06);
  const bridgeMesh = new THREE.Mesh(bridgeGeom, glassesMaterial);
  bridgeMesh.rotation.z = Math.PI / 2;
  bridgeMesh.position.set(0, 0.01, 0);
  glassesGroup.add(bridgeMesh);

  // 4. Mouth (responsive to lip sync vowels)
  const mouthGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.015, 16);
  mouthGeom.scale(1.2, 0.5, 0.8);
  const mouthMesh = new THREE.Mesh(mouthGeom, mouthMaterial);
  mouthMesh.position.set(0, 0.09, 0.19);
  mouthMesh.rotation.x = Math.PI / 2;
  head.add(mouthMesh);

  // 5. Arms and Hands
  // Right Arm (pointing / gesturing)
  const rightUpperArmGroup = new THREE.Group();
  rightUpperArmGroup.position.set(0.28, 0.45, 0);
  spine.add(rightUpperArmGroup);

  const armGeom = new THREE.CylinderGeometry(0.065, 0.055, 0.32, 12);
  armGeom.translate(0, -0.16, 0);
  const rightUpperArmMesh = new THREE.Mesh(armGeom, blazerMaterial);
  rightUpperArmGroup.add(rightUpperArmMesh);

  const rightForearmGroup = new THREE.Group();
  rightForearmGroup.position.set(0, -0.32, 0);
  rightUpperArmGroup.add(rightForearmGroup);

  const forearmGeom = new THREE.CylinderGeometry(0.055, 0.045, 0.28, 12);
  forearmGeom.translate(0, -0.14, 0);
  const rightForearmMesh = new THREE.Mesh(forearmGeom, blazerMaterial);
  rightForearmGroup.add(rightForearmMesh);

  const handGeom = new THREE.SphereGeometry(0.05, 10, 10);
  handGeom.scale(0.8, 1.2, 0.6);
  handGeom.translate(0, -0.28, 0);
  const rightHandMesh = new THREE.Mesh(handGeom, skinMaterial);
  rightForearmGroup.add(rightHandMesh);

  // Left Arm
  const leftUpperArmGroup = new THREE.Group();
  leftUpperArmGroup.position.set(-0.28, 0.45, 0);
  spine.add(leftUpperArmGroup);

  const leftUpperArmMesh = new THREE.Mesh(armGeom.clone(), blazerMaterial);
  leftUpperArmGroup.add(leftUpperArmMesh);

  const leftForearmGroup = new THREE.Group();
  leftForearmGroup.position.set(0, -0.32, 0);
  leftUpperArmGroup.add(leftForearmGroup);

  const leftForearmMesh = new THREE.Mesh(forearmGeom.clone(), blazerMaterial);
  leftForearmGroup.add(leftForearmMesh);

  const leftHandMesh = new THREE.Mesh(handGeom.clone(), skinMaterial);
  leftForearmGroup.add(leftHandMesh);

  // Update function connecting to AvatarAnimationOutput
  const update = (anim: AvatarAnimationOutput) => {
    const { pose, blink, lipSync, expressionWeights } = anim;

    // 1. Spine and Breathing
    spine.rotation.x = pose.spine.x + pose.chest.x;

    // 2. Head Rotation (pitch, yaw, tilt)
    head.rotation.x = pose.head.x + pose.neck.x;
    head.rotation.y = pose.head.y + pose.neck.y;
    head.rotation.z = pose.head.z + pose.neck.z;

    // 3. Eye Movement & Blinking
    leftIris.position.x = pose.leftEye.y * 0.08;
    leftIris.position.y = -pose.leftEye.x * 0.08;
    rightIris.position.x = pose.rightEye.y * 0.08;
    rightIris.position.y = -pose.rightEye.x * 0.08;

    // Blink eyelid scale
    const eyelidScale = Math.max(0.01, blink);
    leftEyelid.scale.set(1, eyelidScale, 1);
    rightEyelid.scale.set(1, eyelidScale, 1);
    leftEyelid.visible = blink > 0.05;
    rightEyelid.visible = blink > 0.05;

    // 4. Lip Sync (mouth vowel morphing)
    // aa: open wide vertically
    // oh/ou: round funnel
    // ee/ih: wide horizontal smile
    const openY = 0.5 + lipSync.aa * 3.0 + lipSync.oh * 1.5;
    const scaleX = 1.0 + lipSync.ee * 1.2 + lipSync.oh * 0.4 - lipSync.ou * 0.2;
    mouthMesh.scale.set(
      Math.max(0.5, Math.min(2.5, scaleX)),
      Math.max(0.2, Math.min(3.5, openY)),
      1
    );

    // Subtle smile offset on happy/smile expression
    if (expressionWeights.happy > 0.3) {
      mouthMesh.position.y = 0.095;
    } else {
      mouthMesh.position.y = 0.09;
    }

    // 5. Arm Poses
    rightUpperArmGroup.rotation.x = pose.rightUpperArm.x;
    rightUpperArmGroup.rotation.y = pose.rightUpperArm.y;
    rightUpperArmGroup.rotation.z = -pose.rightUpperArm.z; // Mirrored relative to spine
    rightForearmGroup.rotation.x = pose.rightForearm.x;

    leftUpperArmGroup.rotation.x = pose.leftUpperArm.x;
    leftUpperArmGroup.rotation.y = pose.leftUpperArm.y;
    leftUpperArmGroup.rotation.z = -pose.leftUpperArm.z;
    leftForearmGroup.rotation.x = pose.leftForearm.x;
  };

  const dispose = () => {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
  };

  return {
    group,
    update,
    dispose,
  };
}
