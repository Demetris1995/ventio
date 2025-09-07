import React from 'react';

export type ProductCardProps = {
  title: string;
  price: string;
  image?: string | null;
  href?: string;
  onAdd?: () => void;
};

export default function ProductCard({ title, price, image, href, onAdd }: ProductCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-white">
      <a href={href ?? '#'} className="block">
        <div className="aspect-square bg-gray-100 overflow-hidden">
          {image ? (
            <img
              src={image}
              alt={title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          ) : null}
        </div>
      </a>
      <div className="p-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-900">{title}</div>
          <div className="text-sm text-gray-600">{price}</div>
        </div>
        <button
          onClick={onAdd}
          className="text-sm px-3 py-1.5 rounded-md border hover:bg-gray-50"
          aria-label={`Add ${title} to cart`}
        >
          Add
        </button>
      </div>
    </div>
  );
}
