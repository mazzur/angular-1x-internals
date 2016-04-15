import _ from 'lodash';
import assert from '../helpers/assert';
const INSTANTIATING = Symbol('instantiating');

export default class InternalInjector {
    constructor(cache, serviceFactory, isStrict) {
        this.cache = cache;
        this.serviceFactory = serviceFactory;
        this.isStrict = isStrict;
        this.invokationPath = [];
    }

    get(name) {
        return this.getService(name);
    }

    invoke(fn, self, locals) {
        const args = _.map(this.annotate(fn), dependencyName => {
            assert.notEmptyString(dependencyName, `dependency name "${dependencyName}"`);
            return _.get(locals, dependencyName) || this.getService(dependencyName);
        });
        const unwrappedFn = _.isArray(fn) ? _.last(fn) : fn;
        return unwrappedFn.apply(self, args);
    }

    instantiate(Constructor, locals) {
        const UnwrappedConstructor = _.isArray(Constructor) ?
            _.last(Constructor) :
            Constructor;
        const instance = Object.create(UnwrappedConstructor.prototype);
        this.invoke(Constructor, instance, locals);
        return instance;
    }

    annotate(fn) {
        const FN_ARGS = /^function\s*[^\()]*\(\s*([^\)]*)\)/m;
        if (_.isArray(fn)) {
            return fn.slice(0, fn.length - 1);
        } else if (fn.$inject) {
            return fn.$inject;
        } else if (!fn.length) {
            return [];
        } else if (this.isStrict) {
            throw new Error('function without explicit annotation cannot be invoked in strict DI mode');
        }
        return _.map(fn.toString().match(FN_ARGS)[1].split(','), arg => _.trim(arg));
    }

    getService(name) {
        if (this.cache.hasOwnProperty(name)) {
            if (this.cache[name] === INSTANTIATING) {
                throw new Error(`Circular dependency found: ${name} <- ${this.invokationPath.join(' <- ')}`);
            }
            return this.cache[name];
        }
        this.invokationPath.unshift(name);
        try {
            this.cache[name] = INSTANTIATING;
            const instance = this.serviceFactory(name);
            this.cache[name] = instance;
            return instance;
        } finally {
            this.invokationPath.shift();
            if (this.cache[name] === INSTANTIATING) {
                delete this.cache[name];
            }
        }
    }
}
