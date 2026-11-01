/* Shared pure alpha-hit geometry for the isolated desktop edition. */
(function (root) {
  'use strict';
  const MASK_SIZE = 64;
  const MIN_ALPHA = 28;
  function containedRect(sourceWidth, sourceHeight, width = MASK_SIZE, height = MASK_SIZE) {
    if (![sourceWidth, sourceHeight, width, height].every(n => Number.isFinite(n) && n > 0)) return null;
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale, drawHeight = sourceHeight * scale;
    return {x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight};
  }
  function within(bounds, x, y) {
    return Boolean(bounds && Number.isFinite(x) && Number.isFinite(y) &&
      Number.isFinite(bounds.left) && Number.isFinite(bounds.top) &&
      bounds.width > 0 && bounds.height > 0 &&
      x >= bounds.left && y >= bounds.top &&
      x < bounds.left + bounds.width && y < bounds.top + bounds.height);
  }
  // Returns null for invalid/incomplete mask input, so callers can use a safe fallback.
  function alphaAt(mask, bounds, x, y, options = {}) {
    if (!within(bounds, x, y)) return false;
    if (!mask || !Number.isInteger(mask.width) || !Number.isInteger(mask.height) ||
        mask.width <= 0 || mask.height <= 0 ||
        !mask.data || mask.data.length < mask.width * mask.height * 4) return null;
    const u = (x - bounds.left) / bounds.width;
    const v = (y - bounds.top) / bounds.height;
    const xIndex = Math.max(0, Math.min(mask.width - 1,
      Math.floor((options.flipped ? 1 - u : u) * mask.width)));
    const yIndex = Math.max(0, Math.min(mask.height - 1, Math.floor(v * mask.height)));
    const alpha = mask.data[(yIndex * mask.width + xIndex) * 4 + 3];
    return alpha >= (Number.isFinite(options.threshold) ? options.threshold : MIN_ALPHA);
  }
  const api = Object.freeze({MASK_SIZE, MIN_ALPHA, containedRect, within, alphaAt});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DexterHitTest = api;
})(typeof window !== 'undefined' ? window : null);
