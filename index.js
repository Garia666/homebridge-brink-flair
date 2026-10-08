'use strict';

const { BrinkFlairPlatform, PLUGIN, PLATFORM } = require('./lib/platform');

module.exports = (api) => {
  api.registerPlatform(PLUGIN, PLATFORM, BrinkFlairPlatform);
};
