import React from 'react';

export const Input = React.forwardRef(function Input(
  { className = '', ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={`px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-zinc-100 ${className}`}
      {...props}
    />
  );
});

export default Input;
