/* global FontFaceObserver:false */
/* global revd:false */
/* eslint-env browser */

// TODO: Make FontFaceObserver an ES2015 module
'use strict';

// * Show fallback font until custom fonts are loaded.
let fontObservers = [
  new FontFaceObserver('Charter BT').check(null, 7000),
  new FontFaceObserver('Charter BT', {style: 'italic'}).check(null, 7000)
];

Promise.all(fontObservers).then(function () {
  document.documentElement.classList.add('is-fontsLoaded');
  sessionStorage.setItem('fontsLoaded', true);
});

// * Load external svg and append to DOM
//  TODO: Abstract for any number of svgs. Maybe parse DOM to apply SVGs? Maybe
//  use a modernizr test to check if external fragmnent identifiers work, and if
//  not load external polyfill like this?
let applySVGs = function () {
  let ajax = new XMLHttpRequest();
  ajax.open('GET', `/images/sprites/${revd('icons.svg')}`, true);
  ajax.send();
  ajax.onload = function () {
    let SvgBank = document.querySelector('.Page-svgBank');
    SvgBank.innerHTML = ajax.responseText;
  };
};

applySVGs();
