import * as THREE from 'three';
import { invalidateCache, setSceneObjects } from '../ray-tracing/trace.js';

// Manages placeable 3D objects that participate in ray intersection
// Each object has both a Three.js mesh (visual) and a logical shape (intersection)

const objects = [];
const meshes = [];

const objectColors = {
  box: 0xcc6644,
  sphere: 0x4466cc,
};

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
