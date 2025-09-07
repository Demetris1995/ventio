import React from 'react';
import ProductCard from './ProductCard';
import type { ProductCardProps } from './ProductCard';

export default function ProductGrid({ items }: { items: ProductCardProps[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((p, i) => (
        <ProductCard key={p.href ?? p.title + i} {...p} />
      ))}
    </div>
  );
}
