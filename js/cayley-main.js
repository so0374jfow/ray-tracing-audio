import { startAnimationLoop } from './animation';
import { init as initAutomate } from './automate';
import { generateCayleyGraph, drawCayleyLabels } from './cayley-env';
import Scene from './scene';

// Patch Scene.render to draw Cayley labels on top
const originalRender = Scene.render.bind(Scene);
Scene.render = function () {
  originalRender();
  drawCayleyLabels();
};

// Init with Cayley graph (no regeneration — static environment)
initAutomate(generateCayleyGraph, false);
startAnimationLoop();
