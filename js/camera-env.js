import { viewport } from './util/browser-util';
import Line from './geometry/Line';
import Scene from './scene';
import colors from './misc/colors';

// --- Webcam environment generator ---
// Captures webcam video, downscales to a small grid, thresholds brightness,
// and places line segments on boundaries between dark and light cells.
// The webcam silhouette becomes walls that rays bounce off.

const GRID_COLS = 48;
const GRID_ROWS = 36;
const UPDATE_INTERVAL = 300; // ms between environment updates
const BRIGHTNESS_THRESHOLD = 100; // 0-255; below = solid

let videoElement = null;
let offscreenCanvas = null;
let offscreenCtx = null;
let updateTimer = null;
let webcamReady = false;

function initWebcam() {
  videoElement = document.getElementById('webcam');
  if (!videoElement) {
    console.warn('No <video id="webcam"> element found');
    return;
  }

  offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = GRID_COLS;
  offscreenCanvas.height = GRID_ROWS;
  offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } })
    .then((stream) => {
      videoElement.srcObject = stream;
      videoElement.addEventListener('loadedmetadata', () => {
        webcamReady = true;
        updateTimer = setInterval(processFrame, UPDATE_INTERVAL);
      });
    })
    .catch((err) => {
      console.warn('Webcam access denied:', err.message);
    });
}

function processFrame() {
  if (!webcamReady || videoElement.readyState < videoElement.HAVE_CURRENT_DATA) return;

  // Draw mirrored webcam to offscreen canvas at grid resolution
  offscreenCtx.save();
  offscreenCtx.translate(GRID_COLS, 0);
  offscreenCtx.scale(-1, 1);
  offscreenCtx.drawImage(videoElement, 0, 0, GRID_COLS, GRID_ROWS);
  offscreenCtx.restore();

  // Get pixel data
  const imageData = offscreenCtx.getImageData(0, 0, GRID_COLS, GRID_ROWS);
  const data = imageData.data;

  // Build binary grid from brightness
  const grid = new Uint8Array(GRID_COLS * GRID_ROWS);
  for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
    const idx = i * 4;
    const grey = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    grid[i] = grey < BRIGHTNESS_THRESHOLD ? 1 : 0;
  }

  // Extract boundary lines and populate scene
  updateSceneFromGrid(grid);
}

function updateSceneFromGrid(grid) {
  Scene.finishedLines.length = 0;
  Scene.circles.length = 0;

  const { width, height } = viewport();
  const cellW = width / GRID_COLS;
  const cellH = height / GRID_ROWS;

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const current = grid[row * GRID_COLS + col];

      // Vertical boundary (check right neighbor)
      if (col < GRID_COLS - 1) {
        const right = grid[row * GRID_COLS + col + 1];
        if (current !== right) {
          const x = (col + 1) * cellW;
          const line = new Line(x, row * cellH, x, (row + 1) * cellH, colors.line);
          line.width = 2;
          Scene.finishedLines.push(line);
        }
      }

      // Horizontal boundary (check bottom neighbor)
      if (row < GRID_ROWS - 1) {
        const below = grid[(row + 1) * GRID_COLS + col];
        if (current !== below) {
          const y = (row + 1) * cellH;
          const line = new Line(col * cellW, y, (col + 1) * cellW, y, colors.line);
          line.width = 2;
          Scene.finishedLines.push(line);
        }
      }
    }
  }
}

export function generateWebcamEnvironment() {
  initWebcam();
}
