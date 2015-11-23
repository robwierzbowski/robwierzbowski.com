'use strict';

import fs from 'fs';
import nodeSass from 'node-sass';

export function readJSON (path) {
  return JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}));
}

export function jadeRevd (path, manifest) {
  return manifest[path] || path;
}

export function sassRevd (path, manifest) {
  let stringPath = path.getValue();
  let revdPath = manifest[stringPath] || stringPath;
  return new nodeSass.types.String(revdPath);
}
