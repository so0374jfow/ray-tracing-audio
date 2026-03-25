import { startAnimationLoop } from './animation';
import { init as initAutomate } from './automate';

function init() {
  initAutomate();
  startAnimationLoop();
}

init();