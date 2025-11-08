import { AlertTriangle } from 'lucide-react';

export const ErrorState = ({ title = 'Something went wrong', description, onRetry }) => (
  <div className="p-6 text-center bg-red-50 border border-red-200 rounded-xl">
    <div className="flex items-center justify-center mb-3 text-red-600">
      <AlertTriangle className="mr-2" size={20} />
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
    {description && <p className="text-sm text-red-700">{description}</p>}
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 mt-4 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
      >
        Try again
      </button>
    )}
  </div>
);
