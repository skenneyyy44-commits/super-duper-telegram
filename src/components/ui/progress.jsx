import React from 'react';

export function Progress({ value = 0, className = '', ...props }) {
  return (
    <div className={`w-full bg-zinc-800 rounded ${className}`} {...props}>
      <div
        className="bg-zinc-500 h-full rounded"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default Progress;
