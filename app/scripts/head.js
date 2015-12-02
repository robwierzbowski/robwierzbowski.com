/* global supportsWoff2:false */
/* global revd:false */
/* eslint-env browser */

'use strict';

// If the font has been loaded previously, set the loaded state right away
if (sessionStorage.getItem('fontsLoaded')) {
  document.documentElement.classList.add('is-fontsLoaded');
}

// Create prefetch links for assets
const createPrefetch = (url) => {
  const link = document.createElement('link');
  link.setAttribute('rel', 'prefetch');
  link.setAttribute('href', url);
  document.head.appendChild(link);
};

const fontType = supportsWoff2 ? 'woff2' : 'woff';

const sources = [
  `/fonts/${revd(`charter-bt-roman.${fontType}`)}`,
  `/fonts/${revd(`charter-bt-italic.${fontType}`)}`,
  `/images/sprites/${revd('icons.svg')}`
];

sources.forEach((source) => { createPrefetch(source); });
