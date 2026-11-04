import { BeerBottle, BeerStein, BowlFood, Coffee, ForkKnife, Hamburger, IceCream, Martini, Pizza, Wine } from "@phosphor-icons/react/ssr";

// Icon shown when a product has no photo, picked from the product and category names.
// Order matters: the first match wins, so "cerveza" beats the generic "bebida".
const rules = [
  { icon: BeerStein, words: ["cerveza", "birra", "pinta", "chopp"] },
  { icon: Wine, words: ["vino", "copa de", "espumante", "champagne"] },
  { icon: Martini, words: ["trago", "coctel", "cóctel", "fernet", "gin", "vermut", "aperitivo", "limonada"] },
  { icon: Coffee, words: ["café", "cafe", "té ", "infusion", "infusión"] },
  { icon: BeerBottle, words: ["bebida", "gaseosa", "agua", "jugo", "soda"] },
  { icon: IceCream, words: ["postre", "helado", "dulce"] },
  { icon: Pizza, words: ["pizza"] },
  { icon: Hamburger, words: ["hamburguesa", "burger", "smash"] },
  { icon: BowlFood, words: ["papas", "compartir", "picada", "entrada", "ensalada", "nachos"] },
];

export function PlaceholderIcon({ names, size }: { names: Array<string | undefined>; size: number }) {
  const text = ` ${names.filter(Boolean).join(" ").toLowerCase()} `;
  const Icon = rules.find((rule) => rule.words.some((word) => text.includes(word)))?.icon ?? ForkKnife;
  return <Icon size={size} weight="duotone" />;
}
