'use strict';

let fontObservers = [
  new FontFaceObserver('Charter BT').check(),
  new FontFaceObserver('Charter BT', {style: 'italic'}).check()
];

Promise.all(fontObservers).then(function() {
  document.documentElement.classList.add('is-fontsLoaded');
});
