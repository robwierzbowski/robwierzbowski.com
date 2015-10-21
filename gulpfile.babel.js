'use strict';

import fs from 'fs';
import path from 'path';
import gulp from 'gulp';
import del from 'del';
import runSequence from 'run-sequence';
import browserSync from 'browser-sync';
import swPrecache from 'sw-precache';
import gulpLoadPlugins from 'gulp-load-plugins';
import {output as pagespeed} from 'psi';
import pkg from './package.json';

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

// * On serve

// Lint JavaScript
gulp.task('jshint', () =>
  gulp.src('app/scripts/**/*.js')
  .pipe($.jshint())
  .pipe($.jshint.reporter('jshint-stylish'))
  .pipe($.if(!browserSync.active, $.jshint.reporter('fail')))
);

// Transpile and process JavaScript
gulp.task('scripts', () =>
  gulp.src([
    // Components
    'node_modules/fontfaceobserver/fontfaceobserver.js',
    // Site
    'app/scripts/**/*.js'
  ])
  .pipe($.changed('.tmp/scripts'))
  .pipe($.sourcemaps.init())
  .pipe($.babel())
  .pipe($.sourcemaps.write())
  .pipe(gulp.dest('.tmp/scripts'))
);

// Compile and process stylesheets
gulp.task('styles', () => {
  const SUPPORTED_BROWSERS = ['last 2 versions', '> 5%'];

  // For best performance, don't add Sass partials to `gulp.src`
  return gulp.src('app/styles/main.scss')
  .pipe($.sourcemaps.init())
  .pipe($.sass({
    precision: 10
  }).on('error', $.sass.logError))
  .pipe($.changed('.tmp/styles', {hasChanged: $.changed.compareSha1Digest}))
  .pipe($.autoprefixer(SUPPORTED_BROWSERS))
  .pipe($.sourcemaps.write())
  .pipe(gulp.dest('.tmp/styles'));
});

// Process svgs
// TODO: Make work in IE with polyfill or appending to DOM
// TODO: SVGO
gulp.task('svg', () =>
  gulp.src('app/images/sprites/icons/*.svg')
  .pipe($.svgstore())
  .pipe($.cheerio({
      run: function ($) { $('[fill]').removeAttr('fill'); },
      parserOptions: { xmlMode: true }
  }))
  .pipe(gulp.dest('.tmp/images/sprites'))
);

// Compile templates
gulp.task('jade', () =>
  gulp.src('app/index.jade')
  .pipe($.jade({
    pretty: true
  }))
  .pipe(gulp.dest('.tmp'))
);

gulp.task('clean', (done) =>
  del(['.tmp', 'dist/*', '!dist/.git'], {dot: true}, done)
);

// Serve and Watch
gulp.task('serve', ['jshint', 'scripts', 'styles', 'jade', 'svg'], () => {
  browserSync({
    notify: false,
    logPrefix: 'BrowserSync',
    server: ['.tmp', 'app']
  });

  gulp.watch(['app/**/*.jade', 'app/content/*.md'], ['jade', reload]);
  gulp.watch('app/styles/**/*.scss', ['styles', reload]);
  gulp.watch('app/scripts/**/*.js', ['jshint', 'scripts', reload]);
  gulp.watch('app/images/**/*', reload);
  gulp.watch('app/images/**/*.svg', ['svg', reload]);
});

// * On build

// NOTE! Introduced breaking build changes by introducing Jade.
// Don't bother to build for now.

// TEMP: Remove concatenation / minification of styles, since no building right
// now. Minification and reporting can happen only on build; no need for that
// info every change.

// // Concatenate and minify styles
// .pipe($.if('*.css', $.minifyCss()))
// .pipe($.sourcemaps.write('.')) // Why two sourcemaps? Because of CSS I'm guessing.
// .pipe(gulp.dest('dist/styles'))
// .pipe($.size({title: 'styles'}));

// // Optimize images
// gulp.task('images', () =>
//   gulp.src('app/images/**/*')
//   .pipe($.cache($.imagemin({
//     progressive: true,
//     interlaced: true
//   })))
//   .pipe(gulp.dest('dist/images'))
//   .pipe($.size({title: 'images'}))
// );

// // Copy all files at the root level (app)
// gulp.task('copy', () =>
//   gulp.src([
//     'app/*',
//     '!app/*.jade',
//     'node_modules/apache-server-configs/dist/.htaccess'
//   ], {
//     dot: true
//   })
//   .pipe(gulp.dest('dist'))
//   .pipe($.size({title: 'copy'}))
// );

