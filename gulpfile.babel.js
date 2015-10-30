'use strict';

import gulp from 'gulp';
import del from 'del';
import runSequence from 'run-sequence';
import browserSync from 'browser-sync';
import gulpLoadPlugins from 'gulp-load-plugins';
import pump from 'pumpify';

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

let build = false;

// Note: Fonts, SVGs are not cache busted.

// Lint JavaScript
gulp.task('jshint', () =>
  gulp.src([
    'gulpfile.babel.js',
    'app/scripts/**/*.js'
   ])
  .pipe($.jshint())
  .pipe($.jshint.reporter('jshint-stylish'))
  .pipe($.if(!browserSync.active, $.jshint.reporter('fail')))
);

// Transpile and process JavaScript
gulp.task('scripts', () =>
  gulp.src([
    'node_modules/fontfaceobserver/fontfaceobserver.js',
    'app/scripts/**/*.js'
  ])
  .pipe($.changed('.tmp/scripts'))
  .pipe($.sourcemaps.init())
  .pipe($.babel())
  .pipe($.sourcemaps.write())
  .pipe(gulp.dest('.tmp/scripts'))

  // Build
  .pipe($.if(build, pump.obj(
    $.concat('main.js'),
    $.uglify({preserveComments: 'some'}),
    $.size({title: 'scripts'}),
    $.rev(),
    $.sourcemaps.write('.'),
    gulp.dest('dist/scripts'),
    $.rev.manifest(),
    gulp.dest('dist/scripts')
  )))
);

// Compile and process stylesheets
gulp.task('styles', () => {
  const SUPPORTED_BROWSERS = ['last 2 versions', '> 5%'];

  return gulp.src('app/styles/main.scss')
  .pipe($.sourcemaps.init())
  .pipe($.sass({
    precision: 10
  }).on('error', $.sass.logError))
  .pipe($.changed('.tmp/styles', {hasChanged: $.changed.compareSha1Digest}))
  .pipe($.autoprefixer(SUPPORTED_BROWSERS))
  .pipe($.sourcemaps.write())
  .pipe(gulp.dest('.tmp/styles'))

  // Build
  .pipe($.if(build, pump.obj(
    $.minifyCss(),
    $.size({title: 'styles'}),
    $.rev(),
    $.sourcemaps.write('.'),
    gulp.dest('dist/styles'),
    $.rev.manifest(),
    gulp.dest('dist/styles')
  )));
});

// Process svgs
gulp.task('svg', () =>
  gulp.src('app/images/sprites/icons/*.svg')
  .pipe($.svgstore())
  .pipe($.cheerio({
      run: function ($) { $('[fill]').removeAttr('fill'); },
      parserOptions: {xmlMode: true}
  }))
  .pipe(gulp.dest('.tmp/images/sprites'))

  // Build
  .pipe($.if(build, pump.obj(
    $.imagemin({
      svgoPlugins: [
        {cleanupIDs: false},
        {removeDesc: false},
        {removeDimensions: false},
        {removeUselessStrokeAndFill: false}
      ]
    }),
    $.size({title: 'svg'}),
    gulp.dest('dist/images/sprites')
  )))
);

// Compile templates
gulp.task('templates', () => {
  let jsMap = require('./dist/scripts/rev-manifest');
  let cssMap = require('./dist/styles/rev-manifest');

  return gulp.src('app/index.jade')
  .pipe($.jade({
    pretty: true
  }))
  .pipe(gulp.dest('.tmp'))

  // Build
  .pipe($.if(build, pump.obj(
    $.htmlReplace({
      js: `/scripts/${jsMap["main.js"]}`,
      css: `/styles/${cssMap["main.css"]}`
    }),
    $.minifyHtml(),
    $.size({title: 'html'}),
    gulp.dest('dist')
  )));
});

// Copy all other files
gulp.task('copy', () =>
  gulp.src([
    'app/*.*',
    '!app/*.jade',
    'app/fonts/*'
  ], {
    base: 'app',
    dot: true
  })
  .pipe($.if('**/*.woff2', $.size({title: 'fonts'})))
  .pipe(gulp.dest('dist'))
);

gulp.task('clean', (done) =>
  del(['.tmp', 'dist/*', '!dist/.git'], {dot: true}, done)
);

// Serve
gulp.task('serve', ['jshint', 'scripts', 'styles', 'templates', 'svg'], () => {
  browserSync({
    notify: false,
    logPrefix: 'BrowserSync',
    server: ['.tmp', 'app']
  });

  gulp.watch(['app/**/*.jade', 'app/content/*.md'], ['templates', reload]);
  gulp.watch('app/styles/**/*.scss', ['styles', reload]);
  gulp.watch('app/scripts/**/*.js', ['jshint', 'scripts', reload]);
  gulp.watch('app/images/**/*', reload);
  gulp.watch('app/images/**/*.svg', ['svg', reload]);
});

gulp.task('serve:dist', ['default'], () => {
  browserSync({
    notify: false,
    logPrefix: 'BrowserSync',
    server: 'dist'
  });
});

gulp.task('default', ['clean'], (done) => {
  build = true;

  runSequence(
    ['styles', 'scripts', 'svg', 'copy'],
    'templates',
    done
  );
});

gulp.task('publish', () => {
  let awsSettings = {
    // Uses global config for authorization
    params: {
      Bucket: 'robwierzbowski.com'
    },
    region: 'us-east-1'
  };

  let assetHeaders = {
    'Cache-Control': 'max-age=155520000'
  };

  let htmlHeaders = {
    'Cache-Control': 'no-store' // Good idea?
  };

  let publisher = $.awspublish.create(awsSettings);

  return gulp.src('dist/styles/*.css', {base: 'dist'})
  .pipe(gulp.dest('testo'))
  .pipe($.awspublish.gzip())
  .pipe(publisher.publish(assetHeaders))
  .pipe(publisher.cache())
  .pipe($.awspublish.reporter());
});

// TODO: Add Pagespeed task
gulp.task('pagespeed', (done) => {
  done();
});

// TODO: Generate a service worker for offline browsing. Not important until
// articles exist
gulp.task('generate-service-worker', (done) => {
  done();
});
