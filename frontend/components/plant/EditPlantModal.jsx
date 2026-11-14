import { useCallback, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { FileUploader } from '../common/FileUploader';
import { fileToBase64 } from '../../utils/media';
import { resolveAppId } from '../../utils/firebase';
import { getPlantsPath } from '../../utils/plants';

const appId = resolveAppId();

export const EditPlantModal = ({ firestore, userId, plant, onClose }) => {
  const [name, setName] = useState(plant.name);
  const [species, setSpecies] = useState(plant.species || '');
  const [previewImage, setPreviewImage] = useState(plant.profileImageBase64 || null);
  const [wateringIntervalDays, setWateringIntervalDays] = useState(
    String(plant.wateringIntervalDays ?? 7),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleFileSelected = useCallback(async (file) => {
    try {
      setPreviewImage(await fileToBase64(file));
    } catch (fileError) {
      console.error('Failed to process image', fileError);
      setError('We were unable to read that file. Please try a different image.');
    }
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!name.trim()) {
        setError('Please add a nickname for your plant.');
        return;
      }
      setError(null);
      setIsSaving(true);

      try {
        await updateDoc(doc(firestore, getPlantsPath(appId, userId), plant.id), {
          name: name.trim(),
          species: species.trim(),
          profileImageBase64: previewImage,
          wateringIntervalDays: Number(wateringIntervalDays) || 7,
        });
        onClose();
      } catch (saveError) {
        console.error('Failed to update plant', saveError);
        setError('We could not save your changes. Please try again.');
      } finally {
        setIsSaving(false);
      }
    },
    [firestore, name, onClose, plant.id, previewImage, species, userId, wateringIntervalDays],
  );

  return (
    <Modal title="Edit plant" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block mb-1 text-sm font-semibold text-gray-700">Nickname</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Living room fern"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-semibold text-gray-700">Species</label>
          <input
            type="text"
            value={species}
            onChange={(event) => setSpecies(event.target.value)}
            placeholder="Optional"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-semibold text-gray-700">Water every ___ days</label>
          <input
            type="number"
            min="1"
            step="1"
            value={wateringIntervalDays}
            onChange={(event) => setWateringIntervalDays(event.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
          />
        </div>
        <FileUploader
          label="Profile photo"
          helperText="PNG or JPG up to 1MB"
          previewSrc={previewImage}
          onFileSelected={handleFileSelected}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300"
            disabled={isSaving || !name}
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" /> Saving
              </>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
