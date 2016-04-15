import _ from 'lodash';
import $ from 'jquery';
import Attributes from './attributes/attributes';
import isBooleanAttribute from './helpers/isBooleanAttribute';

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

    $get($injector) {
        return ($nodes) => {
            const compositeLinkFn = this.$$compileNodes($injector, $nodes);

            return function publicLinkFn(scope) {
                $nodes.data('$scope', scope);
                compositeLinkFn(scope, $nodes);
            };
        };
    }

    static groupScan(node, startAttr, endAttr) {
        const nodes = [];
        let _node = node;

        if (startAttr && _node && _node.hasAttribute(startAttr)) {
            let depth = 0;
            do {
                if (_node.nodeType === Node.ELEMENT_NODE) {
                    if (_node.hasAttribute(startAttr)) {
                        depth++;
                    } else if (_node.hasAttribute(endAttr)) {
                        depth--;
                    }
                }
                nodes.push(_node);
                _node = _node.nextSibling;
            }
            while (depth > 0);
        } else {
            nodes.push(_node);
        }

        return $(nodes);
    }

    $$applyDirectivesToNode(directives, compileNode, attrs) {
        let $compileNode = $(compileNode);
        const linkFns = [];

        _.forEach(directives, directive => {
            if (directive.$$start) {
                $compileNode = CompileProvider.groupScan(compileNode, directive.$$start, directive.$$end);
            }

            if (directive.compile) {
                const linkFn = directive.compile($compileNode, attrs);

                if (linkFn) {
                    linkFns.push(linkFn);
                }
            }
        });

        function nodeLinkFn(childLinkFn, scope, linkNode) {
            if (childLinkFn) {
                childLinkFn(scope, linkNode.childNodes);
            }

            _.forEach(linkFns, linkFn => {
                linkFn(scope, $(linkNode), attrs);
            });
        }

        return nodeLinkFn;
    }

    $$compileNodes($injector, $nodes) {
        const linkFns = [];
        const compileProvider = this;

        _.forEach($nodes, compileSingleNode);

        return compositeLinkFn;

        function compileSingleNode(node, i) {
            let nodeLinkFn;
            let childLinkFn;

            const attrs = new Attributes($injector.get('$rootScope'), $(node));

            const directives = compileProvider.$$collectDirectives($injector, node, attrs);
            if (directives.length) {
                nodeLinkFn = compileProvider.$$applyDirectivesToNode(directives, node, attrs);
            }

            if (node.childNodes && node.childNodes.length) {
                childLinkFn = compileProvider.$$compileNodes($injector, node.childNodes);
            }

            if (nodeLinkFn || childLinkFn) {
                linkFns.push({
                    nodeLinkFn,
                    childLinkFn,
                    idx: i
                });
            }
        }

        function compositeLinkFn(scope, linkNodes) {
            _.forEach(linkFns, linkFn => {
                linkFn.nodeLinkFn(linkFn.childLinkFn, scope, linkNodes[linkFn.idx]);
            });
        }
    }

    static normalizeDirectiveName(name) {
        const PREFIX_REGEXP = /(x[:\-_]|data[:\-_])/i;
        return _.camelCase(name.replace(PREFIX_REGEXP, ''));
    }

    static nodeName(element) {
        return element.nodeName ? element.nodeName : element[0].nodeName;
    }

    $$addDirective($injector, directives, name, mode, attrStartName, attrEndName) {
        let match;

        if (this.directivesStore.hasOwnProperty(name)) {
            const foundDirectives = $injector.get(`${name}Directive`);
            const applicableDirectives = _.filter(foundDirectives, dir => _.includes(dir.restrict, mode));

            _.forEach(applicableDirectives, directiveDO => {
                let directive = directiveDO;
                if (attrStartName) {
                    directive = _.create(directive, {
                        $$start: attrStartName,
                        $$end: attrEndName
                    });
                }

                directives.push(directive);
                match = directive;
            });
        }

        return match;
    }

    $$directiveIsMultiElement($injector, name) {
        if (this.directivesStore.hasOwnProperty(name)) {
            const directives = $injector.get(`${name}Directive`);
            return _.some(directives, {multiElement: true});
        }

        return false;
    }
    
    $$collectDirectives($injector, node, attrs) {
        const directives = [];
        let match;

        if (node.nodeType === Node.ELEMENT_NODE) {
            const normalizedNodeName = CompileProvider.normalizeDirectiveName(CompileProvider.nodeName(node).toLowerCase());
            this.$$addDirective($injector, directives, normalizedNodeName, 'E');

            _.forEach(node.attributes, attr => {
                let attrStartName;
                let attrEndName;
                let name = attr.name;
                let normalizedAttr = CompileProvider.normalizeDirectiveName(name.toLowerCase());
                const isNgAttr = /^ngAttr[A-Z]/.test(normalizedAttr);

                if (isNgAttr) {
                    name = _.kebabCase(normalizedAttr[6].toLowerCase() + normalizedAttr.substring(7));
                    normalizedAttr = CompileProvider.normalizeDirectiveName(name.toLowerCase());
                }
                attrs.$attr[normalizedAttr] = name;

                const directiveNName = normalizedAttr.replace(/(Start|End)$/, '');
                if (this.$$directiveIsMultiElement($injector, directiveNName)) {
                    if (/Start$/.test(normalizedAttr)) {
                        attrStartName = name;
                        attrEndName = `${name.substring(0, name.length - 5)}End`;
                        name = name.substring(0, name.length - 5);
                    }
                }

                normalizedAttr = CompileProvider.normalizeDirectiveName(name.toLowerCase());
                this.$$addDirective($injector, directives, normalizedAttr, 'A', attrStartName, attrEndName);

                if (isNgAttr || !attrs.hasOwnProperty(normalizedAttr)) {
                    attrs[normalizedAttr] = attr.value.trim();

                    if (isBooleanAttribute(node, normalizedAttr)) {
                        attrs[normalizedAttr] = true;
                    }
                }
            });

            _.forEach(node.classList, cls => {
                const normalizedClassName = CompileProvider.normalizeDirectiveName(cls);

                if (this.$$addDirective($injector, directives, normalizedClassName, 'C')) {
                    attrs[normalizedClassName] = undefined;
                }
            });

            let className = node.className;
            if (_.isString(className) && !_.isEmpty(className)) {
                match = /([\d\w\-_]+)(?:\:([^;]+))?;?/.exec(className);
                while (match) {
                    const normalizedClassName = CompileProvider.normalizeDirectiveName(match[1]);
                    if (this.$$addDirective($injector, directives, normalizedClassName, 'C')) {
                        attrs[normalizedClassName] = match[2] ? match[2].trim() : undefined;
                    }

                    className = className.substr(match.index + match[0].length);
                    match = /([\d\w\-_]+)(?:\:([^;]+))?;?/.exec(className);
                }
            }
        } else if (node.nodeType === Node.COMMENT_NODE) {
            match = /^\s*directive:\s*([\d\w\-_]+)/.exec(node.nodeValue);
            if (match) {
                this.$$addDirective($injector, directives, CompileProvider.normalizeDirectiveName(match[1]), 'M');
            }
        }

        return directives;
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
}

CompileProvider.$inject = ['$provide'];
