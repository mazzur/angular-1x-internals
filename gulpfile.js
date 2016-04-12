const gulp = require('gulp');
const babel = require('gulp-babel');
const concat = require('gulp-concat');
const del = require('del');
const browserify = require('browserify');
const source = require('vinyl-source-stream');

const paths = {
    src: './src/**/*.js',
    dest: './compiled'
};

gulp.task('default', ['browserify'], () => {
    gulp.watch(paths.src, ['browserify']);
});

// does not work in a browser
gulp.task('compile', ['clean:compiled'], () => {
    gulp.src(paths.src)
        .pipe(babel())
        .pipe(concat('bundle.js'))
        .pipe(gulp.dest(paths.dest));
});

//bundler
gulp.task('browserify', () => {
    browserify('./src/a.js')
        .transform('babelify', {presets: 'es2015'})
        .bundle()
        .pipe(source('bundle.js'))
        .pipe(gulp.dest('./example/'));
});

gulp.task('clean:compiled', () => {
    del('./compiled/**');
});