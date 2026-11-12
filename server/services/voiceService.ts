import { openspeakerRequest } from './openspeakerClient.js';
import { registerObservedAudioHost } from '../config.js';

export interface NormalizedVoice {
  id: string; // The voice id to pass to TTS (e.g. elevenlabs_...)
  name: string;
  category?: string;
  description?: string;
  previewUrl?: string | null;
  gender?: string;
  age?: string;
  accent?: string;
  language?: string;
  useCase?: string;
  tags: string[];
  raw: Record<string, any>;
}

export interface VoiceCatalogInspection {
  totalVoices: number;
  sampleRecordKeys: string[];
  sampleRecordPreviewFields: string[];
  hasPreviewUrls: boolean;
  discoveredGenders: string[];
  discoveredLanguages: string[];
  discoveredAccents: string[];
  discoveredCategories: string[];
  discoveredUseCases: string[];
  discoveredTags: string[];
  fetchedAt: string;
  pageCount: number;
}

export interface VoiceCatalogCache {
  voices: NormalizedVoice[];
  inspection: VoiceCatalogInspection;
  cachedAt: number;
  expiresAt: number;
}

let catalogCache: VoiceCatalogCache | null = null;
let isFetchingCatalog = false;
let pendingFetchPromise: Promise<VoiceCatalogCache> | null = null;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export const ESSENTIAL_PREMADE_VOICES: NormalizedVoice[] = [
  {
    id: 'elevenlabs_QMJTqaMXmGnG8TCm8WQG',
    name: 'Clyde - Vintage and Warm Radio Announcer',
    category: 'high_quality',
    description: 'A vintage male announcer - think old timey radio! Best used for vintage radio broadcasts, character voices, and classic narration.',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/database/user/H2fHN4TKljQ16bAflYGeOPXd0qB2/voices/QMJTqaMXmGnG8TCm8WQG/aa1008ab-76bf-4aa2-96f4-a0f4256722ca.mp3',
    gender: 'male',
    age: 'middle_aged',
    accent: 'american',
    language: 'en',
    useCase: 'vintage_radio_narration',
    tags: ['vintage', 'radio', 'announcer', 'classic', 'en-US', 'male', 'character'],
    raw: {
      voice_id: 'elevenlabs_QMJTqaMXmGnG8TCm8WQG',
      name: 'Clyde - Vintage and Warm Radio Announcer',
      category: 'high_quality',
    },
  },
];

/**
 * Extract preview URL candidates from any nested or flat field
 */
function findPreviewUrl(record: Record<string, any>): string | null {
  const candidateKeys = [
    'preview_url',
    'previewUrl',
    'sample_url',
    'sampleUrl',
    'audio_sample_url',
    'audio_url',
    'sample',
    'preview',
    'audio_preview_url',
  ];

  for (const key of candidateKeys) {
    if (typeof record[key] === 'string' && record[key].trim().startsWith('http')) {
      return record[key].trim();
    }
  }

  // Check nested fields: record.samples, record.labels, record.preview
  if (record.samples && Array.isArray(record.samples) && record.samples.length > 0) {
    const firstSample = record.samples[0];
    if (typeof firstSample === 'string' && firstSample.startsWith('http')) {
      return firstSample;
    }
    if (typeof firstSample === 'object' && firstSample?.audio_url) {
      return firstSample.audio_url;
    }
    if (typeof firstSample === 'object' && firstSample?.preview_url) {
      return firstSample.preview_url;
    }
  }

  if (record.preview && typeof record.preview === 'object') {
    const url = record.preview.url || record.preview.audio_url;
    if (typeof url === 'string' && url.startsWith('http')) return url;
  }

  return null;
}

/**
 * Safely extract and normalize voice metadata
 */
