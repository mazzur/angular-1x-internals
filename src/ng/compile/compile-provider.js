import _ from 'lodash';
import Compiler from './compiler';

export default class CompileProvider {
    constructor($provide) {
        this.$provide = $provide;
        this.directivesStore = {};
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

        if (!this.directivesStore.hasOwnProperty(name)) {
            this.directivesStore[name] = [];

            this.$provide.factory(`${name}Directive`, [
                '$injector',
                $injector => _.map(this.directivesStore[name], singleDirectiveFactory => {
                    const directiveDO = $injector.invoke(singleDirectiveFactory);
                    directiveDO.restrict = directiveDO.restrict || 'EA';

                    if (directiveDO.link && !directiveDO.compile) {
                        directiveDO.compile = _.constant(directiveDO.link);
                    }

                    return directiveDO;
                })
            ]);
        }

        this.directivesStore[name].push(directiveFactory);
    }

    $$registerDirectivesObject(directivesObject) {
        _.forEach(directivesObject, (directiveFactory, name) => {
            this.directive(name, directiveFactory);
        });
    }

    $get($injector) {
        const compiler = new Compiler($injector, this.directivesStore);
        return compiler.compile.bind(compiler);
    }
}

CompileProvider.$inject = ['$provide'];
