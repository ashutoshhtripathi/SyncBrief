import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  return (
    <nav className={`flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 ${className}`} aria-label="Breadcrumb">
      <Link
        to="/"
        className="p-1 rounded-md hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        title="Today Home"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
            {item.path && !isLast ? (
              <Link
                to={item.path}
                className="hover:text-slate-900 dark:hover:text-white font-medium transition"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
