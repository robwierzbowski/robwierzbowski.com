'use strict';

import gulpLoadPlugins from 'gulp-load-plugins';
const $ = gulpLoadPlugins();

let commit = '';
let pull = '';
let push = '';

export default {
  commit: commit,
  pull: pull,
  push: push
};
