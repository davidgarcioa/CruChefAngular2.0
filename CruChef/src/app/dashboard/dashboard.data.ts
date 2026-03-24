import { Category } from '../models/category.model';
import { Dish } from '../models/dish.model';

export interface NavigationItem {
  label: string;
  route: string;
  icon: string;
}

export interface DishImageOption {
  key: string;
  label: string;
  emoji: string;
  imageUrl: string;
}

const svgToDataUri = (svg: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const dishIllustration = (emoji: string, base: string, accent: string): string =>
  svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="180" viewBox="0 0 220 180">
      <defs>
        <linearGradient id="badge" x1="10%" y1="5%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${base}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
        <radialGradient id="shine" cx="35%" cy="25%" r="60%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.55)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="110" cy="145" rx="70" ry="18" fill="rgba(0,0,0,0.22)" />
      <circle cx="110" cy="88" r="58" fill="url(%23badge)" />
      <circle cx="110" cy="88" r="58" fill="url(%23shine)" />
      <text x="110" y="106" text-anchor="middle" font-size="74">${emoji}</text>
    </svg>
  `);

export const ownerNavigationItems: NavigationItem[] = [
  { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
  { label: 'Ordenes', route: '/orders', icon: 'receipt_long' },
  { label: 'Restaurantes', route: '/restaurants', icon: 'storefront' },
  { label: 'Historial', route: '/history', icon: 'history' },
  { label: 'Cambiar rol', route: '/select-role', icon: 'switch_account' },
];

export const userNavigationItems: NavigationItem[] = [
  { label: 'Menu', route: '/user', icon: 'restaurant_menu' },
  { label: 'Cambiar rol', route: '/select-role', icon: 'switch_account' },
];

export const categories: Category[] = [
  { id: 'all', name: 'Todas', icon: '🍽️' },
  { id: 'burgers', name: 'Burger', icon: '🍔' },
  { id: 'pizza', name: 'Pizza', icon: '🍕' },
  { id: 'tacos', name: 'Tacos', icon: '🌮' },
  { id: 'combo', name: 'Combos', icon: '🍱' },
  { id: 'desserts', name: 'Postres', icon: '🍰' },
];

export const dishImageOptions: DishImageOption[] = [
  {
    key: 'burger',
    label: 'Hamburguesa',
    emoji: '🍔',
    imageUrl: dishIllustration('🍔', '#f0be68', '#7d5233'),
  },
  {
    key: 'pizza',
    label: 'Pizza',
    emoji: '🍕',
    imageUrl: dishIllustration('🍕', '#ef9d52', '#d24b36'),
  },
  {
    key: 'sushi',
    label: 'Sushi',
    emoji: '🍣',
    imageUrl: dishIllustration('🍣', '#ff9a6e', '#2b293c'),
  },
  {
    key: 'dessert',
    label: 'Postre',
    emoji: '🍰',
    imageUrl: dishIllustration('🍰', '#ff8a8d', '#924337'),
  },
  {
    key: 'tacos',
    label: 'Tacos',
    emoji: '🌮',
    imageUrl: dishIllustration('🌮', '#f1b94b', '#b86a25'),
  },
  {
    key: 'combo',
    label: 'Combo',
    emoji: '🍱',
    imageUrl: dishIllustration('🍱', '#84b0ff', '#35507a'),
  },
];

export const dishImageMap = Object.fromEntries(
  dishImageOptions.map((option) => [option.key, option.imageUrl]),
) as Record<string, string>;

export const getDishImageUrl = (imageKey: string): string =>
  dishImageMap[imageKey] ?? dishImageOptions[0].imageUrl;

export const defaultDishes: Dish[] = [
  {
    id: 'dish-1',
    name: 'Hamburguesa',
    price: 24000,
    rating: 5,
    restaurant: "Restaurante Ivon's",
    imageKey: 'burger',
    imageUrl: getDishImageUrl('burger'),
    categoryId: 'burgers',
  },
  {
    id: 'dish-2',
    name: 'Pizza',
    price: 24000,
    rating: 5,
    restaurant: "Restaurante Ivon's",
    imageKey: 'pizza',
    imageUrl: getDishImageUrl('pizza'),
    categoryId: 'pizza',
  },
  {
    id: 'dish-3',
    name: 'Sushi',
    price: 24000,
    rating: 4,
    restaurant: "Restaurante Ivon's",
    imageKey: 'sushi',
    imageUrl: getDishImageUrl('sushi'),
    categoryId: 'combo',
  },
  {
    id: 'dish-4',
    name: 'Postre',
    price: 24000,
    rating: 4,
    restaurant: 'Pasteleria CruChef',
    imageKey: 'dessert',
    imageUrl: getDishImageUrl('dessert'),
    categoryId: 'desserts',
  },
  {
    id: 'dish-5',
    name: 'Tacos',
    price: 22000,
    rating: 5,
    restaurant: 'Taqueria Central',
    imageKey: 'tacos',
    imageUrl: getDishImageUrl('tacos'),
    categoryId: 'tacos',
  },
];
