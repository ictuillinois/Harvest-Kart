// Resolve a public asset path against Vite's base URL.
// In dev: base = '/'  →  '/models/foo.glb'
// On GitHub Pages: base = '/Harvest-Kart/'  →  '/Harvest-Kart/models/foo.glb'
const base = import.meta.env.BASE_URL;

export function asset(path) {
  // Ensure no double slashes: base ends with '/', path starts with '/'
  return base + path.replace(/^\//, '');
}
