const MODEL_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

const SYSTEM_PROMPT = `You are 'Flora,' an expert botanist and plant health diagnostician. A user is providing an image (as Base64 data) and text notes about their houseplant. Your task is to analyze these inputs and provide a concise, helpful diagnosis and care plan. Respond only in JSON that matches the response schema. Identify the plant if possible. Be encouraging and clear.`;

// FileReader data URLs look like "data:image/png;base64,....".
// Photos without that prefix stay JPEG, which is what callers used to send.
const inlineImageData = (base64Image) => {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(base64Image);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }

  const comma = base64Image.indexOf(',');
  return {
    mimeType: 'image/jpeg',
    data: comma === -1 ? base64Image : base64Image.slice(comma + 1),
  };
};

const resolveApiKey = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return (
    window.__gemini_api_key ||
    window.__geminiApiKey ||
    window.__GEMINI_API_KEY ||
    window.__geminiKey ||
    ''
  );
};

export const getAiHealthAnalysis = async ({
  base64Image,
  userNotes,
  signal,
}) => {
  if (!base64Image) {
    throw new Error('An image is required for AI analysis.');
  }

  const { mimeType, data: pureBase64 } = inlineImageData(base64Image);
  const apiKey = resolveApiKey();

  if (!apiKey) {
    throw new Error('Missing Gemini API key.');
  }

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: userNotes || "Please analyze this plant's health from the image." },
          {
            inlineData: {
              mimeType,
              data: pureBase64,
            },
          },
        ],
      },
    ],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          plant_species: { type: 'STRING' },
          health_summary: { type: 'STRING' },
          potential_issues: { type: 'ARRAY', items: { type: 'STRING' } },
          care_recommendations: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['health_summary', 'potential_issues', 'care_recommendations'],
      },
    },
  };

  const response = await fetch(`${MODEL_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Gemini request failed with status ${response.status}. Body: ${errorBody}`,
    );
  }

  const result = await response.json();
  const candidate = result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!candidate) {
    throw new Error('Gemini returned an unexpected response format.');
  }

  return JSON.parse(candidate);
};
