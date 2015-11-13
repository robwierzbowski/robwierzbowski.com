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

const awsSettings = {
  params: {
    Bucket: 'robwierzbowski.com'
  },
  region: 'us-east-1'
};
const day = 86400;
const farFuture = {'Cache-Control': `max-age=${day * 365}`};
const future = {'Cache-Control': `max-age=${day * 7}`};
const noCache = {'Cache-Control': 'no-cache'};
const publisher = $.awspublish.create(awsSettings);

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

gulp.task('components:inline', () =>
  gulp.src([
    // 'node_modules/woff2-feature-test/woff2.js'
  ])
  .pipe($.changed('.tmp/components/'))

  // Build
  .pipe($.if(build, pump.obj(
    $.uglify({preserveComments: 'some'}),
    $.size({title: 'inline scripts'}),
    $.sourcemaps.write('.')
  )))

  .pipe(gulp.dest('.tmp/components/'))
);

gulp.task('scripts:inline', () =>
  gulp.src([
    // 'app/scripts/example.js'
  ])
  .pipe($.changed('.tmp/scripts'))
  .pipe($.sourcemaps.init())
  .pipe($.babel())
  .pipe($.sourcemaps.write())

  // Build
  .pipe($.if(build, pump.obj(
    $.uglify({preserveComments: 'some'}),
    $.size({title: 'inline scripts'}),
    $.sourcemaps.write('.')
  )))

  .pipe(gulp.dest('.tmp/scripts'))
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
gulp.task('templates', ['components:inline'], () => {
  return gulp.src('app/index.jade')
  .pipe($.jade({
    pretty: true,
    basedir: '.'
  }))
  .pipe(gulp.dest('.tmp'))

  // Build
  .pipe($.if(build, () => {
    let jsMap = require('./dist/scripts/rev-manifest');
    let cssMap = require('./dist/styles/rev-manifest');

    return pump.obj(
       $.htmlReplace({
        js: `/scripts/${jsMap["main.js"]}`,
        css: `/styles/${cssMap["main.css"]}`
      }),
      $.minifyHtml(),
      $.size({title: 'html'}),
      gulp.dest('dist')
    );
  }));
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

  gulp.watch(['app/**/*.jade'], ['templates', reload]);
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

gulp.task('update-gauges', () => {
  return $.remoteSrc('track.js', {base: 'https://track.gaug.es/'})
  .pipe(publisher.publish(future))
  .pipe($.awspublish.reporter());
});

gulp.task('publish', ['default', 'update-gauges'], () => {
  const gzipTypes = '**/*.{html,css,js,svg,ico,json,txt}';
  const cacheBustedTypes = '**/*.{css,js}';
  const cachedTypes = '**/*.{gif,jpeg,jpg,png,svg,webp,ico,woff,woff2}';
  const noCacheTypes = '**/*.{html,json,xml,txt}';
  const otherTypes = [
    '**/*',
    `!${cacheBustedTypes}`,
    `!${cachedTypes}`,
    `!${noCacheTypes}`
  ];

  return gulp.src('dist/**/*', {base: 'dist'})
  .pipe($.if(gzipTypes, $.awspublish.gzip()))
  .pipe($.if(cacheBustedTypes, publisher.publish(farFuture)))
  .pipe($.if(cachedTypes, publisher.publish(future)))
  .pipe($.if(noCacheTypes, publisher.publish(noCache)))
  .pipe($.if(otherTypes, publisher.publish()))
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
