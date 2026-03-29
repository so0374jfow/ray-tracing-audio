import { startAnimationLoop } from './animation';
import { init as initAutomate, setCustomMovement } from './automate';
import {
  generatePlatonicEnvironment,
  updatePlatonicGeometry,
  getCurrentSolidName,
  drawInnerEdges,
  getHull,
} from './platonic-env';
import { initText, layoutAroundObstacle, renderLines } from './text-layout';
import Scene from './scene';
import { ctx } from './canvas';
import { viewport } from './util/browser-util';

const TEXT_FONT = '15px Georgia, serif';
const TEXT_COLOR = 'rgba(180, 180, 180, 0.85)';
const LINE_HEIGHT = 22;
const MARGIN = 30;

const SAMPLE_TEXT =
  'In three-dimensional space, a Platonic solid is a regular, convex polyhedron. ' +
  'It is constructed by congruent regular polygonal faces with the same number of faces ' +
  'meeting at each vertex. Five solids meet these criteria: the tetrahedron, cube, ' +
  'octahedron, dodecahedron, and icosahedron. They are named after the ancient Greek ' +
  'philosopher Plato, who theorized in his dialogue the Timaeus that the classical ' +
  'elements were made of these regular solids. The tetrahedron represented fire, the ' +
  'cube represented earth, the octahedron represented air, the icosahedron represented ' +
  'water, and the dodecahedron represented the cosmos or the shape of the universe ' +
  'itself. These five forms have fascinated mathematicians, artists, and philosophers ' +
  'for millennia. They appear in crystal structures, viral capsids, and the geometry ' +
  'of spacetime. Johannes Kepler attempted to relate the five solids to the distances ' +
  'of the known planets from the Sun. In modern mathematics, they connect to group ' +
  'theory, topology, and the classification of finite simple groups. Each solid is the ' +
  'dual of another: the cube and octahedron are duals, as are the dodecahedron and ' +
  'icosahedron. The tetrahedron is self-dual. When one solid morphs into its dual, ' +
  'vertices become faces and faces become vertices, a beautiful symmetry that echoes ' +
  'through every branch of mathematics. Sound propagates through space much as light ' +
  'does, bouncing off surfaces and carrying information about the geometry of the ' +
  'environment. Here, rays trace paths from a listener outward, reflecting off the ' +
  'edges of these ancient forms, and the distances they travel become frequencies ' +
  'you can hear. The shape of the solid becomes the shape of the sound.';

let prepared = null;

// Patch Scene.render to draw inner edges, text, and label
const originalRender = Scene.render.bind(Scene);
Scene.render = function () {
  drawInnerEdges(ctx);
  originalRender();
  drawText();
  drawLabel();
};

function drawText() {
  if (!prepared) return;
  const { width, height } = viewport();
  const hull = getHull();
  const region = {
    x: MARGIN,
    y: MARGIN,
    width: width - MARGIN * 2,
    height: height - MARGIN * 2,
  };
  const lines = layoutAroundObstacle(prepared, hull, region, LINE_HEIGHT);
  renderLines(ctx, lines, TEXT_FONT, TEXT_COLOR);
}

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

// Prepare text once after DOM is ready
prepared = initText(SAMPLE_TEXT, TEXT_FONT);

startAnimationLoop();
