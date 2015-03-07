var graphCanvasOffsetX;
var graphCanvasOffsetY;

// Maps identifier to last touch location
var lastTouchMapX = {};
var lastTouchMapY = {};

var lastAvgDist = 0;

var processClick = function(event) {
	var adjustX = event.clientX - graphCanvasOffsetX;
	var adjustY = event.clientY - graphCanvasOffsetY;
	console.log("The canvas was clicked! at (" + adjustX + ", " + adjustY + ")");
	jOnClick(adjustX, adjustY);
}

var processMouseMove = function(event) {
	//console.log(event);
	if(event.which == 1){
	  var adjustX = event.clientX - graphCanvasOffsetX;
	  var adjustY = event.clientY - graphCanvasOffsetY;
	  //console.log("The mouse was moved, location (" + adjustX + ", " + adjustY + ")" 
	  // + " delta: (" + event.movementX + ", " + event.movementY + ")");
	  jOnMouseMove(event.movementX, event.movementY);
	}
}

var averageDistToPoint = function(event, pointX, pointY) {
	var totalDistToPoint = 0;
	for(var j = 0; j < event.targetTouches.length; j++){
		var u = event.targetTouches[j];
		var x = u.clientX - graphCanvasOffsetX;
		var y = u.clientY - graphCanvasOffsetY;
		totalDistToPoint += Math.sqrt( (pointX - x)*(pointX - x) + (pointY - y)*(pointY - y));
	}
	return totalDistToPoint/event.targetTouches.length;
}

var averagePoint = function(event) {
	var centerX = 0;
	var centerY = 0;
	for(var i = 0; i < event.targetTouches.length; i++){
		var t = event.targetTouches[i];
		centerX += (t.clientX - graphCanvasOffsetX);
		centerY += (t.clientY - graphCanvasOffsetY);			
	}
	centerX = centerX/event.targetTouches.length;
	centerY = centerY/event.targetTouches.length;
	return [centerX, centerY];
}

var resetScale = function(event){
	var center = averagePoint(event);
	lastTouchMapX["center"] = center[0];
	lastTouchMapY["center"] = center[1];
	lastAvgDist = averageDistToPoint(event, center[0], center[1]);
}

var processTouchStart = function(event) {
	for(var i = 0; i < event.changedTouches.length; i++){
		var t = event.changedTouches[i];
		if(t.identifier in lastTouchMapX || t.identifier in lastTouchMapY){
			console.log("warning: found a location for a finger that just went down.")
		}
		lastTouchMapX[t.identifier] = t.clientX - graphCanvasOffsetX;
		lastTouchMapY[t.identifier] = t.clientY - graphCanvasOffsetY;
	}
	if(event.targetTouches.length > 1){
		resetScale(event);
	}
}

var processTouchEnd = function(event) {
	for(var i = 0; i < event.changedTouches.length; i++){
		var t = event.changedTouches[i];
		if(t.identifier in lastTouchMapX) {
			delete lastTouchMapX[t.identifier];
		}
		else{
			console.log("warning: missing last locationX on touch end");
		}
		if(t.identifier in lastTouchMapY){
			delete lastTouchMapY[t.identifier];
		}
		else{
			console.log("warning: missing last locationY on touch end");
		}
	}
	if(event.targetTouches.length > 1){
		resetScale(event);
	} else {
		delete lastTouchMapX["center"];
		delete lastTouchMapY["center"];
		lastAvgDist = 0;
	}	
}

var processTouchMove = function(event) {
	event.preventDefault();
	if(event.targetTouches.length == 1){
		var tSingle = event.targetTouches[0];
		if(tSingle.identifier in lastTouchMapX && tSingle.identifier in lastTouchMapY){
			var deltaX = (tSingle.clientX - graphCanvasOffsetX) - lastTouchMapX[tSingle.identifier];
			var deltaY = (tSingle.clientY - graphCanvasOffsetY) - lastTouchMapY[tSingle.identifier];
			// console.log("Touch drag event, delta: (" + deltaX + ", " + deltaY + ")");
			jOnMouseMove(deltaX, deltaY);
		}
	}
	else if(event.targetTouches.length > 1){
		var newCenter = averagePoint(event);
		var newAvgDist = averageDistToPoint(event, newCenter[0], newCenter[1]);
		
		var deltaX = newCenter[0] - lastTouchMapX["center"];
		var deltaY = newCenter[1] - lastTouchMapY["center"];
		
		console.log("Multi fingered drag event, delta: (" + deltaX + ", " + deltaY + ")");
		jOnMouseMove(deltaX, deltaY);
		
		var zoomRatio = newAvgDist/lastAvgDist;
		console.log("Multi fingered scale event, zoom ratio: " + zoomRatio);
		jOnZoomAbout(newCenter[0], newCenter[1], zoomRatio);
		
		lastAvgDist = newAvgDist;
		lastTouchMapX["center"] = newCenter[0];
		lastTouchMapY["center"] = newCenter[1];
		
	}
	for(var i = 0; i < event.targetTouches.length; i++){
		var t = event.targetTouches[i];
		lastTouchMapX[t.identifier] = t.clientX - graphCanvasOffsetX;
		lastTouchMapY[t.identifier] = t.clientY - graphCanvasOffsetY;
	}
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

function resizeCanvas() {
	var gCanvas = document.getElementById("graph-canvas");
	gCanvas.width = window.innerWidth;
	gCanvas.height = window.innerHeight;
	graphCanvasOffsetX = gCanvas.offsetLeft;
	graphCanvasOffsetY = gCanvas.offsetTop;
	jResize(gCanvas.width, gCanvas.height);
}

function onStart() {
	var gCanvas = document.getElementById("graph-canvas");
	gCanvas.width = window.innerWidth;
	gCanvas.height = window.innerHeight;
	graphCanvasOffsetX = gCanvas.offsetLeft;
	graphCanvasOffsetY = gCanvas.offsetTop;
    console.log("The canvas offset is (" + graphCanvasOffsetX + ", " + graphCanvasOffsetY + ")");
    
    window.addEventListener('resize', resizeCanvas, false);
    
    // document.getElementById("graph-canvas").addEventListener("click",processClick);
    gCanvas.addEventListener("mousemove",processMouseMove,false);
    gCanvas.addEventListener("touchstart",processTouchStart,false);
    gCanvas.addEventListener("touchmove",processTouchMove,false);
    gCanvas.addEventListener("touchend",processTouchEnd,false);
    gCanvas.addEventListener("mousewheel",processScroll,false);
    gCanvas.addEventListener("DOMMouseScroll",processScroll, false);
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