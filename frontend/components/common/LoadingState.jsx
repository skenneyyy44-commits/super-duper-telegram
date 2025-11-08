import { Loader2 } from 'lucide-react';

export const LoadingState = ({ message = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center text-gray-600">
    <Loader2 size={32} className="mb-3 text-green-600 animate-spin" />
    <p className="text-base">{message}</p>
  </div>
);