function normalizeVoice(rawRecord: Record<string, any>): NormalizedVoice {
  // Voice ID must keep any elevenlabs_ prefix exactly as returned
  const id = String(
    rawRecord.voice_id ||
    rawRecord.id ||
    rawRecord.voiceId ||
    rawRecord.uuid ||
    ''
  ).trim();

  const name = String(rawRecord.name || rawRecord.voice_name || id || 'Unnamed Voice').trim();
  const description = rawRecord.description || rawRecord.bio || rawRecord.desc || '';
  const category = rawRecord.category || rawRecord.type || '';

  // Extract preview URL if present
  const previewUrl = findPreviewUrl(rawRecord);
  if (previewUrl) {
    try {
      const parsedUrl = new URL(previewUrl);
      registerObservedAudioHost(parsedUrl.hostname);
    } catch {
      // ignore URL parse errors
    }
  }

  // Labels often contain gender, accent, age, use case, language
  const labels: Record<string, any> = rawRecord.labels || rawRecord.metadata || {};

  const gender =
    rawRecord.gender ||
    labels.gender ||
    labels['voice-gender'] ||
    labels.Gender ||
    undefined;

  const age =
    rawRecord.age ||
    labels.age ||
    labels['voice-age'] ||
    labels.Age ||
    undefined;

  const accent =
    rawRecord.accent ||
    labels.accent ||
    labels['voice-accent'] ||
    labels.Accent ||
    undefined;

  const language =
    rawRecord.language ||
    labels.language ||
    labels['voice-language'] ||
    labels.Language ||
    rawRecord.lang ||
    undefined;

  const useCase =
    rawRecord.use_case ||
    rawRecord.useCase ||
    labels.use_case ||
    labels['use case'] ||
    labels.useCase ||
    labels.descriptive ||
    undefined;

  // Extract tags from tags array, label values, or keywords
  const tagsSet = new Set<string>();
  if (Array.isArray(rawRecord.tags)) {
    rawRecord.tags.forEach(t => typeof t === 'string' && tagsSet.add(t.trim()));
  }
  if (Array.isArray(rawRecord.categories)) {
    rawRecord.categories.forEach(c => typeof c === 'string' && tagsSet.add(c.trim()));
  }
  if (labels && typeof labels === 'object') {
    Object.values(labels).forEach(v => {
      if (typeof v === 'string' && v.trim().length > 0 && v.trim().length < 30) {
        tagsSet.add(v.trim());
      }
    });
  }

  return {
    id,
    name,
    category: category ? String(category).trim() : undefined,
    description: description ? String(description).trim() : undefined,
    previewUrl,
    gender: gender ? String(gender).trim() : undefined,
    age: age ? String(age).trim() : undefined,
    accent: accent ? String(accent).trim() : undefined,
    language: language ? String(language).trim() : undefined,
    useCase: useCase ? String(useCase).trim() : undefined,
    tags: Array.from(tagsSet).filter(t => t.length > 0),
    raw: rawRecord,
  };
}

export async function fetchVoiceCatalog(forceRefresh: boolean = false): Promise<VoiceCatalogCache> {
  const now = Date.now();

  if (!forceRefresh && catalogCache && catalogCache.expiresAt > now) {
    return catalogCache;
  }

  // De-duplicate simultaneous fetch requests
  if (isFetchingCatalog && pendingFetchPromise) {
    return pendingFetchPromise;
  }

  isFetchingCatalog = true;
  pendingFetchPromise = (async () => {
    try {
      const allRawVoices: Record<string, any>[] = [];
      let page = 1;
      const pageSize = 100;
      let hasMore = true;
      let sampleRecordKeys: string[] = [];

      console.log('[VoiceService] Starting catalog fetch from OpenSpeaker upstream...');

      while (hasMore) {
        const queryParams = new URLSearchParams({
          provider: 'elevenlabs',
          page: String(page),
          page_size: String(pageSize),
        });

        const response = await openspeakerRequest<{
          success?: boolean;
          data?: any[];
          voices?: any[];
          pagination?: any;
        }>({
          method: 'GET',
          path: `/v3/voices?${queryParams.toString()}`,
          timeoutMs: 25000,
        });

        const pageData = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.voices)
          ? response.voices
          : [];

        if (page === 1) {
          if (pageData.length > 0) {
            sampleRecordKeys = Object.keys(pageData[0]);
            console.log(
              `[VoiceService] Page 1 inspected. Sample voice record keys:`,
              sampleRecordKeys
            );
          } else {
            console.log('[VoiceService] Page 1 returned empty array.');
          }
        }

        allRawVoices.push(...pageData);

        // Fetch pages until a page returns empty or fewer than 100 items
        if (pageData.length < pageSize || pageData.length === 0) {
          hasMore = false;
        } else {
          page++;
          // Safety cap to prevent infinite loops (up to 30 pages = 3000 voices)
          if (page > 30) {
            hasMore = false;
          }
        }
      }

      console.log(`[VoiceService] Fetched ${allRawVoices.length} raw voice records across ${page} page(s).`);

      // Deduplicate voices by unique ID, merging any richer metadata (such as previewUrl or tags)
      const voiceMap = new Map<string, NormalizedVoice>();

      // Seed essential curated voices first
      for (const essential of ESSENTIAL_PREMADE_VOICES) {
        voiceMap.set(essential.id, essential);
      }

      for (const raw of allRawVoices) {
        const norm = normalizeVoice(raw);
        if (!norm.id) continue;

        const existing = voiceMap.get(norm.id);
        if (!existing) {
          voiceMap.set(norm.id, norm);
        } else {
          // Merge preview URL if the new record has one and the previous did not
          if (!existing.previewUrl && norm.previewUrl) {
            existing.previewUrl = norm.previewUrl;
          }
          // Merge description if missing
          if (!existing.description && norm.description) {
            existing.description = norm.description;
          }
          // Merge tags
          if (norm.tags && norm.tags.length > 0) {
            existing.tags = Array.from(new Set([...existing.tags, ...norm.tags]));
          }
        }
      }

      const normalizedVoices = Array.from(voiceMap.values());
      console.log(`[VoiceService] Deduplicated to ${normalizedVoices.length} unique voices.`);

      // Analyze discovery fields for UI filters
      const sampleRecordPreviewFields: string[] = [];
      if (allRawVoices.length > 0) {
        for (const k of Object.keys(allRawVoices[0])) {
          if (k.toLowerCase().includes('preview') || k.toLowerCase().includes('sample') || k.toLowerCase().includes('audio')) {
            sampleRecordPreviewFields.push(k);
          }
        }
      }

      const discoveredGenders = Array.from(
        new Set(normalizedVoices.map(v => v.gender).filter(Boolean) as string[])
      ).sort();
      const discoveredLanguages = Array.from(
        new Set(normalizedVoices.map(v => v.language).filter(Boolean) as string[])
      ).sort();
      const discoveredAccents = Array.from(
        new Set(normalizedVoices.map(v => v.accent).filter(Boolean) as string[])
      ).sort();
      const discoveredCategories = Array.from(
        new Set(normalizedVoices.map(v => v.category).filter(Boolean) as string[])
      ).sort();
      const discoveredUseCases = Array.from(
        new Set(normalizedVoices.map(v => v.useCase).filter(Boolean) as string[])
      ).sort();
      const allTags = new Set<string>();
      normalizedVoices.forEach(v => v.tags.forEach(t => allTags.add(t)));
      const discoveredTags = Array.from(allTags).sort();

      const previewCount = normalizedVoices.filter(v => Boolean(v.previewUrl)).length;

      const inspection: VoiceCatalogInspection = {
        totalVoices: normalizedVoices.length,
        sampleRecordKeys,
        sampleRecordPreviewFields,
        hasPreviewUrls: previewCount > 0,
        discoveredGenders,
        discoveredLanguages,
        discoveredAccents,
        discoveredCategories,
        discoveredUseCases,
        discoveredTags,
        fetchedAt: new Date().toISOString(),
        pageCount: page,
      };

      catalogCache = {
        voices: normalizedVoices,
        inspection,
        cachedAt: now,
        expiresAt: now + CACHE_TTL_MS,
      };

      return catalogCache;
    } finally {
      isFetchingCatalog = false;
      pendingFetchPromise = null;
    }
  })();

  return pendingFetchPromise;
}

