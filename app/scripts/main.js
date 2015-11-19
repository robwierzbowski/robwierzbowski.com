/*global FontFaceObserver:false */
// TODO: Make FontFaceObserver an ES2015 module
'use strict';

// * Show fallback font until custom fonts are loaded.
let fontObservers = [
  new FontFaceObserver('Charter BT').check(),
  new FontFaceObserver('Charter BT', {style: 'italic'}).check()
];

Promise.all(fontObservers).then(function() {
  document.documentElement.classList.add('is-fontsLoaded');
  document.cookie = 'fontsLoaded=true';
});

// * Load external svg and append to DOM
//  TODO: Abstract for any number of svgs. Maybe parse DOM to apply SVGs? Maybe
//  use a modernizr test to check if external fragmnent identifiers work, and if
//  not load external polyfill like this?
let applySVGs = function () {
  let ajax = new XMLHttpRequest();
  ajax.open('GET', '/images/sprites/icons.svg', true);
  ajax.send();
  ajax.onload = function() {
    let SvgBank = document.querySelector('.SvgBank');
    SvgBank.innerHTML = ajax.responseText;
  };
};

applySVGs();
