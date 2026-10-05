// Map NEXORA route keys → URL paths. Used by the store's navigate() shim so the
// existing 60+ call sites keep working while we adopt react-router URLs.
export const ROUTE_PATHS: Record<string, (params?: Record<string, string>) => string> = {
  home: () => '/',
  shop: () => '/shop',
  categories: () => '/categories',
  about: () => '/about',
  product: (p) => `/product/${p?.slug ?? ''}`,
  checkout: () => '/checkout',
  'order-success': (p) => `/order-success/${p?.orderId ?? ''}`,
  orders: () => '/orders',
  wishlist: () => '/wishlist',
  'admin-dashboard': () => '/admin',
  login: () => '/login',
};

/** Set by App once the react-router navigate function is available. */
type Navigator = (to: string, opts?: { replace?: boolean }) => void;
let routerNavigate: Navigator | null = null;

export function setRouterNavigate(fn: Navigator): void {
  routerNavigate = fn;
}

export function push(route: string, params?: Record<string, string>): void {
  const pathFn = ROUTE_PATHS[route];
  const to = pathFn ? pathFn(params) : '/';
  if (routerNavigate) {
    routerNavigate(to);
  } else {
    // Fallback before router mounts (should not happen in practice)
    window.location.hash = to;
  }
}
