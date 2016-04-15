function defined(value, text) {
    if (typeof value === 'undefined') {
        throw new Error(`${text} is undefined`);
    }
}

function notEmptyString(value, text) {
    if (typeof value !== 'string') {
        throw new Error(`${text} should be a string, instead got: ${value}`);
    }

    if (value === '') {
        throw new Error(`${text} is empty string`);
    }
}

function notNull(value, text) {
    if (value === null) {
        throw new Error(`${text} is null`);
    }
}

function uniqueKey(hash, key, text) {
    if (hash.hasOwnProperty(key)) {
        throw new Error(`duplicate hash map key: ${text} : ${key}`);
    }
}

function definedAndNotNull(value, text) {
    if ((value === null) || (typeof value === 'undefined')) {
        throw new Error(`${text} is ${value}`);
    }
}

function isFunction(value, text) {
    if (!_.isFunction(value)) {
        throw new Error(`${text} should be a function, instead got: ${value}`);
    }
}

function isObject(value, text) {
    if (!_.isObject(value)) {
        throw new Error(`${text} should be an object, instead got: ${value}`);
    }
}

function isArray(value, text) {
    if (!Array.isArray(value)) {
        throw new Error(`${text} should be an array, instead got: ${value}`);
    }
}

export default {
    defined,
    notEmptyString,
    notNull,
    uniqueKey,
    definedAndNotNull,
    isFunction,
    isObject,
    isArray
};
