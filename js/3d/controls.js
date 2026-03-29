import * as THREE from 'three';
import { moveSpeed, mouseSensitivity, roomWidth, roomHeight, roomDepth } from './config.js';

const keys = {};
let yaw = 0;
let pitch = 0;
let isLocked = false;

const halfW = roomWidth / 2 - 0.3;
const halfD = roomDepth / 2 - 0.3;
const minY = 1.0;
const maxY = roomHeight - 0.3;

export function initControls(camera, domElement) {
  const overlay = document.getElementById('overlay');

  // Pointer lock
  domElement.addEventListener('click', () => {
    if (!isLocked) {
      domElement.requestPointerLock();
    }
  });

  overlay?.addEventListener('click', () => {
    domElement.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    isLocked = document.pointerLockElement === domElement;
    if (overlay) {
      overlay.style.display = isLocked ? 'none' : 'flex';
    }
  });

  // Mouse look
  document.addEventListener('mousemove', e => {
    if (!isLocked) return;
    yaw -= e.movementX * mouseSensitivity;
    pitch -= e.movementY * mouseSensitivity;
    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
  });
  document.addEventListener('keyup', e => {
    keys[e.code] = false;
  });
}

const forward = new THREE.Vector3();
const right = new THREE.Vector3();

export function updateControls(camera, delta) {
  if (!isLocked) return;

  // Apply rotation
  const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
  camera.quaternion.setFromEuler(euler);

  // Movement direction (XZ plane only for walking)
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, new THREE.Vector3(0, -1, 0)).normalize();

  const speed = moveSpeed * delta;

  if (keys['KeyW']) camera.position.addScaledVector(forward, speed);
  if (keys['KeyS']) camera.position.addScaledVector(forward, -speed);
  if (keys['KeyA']) camera.position.addScaledVector(right, speed);
  if (keys['KeyD']) camera.position.addScaledVector(right, -speed);
  if (keys['Space']) camera.position.y += speed;
  if (keys['ShiftLeft'] || keys['ShiftRight']) camera.position.y -= speed;

  // Clamp to room bounds
  camera.position.x = Math.max(-halfW, Math.min(halfW, camera.position.x));
  camera.position.y = Math.max(minY, Math.min(maxY, camera.position.y));
  camera.position.z = Math.max(-halfD, Math.min(halfD, camera.position.z));
}

export function isPointerLocked() {
  return isLocked;
}
