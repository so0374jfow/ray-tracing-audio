import { startAnimationLoop } from './animation';
import { init as initAutomate } from './automate';
import { generateWebcamEnvironment } from './camera-env';

// Init with webcam environment (no interval regeneration — camera-env manages its own)
initAutomate(generateWebcamEnvironment, false);
startAnimationLoop();
