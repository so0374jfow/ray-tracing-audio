import { startAnimationLoop } from './animation';
import { init as initAutomate, setCustomMovement } from './automate';
import { generateCayleyGraph, drawCayleyLabels, updateCayleyMovement } from './cayley-env';
import Scene from './scene';

// Patch Scene.render to draw Cayley labels on top
const originalRender = Scene.render.bind(Scene);
Scene.render = function () {
  originalRender();
  drawCayleyLabels();
};

// Use cyclic Q8 movement instead of random wandering
setCustomMovement(updateCayleyMovement);

// Init with Cayley graph (no regeneration — static environment)
initAutomate(generateCayleyGraph, false);
startAnimationLoop();
