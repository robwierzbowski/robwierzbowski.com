'use strict';

import gulp from 'gulp';
import del from 'del';
import runSequence from 'run-sequence';
import browserSync from 'browser-sync';
import gulpLoadPlugins from 'gulp-load-plugins';
import pump from 'pumpify';
import {argv} from 'yargs';
import {readJSON, jadeRevd, sassRevd} from './helpers.js';

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

// * JavaScript
gulp.task('lint', () =>
  gulp.src([
    '*.js',
    'app/scripts/**/*.js'
  ])
  .pipe($.eslint())
  .pipe($.eslint.format())
  .pipe($.if(!browserSync.active, $.eslint.failOnError()))
);

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
    $.size({title: 'inline components'})
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
    $.size({title: 'inline scripts'})
  )))

  .pipe(gulp.dest('.tmp/scripts'))
);

// * Stylesheets
gulp.task('styles', () => {
  const SUPPORTED_BROWSERS = ['last 2 versions', '> 5%'];
  const manifest = build ? readJSON('./.tmp/manifests/rev-manifest.json') : {};

  return gulp.src('app/styles/main.scss')
  .pipe($.sourcemaps.init())
  .pipe($.sass({
    precision: 10,
    functions: {
      revd: (path) => sassRevd(path, manifest)
    }
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
    gulp.dest('dist/styles'),
    $.rev.manifest('rev-manifest-styles.json'),
    gulp.dest('.tmp/manifests')
  )));
});

// * Images
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

// * Fonts
gulp.task('fonts', () =>
  gulp.src('app/fonts/**/*')
  .pipe($.if('**/*.woff2', $.size({title: 'fonts'})))
  .pipe($.rev())
  .pipe(gulp.dest('dist/fonts'))
  .pipe($.rev.manifest('rev-manifest-fonts.json'))
  .pipe(gulp.dest('.tmp/manifests'))
);

// Posts
import jsonMatter from 'json-front-matter';

gulp.task('posts', () => {
  return gulp.src('app/content/**/*.jade')
  .pipe($.tap(function (file) {
    let contents = file.contents.toString();
    let result = jsonMatter.parse(contents);
    file.original = file.contents;
    file.data = result.attributes;
    file.contents = new Buffer(result.body);
  }))
  .pipe(gulp.dest('.tmp'));

  // Now we need to:
  // - parse markdown
  // - Add to data
  // - write JSON files
  // - write static HTML
});

// * Templates
gulp.task('templates', ['scripts:inline', 'components:inline'], () => {
  const manifest = build ? readJSON('./.tmp/manifests/rev-manifest.json') : {};

  return gulp.src('app/index.jade')
  .pipe($.jade({
    pretty: true,
    basedir: '.',
    locals: {
      manifest: JSON.stringify(manifest),
      revd: (path) => jadeRevd(path, manifest)
    }
  }))
  .pipe(gulp.dest('.tmp'))

  // Build
  .pipe($.if(build, pump.obj(
    $.minifyHtml(),
    $.size({title: 'html'}),
    gulp.dest('dist')
  )));
});

// * All other files
gulp.task('copy', () =>
  gulp.src([
    'app/*.*',
    '!app/*.jade'
  ], {
    dot: true
  })
  .pipe(gulp.dest('dist'))
);

gulp.task('manifests', () =>
  gulp.src('.tmp/manifests/rev-manifest-*.json')
  .pipe($.extend('rev-manifest.json'))
  .pipe(gulp.dest('.tmp/manifests'))
);

gulp.task('clean', (done) =>
  del(['.tmp', 'dist/*'], {dot: true}, done)
);

gulp.task('serve', ['lint', 'scripts', 'styles', 'templates', 'svg'], () => {
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
  gulp.watch(paths.scripts, ['lint', 'scripts', reload]);
  gulp.watch(paths.inlineScripts, ['lint', 'scripts:inline', reload]);
  gulp.watch(paths.inlinecomponents, ['lint', 'components:inline', reload]);
  gulp.watch('app/images/**/*', ['svg', reload]);
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
    ['svg', 'fonts', 'copy'],
    'manifests',
    ['styles', 'scripts'],
    'manifests',
    'templates',
    done
  );
});

// * AWS
// Use the --prod flag to publish to robwierzbowski.com
const awsSettings = {
  params: {
    Bucket: argv.prod ? 'robwierzbowski.com' : 'dev.robwierzbowski.com'
  },
  region: 'us-east-1'
};

const day = 86400;
const farFuture = {'Cache-Control': `max-age=${day * 365}`};
const future = {'Cache-Control': `max-age=${day * 7}`};
const noCache = {'Cache-Control': 'no-cache'};

gulp.task('update-gauges', () => {
  let publisher = $.awspublish.create(awsSettings);

  return $.remoteSrc('track.js', {base: 'https://track.gaug.es/'})
  .pipe($.awspublish.gzip())
  .pipe(publisher.publish(future, {force: true}))
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
