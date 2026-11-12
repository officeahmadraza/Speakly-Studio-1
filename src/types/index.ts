export interface Voice {
  id: string; // e.g. elevenlabs_21m00Tcm4TlvDq8ikWAM
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
  raw?: Record<string, any>;
}

export interface CatalogInspection {
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

export interface ServerAppConfig {
  isConfigured: boolean;
  apiBaseUrl: string;
  maxTextChars: number;
  requiresAccessCode: boolean;
}

export interface GenerationHistoryItem {
  id: string;
  taskId: string;
  voiceId: string;
  voiceName: string;
  text: string;
  charCount: number;
  wordCount: number;
  speed?: number;
  withTranscript?: boolean;
  fileName?: string;
  audioUrl?: string | null;
  creditCost?: number | null;
  createdAt: string;
}

export interface ActiveGenerationTask {
  taskId: string;
  voiceId: string;
  voiceName: string;
  text: string;
  speed: number;
  withTranscript: boolean;
  fileName: string;
  startedAt: number;
}

export interface TaskStatusResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'generating' | 'done' | 'completed' | 'failed' | 'error';
  progress?: number;
  errorMessage?: string | null;
  creditCost?: number | null;
  audioUrl?: string | null;
  createdAt?: string;
  metadata?: Record<string, any>;
}
