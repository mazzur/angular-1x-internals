module.exports = function (config) {
    config.set({
        frameworks: ['browserify', 'jasmine'],
        files: [
            'node_modules/babel-polyfill/browser.js',
            'src/**/*.js'
        ],
        exclude: [],
        preprocessors: {
            'src/**/*.js': ['browserify']
        },
        browserify: {
            debug: true,
            transform: [require('browserify-istanbul')({
                instrumenter: require('isparta'),
                ignore: ['**/*.spec.js']
            }), 'babelify']
        },
        reporters: ['progress', 'coverage'],
        autoWatch: true,
        browsers: ['PhantomJS'],
        coverageReporter: {
            reporters: [
                {
                    type: 'text-summary',
                    subdir: normalizationBrowserName
                },
                {
                    type: 'html',
                    dir: 'coverage/',
                    subdir: normalizationBrowserName
                }
            ]
        }
    });
};

function normalizationBrowserName(browser) {
    return browser.toLowerCase().split(/[ /-]/)[0];
}