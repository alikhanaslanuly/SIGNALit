/** Keep local environment files from silently shipping a loopback API address. */
export function publicApiOrigin(value: string, production: boolean, allowLocal = false): string {
  if (!value.trim()) return '';
  let url: URL; try {url=new URL(value.trim());} catch {throw new Error('VITE_API_URL must be an HTTP(S) origin, without a path.');}
  if (!['http:','https:'].includes(url.protocol)||url.pathname!=='/'||url.search||url.hash||url.username||url.password) throw new Error('VITE_API_URL must be an HTTP(S) origin, without credentials or a path.');
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(production&&!allowLocal&&(local||url.protocol!=='https:')) throw new Error('Production VITE_API_URL requires HTTPS and a reachable non-loopback hostname. For a local preview only, use SIGNAL_ALLOW_LOCAL_API=1.');
  return url.origin;
}
