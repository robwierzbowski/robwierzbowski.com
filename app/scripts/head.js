/*global supportsWoff2:false */
'use strict';

// Create prefetch links for fonts
const fontPath = '/fonts/';
const fontType = supportsWoff2 ? '.woff2' : '.woff';
const fontList =   [
  'charter-bt-roman',
  'charter-bt-italic'
];

fontList.forEach((font) => {
  const fontUrl = `${fontPath}${font}${fontType}`;
  const prefetch = document.createElement('link');

  prefetch.setAttribute('rel', 'prefetch');
  prefetch.setAttribute('href', fontUrl);
  document.head.appendChild(prefetch);
});
