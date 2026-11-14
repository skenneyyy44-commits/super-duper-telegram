import { useMemo, useState } from 'react';
import { Plus, Search, Sprout, Leaf } from 'lucide-react';
import { PlantCard } from './PlantCard';
import { getWateringStatus } from '../../utils/watering';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'species-asc', label: 'Species (A-Z)' },
  { value: 'watering-due', label: 'Watering: due first' },
];

const sortPlants = (plants, sortOption) => {
  const sorted = [...plants];

  switch (sortOption) {
    case 'name-asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'species-asc':
      return sorted.sort((a, b) => {
        const speciesA = a.species || '';
        const speciesB = b.species || '';
        if (!speciesA && speciesB) return 1;
        if (speciesA && !speciesB) return -1;
        return speciesA.localeCompare(speciesB);
      });
    case 'oldest':
      return sorted.sort((a, b) => a.createdAt.toDate() - b.createdAt.toDate());
    case 'watering-due':
      return sorted.sort((a, b) => {
        const diff = getWateringStatus(a).daysUntilDue - getWateringStatus(b).daysUntilDue;
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
    case 'newest':
    default:
      return sorted.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
  }
};

export const PlantDashboard = ({ plants, onSelectPlant, onAddPlant, firestore, userId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('newest');

  const filteredSortedPlants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? plants.filter(
          (plant) =>
            plant.name?.toLowerCase().includes(term) ||
            plant.species?.toLowerCase().includes(term),
        )
      : plants;

    return sortPlants(filtered, sortOption);
  }, [plants, searchTerm, sortOption]);

  return (
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
        <>
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name or species"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <select
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {filteredSortedPlants.length === 0 ? (
            <div className="mt-12 text-center text-gray-500">
              <p className="text-sm">No plants match your search.</p>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="mt-3 px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredSortedPlants.map((plant) => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  onSelect={onSelectPlant}
                  firestore={firestore}
                  userId={userId}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
