import { useState } from 'react';
import { AlertTriangle, Bot, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatTimestamp } from '../../utils/media';

export const HealthLogEntry = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => setExpanded((prev) => !prev);

  return (
    <div className="overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-sm">
      <button
        type="button"
        className="flex items-center justify-between w-full p-4 text-left"
        onClick={toggleExpanded}
      >
        <div className="flex items-center gap-4">
          <img src={log.imageBase64} alt="Health log" className="object-cover w-16 h-16 rounded-xl" />
          <div>
            <p className="text-base font-semibold text-gray-900">{formatTimestamp(log.createdAt)}</p>
            <p className="text-sm text-gray-500 line-clamp-1">
              {log.userNotes || log.aiAnalysis?.health_summary || 'Plant health update'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          {log.aiAnalysis && <Bot size={18} />}
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {log.userNotes && (
            <div className="px-5 py-4">
              <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Notes</h4>
              <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{log.userNotes}</p>
            </div>
          )}

          {log.aiAnalysis ? (
            <div className="px-5 py-4 bg-gray-50">
              <h4 className="flex items-center text-sm font-semibold text-gray-800 uppercase tracking-wide">
                <Bot size={16} className="mr-2 text-blue-500" />
                AI insights
              </h4>
              <dl className="mt-3 space-y-2 text-sm text-gray-700">
                <div>
                  <dt className="font-semibold">Species</dt>
                  <dd>{log.aiAnalysis.plant_species || 'Not identified'}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Summary</dt>
                  <dd>{log.aiAnalysis.health_summary}</dd>
                </div>
              </dl>
              <div className="grid gap-4 mt-4 md:grid-cols-2">
                <div>
                  <h5 className="flex items-center text-sm font-semibold text-red-700">
                    <AlertTriangle size={16} className="mr-2" /> Potential issues
                  </h5>
                  <ul className="mt-2 space-y-1 text-sm text-red-700 list-disc list-inside">
                    {log.aiAnalysis.potential_issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5 className="flex items-center text-sm font-semibold text-green-700">
                    <CheckCircle size={16} className="mr-2" /> Care recommendations
                  </h5>
                  <ul className="mt-2 space-y-1 text-sm text-green-700 list-disc list-inside">
                    {log.aiAnalysis.care_recommendations.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="px-5 py-4 text-sm text-gray-500">No AI analysis was captured for this entry.</p>
          )}
        </div>
      )}
    </div>
  );
};
