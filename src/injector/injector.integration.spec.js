import InjectorFactory from './injector-factory';
import Loader from '../loader/loader';
import _ from 'lodash';

/**
 * TODO
 * - function modules
 * - decorators
 */

describe('injector', () => {
    let loader;
    let injectorFactory;

    function createInjector(deps) {
        return injectorFactory.createInjector(deps);
    }

    beforeEach(() => {
        loader = new Loader();
        injectorFactory = new InjectorFactory(loader);
    });

    describe('basically', () => {
        it('can be created', () => {
            const injector = createInjector([]);
            expect(injector).toBeDefined();
        });

        it('has a constant that has been registered to a module', () => {
            const module = loader.module('myModule', []);
            module.constant('aConstant', 42);
            const injector = createInjector(['myModule']);
            expect(injector.has('aConstant')).toBe(true);
        });

        it('does not have a non-registered constant', () => {
            loader.module('myModule', []);
            const injector = createInjector(['myModule']);
            expect(injector.has('aConstant')).toBe(false);
        });

        it('does not allow a constant called hasOwnProperty', () => {
            const module = loader.module('myModule', []);
            module.constant('hasOwnProperty', false);
            expect(() => {
                createInjector(['myModule']);
            }).toThrow();
        });

        it('can return a registered constant', () => {
            const module = loader.module('myModule', []);
            module.constant('aConstant', 42);
            const injector = createInjector(['myModule']);
            expect(injector.get('aConstant')).toBe(42);
        });

        it('loads multiple modules', () => {
            const module1 = loader.module('myModule', []);
            const module2 = loader.module('myOtherModule', []);
            module1.constant('aConstant', 42);
            module2.constant('anotherConstant', 43);
            const injector = createInjector(['myModule', 'myOtherModule']);

            expect(injector.has('aConstant')).toBe(true);
            expect(injector.has('anotherConstant')).toBe(true);
        });

        it('loads the required modules of a module', () => {
            const module1 = loader.module('myModule', []);
            const module2 = loader.module('myOtherModule', ['myModule']);
            module1.constant('aConstant', 42);
            module2.constant('anotherConstant', 43);
            const injector = createInjector(['myOtherModule']);

            expect(injector.has('aConstant')).toBe(true);
            expect(injector.has('anotherConstant')).toBe(true);
        });

        it('loads the transitively required modules of a module', () => {
            const module1 = loader.module('myModule', []);
            const module2 = loader.module('myOtherModule', ['myModule']);
            const module3 = loader.module('myThirdModule', ['myOtherModule']);
            module1.constant('aConstant', 42);
            module2.constant('anotherConstant', 43);
            module3.constant('aThirdConstant', 44);
            const injector = createInjector(['myThirdModule']);

            expect(injector.has('aConstant')).toBe(true);
            expect(injector.has('anotherConstant')).toBe(true);
            expect(injector.has('aThirdConstant')).toBe(true);
        });

        it('loads each module only once', () => {
            loader.module('myModule', ['myOtherModule']);
            loader.module('myOtherModule', ['myModule']);

            createInjector(['myModule']);
        });
    });

    describe('instance', () => {
        let module;

        beforeEach(() => {
            module = loader.module('someModule', []);
        });

        it('invokes a function with the given context', () => {
            module.constant('hundredConstant', 100);

            const $injector = injectorFactory.createInjector(['someModule']);
            const obj = {
                two: 2,
                fn: function func(hundred) {
                    return hundred + this.two;
                }
            };
            obj.fn.$inject = ['hundredConstant'];

            expect($injector.invoke(obj.fn, obj)).toBe(102);
        });

        it('overwrites dependency with locals when invoking with', () => {
            module.constant('a', 1);
            module.constant('b', 2);

            const $injector = injectorFactory.createInjector(['someModule']);
            const fn = (one, two) => one + two;
            fn.$inject = ['a', 'b'];

            expect($injector.invoke(fn, undefined, {b: 3})).toBe(4);
        });

        it('annotates function arguments when arguments are implicit', () => {
            const $injector = injectorFactory.createInjector(['someModule']);
            const fn = (one, two) => one + two;

            expect($injector.annotate(fn)).toEqual(['one', 'two']);
        });

        it('throws when using a non-annotated fn in strict mode', () => {
            const $injector = injectorFactory.createInjector(['someModule'], true);
            const fn = function (a, b, c) {
            };
            expect(() => {
                $injector.annotate(fn);
            }).toThrow();
        });

        it('"instantiate" method creates instance object', () => {
            module.constant('a', 1);
            module.constant('b', 100);

            const $injector = injectorFactory.createInjector(['someModule']);
            const Constructor = function func(a, b) {
                this.sum = a + b;
            };

            const instance = $injector.instantiate(Constructor);

            expect(instance.sum).toBe(101);
        });

        it('uses the prototype of the constructor when instantiating', () => {
            class BaseType {
                getValue() {
                    return 42;
                }
            }
            class Type extends BaseType {
                constructor() {
                    super();
                    this.v = this.getValue();
                }
            }
            const $injector = injectorFactory.createInjector(['someModule']);
            const instance = $injector.instantiate(Type);
            expect(instance.v).toBe(42);
        });

        describe('works with providers:', () => {
            it('registers providers with $get method', () => {
                module.provider('provider', {
                    $get: () => 100
                });
                const $injector = injectorFactory.createInjector(['someModule']);
                expect($injector.get('provider')).toBe(100);
            });

            it('injects the $get method of a provider', () => {
                module.constant('a', 1);
                module.provider('b', {
                    $get: a => a + 2
                });
                const injector = injectorFactory.createInjector(['someModule']);
                expect(injector.get('b')).toBe(3);
            });

            it('injects the $get method of a provider lazily', () => {
                module.provider('b', {
                    $get: a => a + 2
                });
                module.provider('a', {
                    $get: _.constant(1)
                });
                const injector = injectorFactory.createInjector(['someModule']);
                expect(injector.get('b')).toBe(3);
            });

            it('instantiates dependency only once', () => {
                module.provider('someProviderName', {
                    $get: () => {
                        return {};
                    }
                });
                const $injector = injectorFactory.createInjector(['someModule']);
                expect($injector.get('someProviderName')).toBe($injector.get('someProviderName'));
            });

            it('throws when circular dependency found', () => {
                module.provider('a', {
                    $get: (b) => {
                    }
                });
                module.provider('b', {
                    $get: (c) => {
                    }
                });
                module.provider('c', {
                    $get: (a) => {
                    }
                });
                const $injector = injectorFactory.createInjector(['someModule']);

                function act() {
                    $injector.get('a');
                }

                expect(act).toThrow();
            });

            it('cleans up the circular marker when instantiation fails', () => {
                module.provider('a', {
                    $get: () => {
                        throw new Error('Failing instantiation!');
                    }
                });
                const $injector = injectorFactory.createInjector(['someModule']);
                expect(() => {
                    $injector.get('a');
                }).toThrowError('Failing instantiation!');
                expect(() => {
                    $injector.get('a');
                }).toThrowError('Failing instantiation!');
            });

            it('notifies the user about a circular dependency', function () {
                module.provider('a', {
                    $get: (b) => {
                    }
                });
                module.provider('b', {
                    $get: (c) => {
                    }
                });
                module.provider('c', {
                    $get: (a) => {
                    }
                });
                const $injector = injectorFactory.createInjector(['someModule']);
                expect(() => {
                    $injector.get('a');
                }).toThrowError('Circular dependency found: a <- c <- b <- a');
            });

            it('instantiates constructor provider', () => {
                module.constant('b', 1);
                module.provider('a', function providerConstructor(b) {
                    this.$get = () => {
                        return 100 + b;
                    };
                });
                const $injector = injectorFactory.createInjector(['someModule']);
                expect($injector.get('a')).toBe(101);
            });

            it('injects another provider to a provider constructor', () => {
                module.provider('a', function () {
                    let value = 1;
                    this.setValue = (v) => {
                        value = v;
                    };
                    this.$get = () => {
                        return value;
                    };
                });
                module.provider('b', function (aProvider) {
                    aProvider.setValue(2);
                    this.$get = () => {
                    };
                });
                const $injector = injectorFactory.createInjector(['someModule']);
                expect($injector.get('a')).toBe(2);
            });

            it('does not inject an instance to a provider constructor function', () => {
                module.provider('a', function AProvider() {
                    this.$get = () => 1;
                });
                module.provider('b', function BProvider(a) {
                    this.$get = () => a;
                });
                expect(() => {
                    injectorFactory.createInjector(['someModule']);
                }).toThrow();
            });

            it('does not inject a provider to a $get function', () => {
                module.provider('a', function AProvider() {
                    this.$get = () => 1;
                });
                module.provider('b', function BProvider() {
                    this.$get = aProvider => aProvider.$get();
                });
                const $injector = injectorFactory.createInjector(['someModule']);
                expect(() => {
                    $injector.get('b');
                }).toThrow();
            });

            it('does not inject a provider to invoke', () => {
                module.provider('a', function AProvider() {
                    this.$get = () => 1;
                });
                const $injector = injectorFactory.createInjector(['someModule']);
                expect(() => {
                    $injector.invoke(aProvider => {
                    });
                }).toThrow();
            });

            it('does not give access to providers through get', () => {
                module.provider('a', function AProvider() {
                    this.$get = () => 1;
                });
                const $injector = injectorFactory.createInjector(['someModule']);
                expect(() => {
                    $injector.get('aProvider');
                }).toThrow();
            });

            it('registers constants first', () => {
                module.provider('a', function (b) {
                    this.$get = () => {
                        return b;
                    };
                });
                module.constant('b', 100);
                const $injector = injectorFactory.createInjector(['someModule']);
                expect($injector.get('a')).toBe(100);
            });

            it('allows injecting the instance injector to $get', () => {
                module.constant('a', 100);
                module.provider('b', function () {
                    this.$get = ($injector) => $injector.get('a');
                });
                const $injector = injectorFactory.createInjector(['someModule']);
                expect($injector.get('b')).toBe(100);
            });

            it('allows injecting the provider injector to provider', () => {
                module.provider('a', function AProvider() {
                    this.value = 42;
                    this.$get = function () {
                        return this.value;
                    };
                });
                module.provider('b', function BProvider($injector) {
                    const aProvider = $injector.get('aProvider');
                    this.$get = () => aProvider.value;
                });
                const $injector = injectorFactory.createInjector(['someModule']);
                expect($injector.get('b')).toBe(42);
            });

            it('allows injecting the $provide service to providers', () => {
                module.provider('a', function ($provide) {
                    $provide.constant('b', 2);
                    this.$get = (b) => b + 1;
                });
                const injector = injectorFactory.createInjector(['someModule']);
                expect(injector.get('a')).toBe(3);
            });

            it('does not allow injecting $provide to $get', () => {
                module.provider('a', function () {
                    this.$get = function ($provide) {
                    };
                });
                const injector = injectorFactory.createInjector(['someModule']);

                function act() {
                    injector.get('a');
                }

                expect(act).toThrow();
            });

            it('runs config blocks when the injector is created', () => {
                let hasRun = false;
                module.config(() => {
                    hasRun = true;
                });
                injectorFactory.createInjector(['someModule']);
                expect(hasRun).toBe(true);
            });

            it('injects config blocks with provider injector', () => {
                module.config(($provide) => {
                    $provide.constant('a', 100);
                });
                const injector = injectorFactory.createInjector(['someModule']);
                expect(injector.get('a')).toBe(100);
            });

            it('allows registering config blocks before providers', () => {
                module.config(function (aProvider) {
                });
                module.provider('a', function () {
                    this.$get = _.constant(42);
                });
                const injector = injectorFactory.createInjector(['someModule']);
                expect(injector.get('a')).toBe(42);
            });

            it('runs a config block added during module registration', () => {
                const aModule = loader.module('aModule', [], ($provide) => {
                    $provide.constant('a', 100);
                });
                const injector = injectorFactory.createInjector(['aModule']);
                expect(injector.get('a')).toBe(100);
            });

            it('runs run blocks when the injector is created', () => {
                let hasRun = false;
                module.run(() => {
                    hasRun = true;
                });
                injectorFactory.createInjector(['someModule']);
                expect(hasRun).toBe(true);
            });

            it('configures all modules before running any run blocks', () => {
                let result;
                module.provider('a', {$get: _.constant(1)});
                module.run((a, b) => {
                    result = a + b;
                });

                const anotherModule = loader.module('anotherModule', []);
                anotherModule.provider('b', {$get: _.constant(2)});

                injectorFactory.createInjector(['someModule', 'anotherModule']);

                expect(result).toBe(3);
            });

            it('allows registering a factory', () => {
                module.factory('a', () => 100);
                const injector = injectorFactory.createInjector(['someModule']);
                expect(injector.get('a')).toBe(100);
            });

            it('forces factory to return a value', () => {
                module.factory('a', () => {

                });
                module.factory('b', () => {
                    return null;
                });

                const injector = injectorFactory.createInjector(['someModule']);
                expect(() => {
                    injector.get('a');
                }).toThrow();
                expect(injector.get('b')).toBeNull();
            });

            it('allows registering a value', () => {
                module.value('a', 100);
                const injector = injectorFactory.createInjector(['someModule']);
                expect(injector.get('a')).toBe(100);
            });

            it('allows an undefined value', () => {
                module.value('a', undefined);
                const injector = injectorFactory.createInjector(['someModule']);
                expect(injector.get('a')).toBeUndefined();
            });

            it('allows registering a service', () => {
                module.service('aService', function () {
                    this.getValue = () => 100;
                });
                const injector = injectorFactory.createInjector(['someModule']);
                expect(injector.get('aService').getValue()).toBe(100);
            });

            it('injects service constructors with instances', () => {
                module.value('theValue', 100);
                module.service('aService', function (theValue) {
                    this.getValue = () => theValue;
                });
                const injector = injectorFactory.createInjector(['someModule']);
                expect(injector.get('aService').getValue()).toBe(100);
            });

            it('only instantiates services once', () => {
                module.service('aService', function () {

                });
                const injector = injectorFactory.createInjector(['someModule']);
                expect(injector.get('aService')).toBe(injector.get('aService'));
            });

            it('runs a function module dependency as a config block', () => {
                const functionModule = ($provide) => {
                    $provide.constant('a', 100);
                };
                loader.module('aModule', [functionModule]);
                const injector = injectorFactory.createInjector(['aModule']);
                expect(injector.get('a')).toBe(100);
            });

            it('runs a function module with array injection as a config block', function () {
                const functionModule = ['$provide', function ($provide) {
                    $provide.constant('a', 42);
                }];
                loader.module('myModule', [functionModule]);
                const injector = injectorFactory.createInjector(['myModule']);
                expect(injector.get('a')).toBe(42);
            });

            it('supports returning a run block from a function module', () => {
                let result;
                const functionModule = ($provide) => {
                    $provide.constant('a', 100);
                    return (a) => {
                        result = a;
                    };
                };
                loader.module('aModule', [functionModule]);
                injectorFactory.createInjector(['aModule']);
                expect(result).toBe(100);
            });

            it('only loads function modules once', () => {
                const functionModule = jasmine.createSpy('functionModule');
                loader.module('aModule', [functionModule, functionModule]);
                injectorFactory.createInjector(['aModule']);
                expect(functionModule.calls.count()).toBe(1);
            });
        });

        /**
         it('configures all modules before running any run blocks', () => {
            let result;
            module.provider('a', {$get: _.constant(1)});
            module.run((a, b) => {
                result = a + b;
            });

            const anotherModule = loader.module('anotherModule', []);
            anotherModule.provider('b', {$get: _.constant(2)});

            injectorFactory.createInjector(['someModule', 'anotherModule']);

            expect(result).toBe(3);
        });




         it('allows changing an instance using a decorator', () => {
            module.factory('aValue', () => {
                return {
                    aKey: 100
                };
            });
            module.constant('a', 1);
            module.config(($provide) => {
                $provide.decorator('aValue', ($delegate) => {
                    $delegate.decoratedKey = 200;
                });
                $provide.decorator('aValue', (a, $delegate) => {
                    $delegate.anotherDecoratedKey = 300 + a;
                });
            });

            const injector = injectorFactory.createInjector(['someModule']);

            expect(injector.get('aValue').aKey).toBe(100);
            expect(injector.get('aValue').decoratedKey).toBe(200);
            expect(injector.get('aValue').anotherDecoratedKey).toBe(301);
        });
         **/
    });
});
