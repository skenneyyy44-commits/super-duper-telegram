import { Plus, Sprout, Leaf } from 'lucide-react';
import { PlantCard } from './PlantCard';

export const PlantDashboard = ({ plants, onSelectPlant, onAddPlant }) => (
  <div className="p-4 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-200">
      <div className="flex items-center space-x-3">
        <Leaf size={32} className="text-green-600" />
        <h1 className="text-3xl font-bold text-gray-900">My Plants</h1>
      </div>
      <button
        type="button"
        onClick={onAddPlant}
        className="flex items-center px-4 py-2 text-white bg-green-600 rounded-lg shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      >
        <Plus size={18} className="mr-2" />
        Add plant
      </button>
    </div>

    {plants.length === 0 ? (
      <div className="mt-12 text-center text-gray-500">
        <Sprout size={72} className="mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">No plants yet</h2>
        <p className="text-sm">Start tracking your collection by adding your first plant.</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {plants.map((plant) => (
          <PlantCard key={plant.id} plant={plant} onSelect={onSelectPlant} />
        ))}
      </div>
    )}
  </div>
);
