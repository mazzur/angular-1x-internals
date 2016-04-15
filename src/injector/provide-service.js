import _ from 'lodash';

export default class ProvideService{
    constructor(cache, providerInjector, instanceInjector) {
        this.cache = cache;
        this.providerInjector = providerInjector;
        this.instanceInjector = instanceInjector;
    }

    constant(key, value) {
        if (key === 'hasOwnProperty') {
            throw new Error('such key is not allowed');
        }
        this.cache.instances[key] = value;
        this.cache.providers[key] = value;
    }

    provider(key, providerDefinition) {
        this.cache.providers[`${key}Provider`] = _.isFunction(providerDefinition) ?
            this.providerInjector.instantiate(providerDefinition) : providerDefinition;
    }

    factory(key, factoryFn, enforceReturn = true) {
        this.provider(key, {
            $get: enforceReturn ? this.$$enforceReturnValue(factoryFn) : factoryFn
        });
    }

    service(key, Constructor) {
        this.factory(key, () => this.instanceInjector.instantiate(Constructor), false);
    }

    value(key, val) {
        this.factory(key, () => val, false);
    }

    $$enforceReturnValue(fn) {
        return () => {
            const value = this.instanceInjector.invoke(fn);
            if (_.isUndefined(value)) {
                throw new Error(`Factory ${fn.name} must return value`);
            }
            return value;
        };
    }
}
