import { Leaf } from 'lucide-react';

export const PlantCard = ({ plant, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(plant.id)}
    className="overflow-hidden text-left bg-white rounded-2xl shadow-md transition transform hover:-translate-y-1 hover:shadow-xl"
  >
    <div className="w-full h-48 bg-gray-100">
      {plant.profileImageBase64 ? (
        <img src={plant.profileImageBase64} alt={plant.name} className="object-cover w-full h-full" />
      ) : (
        <div className="flex items-center justify-center w-full h-full text-green-300">
          <Leaf size={56} />
        </div>
      )}
    </div>
    <div className="px-5 py-4">
      <h3 className="text-xl font-semibold text-gray-900">{plant.name}</h3>
      <p className="text-sm text-gray-500">{plant.species || 'Unknown species'}</p>
    </div>
  </button>
);
