import _ from 'lodash';
import $ from 'jquery';
import Attributes from './attributes/attributes';
import isBooleanAttribute from './helpers/isBooleanAttribute';

export default class Compiler {
    constructor($injector, directivesStore) {
        this.$injector = $injector;
        this.directivesStore = directivesStore;
    }

    compile($nodes) {
        const compositeLinkFn = this.$$compileNodes($nodes);
        return function publicLinkFn(scope) {
            $nodes.data('$scope', scope);
            compositeLinkFn(scope, $nodes);
        };
    }

    $$compileNodes($nodes) {
        const linkFns = [];
        const compiler = this;

        _.forEach($nodes, compileSingleNode);

        return compositeLinkFn;

        function compileSingleNode(node, i) {
            let nodeLinkFn;
            let childLinkFn;

            const attrs = new Attributes(compiler.$injector.get('$rootScope'), $(node));

            const directives = compiler.$$collectDirectives(node, attrs);
            if (directives.length) {
                nodeLinkFn = compiler.$$applyDirectivesToNode(directives, node, attrs);
            }

            if (node.childNodes && node.childNodes.length) {
                childLinkFn = compiler.$$compileNodes(node.childNodes);
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

    static nodeName(element) {
        return element.nodeName ? element.nodeName : element[0].nodeName;
    }

    static normalizeDirectiveName(name) {
        const PREFIX_REGEXP = /(x[:\-_]|data[:\-_])/i;
        return _.camelCase(name.replace(PREFIX_REGEXP, ''));
    }

    $$applyDirectivesToNode(directives, compileNode, attrs) {
        let $compileNode = $(compileNode);
        const linkFns = [];

        _.forEach(directives, directive => {
            if (directive.$$start) {
                $compileNode = Compiler.groupScan(compileNode, directive.$$start, directive.$$end);
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

    $$addDirective(directives, name, mode, attrStartName, attrEndName) {
        let match;

        if (this.directivesStore.hasOwnProperty(name)) {
            const foundDirectives = this.$injector.get(`${name}Directive`);
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

    $$directiveIsMultiElement(name) {
        if (this.directivesStore.hasOwnProperty(name)) {
            const directives = this.$injector.get(`${name}Directive`);
            return _.some(directives, {multiElement: true});
        }

        return false;
    }

    $$collectDirectives(node, attrs) {
        const directives = [];
        let match;

        if (node.nodeType === Node.ELEMENT_NODE) {
            const normalizedNodeName = Compiler.normalizeDirectiveName(Compiler.nodeName(node).toLowerCase());
            this.$$addDirective(directives, normalizedNodeName, 'E');

            _.forEach(node.attributes, attr => {
                let attrStartName;
                let attrEndName;
                let name = attr.name;
                let normalizedAttr = Compiler.normalizeDirectiveName(name.toLowerCase());
                const isNgAttr = /^ngAttr[A-Z]/.test(normalizedAttr);

                if (isNgAttr) {
                    name = _.kebabCase(normalizedAttr[6].toLowerCase() + normalizedAttr.substring(7));
                    normalizedAttr = Compiler.normalizeDirectiveName(name.toLowerCase());
                }
                attrs.$attr[normalizedAttr] = name;

                const directiveNName = normalizedAttr.replace(/(Start|End)$/, '');
                if (this.$$directiveIsMultiElement(directiveNName)) {
                    if (/Start$/.test(normalizedAttr)) {
                        attrStartName = name;
                        attrEndName = `${name.substring(0, name.length - 5)}End`;
                        name = name.substring(0, name.length - 5);
                    }
                }

                normalizedAttr = Compiler.normalizeDirectiveName(name.toLowerCase());
                this.$$addDirective(directives, normalizedAttr, 'A', attrStartName, attrEndName);

                if (isNgAttr || !attrs.hasOwnProperty(normalizedAttr)) {
                    attrs[normalizedAttr] = attr.value.trim();

                    if (isBooleanAttribute(node, normalizedAttr)) {
                        attrs[normalizedAttr] = true;
                    }
                }
            });

            _.forEach(node.classList, cls => {
                const normalizedClassName = Compiler.normalizeDirectiveName(cls);

                if (this.$$addDirective(directives, normalizedClassName, 'C')) {
                    attrs[normalizedClassName] = undefined;
                }
            });

            let className = node.className;
            if (_.isString(className) && !_.isEmpty(className)) {
                match = /([\d\w\-_]+)(?:\:([^;]+))?;?/.exec(className);
                while (match) {
                    const normalizedClassName = Compiler.normalizeDirectiveName(match[1]);
                    if (this.$$addDirective(directives, normalizedClassName, 'C')) {
                        attrs[normalizedClassName] = match[2] ? match[2].trim() : undefined;
                    }

                    className = className.substr(match.index + match[0].length);
                    match = /([\d\w\-_]+)(?:\:([^;]+))?;?/.exec(className);
                }
            }
        } else if (node.nodeType === Node.COMMENT_NODE) {
            match = /^\s*directive:\s*([\d\w\-_]+)/.exec(node.nodeValue);
            if (match) {
                this.$$addDirective(directives, Compiler.normalizeDirectiveName(match[1]), 'M');
            }
        }

        return directives;
    }
}
