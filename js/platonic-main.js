import { startAnimationLoop } from './animation';
import { init as initAutomate, setCustomMovement } from './automate';
import {
  generatePlatonicEnvironment,
  updatePlatonicGeometry,
  getCurrentSolidName,
  drawInnerEdges,
} from './platonic-env';
import Scene from './scene';
import { ctx } from './canvas';

// Patch Scene.render to draw inner edges (visual only) and label overlay
const originalRender = Scene.render.bind(Scene);
Scene.render = function () {
  drawInnerEdges(ctx);
  originalRender();
  drawLabel();
};

function drawLabel() {
  const name = getCurrentSolidName();
  ctx.save();
  ctx.font = '16px monospace';
  ctx.fillStyle = 'rgba(150, 150, 150, 0.7)';
  ctx.textAlign = 'right';
  ctx.fillText(name, ctx.canvas.width - 16, 30);
  ctx.restore();
}

// Keep player static at center; update geometry each frame instead
setCustomMovement(updatePlatonicGeometry);

// Init with platonic environment (no interval regeneration)
initAutomate(generatePlatonicEnvironment, false);
startAnimationLoop();
