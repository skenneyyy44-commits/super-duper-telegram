import { useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList, Plus } from 'lucide-react';
import { useFirestoreCollection } from '../../hooks/useFirestoreCollection';
import { LoadingState } from '../common/LoadingState';
import { ErrorState } from '../common/ErrorState';
import { HealthLogEntry } from './HealthLogEntry';
import { HealthLogModal } from './HealthLogModal';
import { resolveAppId } from '../../utils/firebase';

const appId = resolveAppId();

export const PlantDetailView = ({ firestore, userId, plant, onBack }) => {
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const collectionPath = useMemo(
    () => `/artifacts/${appId}/users/${userId}/plants/${plant.id}/healthLogs`,
    [plant.id, userId],
  );

  const { documents: logs, isLoading, error } = useFirestoreCollection({
    firestore,
    path: collectionPath,
    enabled: Boolean(firestore && userId && plant?.id),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl p-4 mx-auto md:p-8">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center mb-6 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={18} className="mr-2" /> Back to dashboard
        </button>

        <section className="p-6 bg-white rounded-3xl shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="w-full md:w-1/3">
              <img
                src={plant.profileImageBase64 || 'https://placehold.co/400x400/a0e5b0/4f8a5f?text=Plant'}
                alt={plant.name}
                className="object-cover w-full h-full rounded-2xl"
              />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900">{plant.name}</h1>
              {plant.species && <p className="mt-2 text-lg text-gray-500">{plant.species}</p>}
              <button
                type="button"
                onClick={() => setIsLogModalOpen(true)}
                className="flex items-center justify-center w-full px-4 py-3 mt-8 text-white bg-green-600 rounded-lg shadow md:w-auto hover:bg-green-700"
              >
                <Plus size={18} className="mr-2" /> Log new health entry
              </button>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <header className="flex items-center gap-3 mb-6">
            <ClipboardList size={22} className="text-green-600" />
            <h2 className="text-2xl font-semibold text-gray-900">Health log</h2>
          </header>

          {isLoading && <LoadingState message="Loading health log..." />}

          {error && (
            <ErrorState
              description="We were unable to load your plant's history."
              onRetry={() => window.location.reload()}
            />
          )}

          {!isLoading && !error && logs.length === 0 && (
            <div className="p-8 text-center text-gray-500 bg-white border border-gray-100 rounded-2xl">
              <h3 className="text-lg font-semibold text-gray-700">No entries yet</h3>
              <p className="mt-2 text-sm">
                Capture your first update by tapping the “Log new health entry” button above.
              </p>
            </div>
          )}

          {!isLoading && logs.length > 0 && (
            <div className="space-y-4">
              {logs.map((log) => (
                <HealthLogEntry key={log.id} log={log} />
              ))}
            </div>
          )}
        </section>
      </div>

      {isLogModalOpen && (
        <HealthLogModal
          firestore={firestore}
          userId={userId}
          plantId={plant.id}
          onClose={() => setIsLogModalOpen(false)}
        />
      )}
    </div>
  );
};
