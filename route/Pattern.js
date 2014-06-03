'use strict';

var Parser = /** @type Parser */ require('./Parser');
var _ = require('lodash-node');

/**
 * @private
 * @static
 * @memberOf Pattern
 * @property
 * @type {RegExp}
 * */
var R_PATTERN = /^\s*([\s\S]*?)(?:\s+(\w+))?\s*$/;

/**
 * @private
 * @static
 * @memberOf Pattern
 * @method
 * */
var escape = require('fist.lang.regesc');

/**
 * @private
 * @static
 * @memberOf Pattern
 * @property
 * @type {Object}
 * */
var flag2ParamMap = {
    s: 'doNotMatchStart',
    e: 'doNotMatchEnd',
    i: 'ignoreCase'
};

/**
 * @class Pattern
 * @extends Parser
 * */
var Pattern = Parser.extend(/** @lends Pattern.prototype */ {

    /**
     * @protected
     * @memberOf {Pattern}
     * @method
     *
     * @constructs
     *
     * @param {String} pattern
     * @param {Object} [params]
     * */
    constructor: function (pattern, params) {

        var match = R_PATTERN.exec(pattern);

        Pattern.Parent.call(this, match[1], params);

        /**
         * @public
         * @memberOf {Pattern}
         * @property
         *
         * @type {Object}
         * */
        this.params = _.reduce(match[2], reduceFlag, this.params);

        /**
         * @protected
         * @memberOf {Pattern}
         * @property
         *
         * @type {Array}
         * */
        this._subst = [];

        /**
         * @private
         * @memberOf {Pattern}
         * @property
         *
         * @type {RegExp}
         * */
        this._regexp = this._compileRegExp();

        /**
         * @protected
         * @memberOf {Pattern}
         * @property
         *
         * @type {Object}
         * */
        this._usesOpt = {};

        _.forEach(this._subst, function (part) {
            this._usesOpt[part.body] = true;
        }, this);
    },

    /**
     * @public
     * @memberOf {Pattern}
     * @method
     *
     * @param {Object} [opts]
     *
     * @returns {String}
     * */
    build: function (opts) {

        var using = {};

        function buildPart (part) {

            switch ( part.type ) {

                case Parser.PART_DELIM:

                    return '/';

                case Parser.PART_STATIC:

                    return part.encoded;

                case Parser.PART_PARAM:

                    return buildParamPart(part.body);

                default:

                    return '';
            }
        }

        function buildParamPart (name) {

            var num;
            var value;

            if ( !_.has(opts, name) ) {

                return '';
            }

            value = opts[name];

            if ( using.hasOwnProperty(name) ) {
                num = using[name] += 1;

            } else {
                num = using[name] = 0;
            }

            if ( _.isArray(value) ) {
                value = value[num];

            } else if ( num ) {

                return '';
            }

            if ( Parser.isFalsy(value) ) {

                return '';
            }

            return encodeURIComponent(value);
        }

        return this.compile(buildPart);
    },

    /**
     * @public
     * @memberOf {Pattern}
     * @method
     *
     * @param {String} pathname
     *
     * @returns {Object}
     * */
    match: function (pathname) {

        var i;
        var l;
        var match = this._regexp.exec(pathname);
        var result = null;

        if ( null === match ) {

            return result;
        }

        result = {};

        for ( i = 0, l = this._subst.length; i < l; i += 1 ) {
            push2Result(result, this._subst[i].body, match[i + 1]);
        }

        return result;
    },

    /**
     * @protected
     * @memberOf {Pattern}
     * @method
     *
     * @returns {RegExp}
     * */
    _compileRegExp: function () {

        var source = this.compile(this._compileRegExpPart);

        if ( !this.params.doNotMatchStart ) {
            source = '^' + source;
        }

        if ( !this.params.doNotMatchEnd ) {
            source += '$';
        }

        return new RegExp(source, this.params.ignoreCase ? 'i' : '');
    },

    /**
     * @private
     * @memberOf {Pattern}
     * @method
     *
     * @param {Object} part
     * @param {Boolean} isBubbling
     *
     * @returns {String}
     * */
    _compileRegExpPart: function (part, isBubbling) {

        switch (part.type) {

            case Parser.PART_DELIM:

                return escape('/');

            case Parser.PART_STATIC:

                return this._compileStaticPart(part);

            case Parser.PART_PARAM:
                this._subst.push(part);

                if ( _.isEmpty(part.parts) ) {

                    return '([^/]+?)';
                }

                return '(' + _.map(part.parts,
                    this._compileStaticPart, this).join('|') + ')';

            default:

                if ( isBubbling ) {

                    return ')?';
                }

                return '(?:';
        }
    },

    /**
     * @private
     * @memberOf {Pattern}
     * @method
     *
     * @param {Object} part
     *
     * @returns {String}
     * */
    _compileStaticPart: function (part) {
        part = decodeURIComponent(part.body);

        return _.reduce(part, this._reduceChar, '', this);
    },

    /**
     * @private
     * @memberOf {Pattern}
     * @method
     *
     * @param {String} result
     * @param {String} char
     *
     * @returns {String}
     * */
    _reduceChar: function (result, char) {

        if ( char === encodeURIComponent(char) ) {

            return result + escape(char);
        }

        if ( this.params.ignoreCase ) {

            return result + '(?:' + escape(char) + '|' +
                      encodeURIComponent(char.toLowerCase()) + '|' +
                      encodeURIComponent(char.toUpperCase()) + ')';
        }

        return result + '(?:' + escape(char) + '|' +
                  encodeURIComponent(char) + ')';
    }

});

/**
 * @private
 * @static
 * @memberOf Pattern
 *
 * @param {Object} result
 * @param {String} name
 * @param {*} value
 *
 * @returns {Object}
 * */
function push2Result (result, name, value) {

    if ( 'string' === typeof value && -1 !== value.indexOf('%') ) {
        value = decodeURIComponent(value);
    }

    if ( result.hasOwnProperty(name) ) {

        if ( _.isArray(result[name]) ) {
            result[name].push(value);

            return result;
        }

        result[name] = [result[name], value];

        return result;
    }

    result[name] = value;

    return result;
}

/**
 * @private
 * @static
 * @memberOf Pattern
 * @method
 *
 * @param {Object} params
 * @param {String} name
 *
 * @returns {Object}
 * */
function reduceFlag (params, name) {

    var lowerName = name.toLowerCase();
    var isLowerCased = name === lowerName;

    name = lowerName;

    if ( _.has(flag2ParamMap, name) ) {
        name = flag2ParamMap[name];
    }

    params[name] = isLowerCased;

    return params;
}

module.exports = Pattern;
