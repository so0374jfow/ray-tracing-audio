import * as THREE from 'three';
import { moveSpeed, mouseSensitivity, roomWidth, roomHeight, roomDepth } from './config.js';

const keys = {};
let yaw = 0;
let pitch = 0;
let isLocked = false;
let isMobile = false;
let isActive = false;

const halfW = roomWidth / 2 - 0.3;
const halfD = roomDepth / 2 - 0.3;
const minY = 1.0;
const maxY = roomHeight - 0.3;

// Mobile touch state
let moveStickX = 0;
let moveStickY = 0;
let lookTouchId = null;
let lookLastX = 0;
let lookLastY = 0;
let moveTouchId = null;

// Mobile UI elements
let moveStick = null;
let moveStickKnob = null;
let mobileUI = null;

function detectMobile() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function initControls(camera, domElement) {
  const overlay = document.getElementById('overlay');
  isMobile = detectMobile();

  if (isMobile) {
    initMobileControls(domElement, overlay);
  } else {
    initDesktopControls(domElement, overlay);
  }
}

// --- Desktop controls (unchanged behavior) ---

function initDesktopControls(domElement, overlay) {
  domElement.addEventListener('click', () => {
    if (!isLocked) domElement.requestPointerLock();
  });

  overlay?.addEventListener('click', () => {
    domElement.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    isLocked = document.pointerLockElement === domElement;
    isActive = isLocked;
    if (overlay) overlay.style.display = isLocked ? 'none' : 'flex';
  });

  document.addEventListener('mousemove', e => {
    if (!isLocked) return;
    yaw -= e.movementX * mouseSensitivity;
    pitch -= e.movementY * mouseSensitivity;
    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
  });

  document.addEventListener('keydown', e => {
    keys[e.code] = true;
  });
  document.addEventListener('keyup', e => {
    keys[e.code] = false;
  });
}

// --- Mobile controls ---

function initMobileControls(domElement, overlay) {
  overlay?.addEventListener(
    'touchstart',
    e => {
      e.preventDefault();
      isActive = true;
      if (overlay) overlay.style.display = 'none';
      createMobileUI();
    },
    { passive: false }
  );

  overlay?.addEventListener('click', () => {
    isActive = true;
    if (overlay) overlay.style.display = 'none';
    createMobileUI();
  });

  // Keyboard listeners still needed for mobile button dispatches
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
  });
  document.addEventListener('keyup', e => {
    keys[e.code] = false;
  });
}

function createMobileUI() {
  if (mobileUI) return;

  mobileUI = document.createElement('div');
  mobileUI.id = 'mobile-ui';

  // Move joystick (left side)
  moveStick = document.createElement('div');
  moveStick.className = 'joystick-base';
  moveStickKnob = document.createElement('div');
  moveStickKnob.className = 'joystick-knob';
  moveStick.appendChild(moveStickKnob);
  mobileUI.appendChild(moveStick);

  // Look area (right side)
  const lookArea = document.createElement('div');
  lookArea.className = 'look-area';
  mobileUI.appendChild(lookArea);

  // Action buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'mobile-buttons';
  btnRow.appendChild(createMobileButton('KeyV', 'audio-btn', '\u266B'));
  btnRow.appendChild(createMobileButton('KeyR', 'ray-btn', '\u2736'));
  mobileUI.appendChild(btnRow);

  document.body.appendChild(mobileUI);

  // Inject mobile styles
  const style = document.createElement('style');
  style.textContent = `
    #mobile-ui {
      position:fixed; top:0; left:0; width:100%; height:100%;
      z-index:10; pointer-events:none;
    }
    .joystick-base {
      position:absolute; bottom:30px; left:30px;
      width:120px; height:120px; border-radius:50%;
      background:rgba(255,255,255,0.1); border:2px solid rgba(255,255,255,0.3);
      pointer-events:auto; touch-action:none;
    }
    .joystick-knob {
      position:absolute; top:50%; left:50%;
      width:50px; height:50px; border-radius:50%;
      background:rgba(255,255,255,0.4);
      transform:translate(-50%,-50%);
      pointer-events:none;
    }
    .look-area {
      position:absolute; top:0; right:0;
      width:60%; height:100%;
      pointer-events:auto; touch-action:none;
    }
    .mobile-buttons {
      position:absolute; bottom:30px; right:30px;
      display:flex; gap:12px; pointer-events:auto;
    }
    .mobile-btn {
      width:50px; height:50px; border-radius:50%;
      background:rgba(255,255,255,0.15); border:2px solid rgba(255,255,255,0.3);
      color:#fff; font-size:20px;
      display:flex; align-items:center; justify-content:center;
      touch-action:none; user-select:none;
    }
    .mobile-btn:active { background:rgba(255,255,255,0.35); }
  `;
  document.head.appendChild(style);

  // Joystick touch
  moveStick.addEventListener('touchstart', onMoveStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: false });

  // Look area touch
  lookArea.addEventListener('touchstart', onLookStart, { passive: false });
}

