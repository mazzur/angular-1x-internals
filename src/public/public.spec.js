import Loader from '../loader/loader';
import Angular from './public';
import InjectorFactory from '../injector/injector-factory';

/**
 * TODO
 * - register parser, integrate with the scope
 */

describe('public', () => {
    let angular;
    let injectorFactory;
    let loader;

    beforeEach(() => {
        loader = new Loader();
        angular = new Angular(loader);
        injectorFactory = new InjectorFactory(loader);
    });

    it('creates angular object with module loader', () => {
        expect(angular).toEqual(jasmine.any(Object));
        expect(angular.module).toBeDefined();
    });

    it('sets up the ng module', () => {
        expect(injectorFactory.createInjector(['ng'])).toBeDefined();
    });

    it('sets up rootScope', () => {
        const injector = injectorFactory.createInjector(['ng']);
        expect(injector.has('$rootScope')).toBe(true);
    });
});
