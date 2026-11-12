import React from 'react';
import { Star, Library, Trash2, Mic } from 'lucide-react';
import { Voice } from '../types/index.js';
import { VoiceCard } from '../components/VoiceCard.js';

interface FavoritesViewProps {
  voices: Voice[];
  favoriteIds: string[];
  selectedVoiceId: string | null;
  onToggleFavorite: (voiceId: string) => void;
  onSelectVoice: (voice: Voice) => void;
  onNavigateToLibrary: () => void;
  onNavigateToCreate: () => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  voices,
  favoriteIds,
  selectedVoiceId,
  onToggleFavorite,
  onSelectVoice,
  onNavigateToLibrary,
  onNavigateToCreate,
}) => {
  const favoriteVoices = React.useMemo(() => {
    const seen = new Set<string>();
    return voices.filter(v => {
      if (!v || !v.id || seen.has(v.id)) return false;
      if (!favoriteIds.includes(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }, [voices, favoriteIds]);

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 pb-24 lg:pb-8">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#20242B] dark:text-[#F0F2F5] flex items-center gap-2.5">
            <Star className="w-5 h-5 text-[#B7791F] dark:text-amber-400 fill-[#B7791F] dark:fill-amber-400 shrink-0" />
            <span>Favorite Voices</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#69717C] dark:text-[#8E97A4] mt-0.5">
            Your saved voices, ready whenever inspiration strikes.
          </p>
        </div>

        {favoriteVoices.length > 0 && (
          <button
            type="button"
            onClick={onNavigateToLibrary}
            className="min-h-[38px] px-3.5 py-2 rounded-lg bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] hover:bg-[#F0F2F5] dark:hover:bg-[#20252C] text-xs font-semibold text-[#20242B] dark:text-[#F0F2F5] transition-colors flex items-center gap-2 self-start shadow-xs active:scale-[0.98]"
          >
            <Library className="w-4 h-4 text-[#315BCB] dark:text-blue-400 shrink-0" />
            <span>Browse Full Catalog</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      {favoriteVoices.length === 0 ? (
        /* Workstation Empty State */
        <div className="py-16 sm:py-20 px-6 text-center bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-2xl max-w-xl mx-auto flex flex-col items-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-400/10 border border-[#B7791F]/30 flex items-center justify-center text-[#B7791F] dark:text-amber-400 mb-4">
            <Star className="w-6 h-6 fill-current" />
          </div>
          <h3 className="text-base font-bold text-[#20242B] dark:text-[#F0F2F5]">
            Your voice collection starts here
          </h3>
          <p className="text-xs text-[#69717C] dark:text-[#8E97A4] mt-2 max-w-sm leading-relaxed">
            Save voices you love from the catalog to audition them instantly and streamline your speech production workflow.
          </p>
          <button
            type="button"
            onClick={onNavigateToLibrary}
            className="mt-6 min-h-[42px] px-5 py-2.5 rounded-xl bg-[#315BCB] hover:bg-[#264BAF] text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 active:scale-95"
          >
            <Library className="w-4 h-4" />
            <span>Explore Voice Library</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-[#69717C] dark:text-[#8E97A4] font-mono tabular-nums flex items-center justify-between">
            <span>
              <strong className="font-semibold text-[#20242B] dark:text-[#F0F2F5]">{favoriteVoices.length}</strong>{' '}
              {favoriteVoices.length === 1 ? 'saved voice' : 'saved voices'} in your library
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {favoriteVoices.map(voice => (
              <VoiceCard
                key={`fav-voice-${voice.id}`}
                voice={voice}
                isFavorite={true}
                isSelected={voice.id === selectedVoiceId}
                onToggleFavorite={onToggleFavorite}
                onSelectVoice={(v) => {
                  onSelectVoice(v);
                  onNavigateToCreate();
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
