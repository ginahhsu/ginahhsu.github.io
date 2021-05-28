//============= play changing title ===========//
var arr2=['doodler.','music lover.',' gamer.','crafter.','world traveler.'];
var i2=0;
var heading2 = document.querySelector('#play');

function slide_play(){
  heading2.innerHTML = arr2[i2];
  //opacity to 1
  heading2.style.opacity = 1;

  //after 2 seconds call next function
  setTimeout (next_play,2000);
}

console.log(arr2.length);

//next function
function next_play(){
  console.log('after 2 secs');
  //increase index for next item in array
  i2++;

  if(i2 > arr2.length -1) {
    i2=0;
  }

  console.log(i2);
  //opacity to 0
  heading2.style.opacity = 0;

  //after 1 second call slide fuction again
  setTimeout(slide_play, 1000);
}
slide_play();