// // Copy web fonts to dist
// gulp.task('fonts', () =>
//   gulp.src(['app/fonts/**'])
//   .pipe(gulp.dest('dist/fonts'))
//   .pipe($.size({title: 'fonts'}))
// );

// // Concatenate and minify JavaScript
// gulp.task('scripts', () =>
//   gulp.src([
//     // TODO: Then should I remove useref entirely?
//     // Note: Since we are not using useref in the scripts build pipeline,
//     //       you need to explicitly list your scripts here in the right order
//     //       to be correctly concatenated
//     './app/scripts/main.js'
//   ])
//   .pipe($.concat('main.min.js'))
//   .pipe($.uglify({preserveComments: 'some'}))
//   // Output files
//   .pipe(gulp.dest('dist/scripts'))
//   .pipe($.size({title: 'scripts'}))
// );

// // Scan your HTML for assets & optimize them
// gulp.task('html', () => {
//   const assets = $.useref.assets({searchPath: '{.tmp,app}'});

//   return gulp.src('app/**/*.html')
//   .pipe(assets)
//   // Remove any unused CSS
//   // Note: If not using the Style Guide, you can delete it from
//   //       the next line to only include styles your project uses.
//   .pipe($.if('*.css', $.uncss({
//     html: [
//       'app/index.html'
//     ],
//     // CSS Selectors for UnCSS to ignore
//     ignore: [
//       /.navdrawer-container.open/,
//       /.app-bar.open/
//     ]
//   })))

//   // Concatenate and minify styles
//   // In case you are still using useref build blocks
//   .pipe($.if('*.css', $.minifyCss()))
//   .pipe(assets.restore())
//   .pipe($.useref())

//   // Minify any HTML
//   .pipe($.if('*.html', $.minifyHtml()))
//   // Output files
//   .pipe(gulp.dest('dist'))
//   .pipe($.size({title: 'html'}));
// });

// // Build and serve the output from the dist build
// gulp.task('serve:dist', ['default'], () =>
//   browserSync({
//     notify: false,
//     logPrefix: 'WSK',
//     // Run as an https by uncommenting 'https: true'
//     // Note: this uses an unsigned certificate which on first access
//     //       will present a certificate warning in the browser.
//     // https: true,
//     server: 'dist',
//     baseDir: 'dist'
//   })
// );

// // Build production files, the default task
// // Re-implemement service worker code from WSK
// gulp.task('default', ['clean'], (done) => {
//   runSequence(
//     'styles',
//     ['jshint', 'html', 'scripts', 'images', 'fonts', 'copy'],
//     'generate-service-worker',
//     done
//   );
// });

// // Run PageSpeed Insights
// gulp.task('pagespeed', (done) => {
//   // Update the below URL to the public URL of your site
//   pagespeed('example.com', {
//     strategy: 'mobile',
//     // By default we use the PageSpeed Insights free (no API key) tier.
//     // Use a Google Developer API key if you have one: http://goo.gl/RkN0vE
//     // key: 'YOUR_API_KEY'
//   }, done);
// });

// // See http://www.html5rocks.com/en/tutorials/service-worker/introduction/ for
// // an in-depth explanation of what service workers are and why you should care.
// // Generate a service worker file that will provide offline functionality for
// // local resources. This should only be done for the 'dist' directory, to allow
// // live reload to work as expected when serving from the 'app' directory.
// gulp.task('generate-service-worker', (done) => {
//   const rootDir = 'dist';

//   swPrecache({
//     // Used to avoid cache conflicts when serving on localhost.
//     cacheId: pkg.name,
//     staticFileGlobs: [
//       `${rootDir}/fonts/**/*.woff`,
//       `${rootDir}/images/**/*`,
//       `${rootDir}/scripts/**/*.js`,
//       `${rootDir}/styles/**/*.css`,
//       `${rootDir}/*.{html,json}`
//     ],

//     // Translates a static file path to the relative URL that it's served from.
//     stripPrefix: path.join(rootDir, path.sep)
//   }, (err, swFileContents) => {
//     if (err) {
//       done(err);
//       return;
//     }

//     const filepath = path.join(rootDir, 'service-worker.js');

//     fs.writeFile(filepath, swFileContents, (err) => {
//       if (err) {
//         done(err);
//         return;
//       }

//       done();
//     });
//   });
// });

// // Load custom tasks from the `tasks` directory
// // try { require('require-dir')('tasks'); } catch (err) { console.error(err); }
