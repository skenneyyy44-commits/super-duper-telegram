import { useState } from 'react';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { formatTimestamp } from '../../utils/media';
import { resolveAppId } from '../../utils/firebase';
import { getHealthLogsPath } from '../../utils/plants';
import { ConfirmDialog } from '../common/ConfirmDialog';

const asList = (value) => (Array.isArray(value) ? value : []);

const appId = resolveAppId();

export const HealthLogEntry = ({ log, firestore, userId, plantId }) => {
  const [expanded, setExpanded] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(log.userNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const toggleExpanded = () => setExpanded((prev) => !prev);
  const issues = asList(log.aiAnalysis?.potential_issues);
  const recommendations = asList(log.aiAnalysis?.care_recommendations);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, getHealthLogsPath(appId, userId, plantId), log.id));
      setIsConfirmingDelete(false);
    } catch (error) {
      console.error('Failed to delete health log entry', error);
      setIsDeleting(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await updateDoc(doc(firestore, getHealthLogsPath(appId, userId, plantId), log.id), {
        userNotes: editedNotes.trim(),
      });
      setIsEditingNotes(false);
    } catch (error) {
      console.error('Failed to update health log notes', error);
    } finally {
      setIsSavingNotes(false);
    }
  };

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
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              setIsConfirmingDelete(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation();
                setIsConfirmingDelete(true);
              }
            }}
            aria-label="Delete entry"
            title="Delete entry"
            className="p-1 rounded-full hover:bg-gray-100 hover:text-red-600"
          >
            <Trash2 size={16} />
          </span>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Notes</h4>
              {!isEditingNotes && (
                <button
                  type="button"
                  onClick={() => {
                    setEditedNotes(log.userNotes || '');
                    setIsEditingNotes(true);
                  }}
                  aria-label="Edit notes"
                  title="Edit notes"
                  className="p-1 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-700"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="mt-2 space-y-2">
                <textarea
                  rows={3}
                  value={editedNotes}
                  onChange={(event) => setEditedNotes(event.target.value)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingNotes(false)}
                    disabled={isSavingNotes}
                    className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="flex items-center px-3 py-1 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300"
                  >
                    {isSavingNotes ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                {log.userNotes || 'No notes recorded.'}
              </p>
            )}
          </div>

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
                    {issues.length > 0 ? (
                      issues.map((issue, index) => <li key={index}>{issue}</li>)
                    ) : (
                      <li>No issues detected yet.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h5 className="flex items-center text-sm font-semibold text-green-700">
                    <CheckCircle size={16} className="mr-2" /> Care recommendations
                  </h5>
                  <ul className="mt-2 space-y-1 text-sm text-green-700 list-disc list-inside">
                    {recommendations.length > 0 ? (
                      recommendations.map((item, index) => <li key={index}>{item}</li>)
                    ) : (
                      <li>No recommendations available yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="px-5 py-4 text-sm text-gray-500">No AI analysis was captured for this entry.</p>
          )}
        </div>
      )}

      {isConfirmingDelete && (
        <ConfirmDialog
          title="Delete this entry?"
          description="This health log entry will be permanently deleted."
          isProcessing={isDeleting}
          onConfirm={handleDelete}
          onClose={() => setIsConfirmingDelete(false)}
        />
      )}
    </div>
  );
};
