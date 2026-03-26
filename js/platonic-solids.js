// Platonic solid vertex & edge data — all vertices on the unit sphere.
// Each solid: { name, vertices: [[x,y,z],...], edges: [[i,j],...] }

const PHI = (1 + Math.sqrt(5)) / 2; // golden ratio ≈ 1.618

function normalize(v) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

function makeVertices(raw) {
  return raw.map(normalize);
}

// --- Tetrahedron: 4 vertices, 6 edges ---
const tetrahedron = {
  name: 'Tetrahedron',
  vertices: makeVertices([
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ]),
  edges: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ],
};

// --- Cube (Hexahedron): 8 vertices, 12 edges ---
const cube = {
  name: 'Cube',
  vertices: makeVertices([
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [1, -1, -1],
    [-1, 1, 1],
    [-1, 1, -1],
    [-1, -1, 1],
    [-1, -1, -1],
  ]),
  edges: [
    [0, 1],
    [0, 2],
    [0, 4],
    [1, 3],
    [1, 5],
    [2, 3],
    [2, 6],
    [3, 7],
    [4, 5],
    [4, 6],
    [5, 7],
    [6, 7],
  ],
};

// --- Octahedron: 6 vertices, 12 edges ---
const octahedron = {
  name: 'Octahedron',
  vertices: makeVertices([
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ]),
  edges: [
    [0, 2],
    [0, 3],
    [0, 4],
    [0, 5],
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    [2, 4],
    [2, 5],
    [3, 4],
    [3, 5],
  ],
};

// --- Dodecahedron: 20 vertices, 30 edges ---
const INV_PHI = 1 / PHI;
const dodecahedron = {
  name: 'Dodecahedron',
  vertices: makeVertices([
    // cube vertices
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [1, -1, -1],
    [-1, 1, 1],
    [-1, 1, -1],
    [-1, -1, 1],
    [-1, -1, -1],
    // rectangles on coordinate planes
    [0, PHI, INV_PHI],
    [0, PHI, -INV_PHI],
    [0, -PHI, INV_PHI],
    [0, -PHI, -INV_PHI],
    [INV_PHI, 0, PHI],
    [-INV_PHI, 0, PHI],
    [INV_PHI, 0, -PHI],
    [-INV_PHI, 0, -PHI],
    [PHI, INV_PHI, 0],
    [PHI, -INV_PHI, 0],
    [-PHI, INV_PHI, 0],
    [-PHI, -INV_PHI, 0],
  ]),
  edges: [
    [0, 8],
    [0, 12],
    [0, 16],
    [1, 9],
    [1, 14],
    [1, 16],
    [2, 10],
    [2, 12],
    [2, 17],
    [3, 11],
    [3, 14],
    [3, 17],
    [4, 8],
    [4, 13],
    [4, 18],
    [5, 9],
    [5, 15],
    [5, 18],
    [6, 10],
    [6, 13],
    [6, 19],
    [7, 11],
    [7, 15],
    [7, 19],
    [8, 9],
    [10, 11],
    [12, 13],
    [14, 15],
    [16, 17],
    [18, 19],
  ],
};

// --- Icosahedron: 12 vertices, 30 edges ---
const icosahedron = {
  name: 'Icosahedron',
  vertices: makeVertices([
    [0, 1, PHI],
    [0, 1, -PHI],
    [0, -1, PHI],
    [0, -1, -PHI],
    [1, PHI, 0],
    [1, -PHI, 0],
    [-1, PHI, 0],
    [-1, -PHI, 0],
    [PHI, 0, 1],
    [PHI, 0, -1],
    [-PHI, 0, 1],
    [-PHI, 0, -1],
  ]),
  edges: [
    [0, 2],
    [0, 4],
    [0, 6],
    [0, 8],
    [0, 10],
    [1, 3],
    [1, 4],
    [1, 6],
    [1, 9],
    [1, 11],
    [2, 5],
    [2, 7],
    [2, 8],
    [2, 10],
    [3, 5],
    [3, 7],
    [3, 9],
    [3, 11],
    [4, 6],
    [4, 8],
    [4, 9],
    [5, 7],
    [5, 8],
    [5, 9],
    [6, 10],
    [6, 11],
    [7, 10],
    [7, 11],
    [8, 9],
    [10, 11],
  ],
};

const solids = [tetrahedron, cube, octahedron, dodecahedron, icosahedron];

export default solids;
