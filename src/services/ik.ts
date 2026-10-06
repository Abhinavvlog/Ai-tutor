import { Vector3, Quaternion } from 'three';

// Fast 2-bone IK solver for the arm
export function solve2BoneIK(
  shoulderPos: Vector3,
  targetPos: Vector3,
  upperArmLength: number,
  lowerArmLength: number,
  poleVector: Vector3 // Direction for the elbow to point (e.g. down and slightly back)
) {
  const dir = new Vector3().subVectors(targetPos, shoulderPos);
  const dist = dir.length();
  dir.normalize();
  
  // Prevent overstretching
  const maxDist = upperArmLength + lowerArmLength - 0.001;
  const clampedDist = Math.min(dist, maxDist);
  
  // Law of cosines for shoulder angle
  const cosAngleShoulder = (upperArmLength * upperArmLength + clampedDist * clampedDist - lowerArmLength * lowerArmLength) / (2 * upperArmLength * clampedDist);
  const angleShoulder = Math.acos(Math.max(-1, Math.min(1, cosAngleShoulder)));
  
  // Law of cosines for elbow angle
  const cosAngleElbow = (upperArmLength * upperArmLength + lowerArmLength * lowerArmLength - clampedDist * clampedDist) / (2 * upperArmLength * lowerArmLength);
  const angleElbow = Math.acos(Math.max(-1, Math.min(1, cosAngleElbow)));

  // Calculate base rotation to point from shoulder to target
  const defaultDir = new Vector3(1, 0, 0); // Assuming rest pose arm points along +X (adjust based on VRM)
  const qBase = new Quaternion().setFromUnitVectors(defaultDir, dir);

  // Apply shoulder bend towards pole vector
  // We need an axis perpendicular to dir and poleVector
  const bendAxis = new Vector3().crossVectors(dir, poleVector).normalize();
  if (bendAxis.lengthSq() < 0.001) {
    // Fallback if target is aligned with pole vector
    bendAxis.set(0, 1, 0).cross(dir).normalize();
  }
  
  const qShoulderBend = new Quaternion().setFromAxisAngle(bendAxis, angleShoulder);
  const qUpperArm = qBase.clone().multiply(qShoulderBend);
  
  // The elbow bends along the same axis
  // But VRM local elbow bend is usually around local Z or Y depending on export.
  // For simplicity, we just output the angles and let the controller map them to local Euler.
  
  return { qUpperArm, angleElbow };
}
