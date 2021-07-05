//Home changing title
var arr=['designs.','branding.','experiences.','products.','interactions.'];
var i=0;
var heading = document.querySelector('#home');


function slide(){
  heading.innerHTML = arr[i];
  //opacity to 1
  heading.style.opacity = 1;

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
  heading.style.opacity = 0;

  //after 1 second call slide fuction again
  setTimeout(slide, 1000);
}
slide();


//Home typewriter ///
/*var home = document.getElementById('home');

var typewriter = new Typewriter(home, {
  strings: ['type','this','now']
  cursor: '|',
  delay: 'natural', // 'natural' or Number

});*/

/*typewriter
  .pauseFor(2500)
  .typeString('A simple yet powerful native javascript')
  .pauseFor(300)
  .deleteChars(10)
  .typeString('<strong>JS</strong> plugin for a cool typewriter effect and ')
  .typeString('<strong>only <span style="color: #27ae60;">5kb</span> Gzipped!</strong>')
  .pauseFor(1000)
  .start();*/
