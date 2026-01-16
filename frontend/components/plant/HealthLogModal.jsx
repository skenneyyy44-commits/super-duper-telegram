import { useCallback, useMemo, useRef, useState } from 'react';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { Bot, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { FileUploader } from '../common/FileUploader';
import { fileToBase64 } from '../../utils/media';
import { getAiHealthAnalysis } from '../../utils/ai';
import { resolveAppId } from '../../utils/firebase';

const appId = resolveAppId();

const initialAiState = {
  status: 'idle',
  payload: null,
  error: null,
};

export const HealthLogModal = ({ firestore, userId, plantId, onClose }) => {
  const [userNotes, setUserNotes] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [{ status: aiStatus, payload: aiPayload, error: aiError }, setAiState] =
    useState(initialAiState);
  const abortControllerRef = useRef(null);

  const canAnalyze = useMemo(() => Boolean(previewImage) && aiStatus !== 'loading', [previewImage, aiStatus]);

  const handleFileSelected = useCallback(async (file) => {
    try {
      setPreviewImage(await fileToBase64(file));
    } catch (fileError) {
      console.error('Failed to process image', fileError);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!previewImage) {
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAiState({ status: 'loading', payload: null, error: null });

    try {
      const analysis = await getAiHealthAnalysis({
        base64Image: previewImage,
        userNotes,
        signal: controller.signal,
      });
      setAiState({ status: 'success', payload: analysis, error: null });
    } catch (analysisError) {
      if (analysisError.name === 'AbortError') {
        return;
      }
      console.error('AI analysis failed', analysisError);
      setAiState({ status: 'error', payload: null, error: analysisError });
    }
  }, [previewImage, userNotes]);

  const handleSave = useCallback(async () => {
    if (!previewImage || !firestore) {
      return;
    }
    setSaveError(null);
    setIsSaving(true);

    try {
      const path = `/artifacts/${appId}/users/${userId}/plants/${plantId}/healthLogs`;
      await addDoc(collection(firestore, path), {
        userNotes,
        imageBase64: previewImage,
        aiAnalysis: aiPayload || null,
        createdAt: Timestamp.now(),
      });
      onClose();
    } catch (error) {
      console.error('Failed to save health log', error);
      setSaveError(error);
    } finally {
      setIsSaving(false);
    }
  }, [aiPayload, firestore, plantId, previewImage, userId, userNotes, onClose]);

  return (
    <Modal title="Log a health update" onClose={onClose}>
      <div className="space-y-5">
        <FileUploader
          label="Current photo"
          helperText="Required for AI analysis"
          previewSrc={previewImage}
          onFileSelected={handleFileSelected}
          required
        />

        <div>
          <label className="block mb-2 text-sm font-semibold text-gray-700">Notes</label>
          <textarea
            rows={3}
            value={userNotes}
            onChange={(event) => setUserNotes(event.target.value)}
            placeholder="e.g. Noticed some brown spots on the leaves"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="flex items-center justify-center w-full px-4 py-2 font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
        >
          {aiStatus === 'loading' ? (
            <>
              <Loader2 className="mr-2 animate-spin" size={18} />
              Analyzing...
            </>
          ) : (
            <>
              <Bot className="mr-2" size={18} /> Analyze with AI
            </>
          )}
        </button>

        {aiStatus === 'error' && (
          <p className="text-sm text-red-600">
            {aiError?.message || 'We could not analyze this image. Please try again.'}
          </p>
        )}

        {aiPayload && (
          <div className="p-4 space-y-3 bg-gray-100 border border-gray-200 rounded-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">AI analysis</h3>
              <span className="text-xs font-medium text-green-700 uppercase">Preview</span>
            </div>
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">Species:</span> {aiPayload.plant_species || 'Not identified'}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">Summary:</span> {aiPayload.health_summary}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-red-700 uppercase">Potential issues</h4>
                <ul className="mt-2 space-y-1 text-sm text-red-700 list-disc list-inside">
                  {aiPayload.potential_issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-green-700 uppercase">Care recommendations</h4>
                <ul className="mt-2 space-y-1 text-sm text-green-700 list-disc list-inside">
                  {aiPayload.care_recommendations.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {saveError && (
          <p className="text-sm text-red-600">
            Unable to save this log. Please try again.
          </p>
        )}

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
            type="button"
            onClick={handleSave}
            disabled={!previewImage || isSaving}
            className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300"
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" /> Saving
              </>
            ) : (
              'Save to log'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
