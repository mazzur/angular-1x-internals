import _ from 'lodash';
import $ from 'jquery';
import Attributes from './attributes/attributes';
import isBooleanAttribute from './helpers/isBooleanAttribute';

export default class Compiler {
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

    static groupElementsLinkFnWrapper(linkFn, groupStart, groupEnd) {
        return (scope, el, attrs) => {
            const group = Compiler.groupScan(el[0], groupStart, groupEnd);
            return linkFn(scope, group, attrs);
        };
    }

    static nodeName(element) {
        return element.nodeName ? element.nodeName : element[0].nodeName;
    }

    static normalizeDirectiveName(name) {
        const PREFIX_REGEXP = /(x[:\-_]|data[:\-_])/i;
        return _.camelCase(name.replace(PREFIX_REGEXP, ''));
    }

    constructor($injector, directivesStore) {
        this.$injector = $injector;
        this.directivesCache = directivesStore;
    }

    compile($nodes) {
        const compositeLinkFn = this.$$compileNodes($nodes);
        return function publicLinkFn(scope) {
            $nodes.data('$scope', scope);
            compositeLinkFn(scope, $nodes);
        };
    }

    $$compileNodes($nodes) {
        const linkFnObjects = [];
        const compiler = this;

        _.forEach($nodes, compileSingleNode);

        return compositeLinkFn;

        function compileSingleNode(node, i) {
            let nodeLinkFn;
            let childNodesCompositeLinkFn;

            const attrs = new Attributes(compiler.$injector.get('$rootScope'), $(node));

            const directives = compiler.$$collectDirectives(node, attrs);
            if (directives.length) {
                nodeLinkFn = compiler.$$applyDirectivesToNode(directives, node, attrs);
            }

            if (!_.isEmpty(node.childNodes)) {
                childNodesCompositeLinkFn = compiler.$$compileNodes(node.childNodes);
            }

            if (nodeLinkFn || childNodesCompositeLinkFn) {
                linkFnObjects.push({
                    nodeLinkFn,
                    childNodesCompositeLinkFn,
                    idx: i
                });
            }
        }

        function compositeLinkFn(scope, linkNodes) {
            const stableLinkNodes = [];

            _.forEach(linkFnObjects, ({idx}) => {
                stableLinkNodes[idx] = linkNodes[idx];
            });

            _.forEach(linkFnObjects, ({nodeLinkFn, childNodesCompositeLinkFn, idx}) => {
                if (nodeLinkFn) {
                    nodeLinkFn(childNodesCompositeLinkFn, scope, stableLinkNodes[idx]);
                } else {
                    childNodesCompositeLinkFn(scope, stableLinkNodes[idx].children);
                }
            });
        }
    }

    $$collectDirectives(node, attrs) {
        const directives = [];
        let match;

        if (node.nodeType === Node.ELEMENT_NODE) {
            const normalizedNodeName = Compiler.normalizeDirectiveName(Compiler.nodeName(node).toLowerCase());
            this.$$pushApplicableDirectives(directives, normalizedNodeName, 'E');

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
                attrs.$attrMap[normalizedAttr] = name;

                const directiveNName = normalizedAttr.replace(/(Start|End)$/, '');
                if (this.$$directiveIsMultiElement(directiveNName)) {
                    if (/Start$/.test(normalizedAttr)) {
                        attrStartName = name;
                        attrEndName = `${name.substring(0, name.length - 5)}End`;
                        name = name.substring(0, name.length - 5);
                    }
                }

                normalizedAttr = Compiler.normalizeDirectiveName(name.toLowerCase());
                this.$$pushApplicableDirectives(directives, normalizedAttr, 'A', attrStartName, attrEndName);

                if (isNgAttr || !attrs.hasOwnProperty(normalizedAttr)) {
                    attrs[normalizedAttr] = attr.value.trim();

                    if (isBooleanAttribute(node, normalizedAttr)) {
                        attrs[normalizedAttr] = true;
                    }
                }
            });

            _.forEach(node.classList, cls => {
                const normalizedClassName = Compiler.normalizeDirectiveName(cls);

                if (this.$$pushApplicableDirectives(directives, normalizedClassName, 'C')) {
                    attrs[normalizedClassName] = undefined;
                }
            });

            let className = node.className;
            if (_.isString(className) && !_.isEmpty(className)) {
                match = /([\d\w\-_]+)(?:\:([^;]+))?;?/.exec(className);
                while (match) {
                    const normalizedClassName = Compiler.normalizeDirectiveName(match[1]);
                    if (this.$$pushApplicableDirectives(directives, normalizedClassName, 'C')) {
                        attrs[normalizedClassName] = match[2] ? match[2].trim() : undefined;
                    }

                    className = className.substr(match.index + match[0].length);
                    match = /([\d\w\-_]+)(?:\:([^;]+))?;?/.exec(className);
                }
            }
        } else if (node.nodeType === Node.COMMENT_NODE) {
            match = /^\s*directive:\s*([\d\w\-_]+)/.exec(node.nodeValue);
            if (match) {
                this.$$pushApplicableDirectives(directives, Compiler.normalizeDirectiveName(match[1]), 'M');
            }
        }

        return directives;
    }

    $$applyDirectivesToNode(directives, node, attrs) {
        let $compileNode = $(node);
        const preLinkFns = [];
        const postLinkFns = [];

        _.forEach(directives, directive => {
            const directiveStart = directive.$$start;
            const directiveEnd = directive.$$end;

            if (directive.$$start) {
                $compileNode = Compiler.groupScan(node, directive.$$start, directive.$$end);
            }

            if (directive.compile) {
                const linkFn = directive.compile($compileNode, attrs);

                if (_.isFunction(linkFn)) {
                    pushLinkFns(null, linkFn, directiveStart, directiveEnd);
                } else if (_.isObject(linkFn)) {
                    pushLinkFns(linkFn.pre, linkFn.post, directiveStart, directiveEnd);
                }
            }
        });

        function pushLinkFns(preFn, postFn, directiveStart, directiveEnd) {
            let pre = preFn;
            let post = postFn;
            if (post) {
                if (directiveStart) {
                    post = Compiler.groupElementsLinkFnWrapper(post, directiveStart, directiveEnd);
                }
                postLinkFns.push(post);
            }
            if (pre) {
                if (directiveStart) {
                    pre = Compiler.groupElementsLinkFnWrapper(pre, directiveStart, directiveEnd);
                }
                preLinkFns.push(pre);
            }
        }

        function nodeLinkFn(childNodesCompositeLinkFn, scope, nodeToBeLinked) {
            _.forEach(preLinkFns, link);

            if (childNodesCompositeLinkFn) {
                childNodesCompositeLinkFn(scope, nodeToBeLinked.children);
            }

            _.forEach(postLinkFns, link);

            function link(linkFn) {
                linkFn(scope, $(nodeToBeLinked), attrs);
            }
        }

        return nodeLinkFn;
    }

    $$pushApplicableDirectives(directives, name, mode, attrStartName, attrEndName) {
        let match;

        if (this.directivesCache.hasOwnProperty(name)) {
            const foundDirectives = this.$injector.get(`${name}Directive`);
            const applicableDirectives = _.filter(foundDirectives, ddo => _.includes(ddo.restrict, mode));

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
        if (this.directivesCache.hasOwnProperty(name)) {
            const directives = this.$injector.get(`${name}Directive`);
            return _.some(directives, {multiElement: true});
        }

        return false;
    }
}
