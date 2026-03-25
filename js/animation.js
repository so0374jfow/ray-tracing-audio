import drawFrame from './frame'
import { updateAutoMovement } from './automate'

var recursiveAnim;

function startAnimationLoop(){
  var animFrame = window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame    ||
      window.oRequestAnimationFrame      ||
      window.msRequestAnimationFrame     ||
      null ;

  recursiveAnim = function() {
    updateAutoMovement();
    drawFrame();
    animFrame( recursiveAnim );
  };
  animFrame(recursiveAnim);
  console.log("Starting animation.")
}

function stopAnimationLoop(){
  recursiveAnim = function(){
    console.log("Stopping animation!");
  }
}

export {startAnimationLoop, stopAnimationLoop};