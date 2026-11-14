import { useCallback, useState } from 'react';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { Droplet, Leaf, Loader2, Pencil, Trash2 } from 'lucide-react';
import { resolveAppId } from '../../utils/firebase';
import { getPlantsPath, deletePlantWithHealthLogs } from '../../utils/plants';
import { getWateringStatus, formatWateringDueLabel } from '../../utils/watering';
import { EditPlantModal } from '../plant/EditPlantModal';
import { ConfirmDialog } from '../common/ConfirmDialog';

const appId = resolveAppId();

const STATUS_STYLES = {
  overdue: 'bg-red-100 text-red-700',
  'due-soon': 'bg-amber-100 text-amber-700',
  ok: 'bg-green-100 text-green-700',
};

export const PlantCard = ({ plant, onSelect, firestore, userId }) => {
  const [isMarkingWatered, setIsMarkingWatered] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const status = getWateringStatus(plant);

  const handleMarkWatered = useCallback(
    async (event) => {
      event.stopPropagation();
      setIsMarkingWatered(true);
      try {
        await updateDoc(doc(firestore, getPlantsPath(appId, userId), plant.id), {
          lastWateredAt: Timestamp.now(),
        });
      } catch (error) {
        console.error('Failed to mark plant as watered', error);
      } finally {
        setIsMarkingWatered(false);
      }
    },
    [firestore, plant.id, userId],
  );

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deletePlantWithHealthLogs({ firestore, appId, userId, plantId: plant.id });
      setIsConfirmingDelete(false);
    } catch (error) {
      console.error('Failed to delete plant', error);
      setIsDeleting(false);
    }
  }, [firestore, plant.id, userId]);

  return (
    <div className="relative overflow-hidden text-left bg-white rounded-2xl shadow-md transition transform hover:-translate-y-1 hover:shadow-xl">
      <button
        type="button"
        onClick={() => onSelect(plant.id)}
        className="block w-full text-left"
      >
        <div className="relative w-full h-48 bg-gray-100">
          {plant.profileImageBase64 ? (
            <img src={plant.profileImageBase64} alt={plant.name} className="object-cover w-full h-full" />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-green-300">
              <Leaf size={56} />
            </div>
          )}
          <span
            className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${STATUS_STYLES[status.state]}`}
          >
            <Droplet size={12} />
            {formatWateringDueLabel(status)}
          </span>
        </div>
        <div className="px-5 py-4">
          <h3 className="text-xl font-semibold text-gray-900">{plant.name}</h3>
          <p className="text-sm text-gray-500">{plant.species || 'Unknown species'}</p>
        </div>
      </button>

      <div className="flex items-center justify-end gap-1 px-5 pb-4">
        <button
          type="button"
          onClick={handleMarkWatered}
          disabled={isMarkingWatered}
          aria-label="Mark watered"
          title="Mark watered"
          className="p-2 rounded-full hover:bg-gray-100 text-gray-500 disabled:opacity-50"
        >
          {isMarkingWatered ? <Loader2 size={16} className="animate-spin" /> : <Droplet size={16} />}
        </button>
        <button
          type="button"
          onClick={() => setIsEditModalOpen(true)}
          aria-label="Edit plant"
          title="Edit plant"
          className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={() => setIsConfirmingDelete(true)}
          aria-label="Delete plant"
          title="Delete plant"
          className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {isEditModalOpen && (
        <EditPlantModal
          firestore={firestore}
          userId={userId}
          plant={plant}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}

      {isConfirmingDelete && (
        <ConfirmDialog
          title="Delete plant?"
          description={`This will permanently delete "${plant.name}" and all of its health log entries. This cannot be undone.`}
          isProcessing={isDeleting}
          onConfirm={handleDelete}
          onClose={() => setIsConfirmingDelete(false)}
        />
      )}
    </div>
  );
};
