const { getDefaultConfig } = require('expo/metro-config');

// Polyfill for toReversed() method for Node.js < 20
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return [...this].reverse();
  };
}

const config = getDefaultConfig(__dirname);

module.exports = config;
