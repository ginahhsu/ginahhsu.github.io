////Home changing title/////
var arr=['designs.','branding.','experiences.','products.','interactions.'];
var i=0;
var heading = document.querySelector('#home');

function slide(){
  home.innerHTML = arr[i];
  //opacity to 1
  home.style.opacity = 1;

  //after 2 seconds call next function
  setTimeout (next,2000);
}

console.log(arr.length);

//next function
function next(){
  console.log('after 2 secs');
  //increase index for next item in array
  i++;

  if(i > arr.length -1) {
    i=0;
  }

  console.log(i);
  //opacity to 0
  home.style.opacity = 0;

  //after 1 second call slide fuction again
  setTimeout(slide, 1000);
}
slide();

//============= play changing title ===========//
var arr=['doodler.','music lover.','Nintendo gamer.','crafter.','world traveler.'];
var i=0;
var heading = document.querySelector('#play');

function slide_play(){
  play.innerHTML = arr[i];
  //opacity to 1
  play.style.opacity = 1;

  //after 2 seconds call next function
  setTimeout (next_play,2000);
}

console.log(arr.length);

//next function
function next_play(){
  console.log('after 2 secs');
  //increase index for next item in array
  i++;

  if(i > arr.length -1) {
    i=0;
  }

  console.log(i);
  //opacity to 0
  play.style.opacity = 0;

  //after 1 second call slide fuction again
  setTimeout(slide_play, 1000);
}
slide_play();

/////////Medley photo swap #1////////
var photos = 'hmw.jpg';

function swapImage(obj) {
  var image = document.getElementById("imageToSwap");

  if (obj.parentElement.getAttribute('id') == "photos") {
    photos = obj.getAttribute('value')
  }

  image.src = "images/projects/medley/" + photos;
};



////////////Medley photo swap #2///////////////
var photos = 'innovationmatrix.jpg';

function swapImage_decide(obj) {
  var image = document.getElementById("imageToSwap_decide");

  if (obj.parentElement.getAttribute('id') == "photos") {
    photos = obj.getAttribute('value')
  }

  image.src = "images/projects/medley/" + photos;
};



//============= Scroll up button =============//
var mybutton = document.getElementById("myBtn");

// When the user clicks on the button, scroll to the top of the document
function topFunction() {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}

//============= Menu =============//
let mainNav = document.getElementById('js-menu');
let navBarToggle = document.getElementById('js-navbar-toggle');

navBarToggle.addEventListener('click', function () {
  mainNav.classList.toggle('active');
});

//============= Progress nav bar ================//
window.onload = function() {

	var toc = document.querySelector( '.toc' );
	var tocPath = document.querySelector( '.toc-marker path' );
	var tocItems;

	// Factor of screen size that the element must cross
	// before it's considered visible
	var TOP_MARGIN = 0.1,
		BOTTOM_MARGIN = 0.2;

	var pathLength;

	var lastPathStart,
		lastPathEnd;

	window.addEventListener( 'resize', drawPath, false );
	window.addEventListener( 'scroll', sync, false );

	drawPath();

	function drawPath() {

		tocItems = [].slice.call( toc.querySelectorAll( 'li' ) );

		// Cache element references and measurements
		tocItems = tocItems.map( function( item ) {
			var anchor = item.querySelector( 'a' );
			var target = document.getElementById( anchor.getAttribute( 'href' ).slice( 1 ) );

			return {
				listItem: item,
				anchor: anchor,
				target: target
			};
		} );

		// Remove missing targets
		tocItems = tocItems.filter( function( item ) {
			return !!item.target;
		} );

		var path = [];
		var pathIndent;

		tocItems.forEach( function( item, i ) {

			var x = item.anchor.offsetLeft - 5,
				y = item.anchor.offsetTop,
				height = item.anchor.offsetHeight;

			if( i === 0 ) {
				path.push( 'M', x, y, 'L', x, y + height );
				item.pathStart = 0;
			}
			else {
				// Draw an additional line when there's a change in
				// indent levels
				if( pathIndent !== x ) path.push( 'L', pathIndent, y );

				path.push( 'L', x, y );

				// Set the current path so that we can measure it
				tocPath.setAttribute( 'd', path.join( ' ' ) );
				item.pathStart = tocPath.getTotalLength() || 0;

				path.push( 'L', x, y + height );
			}

			pathIndent = x;

			tocPath.setAttribute( 'd', path.join( ' ' ) );
			item.pathEnd = tocPath.getTotalLength();

		} );

		pathLength = tocPath.getTotalLength();

		sync();

	}

	function sync() {

		var windowHeight = window.innerHeight;

		var pathStart = pathLength,
			pathEnd = 0;

		var visibleItems = 0;

		tocItems.forEach( function( item ) {

			var targetBounds = item.target.getBoundingClientRect();

			if( targetBounds.bottom > windowHeight * TOP_MARGIN && targetBounds.top < windowHeight * ( 1 - BOTTOM_MARGIN ) ) {
				pathStart = Math.min( item.pathStart, pathStart );
				pathEnd = Math.max( item.pathEnd, pathEnd );

				visibleItems += 1;

				item.listItem.classList.add( 'visible' );
			}
			else {
				item.listItem.classList.remove( 'visible' );
			}

		} );

		// Specify the visible path or hide the path altogether
		// if there are no visible items
		if( visibleItems > 0 && pathStart < pathEnd ) {
			if( pathStart !== lastPathStart || pathEnd !== lastPathEnd ) {
				tocPath.setAttribute( 'stroke-dashoffset', '1' );
				tocPath.setAttribute( 'stroke-dasharray', '1, '+ pathStart +', '+ ( pathEnd - pathStart ) +', ' + pathLength );
				tocPath.setAttribute( 'opacity', 1 );
			}
		}
		else {
			tocPath.setAttribute( 'opacity', 0 );
		}

		lastPathStart = pathStart;
		lastPathEnd = pathEnd;

	}

};

// hide nav

$(window).scroll(function() {
  var x = document.getElementById(".toc");

    if ($(this).scrollTop() >= 100) {
      x.style.display = "block";
    } else {
      x.style.display = "none";
    }
});
