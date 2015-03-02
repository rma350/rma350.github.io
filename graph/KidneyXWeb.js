var processClick = function(event) {
	var adjustX = event.clientX - graphCanvasOffsetX;
	var adjustY = event.clientY - graphCanvasOffsetY;
	console.log("The canvas was clicked! at (" + adjustX + ", " + adjustY + ")");
	jOnClick(adjustX, adjustY);
}

var processScroll = function(event) {
	console.log(event);
	var delta = Math.max(-1, Math.min(1, (event.wheelDelta || -event.detail)));
	console.log("delta = " + delta);
	var adjustX = event.clientX - graphCanvasOffsetX;
	var adjustY = event.clientY - graphCanvasOffsetY;
	console.log("The canvas was scrolled! at (" + adjustX + ", " + adjustY + ")");
	jOnMouseWheel(adjustX, adjustY, delta);
	if(event.preventDefault){
		event.preventDefault();
	}	
	return false;
}

/**
 * Provides requestAnimationFrame in a cross browser way.
 */
window.requestAnimFrame = (function() {
	console.log("request frame");
  return window.requestAnimationFrame ||
         window.webkitRequestAnimationFrame ||
         window.mozRequestAnimationFrame ||
         window.oRequestAnimationFrame ||
         window.msRequestAnimationFrame ||
         function(/* function FrameRequestCallback */ callback) {//, /* DOMElement Element */ element) {
	       console.log("starting time out");
           return window.setTimeout(callback, 1000/60);
         };
})();

/**
 * Provides cancelAnimationFrame in a cross browser way.
 */
window.cancelAnimFrame = (function() {
  return window.cancelAnimationFrame ||
         window.webkitCancelAnimationFrame ||
         window.mozCancelAnimationFrame ||
         window.oCancelAnimationFrame ||
         window.msCancelAnimationFrame ||
         window.clearTimeout;
})();

var tick = function() {
	//console.log("tick");
    requestAnimFrame(tick);
    //console.log("draw");
    jDrawScene();
    //console.log("update");
    jUpdate();
    //console.log("done");
}

function onStart() {
	jSetupGL();
	tick();
}

function onGWTModuleLoaded() {
    if(document.readyState === "complete") {
      onStart();
    }
    else {
     window.onload = onStart();
    } 
  }