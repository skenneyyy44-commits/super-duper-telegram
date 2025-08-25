import React from 'react';

export function Badge({ className = '', children, ...props }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-100 ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
