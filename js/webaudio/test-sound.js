import {audioCtx} from './webaudio'
import {masterChannel} from './master'
import {panners} from './endpoints'
import Scene from './../scene'
import * as SoundUtils from './sound-util'
import player from '../player'
import {numberOfRays} from '../config.js'


var noise = SoundUtils.createNoise(0.3);
var s440 = SoundUtils.createSine(440, 0.5);
var s560 = SoundUtils.createSine(560, 0.4);

var playing = false;

function playSound(){
  if(playing){

  } else {
    startBuffer(noise, 0);
    playing=true;
  }
}

var sounds = new Array(panners.length);
var sixteeth = audioCtx.sampleRate/60;
var noise = SoundUtils.createNoise(.4);

function playAllSounds(){
  for(var i = 0; i< Scene._distances.length; i++){
    var d = Scene._distances[i];
    if(d>400){
      sounds[i] = SoundUtils.createNoise(1000/(d*d));
    } else {
      sounds[i] = SoundUtils.createSine(10000/d, d/300);
    }
  }

  for(var i = 0; i<sounds.length; i++){
    startBuffer(sounds[i], i);
  }
}

function soundFromDistance(d){
  // if(d>500){
  //   return SoundUtils.createNoise(1000/(d*d), length);
  // } else {
    var freq = 20000/d;
    var length = audioCtx.sampleRate/freq;
    return SoundUtils.createSine(freq, d/500, length);
  // }
}

var soundsPlaying = false;


var lastPosition = {x: 0, y: 0};
var oscillators = new Array(panners.length);
var gains = new Array(panners.length);

for(var i = 0; i<gains.length; i++){
  gains[i] = audioCtx.createGain();
  gains[i].connect(masterChannel);
}

function toggleContinuous(){
  soundsPlaying = !soundsPlaying;
  if(soundsPlaying){
    for(var i = 0; i<gains.length; i++){
      oscillators[i] = audioCtx.createOscillator();
      oscillators[i].connect(gains[i]);
      oscillators[i].start();
    }
  } else {
    for(var osc of oscillators){
      osc.stop();
    }
  }
}

// --- Quaternion decomposition ---
// 180 rays split into 4 quadrants of 45 rays each
const Q_SIZE = numberOfRays / 4;
const DIST_CLAMP = 2000;
const SMOOTH_TIME = 0.02; // seconds — smooth audio parameter transitions

function quadrantMean(distances, start) {
  let sum = 0;
  for (let i = start; i < start + Q_SIZE; i++) {
    sum += Math.min(distances[i], DIST_CLAMP);
  }
  return sum / Q_SIZE;
}

// Sign pattern per quadrant (mirrors quaternion multiplication i,j,k axes)
const Q_SIGNS = [
  [1, 1, 1],   // Q0: +i +j +k
  [-1, 1, -1],  // Q1: -i +j -k
  [-1, -1, 1],  // Q2: -i -j +k
  [1, -1, -1],  // Q3: +i -j -k
];

function updatePlay(){
  if (!soundsPlaying) return;
  if (lastPosition.x === player.x && lastPosition.y === player.y) return;

  lastPosition = {x: player.x, y: player.y};

  const pd = Scene._primaryDistances;
  if (!pd || pd.length < numberOfRays) return;

  // Compute quadrant means
  const m0 = quadrantMean(pd, 0);
  const m1 = quadrantMean(pd, Q_SIZE);
  const m2 = quadrantMean(pd, Q_SIZE * 2);
  const m3 = quadrantMean(pd, Q_SIZE * 3);

  // Quaternion components
  const w = Math.max((m0 + m1 + m2 + m3) / 4, 1);
  const qi = (m0 + m3 - m1 - m2) / (2 * w);
  const qj = (m0 + m1 - m2 - m3) / (2 * w);
  const qk = (m0 + m2 - m1 - m3) / (2 * w);

  // Quaternion-derived harmonic offsets
  const baseFreq = 20000 / w;
  const iOffset = qi * 200;
  const jOffset = qj * 150;
  const kOffset = qk * 100;

  const now = audioCtx.currentTime;

  for (let idx = 0; idx < numberOfRays; idx++) {
    const osc = oscillators[idx];
    const gain = gains[idx];
    if (!osc || !gain) continue;

    const d = Math.min(pd[idx], DIST_CLAMP);

    if (d >= DIST_CLAMP) {
      osc.frequency.setTargetAtTime(0, now, SMOOTH_TIME);
      gain.gain.setTargetAtTime(0, now, SMOOTH_TIME);
      continue;
    }

    const rawFreq = 20000 / d;

    // Quaternion modulation — blend per-ray spatial frequency with quadrant harmonic
    const qIdx = Math.floor(idx / Q_SIZE);
    const signs = Q_SIGNS[qIdx];
    const qWeight = signs[0] * iOffset + signs[1] * jOffset + signs[2] * kOffset;
    const freq = Math.max(rawFreq * 0.7 + (baseFreq + qWeight) * 0.3, 20);

    osc.frequency.setTargetAtTime(freq, now, SMOOTH_TIME);
    gain.gain.setTargetAtTime(Math.min(d / 5000, 0.3) * Math.min(w / 500, 1.0), now, SMOOTH_TIME);
  }
}


function startBuffer(buffer, channel){
  var node = SoundUtils.createNodeFromBuffer(buffer);
  node.connect(panners[channel]);
  node.start();
  node.onended = function(){
    playing = false;
  };
}

export {playSound, playAllSounds, updatePlay, toggleContinuous}