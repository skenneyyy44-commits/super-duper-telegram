import { Loader2 } from 'lucide-react';
import { Modal } from './Modal';

export const ConfirmDialog = ({
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
  isDestructive = true,
  isProcessing = false,
}) => (
  <Modal title={title} onClose={onClose}>
    <div className="space-y-5">
      {description && <p className="text-sm text-gray-600">{description}</p>}
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          disabled={isProcessing}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`flex items-center px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60 ${
            isDestructive
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 size={18} className="mr-2 animate-spin" /> Working
            </>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </div>
  </Modal>
);
