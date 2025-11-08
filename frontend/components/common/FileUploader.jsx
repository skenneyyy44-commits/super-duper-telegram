import { useRef } from 'react';
import { Image as ImageIcon } from 'lucide-react';

export const FileUploader = ({ label, helperText, previewSrc, onFileSelected, accept = 'image/png, image/jpeg', required }) => {
  const inputRef = useRef(null);

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  return (
    <div>
      {label && (
        <label className="block mb-2 text-sm font-medium text-gray-700">{label}</label>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative flex items-center justify-center w-full h-48 overflow-hidden border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition"
      >
        {previewSrc ? (
          <img src={previewSrc} alt="Preview" className="object-cover w-full h-full" />
        ) : (
          <div className="text-center text-gray-500">
            <ImageIcon className="mx-auto mb-3" size={44} />
            <p className="text-sm font-medium">Upload an image</p>
            {helperText && <p className="text-xs text-gray-400">{helperText}</p>}
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        required={required}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
};
