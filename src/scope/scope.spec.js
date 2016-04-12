import Scope from './scope';
import _ from 'lodash';

/**
 * TODO:
 * - digest optimization (lastDirty)
 * - $$postDigest
 * - watchers removal
 * - $watchGroup
 * - substituting the parent scope
 *
 * PART 2 - watchCollections
 * PART 3 - events
 */

describe('Scope', () => {
    describe('digest', () => {
        let scope;

        beforeEach(() => {
            scope = new Scope();
        });

        it('calls the listener function of a watch on first $digest', () => {
            const watchFn = () => {
            };
            const listenerFn = jasmine.createSpy();

            scope.$watch(watchFn, listenerFn);
            scope.$digest();

            expect(listenerFn).toHaveBeenCalled();
        });

        it('calls the watch function with the scope as the argument', () => {
            const watchFn = jasmine.createSpy();
            const listenerFn = () => {
            };
            scope.$watch(watchFn, listenerFn);
            scope.$digest();

            expect(watchFn).toHaveBeenCalledWith(scope);
        });

        it('calls the listener function when the watched value changes', () => {
            let counter = 0;
            scope.someValue = 'a';
            scope.$watch(
                $scope => $scope.someValue,
                () => counter++
            );
            expect(counter).toBe(0);

            scope.$digest();
            expect(counter).toBe(1);

            scope.$digest();
            expect(counter).toBe(1);

            scope.someValue = 'b';
            expect(counter).toBe(1);

            scope.$digest();
            expect(counter).toBe(2);
        });

        it('calls listener when watch value is first undefined', () => {
            let counter = 0;
            scope.$watch(
                $scope => $scope.someValue,
                () => counter++
            );
            scope.$digest();

            expect(counter).toBe(1);
        });

        it('calls listener with new value as old value the first time', () => {
            let oldValueGiven;
            scope.someValue = 123;
            scope.$watch(
                $scope => $scope.someValue,
                (newValue, oldValue) => {
                    oldValueGiven = oldValue;
                }
            );

            scope.$digest();

            expect(oldValueGiven).toBe(123);
        });

        it('may have watchers that omit the listener function', () => {
            const watchFn = jasmine.createSpy().and.returnValue('something');
            scope.$watch(watchFn);
            scope.$digest();

            expect(watchFn).toHaveBeenCalled();
        });


        it('triggers chained watchers in the same digest', () => {
            scope.name = 'Jane';
            scope.$watch(
                $scope => $scope.nameUpper,
                (newValue, oldValue, $scope) => {
                    if (newValue) {
                        $scope.initial = `${newValue.substring(0, 1)}.`;
                    }
                }
            );
            scope.$watch(
                $scope => $scope.name,
                (newValue, oldValue, $scope) => {
                    if (newValue) {
                        $scope.nameUpper = newValue.toUpperCase();
                    }
                }
            );
            scope.$digest();
            expect(scope.initial).toBe('J.');
            scope.name = 'Bob';
            scope.$digest();
            expect(scope.initial).toBe('B.');
        });

        it('gives up on the watches after 10 iterations', () => {
            scope.counterA = 0;
            scope.counterB = 0;
            scope.$watch(
                $scope => $scope.counterA,
                (newValue, oldValue, $scope) => {
                    $scope.counterB++;
                }
            );
            scope.$watch(
                $scope => $scope.counterB,
                (newValue, oldValue, $scope) => {
                    $scope.counterA++;
                }
            );
            expect(() => scope.$digest()).toThrow();
        });

        it('ends the digest when the last watch is clean', () => {
            scope.array = _.range(100);
            let watchExecutions = 0;
            _.times(100, i => {
                scope.$watch(
                    $scope => {
                        watchExecutions++;
                        return $scope.array[i];
                    },
                    () => {
                    }
                );
            });
            scope.$digest();
            expect(watchExecutions).toBe(200);
            scope.array[0] = 420;
            scope.$digest();
            expect(watchExecutions).toBe(300);
        });

        it('does not end digest so that new watches are not run', () => {
            scope.aValue = 'abc';
            scope.counter = 0;
            scope.$watch(
                ($scope) => $scope.aValue,
                (newValue, oldValue, $scope) => {
                    $scope.$watch(
                        $$scope => $$scope.aValue,
                        ($$newValue, $$oldValue, $$scope) => {
                            $$scope.counter++;
                        });
                }
            );
            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it('compares based on value if enabled', () => {
            scope.aValue = [1, 2, 3];
            scope.counter = 0;
            scope.$watch(
                $scope => $scope.aValue,
                (newValue, oldValue, $scope) => $scope.counter++,
                true
            );
            scope.$digest();
            expect(scope.counter).toBe(1);
            scope.aValue.push(4);
            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it('correctly handles NaNs', () => {
            scope.number = 0 / 0; // NaN
            scope.counter = 0;
            scope.$watch(
                $scope => $scope.number,
                (newValue, oldValue, $scope) => $scope.counter++
            );
            scope.$digest();
            expect(scope.counter).toBe(1);
            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it('executes $eval-ed function and returns result', () => {
            scope.aValue = 42;
            expect(scope.$eval($scope => $scope.aValue)).toBe(42);
        });

        it('passes the second $eval argument straight through', () => {
            scope.aValue = 42;
            expect(scope.$eval(($scope, arg) => $scope.aValue + arg, 2)).toBe(44);
        });

        it('executes $applyed function and starts the digest', () => {
            scope.aValue = 'someValue';
            scope.counter = 0;
            scope.$watch(
                $scope => $scope.aValue,
                (newValue, oldValue, $scope) => $scope.counter++
            );
            scope.$digest();
            expect(scope.counter).toBe(1);
            scope.$apply($scope => {
                $scope.aValue = 'someOtherValue';
            });
            expect(scope.counter).toBe(2);
        });

        it('executes $evalAsync-ed function later in the same cycle', () => {
            scope.aValue = [1, 2, 3];
            scope.asyncEvaluated = false;
            scope.asyncEvaluatedImmediately = false;
            scope.$watch(
                $scope => $scope.aValue,
                (newValue, oldValue, $scope) => {
                    $scope.$evalAsync(($$scope) => {
                        $$scope.asyncEvaluated = true;
                    });
                    $scope.asyncEvaluatedImmediately = $scope.asyncEvaluated;
                }
            );
            scope.$digest();
            expect(scope.asyncEvaluated).toBe(true);
            expect(scope.asyncEvaluatedImmediately).toBe(false);
        });

        it('executes postponed funcs even if not dirty respecting the digest limit', () => {
            scope.aValue = [1, 2, 3];
            scope.postponedExecutionCount = 0;
            scope.$watch(
                $scope => {
                    if ($scope.postponedExecutionCount === 2) {
                        return;
                    }
                    $scope.$evalAsync(($$scope) => {
                        $$scope.postponedExecutionCount++;
                    });
                },
                () => {
                }
            );
            scope.$digest();
            expect(scope.postponedExecutionCount).toBe(2);
        });

        it('has a $$phase field whose value is the current digest phase', () => {
            scope.aValue = [1, 2, 3];
            scope.phaseInWatchFunction = undefined;
            scope.phaseInListenerFunction = undefined;
            scope.phaseInApplyFunction = undefined;
            scope.$watch(
                $scope => {
                    $scope.phaseInWatchFunction = $scope.$$phase;
                    return $scope.aValue;
                },
                (newValue, oldValue, $scope) => {
                    $scope.phaseInListenerFunction = $scope.$$phase;
                });
            scope.$apply($scope => {
                $scope.phaseInApplyFunction = $scope.$$phase;
            });

            expect(scope.phaseInWatchFunction).toBe('$digest');
            expect(scope.phaseInListenerFunction).toBe('$digest');
            expect(scope.phaseInApplyFunction).toBe('$apply');
        });

        it('schedules a digest in $evalAsync', (done) => {
            scope.aValue = 'abc';
            scope.counter = 0;
            scope.$watch(
                $scope => $scope.aValue,
                (newValue, oldValue, $scope) => {
                    $scope.counter++;
                }
            );
            scope.$evalAsync(() => {
            });
            expect(scope.counter).toBe(0);
            setTimeout(() => {
                expect(scope.counter).toBe(1);
                done();
            }, 50);
        });

        it('allows async $apply with $applyAsync', (done) => {
            scope.counter = 0;
            scope.$watch(
                ($scope) => $scope.aValue,
                (newValue, oldValue, $scope) => {
                    $scope.counter++;
                }
            );
            scope.$digest();
            expect(scope.counter).toBe(1);
            scope.$applyAsync($scope => {
                $scope.aValue = 'abc';
            });
            expect(scope.counter).toBe(1);
            setTimeout(() => {
                expect(scope.counter).toBe(2);
                done();
            }, 50);
        });

        it('never executes $applyAsynced function in the same cycle', (done) => {
            scope.aValue = [1, 2, 3];
            scope.asyncApplied = false;
            scope.$watch(
                $scope => $scope.aValue,
                (newValue, oldValue, $scope) => {
                    $scope.$applyAsync(($$scope) => {
                        $$scope.asyncApplied = true;
                    });
                }
            );
            scope.$digest();
            expect(scope.asyncApplied).toBe(false);
            setTimeout(() => {
                expect(scope.asyncApplied).toBe(true);
                done();
            }, 50);
        });

        it('coalesces many calls to $applyAsync', (done) => {
            scope.counter = 0;
            scope.$watch(
                $scope => {
                    $scope.counter++;
                    return $scope.aValue;
                },
                () => {
                }
            );
            scope.$applyAsync(($scope) => {
                $scope.aValue = 'abc';
            });
            scope.$applyAsync(($scope) => {
                $scope.aValue = 'def';
            });
            setTimeout(() => {
                expect(scope.counter).toBe(2);
                done();
            }, 50);
        });

        it('cancels and flushes $applyAsync if digested first', (done) => {
            scope.counter = 0;
            scope.$watch(
                $scope => {
                    $scope.counter++;
                    return $scope.aValue;
                },
                () => {
                }
            );
            scope.$applyAsync(($scope) => {
                $scope.aValue = 'abc';
            });
            scope.$applyAsync(($scope) => {
                $scope.aValue = 'def';
            });
            scope.$digest();
            expect(scope.counter).toBe(2);
            expect(scope.aValue).toEqual('def');
            setTimeout(() => {
                expect(scope.counter).toBe(2);
                done();
            }, 50);
        });

        it('catches exceptions in watch functions and continues', () => {
            scope.aValue = 'abc';
            scope.counter = 0;
            scope.$watch(
                () => {
                    throw new Error('error');
                },
                () => {
                }
            );
            scope.$watch(
                ($scope) => $scope.aValue,
                (newValue, oldValue, $scope) => {
                    $scope.counter++;
                }
            );
            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it('catches exceptions in listener functions and continues', () => {
            scope.aValue = 'abc';
            scope.counter = 0;
            scope.$watch(
                $scope => $scope.aValue,
                () => {
                    throw new Error('error');
                }
            );
            scope.$watch(
                $scope => $scope.aValue,
                (newValue, oldValue, $scope) => {
                    $scope.counter++;
                }
            );
            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it('catches exceptions in $evalAsync', (done) => {
            scope.aValue = 'abc';
            scope.counter = 0;
            scope.$watch(
                $scope => $scope.aValue,
                (newValue, oldValue, $scope) => {
                    $scope.counter++;
                }
            );
            scope.$evalAsync(() => {
                throw new Error('Error');
            });

            setTimeout(() => {
                expect(scope.counter).toBe(1);
                done();
            }, 50);
        });

        it('catches exceptions in $applyAsync', (done) => {
            scope.$applyAsync(() => {
                throw new Error('Error');
            });
            scope.$applyAsync(() => {
                throw new Error('Error');
            });
            scope.$applyAsync(($scope) => {
                $scope.applied = true;
            });
            setTimeout(() => {
                expect(scope.applied).toBe(true);
                done();
            }, 50);
        });
    });

    describe('inheritance', () => {
        it('inherits the parents properties', () => {
            const parent = new Scope();
            parent.aValue = [1, 2, 3];
            const child = parent.$new();
            expect(child.aValue).toEqual([1, 2, 3]);
        });

        it('inherits the parents properties whenever they are defined', () => {
            const parent = new Scope();
            const child = parent.$new();
            parent.aValue = [1, 2, 3];
            expect(child.aValue).toEqual([1, 2, 3]);
        });

        it('can manipulate a parent scopes property', () => {
            const parent = new Scope();
            const child = parent.$new();
            parent.aValue = [1, 2, 3];
            child.aValue.push(4);
            expect(child.aValue).toEqual([1, 2, 3, 4]);
            expect(parent.aValue).toEqual([1, 2, 3, 4]);
        });

        it('can watch a property in the parent', () => {
            const parent = new Scope();
            const child = parent.$new();
            parent.aValue = [1, 2, 3];
            child.counter = 0;
            child.$watch(
                $scope => $scope.aValue,
                (newValue, oldValue, $scope) => {
                    $scope.counter++;
                },
                true
            );
            child.$digest();
            expect(child.counter).toBe(1);
            parent.aValue.push(4);
            child.$digest();
            expect(child.counter).toBe(2);
        });

        it('can be nested at any depth', () => {
            const a = new Scope();
            const aa = a.$new();
            const aaa = aa.$new();
            const aab = aa.$new();
            const ab = a.$new();
            const abb = ab.$new();
            a.value = 1;
            expect(aa.value).toBe(1);
            expect(aaa.value).toBe(1);
            expect(aab.value).toBe(1);
            expect(ab.value).toBe(1);
            expect(abb.value).toBe(1);
            ab.anotherValue = 2;
            expect(abb.anotherValue).toBe(2);
            expect(aa.anotherValue).toBeUndefined();
            expect(aaa.anotherValue).toBeUndefined();
        });

        it('shadows parent properties', () => {
            const parent = new Scope();
            const child = parent.$new();
            parent.a = 1;
            child.a = 100;
            expect(parent.a).toBe(1);
            expect(child.a).toBe(100);
        });

        it('does not shadow object properties', () => {
            const parent = new Scope();
            const child = parent.$new();
            parent.a = {foo: 'bar'};
            child.a.foo = 'baz';
            expect(parent.a.foo).toBe('baz');
            expect(child.a.foo).toBe('baz');
        });

        it('does not digest its parent(s)', () => {
            const parent = new Scope();
            const child = parent.$new();
            parent.aValue = 'abc';
            parent.$watch(
                $scope => $scope.aValue,
                (newValue, oldValue, $scope) => {
                    $scope.aValueWas = newValue;
                }
            );
            child.$digest();
            expect(child.aValueWas).toBeUndefined();
        });

        it('keeps a record of its children', () => {
            const parent = new Scope();
            const child1 = parent.$new();
            const child2 = parent.$new();
            const grandChild2 = child2.$new();
            expect(parent.$$children.length).toBe(2);
            expect(parent.$$children[0]).toBe(child1);
            expect(parent.$$children[1]).toBe(child2);
            expect(child1.$$children.length).toBe(0);
            expect(child2.$$children.length).toBe(1);
            expect(child2.$$children[0]).toBe(grandChild2);
        });

        it('digests its children', () => {
            const parent = new Scope();
            const child = parent.$new();
            parent.aValue = 'abc';
            child.$watch(
                $scope => $scope.aValue,
                (newValue, oldValue, $scope) => {
                    $scope.aValueWas = newValue;
                }
            );
            parent.$digest();
            expect(child.aValueWas).toBe('abc');
        });

        it('digests from root on $apply', () => {
            const parent = new Scope();
            const child = parent.$new();
            const child2 = child.$new();
            parent.aValue = 'abc';
            parent.counter = 0;
            parent.$watch(
                (scope) => scope.aValue,
                (newValue, oldValue, scope) => {
                    scope.counter++;
                }
            );
            child2.$apply(() => {
            });
            expect(parent.counter).toBe(1);
        });

        it('schedules a digest from root on $evalAsync', (done) => {
            const parent = new Scope();
            const child = parent.$new();
            const child2 = child.$new();
            parent.aValue = 'abc';
            parent.counter = 0;
            parent.$watch(
                ($scope) => $scope.aValue,
                (newValue, oldValue, $scope) => {
                    $scope.counter++;
                }
            );
            child2.$evalAsync(() => {
            });
            setTimeout(() => {
                expect(parent.counter).toBe(1);
                done();
            }, 50);
        });

        it('does not have access to parent attributes when isolated', () => {
            const parent = new Scope();
            const child = parent.$new(true);
            parent.aValue = 'abc';
            expect(child.aValue).toBeUndefined();
        });

        it('cannot watch parent attributes when isolated', () => {
            const parent = new Scope();
            const child = parent.$new(true);
            parent.aValue = 'abc';
            child.$watch(
                ($scope) => $scope.aValue,
                (newValue, oldValue, scope) => {
                    scope.aValueWas = newValue;
                }
            );
            child.$digest();
            expect(child.aValueWas).toBeUndefined();
        });

        it('digests its isolated children', () => {
            const parent = new Scope();
            const child = parent.$new(true);
            child.aValue = 'abc';
            child.$watch(
                ($scope) => $scope.aValue,
                (newValue, oldValue, scope) => {
                    scope.aValueWas = newValue;
                }
            );
            parent.$digest();
            expect(child.aValueWas).toBe('abc');
        });

        it('digests from root on $apply when isolated', () => {
            const parent = new Scope();
            const child = parent.$new(true);
            const child2 = child.$new();
            parent.aValue = 'abc';
            parent.counter = 0;
            parent.$watch(
                (scope) => scope.aValue,
                (newValue, oldValue, scope) => {
                    scope.counter++;
                }
            );
            child2.$apply(() => {
            });
            expect(parent.counter).toBe(1);
        });

        it('schedules a digest from root on $evalAsync when isolated', (done) => {
            const parent = new Scope();
            const child = parent.$new(true);
            const child2 = child.$new();
            parent.aValue = 'abc';
            parent.counter = 0;
            parent.$watch(
                (scope) => scope.aValue,
                (newValue, oldValue, scope) => {
                    scope.counter++;
                }
            );
            child2.$evalAsync(() => {
            });
            setTimeout(() => {
                expect(parent.counter).toBe(1);
                done();
            }, 50);
        });

        it('executes $evalAsync functions on isolated scopes', (done) => {
            const parent = new Scope();
            const child = parent.$new(true);
            child.$evalAsync((scope) => {
                scope.didEvalAsync = true;
            });
            setTimeout(() => {
                expect(child.didEvalAsync).toBe(true);
                done();
            }, 50);
        });

        it('is no longer digested when $destroy has been called', () => {
            const parent = new Scope();
            const child = parent.$new();
            child.aValue = [1, 2, 3];
            child.counter = 0;
            child.$watch(
                (scope) => scope.aValue,
                (newValue, oldValue, scope) => {
                    scope.counter++;
                },
                true
            );
            parent.$digest();
            expect(child.counter).toBe(1);
            child.aValue.push(4);
            parent.$digest();
            expect(child.counter).toBe(2);
            child.$destroy();
            child.aValue.push(5);
            parent.$digest();
            expect(child.counter).toBe(2);
        });
    });
});