export function getCachedVoiceById(voiceId: string): NormalizedVoice | undefined {
  const directEssential = ESSENTIAL_PREMADE_VOICES.find(
    v => v.id === voiceId || v.id === `elevenlabs_${voiceId}` || `elevenlabs_${v.id}` === voiceId
  );
  if (directEssential) return directEssential;

  if (!catalogCache) return undefined;
  return catalogCache.voices.find(v => v.id === voiceId || v.id === `elevenlabs_${voiceId}` || `elevenlabs_${v.id}` === voiceId);
}

export function invalidateVoiceCache(): void {
  catalogCache = null;
}

/**
 * Direct search against OpenSpeaker's 22,000+ ElevenLabs voice library
 */
export async function searchUpstreamVoices(query: string): Promise<NormalizedVoice[]> {
  const sanitized = query.trim();
  if (!sanitized) return [];

  const rawIdQuery = sanitized.replace(/^elevenlabs_/, '');

  try {
    const response = await openspeakerRequest<{
      data?: any[];
      voices?: any[];
    }>({
      method: 'GET',
      path: `/v3/voices?provider=elevenlabs&search=${encodeURIComponent(sanitized)}`,
      timeoutMs: 15000,
    });

    const results = (response?.data || response?.voices || []).map(normalizeVoice);

    if (results.length === 0 && rawIdQuery !== sanitized) {
      const fallbackRes = await openspeakerRequest<{
        data?: any[];
        voices?: any[];
      }>({
        method: 'GET',
        path: `/v3/voices?provider=elevenlabs&search=${encodeURIComponent(rawIdQuery)}`,
        timeoutMs: 15000,
      });
      const fallbackResults = (fallbackRes?.data || fallbackRes?.voices || []).map(normalizeVoice);
      results.push(...fallbackResults);
    }

    // Merge any found voices into catalog cache so they persist across the app
    if (catalogCache && results.length > 0) {
      for (const v of results) {
        if (!catalogCache.voices.some(existing => existing.id === v.id)) {
          catalogCache.voices.push(v);
        }
      }
    }

    return results;
  } catch (err: any) {
    console.error('[VoiceService] Upstream voice search error:', err.message);
    return [];
  }
}
