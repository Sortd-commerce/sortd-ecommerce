export type CardVariant = {
  id: number;
  sku: string;
  title: string;
  price: string;
  on_hand: number;
};

export type CardProduct = {
  id: number;
  title: string;
  slug: string;
  brand: string;
  tags: string[];
  from_price: string | null;
  has_passed_report: boolean;
  has_lab_report: boolean;
  category: { name: string; slug: string };
  primary_image: { url: string; alt: string } | null;
  default_variant: CardVariant | null;
};
