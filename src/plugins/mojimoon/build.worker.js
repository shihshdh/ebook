import { build } from './build.js';
self.onmessage = ({ data }) => {
  try { self.postMessage({ books: build(data.raw, { native: data.native }) }); }
  catch (error) { self.postMessage({ error: error?.message || String(error) }); }
};
