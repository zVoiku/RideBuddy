// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Stable on-disk cache, shared across web/native builds.
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [new FileStore({ root: path.join(root, 'cache') })];

// Capped only where memory is tight (this repo's Linux dev sandbox OOMs above
// this). On a normal dev machine let Metro use the cores it finds — pinning it
// to 2 roughly triples a cold native bundle.
if (process.env.METRO_MAX_WORKERS) {
  config.maxWorkers = Number(process.env.METRO_MAX_WORKERS);
}

module.exports = config;
