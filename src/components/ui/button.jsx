import React from 'react';

const variants = {
  default: 'bg-zinc-700 hover:bg-zinc-600 text-white',
  secondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100',
};

const sizes = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-3 py-2',
  lg: 'px-4 py-2',
};

export const Button = React.forwardRef(function Button(
  { className = '', variant = 'default', size = 'md', ...props },
  ref
) {
  const v = variants[variant] || variants.default;
  const s = sizes[size] || sizes.md;
  return (
    <button ref={ref} className={`rounded ${v} ${s} ${className}`} {...props} />
  );
});

export default Button;
