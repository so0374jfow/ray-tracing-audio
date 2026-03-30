import { audioCtx } from '../../webaudio/webaudio.js';
import { masterChannel } from '../../webaudio/master.js';
import { numberOfRays, distClamp, smoothTime } from '../config.js';
import { panners, createPanners3D } from './panners3d.js';

// Oscillators, gains, and lowpass filters -- one per ray
let oscillators = new Array(numberOfRays);
let gains = new Array(numberOfRays);
let filters = new Array(numberOfRays); // BiquadFilter for muffling
let soundsPlaying = false;

// 8 octants for 3D modulation
const OCTANT_SIZE = Math.ceil(numberOfRays / 8);

const OCTANT_SIGNS = [
  [1, 1, 1],
  [-1, 1, 1],
  [1, -1, 1],
  [-1, -1, 1],
  [1, 1, -1],
  [-1, 1, -1],
  [1, -1, -1],
  [-1, -1, -1],
];

function octantMean(distances, start) {
  let sum = 0;
  let count = 0;
  for (let i = start; i < start + OCTANT_SIZE && i < numberOfRays; i++) {
    sum += Math.min(distances[i], distClamp);
    count++;
  }
  return count > 0 ? sum / count : distClamp;
}

export function initAudio() {
  createPanners3D();

  for (let i = 0; i < numberOfRays; i++) {
    // Lowpass filter for occlusion muffling
    filters[i] = audioCtx.createBiquadFilter();
    filters[i].type = 'lowpass';
    filters[i].frequency.value = 20000; // fully open
    filters[i].Q.value = 0.7;

    gains[i] = audioCtx.createGain();
    gains[i].gain.value = 0;

    // Chain: oscillator -> filter -> gain -> master
    filters[i].connect(gains[i]);
    gains[i].connect(masterChannel);
  }
}

export function toggleAudio() {
  soundsPlaying = !soundsPlaying;

  if (soundsPlaying) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    for (let i = 0; i < numberOfRays; i++) {
      oscillators[i] = audioCtx.createOscillator();
      oscillators[i].connect(filters[i]);
      oscillators[i].start();
    }
  } else {
    for (const osc of oscillators) {
      if (osc) osc.stop();
    }
    oscillators = new Array(numberOfRays);
  }

  return soundsPlaying;
}

export function updateAudio(traceResults, cameraPosition, cameraForward, cameraUp) {
  if (!soundsPlaying || !traceResults) return;

  // Update AudioListener to match camera
  const listener = audioCtx.listener;
  if (listener.positionX) {
    listener.positionX.setValueAtTime(cameraPosition.x, audioCtx.currentTime);
    listener.positionY.setValueAtTime(cameraPosition.y, audioCtx.currentTime);
    listener.positionZ.setValueAtTime(cameraPosition.z, audioCtx.currentTime);
    listener.forwardX.setValueAtTime(cameraForward.x, audioCtx.currentTime);
    listener.forwardY.setValueAtTime(cameraForward.y, audioCtx.currentTime);
    listener.forwardZ.setValueAtTime(cameraForward.z, audioCtx.currentTime);
    listener.upX.setValueAtTime(cameraUp.x, audioCtx.currentTime);
    listener.upY.setValueAtTime(cameraUp.y, audioCtx.currentTime);
    listener.upZ.setValueAtTime(cameraUp.z, audioCtx.currentTime);
  } else {
    listener.setPosition(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    listener.setOrientation(
      cameraForward.x,
      cameraForward.y,
      cameraForward.z,
      cameraUp.x,
      cameraUp.y,
      cameraUp.z
    );
  }

  // Collect distances
  const distances = new Array(numberOfRays);
  for (let i = 0; i < numberOfRays; i++) {
    distances[i] = traceResults[i].totalDistance;
  }

  // Compute octant means
  const means = [];
  for (let o = 0; o < 8; o++) {
    means.push(octantMean(distances, o * OCTANT_SIZE));
  }

  // Overall mean distance
  const w = Math.max(means.reduce((a, b) => a + b, 0) / 8, 1);

  // Octant-based harmonic components
  const baseFreq = 20000 / w;
  const iOffset = (((means[0] + means[2] + means[4] + means[6]) / 4 - w) / w) * 200;
  const jOffset = (((means[0] + means[1] + means[4] + means[5]) / 4 - w) / w) * 150;
  const kOffset = (((means[0] + means[1] + means[2] + means[3]) / 4 - w) / w) * 100;

  const now = audioCtx.currentTime;

  for (let i = 0; i < numberOfRays; i++) {
    const osc = oscillators[i];
    const gain = gains[i];
    const filter = filters[i];
    if (!osc || !gain || !filter) continue;

    const d = Math.min(distances[i], distClamp);
    const absorption = traceResults[i].accumulatedAbsorption;
    const occlusion = traceResults[i].occlusionFactor;

    if (d >= distClamp) {
      osc.frequency.setTargetAtTime(0, now, smoothTime);
      gain.gain.setTargetAtTime(0, now, smoothTime);
      filter.frequency.setTargetAtTime(20000, now, smoothTime);
      continue;
    }

    const rawFreq = 20000 / d;

    // Octant modulation
    const octIdx = Math.min(Math.floor(i / OCTANT_SIZE), 7);
    const signs = OCTANT_SIGNS[octIdx];
    const qWeight = signs[0] * iOffset + signs[1] * jOffset + signs[2] * kOffset;
    const freq = Math.max(rawFreq * 0.7 + (baseFreq + qWeight) * 0.3, 20);

    osc.frequency.setTargetAtTime(freq, now, smoothTime);

    // Gain: distance + absorption + occlusion
    const distGain = Math.min(d / (distClamp * 100), 0.3);
    const absGain = absorption;
    const occGain = 0.3 + 0.7 * occlusion; // occluded rays are quieter but not silent
    const totalGain = distGain * absGain * occGain * Math.min(w / (distClamp * 10), 1.0);
    gain.gain.setTargetAtTime(totalGain, now, smoothTime);

    // Lowpass muffling: occluded rays get muffled (lower cutoff frequency)
    // occlusion 1.0 = fully visible = 20kHz (no muffling)
    // occlusion 0.0 = fully blocked = 300Hz (heavy muffling)
    const cutoff = 300 + occlusion * 19700;
    filter.frequency.setTargetAtTime(cutoff, now, smoothTime);
  }
}

export function isAudioPlaying() {
  return soundsPlaying;
}
