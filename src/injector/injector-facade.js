import _ from 'lodash';
import InternalInjector from './internal-injector';
import Provide from './provide-service';
import Cache from './cache';

export default class InjectorFacade {
    constructor(loader, modulesToLoad, isStrict) {
        this.loader = loader;
        this.modulesToLoad = modulesToLoad;
        this.cache = new Cache();
        this.providerInjector = this.cache.providers.$injector = new InternalInjector(this.cache.providers, (name) => {
            throw new Error(`Unknown provider: ${name}`);
        }, isStrict);
        this.instanceInjector = this.cache.instances.$injector = new InternalInjector(this.cache.instances, (name) => {
            // the same as to get from providerCache?
            const provider = this.providerInjector.getService(`${name}Provider`);
            return this.instanceInjector.invoke(provider.$get, provider);
        }, isStrict);
        this.cache.providers.$provide = new Provide(this.cache, this.providerInjector, this.instanceInjector);
        this.$$loadModules(modulesToLoad);
    }

    has(key) {
        return this.cache.instances.hasOwnProperty(key) || this.cache.providers.hasOwnProperty(`${key}Provider`);
    }

    get(...args) {
        return this.instanceInjector.get.apply(this.instanceInjector, args);
    }

    annotate(...args) {
        return this.instanceInjector.annotate.apply(this.instanceInjector, args);
    }

    invoke(...args) {
        return this.instanceInjector.invoke.apply(this.instanceInjector, args);
    }

    instantiate(...args) {
        return this.instanceInjector.instantiate.apply(this.instanceInjector, args);
    }

    $$loadModules() {
        const loadedModules = new Map();
        const injector = this;
        let runQueue = [];

        function runInvokeQueue(queue) {
            _.each(queue, (record) => {
                const service = injector.providerInjector.get(record[0]);
                const method = record[1];
                const args = record[2];
                service[method].apply(service, args);
            });
        }

        _.forEach(this.modulesToLoad, function loadModule(moduleName) {
            if (loadedModules.has(moduleName)) {
                return;
            }
            loadedModules.set(moduleName, true);
            
            if (_.isString(moduleName)) {
                const module = injector.loader.module(moduleName);
                _.each(module.requires, loadModule);
                runInvokeQueue(module._invokeQueue);
                runInvokeQueue(module._configQueue);
                runQueue = runQueue.concat(module._runQueue);
            } else if (_.isFunction(moduleName) || _.isArray(moduleName)) {
                runQueue.push(injector.providerInjector.invoke(moduleName));
            }
        });

        _.forEach(_.compact(runQueue), (fn) => {
            injector.invoke(fn);
        });
    }
}
