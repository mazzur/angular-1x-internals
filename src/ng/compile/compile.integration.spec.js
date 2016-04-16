import Loader from '../../loader/loader';
import InjectorFactory from '../../injector/injector-factory';
import $CompileProvider from './compile-provider';
import Scope from '../../scope/scope';
import _ from 'lodash';
import $ from 'jquery';

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
        return createInjector(['ng', ($compileProvider) => {
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

    it('can be registered with ng module', () => {
        module.directive('test', () => {
        });
        const injector = createInjector(['ng', 'someModule']);
        expect(injector.has('testDirective')).toBe(true);
    });

    it('allows creating several directives with the same name', () => {
        module.directive('test', _.constant({d: 'one'}));
        module.directive('test', _.constant({d: 'two'}));

        const injector = createInjector(['ng', 'someModule']);
        const result = injector.get('testDirective');

        expect(result.length).toBe(2);
        expect(result[0].d).toEqual('one');
        expect(result[1].d).toEqual('two');
    });

    it('allows creating directives with object notation', () => {
        module.directive({
            a: () => {
            },
            b: () => {
            },
            c: () => {
            }
        });

        const injector = createInjector(['ng', 'someModule']);

        expect(injector.has('aDirective')).toBe(true);
        expect(injector.has('bDirective')).toBe(true);
        expect(injector.has('cDirective')).toBe(true);
    });

    it('compiles element directives from a single element', () => {
        const injector = makeInjectorWithDirectives('myDirective', () => ({
            restrict: 'EACM',
            compile: (element) => {
                element.data('hasCompiled', true);
            }
        }));

        injector.invoke($compile => {
            const el = $('<my-directive></my-directive>');
            $compile(el);

            expect(el.data('hasCompiled')).toBe(true);
        });
    });

    it('compiles element directives found from several elements', () => {
        let idx = 1;
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                restrict: 'EACM', compile: element => {
                    element.data('hasCompiled', idx++);
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<my-directive></my-directive><my-directive></my-directive>');
            $compile(el);
            expect(el.eq(0).data('hasCompiled')).toBe(1);
            expect(el.eq(1).data('hasCompiled')).toBe(2);
        });
    });

    it('compiles element directives from child elements', () => {
        let idx = 1;
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                restrict: 'EACM', compile: element => {
                    element.data('hasCompiled', idx++);
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<div><my-directive></my-directive></div>');
            $compile(el);
            expect(el.data('hasCompiled')).toBeUndefined();
            expect(el.find('> my-directive').data('hasCompiled')).toBe(1);
        });
    });

    it('compiles nested directives', () => {
        let idx = 1;
        let injector = makeInjectorWithDirectives('myDir', () => {
            return {
                restrict: 'EACM', compile: element => {
                    element.data('hasCompiled', idx++);
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<my-dir><my-dir><my-dir/></my-dir></my-dir>');
            $compile(el);
            expect(el.data('hasCompiled')).toBe(1);
            expect(el.find('> my-dir').data('hasCompiled')).toBe(2);
            expect(el.find('> my-dir > my-dir').data('hasCompiled')).toBe(3);
        });
    });

    _.forEach(['x', 'data'], prefix => {
        _.forEach([':', '-', '_'], delim => {
            it('compiles element directives with ' + prefix + delim + ' prefix', () => {
                let injector = makeInjectorWithDirectives('myDir', () => {
                    return {
                        restrict: 'EACM', compile: element => {
                            element.data('hasCompiled', true);
                        }
                    };
                });

                injector.invoke($compile => {
                    let el = $('<' + prefix + delim + 'my-dir></' + prefix + delim + 'my-dir>');
                    $compile(el);

                    expect(el.data('hasCompiled')).toBe(true);
                });
            });
        });
    });

    it('compiles attribute directives', () => {
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                restrict: 'EACM', compile: element => {
                    element.data('hasCompiled', true);
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<div my-directive></div>');
            $compile(el);

            expect(el.data('hasCompiled')).toBe(true);
        });
    });

    it('compiles attribute directives with prefixes', () => {
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                restrict: 'EACM', compile: element => {
                    element.data('hasCompiled', true);
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<div x:my-directive></div>');
            $compile(el);

            expect(el.data('hasCompiled')).toBe(true);
        });
    });

    it('compiles several attribute directives in an element', () => {
        let injector = makeInjectorWithDirectives({
            myDirective: () => {
                return {
                    restrict: 'EACM', compile: element => {
                        element.data('hasCompiled', true);
                    }
                };
            },
            mySecondDirective: () => {
                return {
                    restrict: 'EACM', compile: element => {
                        element.data('secondCompiled', true);
                    }
                };
            }
        });

        injector.invoke($compile => {
            let el = $('<div my-directive my-second-directive></div>');
            $compile(el);

            expect(el.data('hasCompiled')).toBe(true);
            expect(el.data('secondCompiled')).toBe(true);
        });
    });

    it('compiles both element and attribute directives in an element', () => {
        let injector = makeInjectorWithDirectives({
            myDirective: () => {
                return {
                    restrict: 'EACM', compile: element => {
                        element.data('hasCompiled', true);
                    }
                };
            },
            mySecondDirective: () => {
                return {
                    restrict: 'EACM', compile: element => {
                        element.data('secondCompiled', true);
                    }
                };
            }
        });

        injector.invoke($compile => {
            let el = $('<my-directive my-second-directive></my-directive>');
            $compile(el);

            expect(el.data('hasCompiled')).toBe(true);
            expect(el.data('secondCompiled')).toBe(true);
        });
    });

    it('compiles attribute directives with ng-attr prefix', () => {
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                restrict: 'EACM', compile: element => {
                    element.data('hasCompiled', true);
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<div ng-attr-my-directive></div>');
            $compile(el);

            expect(el.data('hasCompiled')).toBe(true);
        });
    });

    it('compiles attribute directives with data:ng-attr prefix', () => {
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                restrict: 'EACM', compile: element => {
                    element.data('hasCompiled', true);
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<div data:ng-attr-my-directive></div>');
            $compile(el);

            expect(el.data('hasCompiled')).toBe(true);
        });
    });

    it('compiles class directives', () => {
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                restrict: 'EACM', compile: element => {
                    element.data('hasCompiled', true);
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<div class="my-directive"></div>');
            $compile(el);

            expect(el.data('hasCompiled')).toBe(true);
        });
    });

    it('compiles class directives with prefixes', () => {
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                restrict: 'EACM', compile: element => {
                    element.data('hasCompiled', true);
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<div class="x-my-directive"></div>');
            $compile(el);

            expect(el.data('hasCompiled')).toBe(true);
        });
    });

    it('compiles several class directives in an element', () => {
        let injector = makeInjectorWithDirectives({
            myDirective: () => {
                return {
                    restrict: 'EACM', compile: element => {
                        element.data('hasCompiled', true);
                    }
                };
            },
            mySecondDirective: () => {
                return {
                    restrict: 'EACM', compile: element => {
                        element.data('secondCompiled', true);
                    }
                };
            }
        });

        injector.invoke($compile => {
            let el = $('<div class="my-directive my-second-directive"></div>');
            $compile(el);

            expect(el.data('hasCompiled')).toBe(true);
            expect(el.data('secondCompiled')).toBe(true);
        });
    });

    it('compiles comment directives', () => {
        let hasCompiled;
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                restrict: 'EACM', compile: () => {
                    hasCompiled = true;
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<!-- directive:my-directive -->');
            $compile(el);

            expect(hasCompiled).toBe(true);
        });
    });

    _.forEach({
        E: {element: true, attribute: false, class: false, comment: false},
        A: {element: true, attribute: false, class: false, comment: false},
        C: {element: true, attribute: false, class: false, comment: false},
        M: {element: true, attribute: false, class: false, comment: false},
        EA: {element: true, attribute: false, class: false, comment: false},
        AC: {element: true, attribute: false, class: false, comment: false},
        EAM: {element: true, attribute: false, class: false, comment: false},
        EACM: {element: true, attribute: false, class: false, comment: false}
    }, (expected, restrict) => {

        describe('restricred to ' + restrict, () => {
            _.forEach({
                element: '<my-directive></my-directive>',
                attribute: '<div my-directive></div>',
                class: '<div class="my-directive"></div>',
                comment: '<!-- directive: my-directive -->'
            }, (dom, type) => {
                it((expected[type] ? 'matches' : 'does not match') + ' on ' + type, () => {
                    let hasCompiled = false;
                    let injector = makeInjectorWithDirectives('myDirective', () => {
                        return {
                            restrict: 'EACM', compile: () => {
                                hasCompiled = true;
                            }
                        };
                    });

                    injector.invoke($compile => {
                        let el = $('<!-- directive:my-directive -->');
                        $compile(el);

                        expect(hasCompiled).toBe(true);
                    });
                });
            });
        });
    });

    it('applies to attributes when no restrict given', () => {
        let hasCompiled = false;
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                compile: () => {
                    hasCompiled = true;
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<div my-directive></div>');
            $compile(el);

            expect(hasCompiled).toBe(true);
        });
    });

    it('applies to elements when no restrict given', () => {
        let hasCompiled = false;
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                compile: () => {
                    hasCompiled = true;
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<my-directive></my-directive>');
            $compile(el);

            expect(hasCompiled).toBe(true);
        });
    });

    it('does not apply to classes when no restrict given', () => {
        let hasCompiled = false;
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                compile: () => {
                    hasCompiled = true;
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<div class="my-directive"></div>');
            $compile(el);

            expect(hasCompiled).toBe(false);
        });
    });

    it('allows applying directive to multiple elements', () => {
        let compileEl = false;
        let injector = makeInjectorWithDirectives('myDir', () => {
            return {
                multiElement: true,
                compile: element => {
                    compileEl = element;
                }
            };
        });

        injector.invoke($compile => {
            let el = $('<div my-dir-start></div><span></span><div my-dir-end></div>');
            $compile(el);

            expect(compileEl.length).toBe(3);
        });
    });

    it('returns a public link function from compile', () => {
        let injector = makeInjectorWithDirectives('myDirective', () => {
            return {
                compile: _.noop
            };
        });

        injector.invoke($compile => {
            let el = $('<div my-directive></div>');
            let linkFn = $compile(el);

            expect(linkFn).toBeDefined();
            expect(_.isFunction(linkFn)).toBe(true);
        });
    });

    describe('linking', () => {
        it('takes a scooe and attaches it to elements', () => {
            let injector = makeInjectorWithDirectives('myDirective', () => {
                return {
                    compile: _.noop
                };
            });

            injector.invoke(($compile, $rootScope) => {
                let el = $('<div my-directive></div>');
                $compile(el)($rootScope);

                expect(el.data('$scope')).toBe($rootScope);
            });
        });

        it('calls directive link function with scope', () => {
            let givenScope;
            let givenElement;
            let givenAttrs;
            const injector = makeInjectorWithDirectives('myDirective', () => ({
                compile: () => function link(scope, element, attrs) {
                    givenScope = scope;
                    givenElement = element;
                    givenAttrs = attrs;
                }
            }));

            injector.invoke(($compile, $rootScope) => {
                const el = $('<div my-directive></div>');
                $compile(el)($rootScope);

                expect(givenScope).toBe($rootScope);
                expect(givenElement[0]).toBe(el[0]);
                expect(givenAttrs).toBeDefined();
                expect(givenAttrs.myDirective).toBeDefined();
            });
        });

        it('supports link function in directive definition object', () => {
            let givenScope, givenElement, givenAttrs;
            let injector = makeInjectorWithDirectives('myDirective', () => {
                return {
                    link: (scope, element, attrs) => {
                        givenScope = scope;
                        givenElement = element;
                        givenAttrs = attrs;
                    }
                };
            });

            injector.invoke(($compile, $rootScope) => {
                let el = $('<div my-directive></div>');
                $compile(el)($rootScope);

                expect(givenScope).toBe($rootScope);
                expect(givenElement[0]).toBe(el[0]);
                expect(givenAttrs).toBeDefined();
                expect(givenAttrs.myDirective).toBeDefined();
            });
        });

        it('links directives on child elements first', () => {
            const givenElements = [];
            const injector = makeInjectorWithDirectives('myDirective', () => {
                return {
                    link: (scope, element) => {
                        givenElements.push(element);
                    }
                };
            });

            injector.invoke(($compile, $rootScope) => {
                const el = $('<div my-directive><div my-directive></div></div>');
                $compile(el)($rootScope);

                expect(givenElements.length).toBe(2);
                expect(givenElements[0][0]).toBe(el[0].firstChild);
                expect(givenElements[1][0]).toBe(el[0]);
            });
        });

        it('links children when parent has no directives', () => {
            const givenElements = [];
            const injector = makeInjectorWithDirectives('myDirective', () => ({
                link: (scope, element) => {
                    debugger;

                    givenElements.push(element);
                }
            }));
            injector.invoke(($compile, $rootScope) => {
                const el = $('<div><div my-directive></div></div>');
                $compile(el)($rootScope);
                expect(givenElements.length).toBe(1);
                expect(givenElements[0][0]).toBe(el[0].firstChild);
            });
        });

        it('supports link function objects with post link fn', () => {
            let linked;
            const injector = makeInjectorWithDirectives('myDirective', () => ({
                link: {
                    post: () => {
                        linked = true;
                    }
                }
            }));
            injector.invoke(($compile, $rootScope) => {
                const el = $('<div><div my-directive></div></div>');
                $compile(el)($rootScope);
                expect(linked).toBe(true);
            });
        });

        it('starts with pre-link fn prior to post link fn', () => {
            const linkCalls = [];
            const injector = makeInjectorWithDirectives('myDirective', () => ({
                link: {
                    pre: (scope, el) => {
                        linkCalls.push(['pre', el[0]]);
                    },
                    post: (scope, el) => {
                        linkCalls.push(['post', el[0]]);
                    }
                }
            }));

            injector.invoke(($compile, $rootScope) => {
                const el = $('<div ng-attr-my-directive><div my-directive></div></div>');
                $compile(el)($rootScope);
                expect(linkCalls.length).toBe(4);
                expect(linkCalls[0]).toEqual(['pre', el[0]]);
                expect(linkCalls[1]).toEqual(['pre', el[0].firstChild]);
                expect(linkCalls[2]).toEqual(['post', el[0].firstChild]);
                expect(linkCalls[3]).toEqual(['post', el[0]]);
            });
        });

        it('stabilizes node list during linking', () => {
            const givenElements = [];
            const injector = makeInjectorWithDirectives('myDirective', () => ({
                link: (scope, element) => {
                    givenElements.push(element[0]);
                    element.after('<div></div>');
                }
            }));
            injector.invoke(($compile, $rootScope) => {
                const el = $('<div><div my-directive></div><div my-directive></div></div>');
                const el1 = el[0].childNodes[0];
                const el2 = el[0].childNodes[1];
                $compile(el)($rootScope);
                expect(givenElements.length).toBe(2);
                expect(givenElements[0]).toBe(el1);
                expect(givenElements[1]).toBe(el2);
            });
        });

        it('invokes multi-element directive link functions with whole group', () => {
            let givenElements;
            const injector = makeInjectorWithDirectives('myDirective', () => ({
                multiElement: true,
                link: (scope, element) => {
                    debugger;
                    givenElements = element;
                }
            }));
            injector.invoke(($compile, $rootScope) => {
                const el = $(
                    '<div my-directive-start></div><p></p><div my-directive-end></div>'
                );
                $compile(el)($rootScope);
                expect(givenElements.length).toBe(3);
            });
        });
    });
});