function createMobileButton(keyCode, className, label) {
  const btn = document.createElement('div');
  btn.className = `mobile-btn ${className}`;
  btn.textContent = label;
  btn.addEventListener(
    'touchstart',
    e => {
      e.preventDefault();
      document.dispatchEvent(new KeyboardEvent('keydown', { code: keyCode }));
      setTimeout(() => {
        document.dispatchEvent(new KeyboardEvent('keyup', { code: keyCode }));
      }, 100);
    },
    { passive: false }
  );
  return btn;
}

function onMoveStart(e) {
  e.preventDefault();
  const touch = e.changedTouches[0];
  moveTouchId = touch.identifier;
  updateMoveStick(touch);
}

function onLookStart(e) {
  e.preventDefault();
  const touch = e.changedTouches[0];
  lookTouchId = touch.identifier;
  lookLastX = touch.clientX;
  lookLastY = touch.clientY;
}

function onTouchMove(e) {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === moveTouchId) updateMoveStick(touch);
    if (touch.identifier === lookTouchId) {
      const dx = touch.clientX - lookLastX;
      const dy = touch.clientY - lookLastY;
      yaw -= dx * mouseSensitivity * 1.5;
      pitch -= dy * mouseSensitivity * 1.5;
      pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
      lookLastX = touch.clientX;
      lookLastY = touch.clientY;
    }
  }
}

function onTouchEnd(e) {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === moveTouchId) {
      moveTouchId = null;
      moveStickX = 0;
      moveStickY = 0;
      if (moveStickKnob) moveStickKnob.style.transform = 'translate(-50%,-50%)';
    }
    if (touch.identifier === lookTouchId) {
      lookTouchId = null;
    }
  }
}

function updateMoveStick(touch) {
  if (!moveStick) return;
  const rect = moveStick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxR = rect.width / 2;

  let dx = touch.clientX - cx;
  let dy = touch.clientY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > maxR) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }

  moveStickX = dx / maxR;
  moveStickY = dy / maxR;

  if (moveStickKnob) {
    moveStickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
}

// --- Shared update loop ---

const forwardVec = new THREE.Vector3();
const rightVec = new THREE.Vector3();

export function updateControls(camera, delta) {
  if (!isActive) return;

  // Apply rotation
  const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
  camera.quaternion.setFromEuler(euler);

  // Movement direction (XZ plane for walking)
  camera.getWorldDirection(forwardVec);
  forwardVec.y = 0;
  forwardVec.normalize();
  rightVec.crossVectors(forwardVec, new THREE.Vector3(0, -1, 0)).normalize();

  const speed = moveSpeed * delta;

  if (isMobile) {
    if (Math.abs(moveStickY) > 0.1)
      camera.position.addScaledVector(forwardVec, -moveStickY * speed);
    if (Math.abs(moveStickX) > 0.1) camera.position.addScaledVector(rightVec, -moveStickX * speed);
  } else {
    if (keys['KeyW']) camera.position.addScaledVector(forwardVec, speed);
    if (keys['KeyS']) camera.position.addScaledVector(forwardVec, -speed);
    if (keys['KeyA']) camera.position.addScaledVector(rightVec, speed);
    if (keys['KeyD']) camera.position.addScaledVector(rightVec, -speed);
    if (keys['Space']) camera.position.y += speed;
    if (keys['ShiftLeft'] || keys['ShiftRight']) camera.position.y -= speed;
  }

  // Clamp to room bounds
  camera.position.x = Math.max(-halfW, Math.min(halfW, camera.position.x));
  camera.position.y = Math.max(minY, Math.min(maxY, camera.position.y));
  camera.position.z = Math.max(-halfD, Math.min(halfD, camera.position.z));
}

export function isPointerLocked() {
  return isLocked;
}

export function isControlsActive() {
  return isActive;
}

export function isMobileDevice() {
  return isMobile;
}
