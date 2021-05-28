////Home changing title/////
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
