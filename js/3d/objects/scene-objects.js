import * as THREE from 'three';
import { invalidateCache, setSceneObjects } from '../ray-tracing/trace.js';

const objects = [];
const meshes = [];

const objectColors = {
  box: 0xcc6644,
  sphere: 0x4466cc,
  wall: 0x99887a,
  selected: 0xffcc00,
};

// Drag state
let dragEnabled = false;
let selectedObj = null;
let selectedMesh = null;
let originalColor = null;
let isDragging = false;
let dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let dragOffset = new THREE.Vector3();
let raycaster = new THREE.Raycaster();
let pointer = new THREE.Vector2();
let intersection = new THREE.Vector3();

export function enableDragMode(enabled) {
  dragEnabled = enabled;
  if (!enabled && selectedMesh) {
    deselectCurrent();
  }
}

export function isDragMode() {
  return dragEnabled;
}

function deselectCurrent() {
  if (selectedMesh && originalColor !== null) {
    selectedMesh.material.emissive.setHex(0x000000);
  }
  selectedObj = null;
  selectedMesh = null;
  originalColor = null;
}

export function initDragControls(camera, domElement, orbitControls) {
  const getPointer = e => {
    const touch = e.touches ? e.touches[0] : e;
    pointer.x = (touch.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(touch.clientY / window.innerHeight) * 2 + 1;
  };

  const onDown = e => {
    if (!dragEnabled) return;
    getPointer(e);
    raycaster.setFromCamera(pointer, camera);

    // Test against object meshes
    const hits = raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      const idx = meshes.indexOf(hitMesh);
      if (idx === -1) return;

      // Select this object
      deselectCurrent();
      selectedObj = objects[idx];
      selectedMesh = hitMesh;
      selectedMesh.material.emissive.setHex(0x332200);
      isDragging = true;

      // Set drag plane at object's Y level
      dragPlane.set(new THREE.Vector3(0, 1, 0), -hitMesh.position.y);

      // Compute offset between ray hit and mesh center
      raycaster.ray.intersectPlane(dragPlane, intersection);
      dragOffset.copy(hitMesh.position).sub(intersection);

      // Disable orbit while dragging
      if (orbitControls) orbitControls.enabled = false;

      e.preventDefault?.();
      e.stopPropagation?.();
    }
  };

  const onMove = e => {
    if (!isDragging || !selectedMesh || !selectedObj) return;
    getPointer(e);
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(dragPlane, intersection);
    intersection.add(dragOffset);

    // Move the mesh
    selectedMesh.position.x = intersection.x;
    selectedMesh.position.z = intersection.z;

    // Update the logical object
    updateObjectPosition(selectedObj, intersection.x, intersection.z);

    e.preventDefault?.();
  };

  const onUp = () => {
    if (isDragging && orbitControls) {
      orbitControls.enabled = true;
    }
    isDragging = false;
  };

  domElement.addEventListener('pointerdown', onDown);
  domElement.addEventListener('pointermove', onMove);
  domElement.addEventListener('pointerup', onUp);
  domElement.addEventListener('pointerleave', onUp);
  // Touch events for mobile
  domElement.addEventListener('touchstart', onDown, { passive: false });
  domElement.addEventListener('touchmove', onMove, { passive: false });
  domElement.addEventListener('touchend', onUp);
}

export function addBox(scene, x, y, z, w = 2, h = 2, d = 2, material = 'wood') {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color: objectColors.box,
    roughness: 0.7,
    metalness: 0.2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  meshes.push(mesh);

  const halfW = w / 2;
  const halfH = h / 2;
  const halfD = d / 2;
  const obj = {
    type: 'box',
    min: { x: x - halfW, y: y - halfH, z: z - halfD },
    max: { x: x + halfW, y: y + halfH, z: z + halfD },
    material,
    mesh,
  };
  objects.push(obj);
  setSceneObjects(objects);
  invalidateCache();
  return obj;
}

// Thin wall: a tall flat box (like a partition wall)
export function addWall(scene, x, z, length = 8, height = 8, angle = 0, material = 'concrete') {
  const thickness = 0.3;
  const geo = new THREE.BoxGeometry(length, height, thickness);
  const mat = new THREE.MeshStandardMaterial({
    color: objectColors.wall,
    roughness: 0.85,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, height / 2, z);
  mesh.rotation.y = angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  meshes.push(mesh);

  // Compute AABB from rotated box
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const halfL = length / 2;
  const halfT = thickness / 2;
  const halfH = height / 2;
  // Rotated extents in XZ
  const extX = Math.abs(cos * halfL) + Math.abs(sin * halfT);
  const extZ = Math.abs(sin * halfL) + Math.abs(cos * halfT);

  const obj = {
    type: 'box',
    min: { x: x - extX, y: 0, z: z - extZ },
    max: { x: x + extX, y: height, z: z + extZ },
    material,
    mesh,
  };
  objects.push(obj);
  setSceneObjects(objects);
  invalidateCache();
  return obj;
}

export function addSphere(scene, x, y, z, radius = 1, material = 'metal') {
  const geo = new THREE.SphereGeometry(radius, 24, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: objectColors.sphere,
    roughness: 0.3,
    metalness: 0.6,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  meshes.push(mesh);

  const obj = {
    type: 'sphere',
    center: { x, y, z },
    radius,
    material,
    mesh,
  };
  objects.push(obj);
  setSceneObjects(objects);
  invalidateCache();
  return obj;
}

export function removeLastObject(scene) {
  if (objects.length === 0) return;
  const obj = objects.pop();
  const mesh = meshes.pop();
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
  setSceneObjects(objects);
  invalidateCache();
}

export function getObjects() {
  return objects;
}

function updateObjectPosition(obj, x, z) {
  if (obj.type === 'box') {
    const halfW = (obj.max.x - obj.min.x) / 2;
    const halfZ = (obj.max.z - obj.min.z) / 2;
    obj.min.x = x - halfW;
    obj.max.x = x + halfW;
    obj.min.z = z - halfZ;
    obj.max.z = z + halfZ;
  } else if (obj.type === 'sphere') {
    obj.center.x = x;
    obj.center.z = z;
  }
  invalidateCache();
}

// Place object at camera target (raycasting forward)
export function placeAtCameraTarget(scene, camera, type = 'box') {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const dir = raycaster.ray.direction;
  const pos = camera.position.clone().add(dir.multiplyScalar(5));

  // Snap to floor for boxes
  if (type === 'box') {
    return addBox(scene, pos.x, 1, pos.z);
  } else {
    return addSphere(scene, pos.x, Math.max(pos.y, 1), pos.z);
  }
}
