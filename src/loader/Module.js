export default class Module {
    constructor(name, requires, modules, configFn) {
        this.name = name;
        this.requires = requires;
        this._invokeQueue = [];
        this._configQueue = [];
        this._runQueue = [];
        this.constant = this.enqueue('$provide', 'constant', 'unshift');
        this.provider = this.enqueue('$provide', 'provider');
        this.factory = this.enqueue('$provide', 'factory');
        this.service = this.enqueue('$provide', 'service');
        this.value = this.enqueue('$provide', 'value');
        this.directive = this.enqueue('$compileProvider', 'directive');
        this.config = this.enqueue('$injector', 'invoke', 'push', this._configQueue);
        if (configFn) {
            this.config(configFn);
        }
    }

    run(fn) {
        this._runQueue.push(fn);
        return this;
    }

    enqueue(service, recipeType, arrayMethod, queue = this._invokeQueue) {
        return (...args) => {
            queue[arrayMethod || 'push']([service, recipeType, args]);
            return this;
        };
    }
}
