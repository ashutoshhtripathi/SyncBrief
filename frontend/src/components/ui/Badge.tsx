import React from 'react';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  className = '',
  ...props
}) => {
  const sizeClasses: Record<BadgeSize, string> = {
    xs: 'px-1.5 py-0.2 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  const variantClasses: Record<BadgeVariant, { container: string; dot: string }> = {
    neutral: {
      container: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400',
    },
    primary: {
      container: 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900',
      dot: 'bg-blue-500',
    },
    success: {
      container: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-500',
    },
    warning: {
      container: 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
    },
    danger: {
      container: 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900',
      dot: 'bg-rose-500',
    },
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${sizeClasses[size]} ${variantClasses[variant].container} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${variantClasses[variant].dot}`} />}
      <span>{children}</span>
    </span>
  );
};
