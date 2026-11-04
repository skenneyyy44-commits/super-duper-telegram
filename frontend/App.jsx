import { useMemo, useState } from 'react';
import { useFirebaseAuth, AUTH_STATUS } from './hooks/useFirebaseAuth';
import { useFirestoreCollection } from './hooks/useFirestoreCollection';
import { PlantDashboard } from './components/dashboard/PlantDashboard';
import { PlantDetailView } from './components/plant/PlantDetailView';
import { AddPlantModal } from './components/plant/AddPlantModal';
import { LoadingState } from './components/common/LoadingState';
import { ErrorState } from './components/common/ErrorState';
import { resolveAppId } from './utils/firebase';

const appId = resolveAppId();

const EmptyShell = ({ message }) => (
  <div className="flex items-center justify-center min-h-screen bg-green-50">
    <LoadingState message={message} />
  </div>
);

export default function App() {
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { firestore, status, user, error } = useFirebaseAuth();

  const plantsPath = useMemo(() => {
    if (!user?.uid) {
      return null;
    }
    return `/artifacts/${appId}/users/${user.uid}/plants`;
  }, [user?.uid]);

  const {
    documents: plants,
    isLoading: isLoadingPlants,
    error: plantsError,
  } = useFirestoreCollection({
    firestore,
    path: plantsPath,
    enabled: status === AUTH_STATUS.READY && Boolean(firestore && plantsPath),
  });

  const selectedPlant = selectedPlantId ? plants.find((plant) => plant.id === selectedPlantId) : null;

  if (status === AUTH_STATUS.ERROR) {
    return (
      <div className="max-w-lg p-6 mx-auto mt-20">
        <ErrorState title="Unable to sign in" description={error?.message} />
      </div>
    );
  }

  if (status !== AUTH_STATUS.READY) {
    return <EmptyShell message="Setting up your greenhouse..." />;
  }

  if (isLoadingPlants) {
    return <EmptyShell message="Loading your plants..." />;
  }

  if (plantsError) {
    return (
      <div className="max-w-lg p-6 mx-auto mt-20">
        <ErrorState
          title="Unable to load plants"
          description={plantsError.message}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans antialiased text-gray-900 bg-gray-50">
      {selectedPlant ? (
        <PlantDetailView
          firestore={firestore}
          userId={user.uid}
          plant={selectedPlant}
          onBack={() => setSelectedPlantId(null)}
        />
      ) : (
        <PlantDashboard
          plants={plants}
          onSelectPlant={setSelectedPlantId}
          onAddPlant={() => setIsAddModalOpen(true)}
        />
      )}

      {isAddModalOpen && (
        <AddPlantModal
          firestore={firestore}
          userId={user.uid}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}
    </div>
  );
}
