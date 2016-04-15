import Scope from '../scope/scope';

export default class Angular {
    constructor(loader) {
        this.loader = loader;
        this.module('ng', [])
            .provider('$rootScope', {
                $get: () => new Scope()
            });
    }

    module(...args) {
        return this.loader.module.apply(this.loader, args);
    }
}
