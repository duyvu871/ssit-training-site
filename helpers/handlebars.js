/**
 * Custom Handlebars Helpers
 */

const moment = require('moment');
moment.locale('vi');

module.exports = {
  // Math helpers
  sum: (...args) => {
    // Remove the object argument that Handlebars adds
    args.pop();
    return args.reduce((a, b) => Number(a) + Number(b), 0);
  },

  multiply: (a, b) => Number(a) * Number(b),

  divide: (a, b) => Number(a) / Number(b),

  subtract: (a, b) => Number(a) - Number(b),

  // Comparison helpers
  eq: (a, b) => a === b,

  neq: (a, b) => a !== b,

  gt: (a, b) => Number(a) > Number(b),

  gte: (a, b) => Number(a) >= Number(b),

  lt: (a, b) => Number(a) < Number(b),

  lte: (a, b) => Number(a) <= Number(b),

  // Logic helpers
  and: (...args) => {
    args.pop(); // Remove the object argument
    return args.every(Boolean);
  },

  or: (...args) => {
    args.pop(); // Remove the object argument
    return args.some(Boolean);
  },

  not: (a) => !a,

  // Array helpers
  includes: (array, value) => array.includes(value),

  // String helpers
  concat: (...args) => {
    args.pop(); // Remove the object argument
    return args.join("");
  },

  toLowerCase: (str) => str.toLowerCase(),

  toUpperCase: (str) => str.toUpperCase(),

  // Date helpers
  formatDate: function(date) {
    return moment(date).format('DD/MM/YYYY HH:mm');
  },

  formatDateTime: (date) => {
    if (!date) return "";
    return new Date(date).toLocaleString("vi-VN");
  },

  // Conditional helpers
  ifCond: function (v1, operator, v2, options) {
    switch (operator) {
      case "==":
        return v1 == v2 ? options.fn(this) : options.inverse(this);
      case "===":
        return v1 === v2 ? options.fn(this) : options.inverse(this);
      case "!=":
        return v1 != v2 ? options.fn(this) : options.inverse(this);
      case "!==":
        return v1 !== v2 ? options.fn(this) : options.inverse(this);
      case "<":
        return v1 < v2 ? options.fn(this) : options.inverse(this);
      case "<=":
        return v1 <= v2 ? options.fn(this) : options.inverse(this);
      case ">":
        return v1 > v2 ? options.fn(this) : options.inverse(this);
      case ">=":
        return v1 >= v2 ? options.fn(this) : options.inverse(this);
      case "&&":
        return v1 && v2 ? options.fn(this) : options.inverse(this);
      case "||":
        return v1 || v2 ? options.fn(this) : options.inverse(this);
      default:
        return options.inverse(this);
    }
  },

  eq: function (a, b) {
    return a === b;
  },
  or: function (a, b) {
    return a || b;
  },
  and: function (a, b) {
    return a && b;
  },
  substring: function (str, start, length) {
    return str ? str.substring(start, start + length) : "";
  },
  new: function (className, ...args) {
    // Helper for creating new instances - mainly for Date objects
    if (className === "Date") {
      return new Date(...args);
    }
    return null;
  },

  // New helpers from the code block
  fromNow: function(date) {
    return moment(date).fromNow();
  },

  truncate: function(text, length) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  },

  join: function(arr, separator) {
    if (!Array.isArray(arr)) return '';
    return arr.join(separator);
  },

  numberFormat: function(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },

  when: function(operand, options) {
    return operand ? options.fn(this) : options.inverse(this);
  },

  math: function(lvalue, operator, rvalue) {
    lvalue = parseFloat(lvalue);
    rvalue = parseFloat(rvalue);
    return {
      "+": lvalue + rvalue,
      "-": lvalue - rvalue,
      "*": lvalue * rvalue,
      "/": lvalue / rvalue,
      "%": lvalue % rvalue
    }[operator];
  },

  limit: function(arr, limit) {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, limit);
  },

  nl2br: function(text) {
    if (!text) return '';
    return text.replace(/(\r\n|\n|\r)/gm, '<br>');
  },
};
