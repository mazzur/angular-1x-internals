import assert from '../helpers/assert';
import Module from './module';

export default class Loader {
    constructor() {
        this.modules = {};
        this.module = (name, requires, configFn) => {
            if (requires) {
                const module = new Module(name, requires, this.modules, configFn);
                this.modules[name] = module;
                return module;
            }
            return this.getModule(name);
        };
    }

    getModule(name) {
        assert.defined(this.modules[name], `module ${name}`);

        return this.modules[name];
    }
}
