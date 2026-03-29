import { audioCtx } from '../../webaudio/webaudio.js';
import { masterChannel } from '../../webaudio/master.js';
import { numberOfRays, rayDirections } from '../config.js';

// Create HRTF panners positioned on fibonacci sphere (3D, not just XZ circle)
// This extends the 2D approach in endpoints.js where panners were on a 2D circle

function createPanner3D(direction) {
  const panner = audioCtx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'linear';
  panner.refDistance = 1;
  panner.maxDistance = 50;
  panner.setPosition(direction.x, direction.y, direction.z);
  panner.connect(masterChannel);
  return panner;
}

export const panners = new Array(numberOfRays);

export function createPanners3D() {
  for (let i = 0; i < numberOfRays; i++) {
    panners[i] = createPanner3D(rayDirections[i]);
  }
}
