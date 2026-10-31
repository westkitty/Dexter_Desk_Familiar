'use strict';

const SIZES = Object.freeze({small: 200, medium: 260, large: 330});
const DEFAULTS = Object.freeze({
  size: 'medium', opacity: 1, alwaysOnTop: true,
  preciseHitTest: true, quiet: false, art: 'pixel',
  x: null, y: null
});

function sanitizeSettings(candidate) {
  const value = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
  return {
    size: Object.hasOwn(SIZES, value.size) ? value.size : DEFAULTS.size,
    opacity: [1, 0.85, 0.7].includes(value.opacity) ? value.opacity : DEFAULTS.opacity,
    alwaysOnTop: typeof value.alwaysOnTop === 'boolean' ? value.alwaysOnTop : DEFAULTS.alwaysOnTop,
    preciseHitTest: typeof value.preciseHitTest === 'boolean' ? value.preciseHitTest : DEFAULTS.preciseHitTest,
    quiet: typeof value.quiet === 'boolean' ? value.quiet : DEFAULTS.quiet,
    art: ['pixel', 'cel', 'atlas'].includes(value.art) ? value.art : DEFAULTS.art,
    x: Number.isInteger(value.x) && Math.abs(value.x) < 100000 ? value.x : null,
    y: Number.isInteger(value.y) && Math.abs(value.y) < 100000 ? value.y : null
  };
}
function dimensions(size) {
  const width = SIZES[size] || SIZES.medium;
  return {width, height: Math.round(width * 1.16)};
}
function clampPosition(position, bounds, windowSize) {
  return {
    x: Math.round(Math.max(bounds.x, Math.min(position.x, bounds.x + bounds.width - windowSize.width))),
    y: Math.round(Math.max(bounds.y, Math.min(position.y, bounds.y + bounds.height - windowSize.height)))
  };
}
function shouldIgnoreMouse({passThrough = false, preciseHitTest = true, overPet = false} = {}) {
  return Boolean(passThrough || (preciseHitTest && !overPet));
}
function isWithinRoot(root, requested) {
  const path = require('node:path');
  const relative = path.relative(root, requested);
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}
module.exports = {SIZES, DEFAULTS, sanitizeSettings, dimensions, clampPosition, shouldIgnoreMouse, isWithinRoot};
