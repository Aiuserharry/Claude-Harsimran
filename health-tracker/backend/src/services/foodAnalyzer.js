// Uses the Claude API (vision + text) to turn a food photo or a spoken/typed
// description into a calorie + macro estimate. This is an estimate, not a
// verified nutrition-database lookup — good enough for day-to-day tracking.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `You are a nutrition estimation assistant embedded in a food-logging app.
Given a description and/or photo of a meal, respond with ONLY a JSON object
(no markdown fences, no extra text) with this exact shape:
{"description": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}
- "description" is a short human-readable summary of what was eaten (max ~12 words).
- All numbers are your best-effort estimate for the whole portion shown/described.
- If the input is ambiguous, make a reasonable assumption about portion size rather than asking a question.`;

async function callClaude(content) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set on the backend');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not parse a JSON estimate from Claude's response: ${text}`);
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    description: String(parsed.description ?? '').slice(0, 200) || 'Food entry',
    calories: Math.round(Number(parsed.calories) || 0),
    protein_g: Number(parsed.protein_g) || 0,
    carbs_g: Number(parsed.carbs_g) || 0,
    fat_g: Number(parsed.fat_g) || 0,
  };
}

async function estimateFromText(description) {
  return callClaude([{ type: 'text', text: `Meal description: ${description}` }]);
}

async function estimateFromPhoto(imageBuffer, mimeType, note) {
  const base64 = imageBuffer.toString('base64');
  const content = [
    {
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: base64 },
    },
    {
      type: 'text',
      text: note ? `Photo of a meal. Additional note from the user: ${note}` : 'Photo of a meal.',
    },
  ];
  return callClaude(content);
}

module.exports = { estimateFromText, estimateFromPhoto };
