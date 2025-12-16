import { lazy, Suspense, ComponentType } from "react";
import { Loader2 } from "lucide-react";

interface LazyLoadOptions {
  fallback?: React.ReactNode;
}

const DefaultFallback = () => (
  <div className="flex items-center justify-center p-8 min-h-[200px]">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

export function lazyLoad<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
) {
  const LazyComponent = lazy(importFn);
  const { fallback = <DefaultFallback /> } = options;

  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

export const LazyMapContainer = lazyLoad(
  () => import("react-leaflet").then(mod => ({ default: mod.MapContainer as any })),
  { fallback: <div className="h-[400px] bg-muted animate-pulse rounded-lg flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> }
);

export const LazyTileLayer = lazyLoad(
  () => import("react-leaflet").then(mod => ({ default: mod.TileLayer as any }))
);

export const LazyMarker = lazyLoad(
  () => import("react-leaflet").then(mod => ({ default: mod.Marker as any }))
);

export const LazyPopup = lazyLoad(
  () => import("react-leaflet").then(mod => ({ default: mod.Popup as any }))
);

export const LazyPolyline = lazyLoad(
  () => import("react-leaflet").then(mod => ({ default: mod.Polyline as any }))
);

export const LazyLineChart = lazyLoad(
  () => import("recharts").then(mod => ({ default: mod.LineChart as any })),
  { fallback: <div className="h-[300px] bg-muted animate-pulse rounded-lg" /> }
);

export const LazyBarChart = lazyLoad(
  () => import("recharts").then(mod => ({ default: mod.BarChart as any })),
  { fallback: <div className="h-[300px] bg-muted animate-pulse rounded-lg" /> }
);

export const LazyAreaChart = lazyLoad(
  () => import("recharts").then(mod => ({ default: mod.AreaChart as any })),
  { fallback: <div className="h-[300px] bg-muted animate-pulse rounded-lg" /> }
);

export const LazyPieChart = lazyLoad(
  () => import("recharts").then(mod => ({ default: mod.PieChart as any })),
  { fallback: <div className="h-[300px] bg-muted animate-pulse rounded-lg" /> }
);

export const LazyResponsiveContainer = lazyLoad(
  () => import("recharts").then(mod => ({ default: mod.ResponsiveContainer as any }))
);
