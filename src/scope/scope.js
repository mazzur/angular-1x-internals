import _ from 'lodash';
const initialValue = Symbol('initial watched value');
const noop = () => {
};
const PHASE = {
    DIGEST: '$digest',
    APPLY: '$apply'
};
const logger = noop;

export default class RootScope {
    constructor() {
        this.$$watchers = [];
        this.$$children = [];
        this.$root = this;
        this.$$evalAsyncQueue = [];
        this.$root.$$applyAsyncId = null;
        this.$$applyAsyncQueue = [];
        this.$$phase = null;
    }

    $new(isolated) {
        class ChildScope {
            constructor(parent, isIsolated) {
                if (isIsolated) {
                    this.$$evalAsyncQueue = parent.$$evalAsyncQueue;
                    this.$$applyAsyncQueue = parent.$$applyAsyncQueue;
                    this.$root = parent.$root;
                }
                this.$$watchers = [];
                this.$$children = [];
                this.$parent = parent;
            }
        }

        ChildScope.prototype = isolated ? RootScope.prototype : this;
        const childScope = new ChildScope(this, isolated);
        this.$$children.push(childScope);
        return childScope;
    }

    $destroy() {
        if (this.$root === this) {
            return;
        }
        _.pull(this.$parent.$$children, this);
    }

    $phaseStatus(phase) {
        if (phase && this.$$phase) {
            throw new Error(`phase ${this.$$phase} already in progress`);
        }
        this.$$phase = phase;
    }

    $eval(expr, locals) {
        return expr(this, locals);
    }

    $evalAsync(expr) {
        if (!this.$$phase && _.isEmpty(this.$$evalAsyncQueue)) {
            setTimeout(() => {
                if (!_.isEmpty(this.$$evalAsyncQueue)) {
                    this.$root.$digest();
                }
            });
        }
        this.$$evalAsyncQueue.push({
            scope: this,
            expr
        });
    }

    $applyAsync(expr) {
        this.$$applyAsyncQueue.push(() => {
            this.$eval(expr);
        });
        if (this.$root.$$applyAsyncId === null) {
            this.$root.$$applyAsyncId = setTimeout(() => {
                this.$apply(_.bind(this.$$reduceApplyAsyncQueue, this));
            });
        }
    }

    $apply(expr) {
        try {
            this.$phaseStatus(PHASE.APPLY);
            this.$eval(expr);
        } finally {
            this.$phaseStatus(null);
            this.$root.$digest();
        }
    }

    $watch(watcher, listener = noop, deepEquality = false) {
        watcher.prevValue = initialValue;
        this.$$watchers.push({
            watcher,
            listener,
            deepEquality
        });
    }

    $digest() {
        let iterationCount = 10;
        let isDirty;
        this.$phaseStatus(PHASE.DIGEST);

        if (this.$root.$$applyAsyncId) {
            clearTimeout(this.$root.$$applyAsyncId);
            this.$$reduceApplyAsyncQueue();
        }
        do {
            this.$$reduceEvalAsyncQueue();
            if (!iterationCount--) {
                this.$phaseStatus(null);
                throw new Error('Digest loop exceeded 10 iterations');
            }
            isDirty = this.$$digestIteration();
        }
        while (isDirty || !_.isEmpty(this.$$evalAsyncQueue));
        this.$phaseStatus(null);
    }

    $$digestIteration() {
        return _.reduce(this.$$watchers, (isDirty, {watcher, listener, deepEquality}) => {
            try {
                const newValue = watcher(this);
                if (!RootScope.$$areEqual(watcher.prevValue, newValue, deepEquality)) {
                    listener(newValue, watcher.prevValue === initialValue ? newValue : watcher.prevValue, this);
                    watcher.prevValue = deepEquality ? _.cloneDeep(newValue) : newValue;
                    return true;
                }
                return false;
            } catch (e) {
                logger(e);
                return false;
            }
        }, false, this) || _.some(this.$$children, (childScope) => childScope.$$digestIteration());
    }

    $$reduceEvalAsyncQueue() {
        _.each(this.$$evalAsyncQueue, ({scope, expr}) => {
            try {
                scope.$eval(expr);
            } catch (e) {
                logger(e);
            }
        });
        this.$$evalAsyncQueue = [];
    }

    $$reduceApplyAsyncQueue() {
        _.each(this.$$applyAsyncQueue, (expr) => {
            try {
                expr();
            } catch (e) {
                logger(e);
            }
        });
        this.$$applyAsyncQueue = [];
        this.$root.$$applyAsyncId = null;
    }

    static $$areEqual(newValue, oldValue, deepEquality) {
        if (deepEquality) {
            return _.isEqual(newValue, oldValue);
        }
        return newValue === oldValue || _.every([newValue, oldValue], _.isNaN);
    }
}
