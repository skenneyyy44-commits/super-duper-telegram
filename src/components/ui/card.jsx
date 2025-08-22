import React from 'react';

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded border border-zinc-800 bg-zinc-900/70 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }) {
  return (
    <div className={`p-4 border-b border-zinc-800 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }) {
  return (
    <h3 className={`font-semibold text-lg ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={`p-4 space-y-2 ${className}`} {...props}>
      {children}
    </div>
  );
}

export default Card;
