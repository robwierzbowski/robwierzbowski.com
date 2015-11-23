'use strict';

import gulp from 'gulp';
import del from 'del';
import runSequence from 'run-sequence';
import browserSync from 'browser-sync';
import gulpLoadPlugins from 'gulp-load-plugins';
import pump from 'pumpify';
import {argv} from 'yargs';

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

let build = argv.build;

const paths = {
  inlineComponents: ['node_modules/woff2-feature-test/woff2.js'],
  inlineScripts: ['app/scripts/head.js'],
  scripts: [
    'node_modules/fontfaceobserver/fontfaceobserver.js',
    'app/scripts/main.js'
  ]
};

// AWS vars
const awsSettings = {
  params: {
    Bucket: argv.dev ? 'dev.robwierzbowski.com' : 'robwierzbowski.com'
  },
  region: 'us-east-1'
};
const day = 86400;
const farFuture = {'Cache-Control': `max-age=${day * 365}`};
const future = {'Cache-Control': `max-age=${day * 7}`};
const noCache = {'Cache-Control': 'no-cache'};

// Note: Fonts, SVGs are not cache busted.
// TODO: Fix that ^^

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
  gulp.src(paths.scripts)
  .pipe($.newer('.tmp/scripts/main.js'))
  .pipe($.sourcemaps.init())
  .pipe($.babel())
  .pipe($.concat('main.js'))
  .pipe($.sourcemaps.write())
  .pipe(gulp.dest('.tmp/scripts'))

  // Build
  .pipe($.if(build, pump.obj(
    $.uglify({preserveComments: 'some'}),
    $.size({title: 'scripts'}),
    $.rev(),
    $.sourcemaps.write('.'),
    gulp.dest('dist/scripts'),
    $.rev.manifest('rev-manifest-scripts.json'),
    gulp.dest('.tmp/manifests')
  )))
);

gulp.task('components:inline', () =>
  gulp.src(paths.inlineComponents)
  .pipe($.newer('.tmp/components/'))

  // Build
  .pipe($.if(build, pump.obj(
    $.uglify({preserveComments: 'some'}),
    $.size({title: 'inline components'}),
    $.sourcemaps.write('.')
  )))

  .pipe(gulp.dest('.tmp/components/'))
);

gulp.task('scripts:inline', () =>
  gulp.src(paths.inlineScripts)
  .pipe($.newer('.tmp/scripts'))
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
    $.rev.manifest('rev-manifest-styles.json'),
    gulp.dest('.tmp/manifests')
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
    $.rev(),
    gulp.dest('dist/images/sprites'),
    $.rev.manifest('rev-manifest-svg.json'),
    gulp.dest('.tmp/manifests')
  )))
);

gulp.task('manifests', () =>
  gulp.src('.tmp/manifests/rev-manifest-*.json')
  .pipe($.extend('rev-manifest.json'))
  .pipe(gulp.dest('.tmp/manifests'))
);

// Compile templates
gulp.task('templates', ['scripts:inline', 'components:inline'], () => {
  return gulp.src('app/index.jade')
  .pipe($.jade({
    pretty: true,
    basedir: '.'
  }))
  .pipe(gulp.dest('.tmp'))

  // Build
  .pipe($.if(build, pump.obj(
    $.minifyHtml(),
    $.size({title: 'html'}),
    gulp.dest('dist')
  )));
});

gulp.task('fonts', () =>
  gulp.src('app/fonts/**/*')
  .pipe($.if('**/*.woff2', $.size({title: 'fonts'})))
  .pipe($.rev())
  .pipe(gulp.dest('dist/fonts'))
  .pipe($.rev.manifest('rev-manifest-fonts.json'))
  .pipe(gulp.dest('.tmp/manifests'))
);

// Copy all other files
gulp.task('copy', () =>
  gulp.src([
    'app/*.*',
    '!app/*.jade'
  ], {
    dot: true
  })
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

  gulp.watch(
    ['app/**/*.jade'].concat(paths.inlineScripts, paths.inlineComponents),
    ['templates', reload]
  );
  gulp.watch('app/styles/**/*.scss', ['styles', reload]);
  gulp.watch(paths.scripts, ['jshint', 'scripts', reload]);
  gulp.watch(paths.inlineScripts, ['jshint', 'scripts:inline', reload]);
  gulp.watch(paths.inlinecomponents, ['jshint', 'components:inline', reload]);

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
    ['styles', 'scripts', 'svg', 'fonts', 'copy'],
    'templates',
    done
  );
});

gulp.task('update-gauges', () => {
  let publisher = $.awspublish.create(awsSettings);

  return $.remoteSrc('track.js', {base: 'https://track.gaug.es/'})
  .pipe($.awspublish.gzip())
  .pipe(publisher.publish(future, {force: true}))
  .pipe($.awspublish.reporter());
});

// Use the --dev flag to publish to dev.robwierzbowski.com
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

  let publisher = $.awspublish.create(awsSettings);

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
