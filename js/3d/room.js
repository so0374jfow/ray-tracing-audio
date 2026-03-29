import * as THREE from 'three';
import { roomWidth, roomHeight, roomDepth } from './config.js';
import { MATERIALS } from './ray-tracing/materials.js';

// Each wall is a visual mesh + a logical plane for ray intersection
// Plane: { point: {x,y,z}, normal: {x,y,z}, bounds: {min, max}, material: string }

const halfW = roomWidth / 2;
const halfD = roomDepth / 2;

export const walls = [
  // Floor (y=0)
  {
    point: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    bounds: {
      min: { x: -halfW, y: 0, z: -halfD },
      max: { x: halfW, y: 0, z: halfD },
    },
    material: 'concrete',
    axes: ['x', 'z'],
  },
  // Ceiling (y=roomHeight)
  {
    point: { x: 0, y: roomHeight, z: 0 },
    normal: { x: 0, y: -1, z: 0 },
    bounds: {
      min: { x: -halfW, y: roomHeight, z: -halfD },
      max: { x: halfW, y: roomHeight, z: halfD },
    },
    material: 'concrete',
    axes: ['x', 'z'],
  },
  // Left wall (x=-halfW)
  {
    point: { x: -halfW, y: 0, z: 0 },
    normal: { x: 1, y: 0, z: 0 },
    bounds: {
      min: { x: -halfW, y: 0, z: -halfD },
      max: { x: -halfW, y: roomHeight, z: halfD },
    },
    material: 'concrete',
    axes: ['y', 'z'],
  },
  // Right wall (x=halfW)
  {
    point: { x: halfW, y: 0, z: 0 },
    normal: { x: -1, y: 0, z: 0 },
    bounds: {
      min: { x: halfW, y: 0, z: -halfD },
      max: { x: halfW, y: roomHeight, z: halfD },
    },
    material: 'concrete',
    axes: ['y', 'z'],
  },
  // Back wall (z=-halfD)
  {
    point: { x: 0, y: 0, z: -halfD },
    normal: { x: 0, y: 0, z: 1 },
    bounds: {
      min: { x: -halfW, y: 0, z: -halfD },
      max: { x: halfW, y: roomHeight, z: -halfD },
    },
    material: 'concrete',
    axes: ['x', 'y'],
  },
  // Front wall (z=halfD)
  {
    point: { x: 0, y: 0, z: halfD },
    normal: { x: 0, y: 0, z: -1 },
    bounds: {
      min: { x: -halfW, y: 0, z: halfD },
      max: { x: halfW, y: roomHeight, z: halfD },
    },
    material: 'concrete',
    axes: ['x', 'y'],
  },
];

export function createRoomMeshes(scene) {
  const meshes = [];

  // Floor
  const floorGeo = new THREE.PlaneGeometry(roomWidth, roomDepth);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x666670,
    roughness: 0.9,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  meshes.push(floor);

  // Grid on floor
  const grid = new THREE.GridHelper(Math.max(roomWidth, roomDepth), 20, 0x555555, 0x333333);
  scene.add(grid);

  // Ceiling
  const ceilGeo = new THREE.PlaneGeometry(roomWidth, roomDepth);
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0x555560,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const ceil = new THREE.Mesh(ceilGeo, ceilMat);
  ceil.position.y = roomHeight;
  ceil.rotation.x = Math.PI / 2;
  scene.add(ceil);
  meshes.push(ceil);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x667788,
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  // Left wall
  const leftGeo = new THREE.PlaneGeometry(roomDepth, roomHeight);
  const left = new THREE.Mesh(leftGeo, wallMat.clone());
  left.position.set(-halfW, roomHeight / 2, 0);
  left.rotation.y = Math.PI / 2;
  scene.add(left);
  meshes.push(left);

  // Right wall
  const right = new THREE.Mesh(leftGeo.clone(), wallMat.clone());
  right.position.set(halfW, roomHeight / 2, 0);
  right.rotation.y = -Math.PI / 2;
  scene.add(right);
  meshes.push(right);

  // Back wall
  const backGeo = new THREE.PlaneGeometry(roomWidth, roomHeight);
  const back = new THREE.Mesh(backGeo, wallMat.clone());
  back.position.set(0, roomHeight / 2, -halfD);
  scene.add(back);
  meshes.push(back);

  // Front wall
  const front = new THREE.Mesh(backGeo.clone(), wallMat.clone());
  front.position.set(0, roomHeight / 2, halfD);
  front.rotation.y = Math.PI;
  scene.add(front);
  meshes.push(front);

  return meshes;
}
