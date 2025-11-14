/**
 * AudioShake API - Stem Separation
 * https://developer.audioshake.ai/tasks
 */

const AUDIOSHAKE_API_BASE = 'https://api.audioshake.ai/tasks';

/**
 * Stem result with download URLs
 */
export interface StemResult {
  model: string;
  urls: Record<string, string>;
}

/**
 * Task status response
 */
interface TaskStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  stems?: StemResult[];
  error?: string;
}

/**
 * Separate audio into stems (vocals, instrumental, etc.)
 *
 * @param audioUrl HTTPS URL to the audio file (must be publicly accessible)
 * @param apiKey AudioShake API key from https://dashboard.audioshake.ai
 * @param stems Array of stem types to extract (default: ['vocals', 'instrumental'])
 * @returns Promise with download URLs for each stem
 */
export async function separateStems(
  audioUrl: string,
  apiKey: string,
  stems: string[] = ['vocals', 'instrumental']
): Promise<StemResult[]> {
  // Validate HTTPS URL
  if (!audioUrl.startsWith('https://')) {
    throw new Error('AudioShake requires HTTPS URLs');
  }

  console.log('\nSubmitting stem separation task to AudioShake...');
  
  const body = {
      url: audioUrl,
      targets: stems.map(model => ({ model, formats: ['wav'] }))
  };
  console.log(JSON.stringify(body, null, 2));

  // Create task
  const createResponse = await fetch(AUDIOSHAKE_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify(body),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`AudioShake API error (${createResponse.status}): ${errorText}`);
  }

  const { id } = await createResponse.json() as { id: string };
  console.log(`Task created: ${id}`);
  console.log('Waiting for processing to complete...');

  // Poll for completion
  const startTime = Date.now();
  const timeout = 600000; // 10 minutes
  const pollInterval = 5000; // 5 seconds

  while (true) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const statusResponse = await fetch(`${AUDIOSHAKE_API_BASE}/${id}`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'User-Agent': 'Dolly/1.0',
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`Failed to check task status (${statusResponse.status}): ${errorText}`);
    }

    const status = await statusResponse.json() as TaskStatus;

    if (status.status === 'completed' && status.stems) {
      console.log('\nStem separation completed!');
      return status.stems;
    }

    if (status.status === 'failed') {
      throw new Error(`Stem separation failed: ${status.error || 'Unknown error'}`);
    }

    if (Date.now() - startTime > timeout) {
      throw new Error('Task timeout after 10 minutes');
    }

    // Show progress
    process.stdout.write(`\rStatus: ${status.status}...`);
  }
}
