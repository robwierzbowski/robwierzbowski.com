'use strict';

import fs from 'fs';
import gulp from 'gulp';
import del from 'del';
import runSequence from 'run-sequence';
import browserSync from 'browser-sync';
import gulpLoadPlugins from 'gulp-load-plugins';
import jade from 'jade';
import marked from 'marked';
import matter from 'json-front-matter';
import pump from 'pumpify';
import {argv} from 'yargs';
import dateFormat from 'dateformat';
import {readJSON, jadeRevd, sassRevd} from './helpers.js';

marked.setOptions({
  breaks: true,
  smartypants: true
});

jade.filters.markdown = marked;

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
  .pipe($.if(!browserSync.active, $.eslint.failAfterError()))
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

// * JSON api
gulp.task('api', () => {
  return gulp.src('app/content/**/*.md', {base: 'app'})
  .pipe($.tap(function (file) {
    let {attributes: data, body} = matter.parse(file.contents.toString());

    data.css = data.css ? fs.readFileSync(data.css, 'utf8') : false;
    data.js = data.js ? fs.readFileSync(data.js, 'utf8') : false;
    data.body = marked(body);

    file.data = data;
    file.contents = new Buffer(JSON.stringify(data));
  }))
  .pipe($.rename({extname: '.json'}))
  .pipe(gulp.dest('.tmp'))
  .pipe($.concatJson('content/posts.json'))
  .pipe(gulp.dest('.tmp'));
});

// * HTML
gulp.task('html', ['api', 'scripts:inline', 'components:inline'], () => {
  const postTpl = fs.readFileSync('./app/templates/layouts/post.jade');
  const postsData = readJSON('./.tmp/content/posts.json');
  const manifest = build ? readJSON('./.tmp/manifests/rev-manifest.json') : {};

  return gulp.src([
    '.tmp/content/**/*.json',
    '!.tmp/content/posts.json'
  ], {base: '.tmp'})

  // Process JSON into jade templates with data objects
  .pipe($.tap(function (file) {
    file.data = JSON.parse(file.contents.toString());
    file.contents = postTpl;
  }))
  .pipe($.rename({extname: '.jade'}))

  // Add static jade templates
  .pipe($.addSrc('app/index.jade'))

  // Add data for all jade templates
  .pipe($.tap(function (file) {
    file.data = file.data || {};
    file.data.posts = postsData;
    file.data.manifest = JSON.stringify(manifest);

    // Jade functions
    file.data.revd = (path) => jadeRevd(path, manifest);
    file.data.formatDate = (date) =>
      dateFormat(new Date(date), 'mmmm d, yyyy');
  }))

  // Compile Jade
  .pipe($.jade({
    jade: jade,
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

gulp.task('serve', ['lint', 'scripts', 'styles', 'html', 'svg'], () => {
  browserSync({
    notify: false,
    logPrefix: 'BrowserSync',
    server: ['.tmp', 'app']
  });

  gulp.watch(
    ['app/**/*.jade'].concat(paths.inlineScripts, paths.inlineComponents),
    ['html', reload]
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
    'html',
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
