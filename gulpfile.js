"use strict";

const project_dist = 'dist';
const project_app = 'app';
const project_prod = 'prod';
const node_path = 'node_modules';

const production = {
  html: {
    pattern: /\/(style|lib|js|images)\//g,
    new_path: '/assets/$1/'
  },
  css: {
    pattern: /\/(images)\//g,
    new_path: '/assets/$1/'
  },
  js: {
    pattern: /\/(\w+)\//g,
    new_path: '/assets/$1/'
  },
};

const path = {
  build: {
    html: project_dist + '/',
    css: project_dist + '/style/',
    js: project_dist + '/js/',
    img: project_dist + '/images/',
  },
  prod: {
    html: project_prod + '/',
    css: project_prod + '/style/',
    js: project_prod + '/js/',
    img: project_prod + '/images/',
  },
  src: {
    html: [project_app + '/*.html', '!'+project_app + '/_*.html'],//выбираем все файлы и исключаем с _
    css: project_app + '/style/**/*.scss',
    js: [project_app + '/js/**/*.js', '!'+project_app + '/js/**/_*.js'], 
    img: project_app + '/images/**/*.{jpg,png,gif}',
  },
  watch: {
    html: project_app + '/**/*.html',
    css: project_app + '/style/**/*.scss',
    js: project_app + '/js/**/*.js',
    img: project_app + '/images/**/*.{jpg,png,gif}',
  },
  clean: {
    dist: './'+project_dist+'/',
    prod: './'+project_prod+'/',
  }
}

let gulp = require('gulp'),
  { src, dest } = require('gulp'),
  browsersync = require('browser-sync').create(),
  del = require('del'),
  sourcemaps = require('gulp-sourcemaps'),
  scss = require('gulp-sass'),
  postcss = require('gulp-postcss'),
  cssnano = require('cssnano'),
  font = require('postcss-font-magician'),
  autoprefixer = require('autoprefixer'),
  sort_media = require('postcss-sort-media-queries'),
  rename = require('gulp-rename'),
  argv = require('yargs').argv,
  uglify = require('gulp-uglify-es').default,
  gulpif = require('gulp-if'),
  file_include = require('gulp-file-include'),
  newer = require('gulp-newer'),
  imagemin = require('gulp-imagemin'),
  imageminPngquant = require('imagemin-pngquant'),
  babel = require("gulp-babel"),
  lazypipe = require('lazypipe'),
  plumber = require('gulp-plumber'),
  beautify = require('gulp-beautify'),
  replace = require('gulp-replace');

function browserSync() {
  browsersync.init({
    server:{
      baseDir: './'+project_dist+'/',
    },
    notify: false,
  })
}

function html() {
  let htmlProd = lazypipe()
  .pipe(replace, production.html.pattern, production.html.new_path)
  .pipe(dest, path.prod.html);

  return src(path.src.html)
    .pipe(plumber()) // отслеживание ошибок
    .pipe(file_include())
    .pipe(beautify.html({ indent_size: 2 }))
    .pipe(gulpif(argv.prod, htmlProd(), dest(path.build.html)))
    .pipe(browsersync.stream())
}


function css(){
  let font_params = {
    variants: {
      'Montserrat': {
        '300': ['woff, eot, woff2'],
        '400 italic': ['woff2']
      }
    },
    // foundries: 'bootstrap google',
    display: 'swap',
    // hosted: ['./src/fonts', /custom/path/to/fonts/on/site] //Have a directory of self-hosted fonts?
  };
  let plugins = [
    autoprefixer(),
    font(font_params),
    sort_media({ sort: 'desktop-first'})
  ];
  let cssMin = lazypipe()
    .pipe(postcss, [cssnano()])
    .pipe(rename, {suffix: '.min'});  
  let cssProd = lazypipe()
    .pipe(replace, production.css.pattern, production.css.new_path);

  return src(path.src.css, { sourcemaps: true })
    .pipe(plumber())
    .pipe(scss({
      outputStyle: 'expanded',
    }).on('error', scss.logError))
    .pipe(gulpif(argv.prod, cssProd()))
    .pipe(postcss(plugins))
    .pipe(gulpif(argv.prod, dest(path.prod.css), dest(path.build.css)))
    .pipe(cssMin())
    .pipe(gulpif(argv.prod, dest(path.prod.css, { sourcemaps: '.' }), dest(path.build.css,  { sourcemaps: '.' })))
    .pipe(browsersync.stream())
}

function js() {
  let jsProd = lazypipe()
  .pipe(replace, production.js.pattern, production.js.new_path)
  .pipe(dest, path.prod.js);

  let jsMin = lazypipe()
  .pipe(uglify)
  .pipe(rename, {suffix: '.min'});

  return src(path.src.js, { sourcemaps: true })
    .pipe(plumber())
    // .pipe(sourcemaps.init())
    .pipe(file_include())
    .pipe(babel())
    .pipe(gulpif(argv.prod, jsProd()))
    .pipe(gulpif(argv.min, jsMin()))
    .pipe(dest(path.build.js, { sourcemaps: '.' }))
    // .pipe(sourcemaps.write())
    .pipe(browsersync.stream())
}

function images(){
  return src(path.src.img)
    .pipe(newer(path.build.img))
    .pipe(imagemin([imageminPngquant(),]))
    .pipe(dest(path.build.img))
}


function clean(){
  return del(argv.prod ? [path.clean.prod] : [path.clean.dist]);
  // return del(argv.prod ? [path.clean.prod + '**', '!' + path.clean.prod + 'images'] : [path.clean.dist + '**', '!' + path.clean.dist + 'images']);
}

function modules(){
  let sources = [
    node_path + '/imask/dist/imask.min.js',
  ];
  return src(sources, {base: node_path, allowEmpty: true})
    .pipe(rename(function(path){
      path.dirname = path.dirname.replace('dist', '');
    }))
    .pipe(dest(project_dist+'/lib/'))
}

function watchFiles() {
  gulp.watch([path.watch.html], html) //следим за изменениями файлов и применяем ф-цию html 
  gulp.watch([path.watch.css], css)
  gulp.watch([path.watch.js], js)
  gulp.watch([path.watch.img], images)
}

let build = gulp.series(clean, gulp.parallel(css, html, js, images, modules)); // вызываем ф-цию очистки папки dist и выполняем сборку html и css параллельно   

let watch = gulp.parallel(watchFiles, browserSync);

exports.css = css;
exports.html = html;
exports.js = js;
exports.images = images;
exports.modules = modules;
exports.build = build;
exports.clean = clean;
exports.watch = watch;
exports.default = watch;

//src([], {base: 'app'}) - при копировании из папки app сохраняем структуру папок
//gulp build --prod 