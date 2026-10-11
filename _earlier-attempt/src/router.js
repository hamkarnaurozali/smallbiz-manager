import { useCallback, useEffect, useState } from 'react';

export const ROUTES = ['dashboard', 'sales', 'expenses', 'products', 'reports', 'data'];

function readRoute() {
  const name = window.location.hash.replace(/^#\/?/, '');
  return ROUTES.includes(name) ? name : 'dashboard';
}

/** Tiny hash router so the browser Back button and refresh keep working without extra libraries. */
export function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((name) => {
    window.location.hash = `#/${name}`;
    setRoute(name);
    window.scrollTo?.(0, 0);
  }, []);
  return [route, navigate];
}
