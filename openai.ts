import fetch from 'node-fetch';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export async function generateOpenAIResponse(prompt: string): Promise<string> {
  const headers = {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are Mr. Caster Baldman, a Farcaster AI agent. Generate concise, professional replies (2-4 sentences) tailored to the prompt.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: 200,
    temperature: 0.5,
  });

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers,
      body,
    });
    const data = await response.json();
    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content.trim();
    }
    throw new Error('No valid response from OpenAI');
  } catch (error) {
    console.error('OpenAI API error:', error);
    return 'Failed to generate a response due to an API issue.';
  }
}