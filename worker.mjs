// Immutable, public build assets only. No financial data, keys, or request state live on the server.
import assets from './dist/assets.mjs';
export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; manifest-src 'self'; upgrade-insecure-requests",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Origin-Agent-Cluster': '?1',
  'Strict-Transport-Security': 'max-age=31536000',
  'Cache-Control': 'no-store',
};
export default {
  fetch(request) {
    const headers = new Headers(SECURITY_HEADERS);
    if (!['GET','HEAD'].includes(request.method)) {
      headers.set('Allow','GET, HEAD');
      return new Response('Method not allowed',{status:405,headers});
    }
    const path = new URL(request.url).pathname;
    const name = path === '/' ? '/index.html' : path;
    const asset = assets[name];
    if (!asset || !Object.hasOwn(assets,name)) return new Response('Niet gevonden',{status:404,headers});
    headers.set('Content-Type',asset.type);
    const body = request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));
    return new Response(body,{headers});
  }
};
