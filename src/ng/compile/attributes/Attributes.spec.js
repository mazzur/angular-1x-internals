import Loader from '../../../loader/loader';
import InjectorFactory from '../../../injector/injector-factory';
import $CompileProvider from '../compile-provider';
import Scope from '../../../scope/scope';
import $ from 'jquery';

/**
 * TODO
 * observer removal
 * add/remove class
 */

describe('compile provider', () => {
    let module;
    let loader;
    let createInjector;
    let $rootScopeProvider;

    beforeEach(() => {
        $rootScopeProvider = function () {
            this.$get = () => new Scope();
        };
        loader = new Loader();
        loader
            .module('ng', [])
            .provider('$compile', $CompileProvider)
            .provider('$rootScope', $rootScopeProvider);

        module = loader.module('someModule', []);

        const injectorFactory = new InjectorFactory(loader);
        createInjector = injectorFactory.createInjector.bind(injectorFactory);
    });

    function makeInjectorWithDirectives(...args) {
        return createInjector(['ng', function ($compileProvider) {
            $compileProvider.directive.apply($compileProvider, args);
        }]);
    }

    function registerAndCompile(dirName, domString, callback) {
        let givenAttrs;
        let injector = makeInjectorWithDirectives(dirName, () => {
            return {
                restrict: 'EACM',
                compile: (element, attrs) => {
                    givenAttrs = attrs;
                }
            };
        });

        injector.invoke(($compile, $rootScope) => {
            let el = $(domString);
            $compile(el);
            callback(el, givenAttrs, $rootScope);
        });
    }

    it('passes the element attributes to the compile function', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive my-attr="1" my-other-attr="two"></my-directive>',
            (el, attrs) => {
                expect(attrs.myAttr).toEqual('1');
                expect(attrs.myOtherAttr).toEqual('two');
            }
        );
    });

    it('trims attribute values', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive my-attr=" val  "></my-directive>',
            (el, attrs) => {
                expect(attrs.myAttr).toEqual('val');
            }
        );
    });

    it('sets the value of boolean attributes to true', () => {
        registerAndCompile(
            'myDirective',
            '<input my-directive disabled>',
            (el, attrs) => {
                expect(attrs.disabled).toBe(true);
            }
        );
    });

    it('does not set the value of custom boolean attributes to true', () => {
        registerAndCompile(
            'myDirective',
            '<input my-directive whatever>',
            (el, attrs) => {
                expect(attrs.whatever).toEqual('');
            }
        );
    });

    it('overwrites attributes with ng-attr- versions', () => {
        registerAndCompile(
            'myDirective',
            '<input my-directive ng-attr-whatever="42" whatever="41">',
            (el, attrs) => {
                expect(attrs.whatever).toEqual('42');
            }
        );
    });

    it('allows setting attributes', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive attr="true"></my-directive>',
            (el, attrs) => {
                attrs.$set('attr', 'false');
                expect(attrs.attr).toEqual('false');
            }
        );
    });

    it('sets attributes to DOM', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive attr="true"></my-directive>',
            (el, attrs) => {
                attrs.$set('attr', 'false');
                expect(el.attr('attr')).toEqual('false');
            }
        );
    });

    it('does not set attributes to DOM when flag is false', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive attr="true"></my-directive>',
            (el, attrs) => {
                attrs.$set('attr', 'false', false);
                expect(el.attr('attr')).toEqual('true');
            }
        );
    });

    it('shares attributes between directives', () => {
        let attrs1, attrs2;
        let injector = makeInjectorWithDirectives({
            myDir: () => {
                return {
                    compile: (element, attrs) => {
                        attrs1 = attrs;
                    }
                };
            },
            myOtherDir: () => {
                return {
                    compile: (element, attrs) => {
                        attrs2 = attrs;
                    }
                };
            }
        });

        injector.invoke($compile => {
            let el = $('<div my-dir my-other-dir></div>');
            $compile(el);

            expect(attrs1).toBe(attrs2);
        });
    });

    it('sets prop for boolean attributes', () => {
        registerAndCompile(
            'myDirective',
            '<input my-directive>',
            (el, attrs) => {
                attrs.$set('disabled', true);
                expect(el.prop('disabled')).toBe(true);
            }
        );
    });

    it('sets prop for boolean attributes even when not flushing', () => {
        registerAndCompile(
            'myDirective',
            '<input my-directive>',
            (el, attrs) => {
                attrs.$set('disabled', true, false);
                expect(el.prop('disabled')).toBe(true);
            }
        );
    });

    it('denormalizes attribute name when explicitly given', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive some-attribute="42"></my-directive>',
            (el, attrs) => {
                attrs.$set('someAttribute', 43, true, 'some-attribute');
                expect(el.attr('some-attribute')).toEqual('43');
            }
        );
    });

    it('denormalizes attribute by snake-casing', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive some-attribute="42"></my-directive>',
            (el, attrs) => {
                attrs.$set('someAttribute', 43);
                expect(el.attr('some-attribute')).toEqual('43');
            }
        );
    });

    it('denormalizes attribute by using original attribute name', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive x-some-attribute="42"></my-directive>',
            (el, attrs) => {
                attrs.$set('someAttribute', '43');
                expect(el.attr('x-some-attribute')).toEqual('43');
            }
        );
    });

    it('does not use ng-attr- prefix in denormalized names', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive ng-attr-some-attribute="42"></my-directive>',
            (el, attrs) => {
                attrs.$set('someAttribute', '43');
                expect(el.attr('some-attribute')).toEqual('43');
            }
        );
    });

    it('uses new attribute name after once given', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive x-some-attribute="42"></my-directive>',
            (el, attrs) => {
                attrs.$set('someAttribute', '43', true, 'some-attribute');
                attrs.$set('someAttribute', '44');

                expect(el.attr('some-attribute')).toEqual('44');
                expect(el.attr('x-some-attribute')).toEqual('42');
            }
        );
    });

    it('calls observer immediately when attribute is #set', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive some-attribute="42"></my-directive>',
            (el, attrs) => {
                let gotValue;

                attrs.$observe('someAttribute', value => {
                    gotValue = value;
                });

                attrs.$set('someAttribute', '43');

                expect(gotValue).toEqual('43');
            }
        );
    });

    it('calls observers on next $digest after registration', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive some-attribute="42"></my-directive>',
            (element, attrs, $rootScope) => {
                let gotValue;

                attrs.$observe('someAttribute', value => {
                    gotValue = value;
                });

                $rootScope.$digest();

                expect(gotValue).toEqual('42');
            }
        );
    });

    it('lets observers be deregistered', () => {
        registerAndCompile(
            'myDirective',
            '<my-directive some-attribute="42"></my-directive>',
            (element, attrs) => {
                let gotValue;

                let remove = attrs.$observe('someAttribute', value => {
                    gotValue = value;
                });

                attrs.$set('someAttribute', '43');
                expect(gotValue).toEqual('43');

                remove();
                attrs.$set('someAttribute', '44');
                expect(gotValue).toEqual('43');
            }
        );
    });

    it('adds an attribute from a class directive', function () {
        registerAndCompile(
            'myDirective',
            '<div class="my-directive"></div>',
            function (element, attrs) {
                expect(attrs.hasOwnProperty('myDirective')).toBe(true);
            }
        );
    });

    it('does not add attribute from class without a directive', function () {
        registerAndCompile(
            'myDirective',
            '<my-directive class="some-class"></my-directive>',
            function (element, attrs) {
                expect(attrs.hasOwnProperty('someClass')).toBe(false);
            }
        );
    });

    it('supports values for class directive attributes', function () {
        registerAndCompile(
            'myDirective',
            '<div class="my-directive: my attribute value"></div>',
            function (element, attrs) {
                expect(attrs.myDirective).toEqual('my attribute value');
            }
        );
    });

    it('terminates class directive attribute value at semicolon', function () {
        registerAndCompile(
            'myDirective',
            '<div class="my-directive: my attribute value; some-other-class"></div>',
            function (element, attrs) {
                expect(attrs.myDirective).toEqual('my attribute value');
            }
        );
    });
});
