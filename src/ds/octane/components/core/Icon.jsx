import React from 'react';
import {
  FilePenLine, CircleQuestionMark, Package, ShoppingCart, Truck, ShieldCheck,
  LayoutDashboard, CalendarDays, FolderOpen, Bell, ChartColumn, Landmark, Camera,
  Search, BookOpen, Factory, Building2, MapPin, LogOut, Menu, ChevronDown, X,
  Circle, TrendingUp, TrendingDown, Minus, OctagonAlert, TriangleAlert, Info, Check,
} from 'lucide-react';

// Registre EXPLICITE (pas `import {icons} from 'lucide-react'`, qui embarquerait
// les ~1500 icônes de la librairie dans le bundle principal — testé, ça faisait
// passer le chunk index de 392 Ko à 1,23 Mo). Chaque icône réellement utilisée
// quelque part dans l'app doit être ajoutée ici explicitement (import nommé +
// entrée dans REGISTRY) pour rester tree-shakée. Complété au fil des phases
// suivantes (conversion des pages) au fur et à mesure des besoins.
const REGISTRY = {
  'file-pen-line': FilePenLine, 'circle-question-mark': CircleQuestionMark,
  package: Package, 'shopping-cart': ShoppingCart, truck: Truck, 'shield-check': ShieldCheck,
  'layout-dashboard': LayoutDashboard, 'calendar-days': CalendarDays, 'folder-open': FolderOpen,
  bell: Bell, 'chart-column': ChartColumn, landmark: Landmark, camera: Camera,
  search: Search, 'book-open': BookOpen, factory: Factory, 'building-2': Building2,
  'map-pin': MapPin, 'log-out': LogOut, menu: Menu, 'chevron-down': ChevronDown, x: X,
  circle: Circle, 'trending-up': TrendingUp, 'trending-down': TrendingDown, minus: Minus,
  'octagon-alert': OctagonAlert, 'triangle-alert': TriangleAlert, info: Info, check: Check,
};

// Réécriture (v43) : remplace la dépendance CDN window.lucide/UMD par des imports
// npm ciblés — même API (name kebab-case, size, strokeWidth, color, style) pour que
// tous les composants OCTANE qui importent {Icon} n'aient rien à changer.
export function Icon({ name, size = 16, strokeWidth = 1.75, color = 'currentColor', style, ...rest }) {
  const LucideIcon = REGISTRY[name];
  if (!LucideIcon) return null;
  return <LucideIcon size={size} strokeWidth={strokeWidth} color={color}
    style={{ display: 'inline-flex', flex: '0 0 auto', ...style }} aria-hidden="true" {...rest} />;
}
