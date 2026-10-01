import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const baseClasses = 'animate-pulse bg-slate-200 dark:bg-slate-800';

  const variantClasses = {
    text: 'h-3.5 rounded-md w-full',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  const customStyle: React.CSSProperties = {
    width,
    height,
    ...style,
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={customStyle}
      {...props}
    />
  );
};
