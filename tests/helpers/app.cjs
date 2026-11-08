const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { createCanvas } = require('@napi-rs/canvas');
const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const engraving = fs.readFileSync(path.join(root, 'vendor/vexflow-bravura.js'), 'utf8');

module.exports = function app(preferences) {
  const errors = [];
  const output = new VirtualConsole();
  output.on('error', (...args) => errors.push(args));
  output.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, { url: 'https://mabiscore.test/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: output });
  const { window } = dom;
  window.HTMLCanvasElement.prototype.getContext = function () { return createCanvas(1200, 800).getContext('2d'); };
  window.requestAnimationFrame = () => 1;
  window.cancelAnimationFrame = () => {};
  if (preferences) window.localStorage.setItem('mabiscore-preferences', JSON.stringify(preferences));
  window.eval(engraving);
  window.eval(fs.readFileSync(path.join(root, 'score-engraver.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'mobile-converter.js'), 'utf8'));
  window.eval(script + '\nglobalThis.__app = {state, audio, elements, getScoreLayout:()=>scoreLayout};');
  const click = selector => window.document.querySelector(selector).click();
  const key = (key, options = {}) => window.document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
  const change = (selector, value) => {
    const element = window.document.querySelector(selector);
    element.value = value;
    element.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  return { window, document: window.document, ...window.__app, errors, click, key, change, close: () => window.close() };
};
