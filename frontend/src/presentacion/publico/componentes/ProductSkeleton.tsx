import React from 'react';

interface ProductSkeletonProps {
  count?: number;
}

export const ProductSkeleton: React.FC<ProductSkeletonProps> = ({ count = 8 }) => (
  <>
    {Array.from({ length: count }).map((_, t) => (
      <div key={t} className="product-card-skeleton glass-panel">
        <div className="skeleton-image-area skeleton-shimmer" />
        <div className="skeleton-info">
          <div className="skeleton-title-line skeleton-shimmer" />
          <div className="skeleton-price-line skeleton-shimmer" />
          <div className="skeleton-chips">
            <div className="skeleton-chip-item skeleton-shimmer" />
            <div className="skeleton-chip-item skeleton-shimmer" />
            <div className="skeleton-chip-item skeleton-shimmer" />
          </div>
        </div>
        <div className="skeleton-btn-area">
          <div className="skeleton-btn-placeholder skeleton-shimmer" />
        </div>
      </div>
    ))}
  </>
);
