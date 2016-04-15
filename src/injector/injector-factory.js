import Injector from './injector-facade';

export default class InjectorFactory {
    constructor(loader) {
        this.loader = loader;
    }

    createInjector(depNames, isStrict) {
        return new Injector(this.loader, depNames, isStrict);
    }
}
