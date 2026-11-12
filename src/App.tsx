import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, NavTab } from './components/Navbar.js';
import { Voice, CatalogInspection, ServerAppConfig, GenerationHistoryItem } from './types/index.js';
import { fetchServerConfig, fetchVoices, refreshVoiceCatalog } from './services/api.js';
import {
  getSavedFavorites,
  toggleFavoriteVoice,
  getGenerationHistory,
  removeHistoryItem,
  clearGenerationHistory,
  getRecentVoiceIds,
} from './services/storage.js';
import { AudioPlayerProvider } from './context/AudioPlayerContext.js';
import { ToastProvider, useToast } from './context/ToastContext.js';
import { CreateSpeechView } from './views/CreateSpeechView.js';
import { VoiceLibraryView } from './views/VoiceLibraryView.js';
import { FavoritesView } from './views/FavoritesView.js';
import { HistoryView } from './views/HistoryView.js';
import { SettingsView } from './views/SettingsView.js';
import { VoiceSelectorModal } from './components/VoiceSelectorModal.js';
import { AlertCircle, RefreshCw, Volume2 } from 'lucide-react';

function VoiceStudioMain() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<NavTab>('create');
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    return (localStorage.getItem('speakly_studio_theme') || localStorage.getItem('voice_studio_theme')) === 'dark';
  });

  const [config, setConfig] = useState<ServerAppConfig>({
    isConfigured: true,
    apiBaseUrl: 'https://api.ai33.pro',
    maxTextChars: 50000,
    requiresAccessCode: true,
  });

  const [voices, setVoices] = useState<Voice[]>([]);
  const [inspection, setInspection] = useState<CatalogInspection | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voicesError, setVoicesError] = useState<string | null>(null);

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getSavedFavorites());
  const [recentIds, setRecentIds] = useState<string[]>(() => getRecentVoiceIds());
  const [history, setHistory] = useState<GenerationHistoryItem[]>(() => getGenerationHistory());

  const [isVoiceSelectorOpen, setIsVoiceSelectorOpen] = useState(false);

  // Sync theme with document element
  useEffect(() => {
    if (isDarkTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('speakly_studio_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('speakly_studio_theme', 'light');
    }
  }, [isDarkTheme]);

  const handleToggleTheme = () => {
    setIsDarkTheme(prev => !prev);
  };

  // Load config & initial catalog
  const loadInitialData = useCallback(async (forceRefresh = false) => {
    try {
      const cfg = await fetchServerConfig();
      setConfig(cfg);

      if (cfg.isConfigured) {
        setIsLoadingVoices(true);
        setVoicesError(null);
        try {
          const catalogData = await fetchVoices(forceRefresh);
          
          // Deduplicate by voice id to prevent duplicate child keys
          const voiceMap = new Map<string, Voice>();
          for (const v of catalogData.voices) {
            if (v && v.id && !voiceMap.has(v.id)) {
              voiceMap.set(v.id, v);
            }
          }
          const uniqueVoices = Array.from(voiceMap.values());
          setVoices(uniqueVoices);
          setInspection(catalogData.inspection);

          // Select first voice if none selected yet
          if (uniqueVoices.length > 0) {
            setSelectedVoice(prev => (prev && uniqueVoices.some(v => v.id === prev.id) ? prev : uniqueVoices[0]));
          }
        } catch (err: any) {
          setVoicesError(err.message || 'Failed to fetch voices catalog.');
        } finally {
          setIsLoadingVoices(false);
        }
      }
    } catch (err: any) {
      console.error('Failed to load initial server configuration', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle Favorites Toggle
  const handleToggleFavorite = (voiceId: string) => {
    const isAdded = toggleFavoriteVoice(voiceId);
    setFavoriteIds(getSavedFavorites());
    const voice = voices.find(v => v.id === voiceId);
    const name = voice?.name || 'Voice';
    if (isAdded) {
      showToast(`Added ${name} to favorites`, 'info');
    } else {
      showToast(`Removed ${name} from favorites`, 'info');
    }
  };

  // Handle Voice Selection
  const handleSelectVoice = (voice: Voice) => {
    setSelectedVoice(voice);
    setRecentIds(getRecentVoiceIds());
    showToast(`Active voice set to "${voice.name}"`, 'info');
  };

  // Handle Generation Complete
  const handleGenerationComplete = (item: GenerationHistoryItem) => {
    setHistory(getGenerationHistory());
    setRecentIds(getRecentVoiceIds());
  };

  // Handle Delete History Item
  const handleRemoveHistoryItem = (id: string) => {
    removeHistoryItem(id);
    setHistory(getGenerationHistory());
    showToast('Record removed from history', 'info');
  };

  // Handle Clear All History
  const handleClearHistory = () => {
    clearGenerationHistory();
    setHistory([]);
  };

  // Handle Clear Favorites
  const handleFavoritesCleared = () => {
    setFavoriteIds([]);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-[#0E1013] text-[#20242B] dark:text-[#F0F2F5] flex flex-col font-sans selection:bg-[#315BCB]/15 selection:text-[#315BCB] transition-colors">
      {/* Top Bar Workstation Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        favoritesCount={favoriteIds.length}
        historyCount={history.length}
        selectedVoice={selectedVoice}
        isDarkTheme={isDarkTheme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Viewport Content */}
      <main className="flex-1">
        {activeTab === 'create' && (
          <CreateSpeechView
            voices={voices}
            selectedVoice={selectedVoice}
            onOpenVoiceSelector={() => setIsVoiceSelectorOpen(true)}
            config={config}
            onGenerationComplete={handleGenerationComplete}
            onSelectVoice={handleSelectVoice}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {activeTab === 'library' && (
          <VoiceLibraryView
            voices={voices}
            inspection={inspection}
            favoriteIds={favoriteIds}
            recentIds={recentIds}
            selectedVoiceId={selectedVoice?.id || null}
            isLoading={isLoadingVoices}
            onRefreshCatalog={() => loadInitialData(true)}
            onToggleFavorite={handleToggleFavorite}
            onSelectVoice={handleSelectVoice}
            onNavigateToCreate={() => setActiveTab('create')}
          />
        )}

        {activeTab === 'favorites' && (
          <FavoritesView
            voices={voices}
            favoriteIds={favoriteIds}
            selectedVoiceId={selectedVoice?.id || null}
            onToggleFavorite={handleToggleFavorite}
            onSelectVoice={handleSelectVoice}
            onNavigateToLibrary={() => setActiveTab('library')}
            onNavigateToCreate={() => setActiveTab('create')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            history={history}
            onRemoveItem={handleRemoveHistoryItem}
            onClearHistory={handleClearHistory}
            onUseTextInCreate={(text, voiceId) => {
              const voice = voices.find(v => v.id === voiceId);
              if (voice) setSelectedVoice(voice);
              setActiveTab('create');
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            config={config}
            inspection={inspection}
            favoritesCount={favoriteIds.length}
            historyCount={history.length}
            onRefreshCatalog={() => loadInitialData(true)}
            onFavoritesCleared={handleFavoritesCleared}
            onHistoryCleared={handleClearHistory}
            onConfigUpdated={() => loadInitialData(false)}
          />
        )}
      </main>

      {/* Voice Selector Modal for Create Speech */}
      <VoiceSelectorModal
        isOpen={isVoiceSelectorOpen}
        onClose={() => setIsVoiceSelectorOpen(false)}
        voices={voices}
        selectedVoiceId={selectedVoice?.id || null}
        favoriteIds={favoriteIds}
        recentIds={recentIds}
        onSelectVoice={handleSelectVoice}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Workstation Footer - Visible on desktop/tablet */}
      <footer className="hidden sm:block border-t border-[#E5E7E8] dark:border-[#292E36] bg-white dark:bg-[#181B20] py-6 px-4 sm:px-6 lg:px-8 text-xs text-[#69717C] dark:text-[#8E97A4] transition-colors">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#315BCB]/10 dark:bg-[#4C77EA]/15 flex items-center justify-center">
              <svg
                className="w-3 h-3 text-[#315BCB] dark:text-[#4C77EA]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M2 10v4" />
                <path d="M6 7v10" />
                <path d="M10 4v16" />
                <path d="M14 6v12" />
                <path d="M18 8v8" />
                <path d="M22 11v2" />
              </svg>
            </div>
            <span className="font-bold text-[#20242B] dark:text-[#F0F2F5]">Speakly Studio</span>
            <span aria-hidden="true" className="text-[#CBD0D6] dark:text-[#3D4450]">·</span>
            <span>Professional AI Speech Workstation</span>
          </div>
          <div className="text-[#8E97A4]">
            Powered by ElevenLabs voice models via OpenSpeaker API
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AudioPlayerProvider>
        <VoiceStudioMain />
      </AudioPlayerProvider>
    </ToastProvider>
  );
}
