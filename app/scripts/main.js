/*global FontFaceObserver:false */
// TODO: Make FontFaceObserver an ES2015 module
'use strict';

// * Show fallback font until custom font is loaded.
let fontObservers = [
  new FontFaceObserver('Charter BT').check(),
  new FontFaceObserver('Charter BT', {style: 'italic'}).check()
];

Promise.all(fontObservers).then(function() {
  document.documentElement.classList.add('is-fontsLoaded');
});
