import { Voice } from '../types/index.js';

export interface VoiceSearchScore {
  voice: Voice;
  score: number;
}

/**
 * High-performance search matcher and relevance scorer for Voice objects
 * Supports:
 * - Exact voice ID matches (with or without 'elevenlabs_' prefix)
 * - Partial voice ID matches
 * - Multi-word keyword search across:
 *   - Voice ID
 *   - Name
 *   - Description
 *   - Gender
 *   - Age
 *   - Accent
 *   - Language
 *   - Category
 *   - Use Case
 *   - Tags
 *   - Raw metadata labels (e.g. tone, descriptive, texture)
 */
export function matchAndScoreVoice(v: Voice, searchStr: string): number {
  const query = searchStr.trim().toLowerCase();
  if (!query) return 1;

  const idLower = (v.id || '').toLowerCase();
  const idStripped = idLower.replace(/^elevenlabs_/, '');
  const queryStripped = query.replace(/^elevenlabs_/, '');

  let score = 0;

  // 1. Exact Voice ID Match (highest priority)
  if (idLower === query || idStripped === queryStripped || idStripped === query) {
    return 1000;
  }

  // 2. ID prefix or substring match
  if (idLower.startsWith(query) || idStripped.startsWith(queryStripped)) {
    score += 600;
  } else if (
    idLower.includes(query) ||
    (queryStripped.length >= 3 && idStripped.includes(queryStripped)) ||
    (query.length >= 3 && idLower.includes(query))
  ) {
    score += 350;
  }

  // 3. Name exact and prefix match
  const nameLower = (v.name || '').toLowerCase();
  if (nameLower === query) {
    score += 500;
  } else if (nameLower.startsWith(query)) {
    score += 300;
  } else if (nameLower.includes(query)) {
    score += 180;
  }

  // 4. Tokenized keyword search
  const tokens = query.split(/\s+/).filter(Boolean);

  // Build full searchable bag
  const rawLabels = v.raw?.labels
    ? Object.values(v.raw.labels)
        .filter(val => typeof val === 'string')
        .join(' ')
    : '';

  const searchableBag = [
    idLower,
    idStripped,
    nameLower,
    v.description || '',
    v.gender || '',
    v.age || '',
    v.accent || '',
    v.language || '',
    v.category || '',
    v.useCase || '',
    (v.tags || []).join(' '),
    rawLabels,
  ]
    .join(' ')
    .toLowerCase();

  // Tokenize searchable bag into distinct words for exact keyword matching
  const bagWords = new Set(searchableBag.split(/[\s,\-_/·.:;()\[\]"']+/).filter(Boolean));

  // If query is an exact phrase match anywhere in the bag
  if (searchableBag.includes(query)) {
    score += 150;
  }

  // Check every token
  let allTokensFound = true;
  for (const token of tokens) {
    const cleanToken = token.replace(/^elevenlabs_/, '');

    // 1. Direct word set match (handles 'male', 'female', 'us', etc. without false substring matches)
    const exactWordMatch = bagWords.has(token) || (cleanToken.length >= 2 && bagWords.has(cleanToken));
    
    // 2. Substring match (for IDs, compound words, names)
    // Avoid matching 'female' when token is 'male'
    const isShortGenderToken = token === 'male' || cleanToken === 'male';
    const substringMatch = !isShortGenderToken && (
      searchableBag.includes(token) ||
      (cleanToken.length >= 3 && searchableBag.includes(cleanToken))
    );

    const found = exactWordMatch || substringMatch;

    if (!found) {
      allTokensFound = false;
      break;
    } else {
      score += exactWordMatch ? 40 : 20;
    }
  }

  if (tokens.length > 1) {
    if (!allTokensFound) {
      return 0; // Multi-word queries must match all keywords
    }
    score += 200; // High bonus for matching all user search keywords
  }

  return allTokensFound || score > 0 ? score : 0;
}

export function filterAndRankVoices(voices: Voice[], query: string): Voice[] {
  const trimmed = query.trim();
  if (!trimmed) return voices;

  const scored: VoiceSearchScore[] = [];

  for (const voice of voices) {
    const score = matchAndScoreVoice(voice, trimmed);
    if (score > 0) {
      scored.push({ voice, score });
    }
  }

  // Sort descending by relevance score, then alphabetically by name
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.voice.name.localeCompare(b.voice.name);
  });

  return scored.map(s => s.voice);
}
