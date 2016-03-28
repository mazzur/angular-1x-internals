module.exports = function (config) {
    config.set({
        frameworks: ['browserify', 'jasmine'],
        files: [
            'src/**/*.js'
        ],
        exclude: [],
        preprocessors: {
            'src/**/*[!.spec].js': ['browserify'],
            'src/**/*.spec.js': ['browserify']
        },
        browserify: {
            debug: true,
            transform: [require('browserify-istanbul')({
                instrumenter: require('isparta'),
                ignore: ['**/*.spec.js']
            }), 'babelify']
        },
        reporters: ['progress', 'coverage'],
        autoWatch: false,
        singleRun: true,
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