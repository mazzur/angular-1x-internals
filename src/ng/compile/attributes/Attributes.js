import isBooleanAttribute from '../helpers/isBooleanAttribute';
import _ from 'lodash';

export default class Attributes {
    constructor($rootScope, element) {
        this.$$element = element;
        this.$attrMap = {};

        this._rootScope = $rootScope;
    }

    $set(key, value, writeAttr, attrName) {
        this[key] = value;

        if (isBooleanAttribute(this.$$element[0], key)) {
            this.$$element.prop(key, value);
        }

        if (!attrName) {
            if (this.$attrMap[key]) {
                attrName = this.$attrMap[key];
            }
            else {
                attrName = this.$attrMap[key] = _.kebabCase(key, '-');
            }
        }
        else {
            this.$attrMap[key] = attrName;
        }

        if (writeAttr !== false) {
            this.$$element.attr(attrName, value);
        }

        if (this.$$observers) {
            _.forEach(this.$$observers[key], observer => {
                try {
                    observer(value);
                }
                catch (e) {
                    console.log(e);
                }
            });
        }
    }

    $observe(key, fn) {
        this.$$observers = this.$$observers || Object.create(null);
        this.$$observers[key] = this.$$observers[key] || [];
        this.$$observers[key].push(fn);

        this._rootScope.$evalAsync(() => {
            fn(this[key]);
        });

        return () => {
            let index = this.$$observers[key].indexOf(fn);
            if (index >= 0) {
                this.$$observers[key].splice(index, 1);
            }
        };
    }
}
