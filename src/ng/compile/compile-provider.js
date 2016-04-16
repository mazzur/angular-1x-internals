import _ from 'lodash';
import Compiler from './compiler';

export default class CompileProvider {
    static parseIsolateBindings(scope) {
        return _.transform(scope, (bindings, token, name) => {
            bindings[name] = {
                mode: token
            };
        }, {});
    }

    constructor($provide) {
        this.$provide = $provide;
        this.directivesCache = {};
    }

    directive(key, factory) {
        if (_.isString(key)) {
            this.$$registerSingleDirective(key, factory);
        } else {
            this.$$registerDirectivesObject(key);
        }
    }

    $$registerSingleDirective(name, directiveFactory) {
        if (name === 'hasOwnProperty') {
            throw new Error('hasOwnProperty is not a valid directive name');
        }

        if (!this.directivesCache.hasOwnProperty(name)) {
            this.directivesCache[name] = [];

            this.$provide.factory(`${name}Directive`, [
                '$injector',
                $injector => _.map(this.directivesCache[name], singleDirectiveFactory => {
                    const directiveDO = $injector.invoke(singleDirectiveFactory);
                    directiveDO.restrict = directiveDO.restrict || 'EA';

                    if (directiveDO.link && !directiveDO.compile) {
                        directiveDO.compile = () => directiveDO.link;
                    }

                    if (_.isObject(directiveDO.scope)) {
                        directiveDO.$$isolateBindings = CompileProvider.parseIsolateBindings(directiveDO.scope);
                    }

                    return directiveDO;
                })
            ]);
        }

        this.directivesCache[name].push(directiveFactory);
    }

    $$registerDirectivesObject(directivesObject) {
        _.forEach(directivesObject, (directiveFactory, name) => {
            this.directive(name, directiveFactory);
        });
    }

    $get($injector) {
        const compiler = new Compiler($injector, this.directivesCache);
        return compiler.compile.bind(compiler);
    }
}

CompileProvider.$inject = ['$provide'];
