import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Filter, Star, Check, Loader2 } from 'lucide-react';
import { Voice } from '../types/index.js';
import { VoiceCard } from './VoiceCard.js';
import { filterAndRankVoices } from '../utils/search.js';
import { searchVoices } from '../services/api.js';

interface VoiceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  voices: Voice[];
  selectedVoiceId: string | null;
  favoriteIds: string[];
  recentIds: string[];
  onSelectVoice: (voice: Voice) => void;
  onToggleFavorite: (voiceId: string) => void;
}

export const VoiceSelectorModal: React.FC<VoiceSelectorModalProps> = ({
  isOpen,
  onClose,
  voices,
  selectedVoiceId,
  favoriteIds,
  recentIds,
  onSelectVoice,
  onToggleFavorite,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [extraVoices, setExtraVoices] = useState<Voice[]>([]);
  const [isSearchingUpstream, setIsSearchingUpstream] = useState(false);

  // Merge pre-loaded voices with dynamically discovered voices from search
  const combinedVoices = useMemo(() => {
    if (extraVoices.length === 0) return voices;
    const map = new Map<string, Voice>();
    // Prioritize extraVoices
    for (const v of extraVoices) {
      if (v?.id) map.set(v.id, v);
    }
    for (const v of voices) {
      if (v?.id && !map.has(v.id)) map.set(v.id, v);
    }
    return Array.from(map.values());
  }, [voices, extraVoices]);

  // Debounced upstream search against full 22,000+ ElevenLabs library
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term || term.length < 2) return;

    const timer = setTimeout(async () => {
      setIsSearchingUpstream(true);
      try {
        const results = await searchVoices(term);
        if (results && results.length > 0) {
          setExtraVoices((prev) => {
            const map = new Map<string, Voice>();
            for (const v of prev) map.set(v.id, v);
            for (const v of results) map.set(v.id, v);
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('Upstream search error:', err);
      } finally {
        setIsSearchingUpstream(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Available options
  const genders = useMemo(() => {
    const set = new Set<string>();
    combinedVoices.forEach(v => v.gender && set.add(v.gender));
    return Array.from(set).sort();
  }, [combinedVoices]);

  const languages = useMemo(() => {
    const set = new Set<string>();
    combinedVoices.forEach(v => v.language && set.add(v.language));
    return Array.from(set).sort();
  }, [combinedVoices]);

  // Filtered voices with guaranteed deduplication by ID and advanced search ranking
  const filteredVoices = useMemo(() => {
    const seen = new Set<string>();
    const baseFiltered = combinedVoices.filter(v => {
      if (!v || !v.id) return false;
      if (seen.has(v.id)) return false;
      seen.add(v.id);

      if (showFavoritesOnly && !favoriteIds.includes(v.id)) return false;
      if (selectedGender !== 'all' && v.gender?.toLowerCase() !== selectedGender.toLowerCase()) return false;
      if (selectedLanguage !== 'all' && v.language?.toLowerCase() !== selectedLanguage.toLowerCase()) return false;

      return true;
    });

    if (searchTerm.trim()) {
      return filterAndRankVoices(baseFiltered, searchTerm);
    }

    return baseFiltered;
  }, [combinedVoices, searchTerm, selectedGender, selectedLanguage, showFavoritesOnly, favoriteIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] sm:max-h-[85vh] bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="selector-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#E5E7E8] dark:border-[#292E36]">
          <div>
            <h2 id="selector-modal-title" className="text-sm sm:text-base font-bold text-[#20242B] dark:text-[#F0F2F5] tracking-tight">
              Select Voice Actor
            </h2>
            <p className="text-xs text-[#69717C] dark:text-[#8E97A4] mt-0.5">
              Choose an authentic ElevenLabs voice profile from the catalog
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] p-1.5 rounded-lg text-[#69717C] hover:text-[#20242B] dark:hover:text-white hover:bg-[#F0F2F5] dark:hover:bg-[#20252C] transition-colors flex items-center justify-center active:scale-95"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-[#E5E7E8] dark:border-[#292E36] bg-[#F7F7F5] dark:bg-[#131518] space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            {isSearchingUpstream ? (
              <Loader2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#315BCB] animate-spin pointer-events-none" />
            ) : (
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E97A4] pointer-events-none" />
            )}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Voice ID, name, keywords..."
              className="w-full min-h-[38px] pl-9 pr-8 py-2 bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-lg text-xs text-[#20242B] dark:text-[#F0F2F5] placeholder:text-[#8E97A4] focus:outline-none focus:border-[#315BCB] focus:ring-1 focus:ring-[#315BCB]/25"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E97A4] hover:text-[#20242B] p-1"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Controls Row */}
          <div className="grid grid-cols-3 sm:flex sm:items-center gap-2">
            {/* Gender Filter */}
            {genders.length > 0 && (
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                aria-label="Filter by gender"
                className="w-full sm:w-auto min-h-[38px] bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-lg px-2.5 sm:px-3 py-2 text-xs text-[#20242B] dark:text-[#F0F2F5] focus:outline-none focus:border-[#315BCB] capitalize font-medium truncate"
              >
                <option value="all">All Genders</option>
                {genders.map((g, idx) => (
                  <option key={`modal-gender-${g}-${idx}`} value={g} className="capitalize">{g}</option>
                ))}
              </select>
            )}

            {/* Language Filter */}
            {languages.length > 0 && (
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                aria-label="Filter by language"
                className="w-full sm:w-auto min-h-[38px] bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-lg px-2.5 sm:px-3 py-2 text-xs text-[#20242B] dark:text-[#F0F2F5] focus:outline-none focus:border-[#315BCB] font-medium truncate"
              >
                <option value="all">All Languages</option>
                {languages.map((l, idx) => (
                  <option key={`modal-lang-${l}-${idx}`} value={l}>{l}</option>
                ))}
              </select>
            )}

            {/* Favorites Only Toggle */}
            <button
              type="button"
              onClick={() => setShowFavoritesOnly(prev => !prev)}
              className={`w-full sm:w-auto min-h-[38px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors active:scale-95 ${
                showFavoritesOnly
                  ? 'bg-amber-50 dark:bg-amber-400/10 border-[#B7791F]/40 text-[#B7791F] dark:text-amber-400'
                  : 'bg-white dark:bg-[#181B20] border-[#E5E7E8] dark:border-[#292E36] text-[#4F5763] dark:text-[#9CA3AF] hover:text-[#20242B] dark:hover:text-white'
              }`}
            >
              <Star className={`w-3.5 h-3.5 shrink-0 ${showFavoritesOnly ? 'fill-[#B7791F] dark:fill-amber-400' : ''}`} />
              <span>Saved</span>
            </button>
          </div>
        </div>

        {/* Voices Grid */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 bg-[#F7F7F5] dark:bg-[#131518]">
          {filteredVoices.length === 0 ? (
            <div className="py-12 text-center">
              {isSearchingUpstream ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-[#315BCB] mx-auto mb-2" />
                  <p className="text-sm font-medium text-[#20242B] dark:text-[#F0F2F5]">
                    Searching across 22,000+ ElevenLabs voices...
                  </p>
                  <p className="text-xs text-[#69717C] dark:text-[#8E97A4] mt-1">
                    Looking up "{searchTerm}" in the extended catalog
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-[#69717C] dark:text-[#8E97A4]">No voices match your filters.</p>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedGender('all');
                      setSelectedLanguage('all');
                      setShowFavoritesOnly(false);
                    }}
                    className="mt-3 text-xs text-[#315BCB] dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                  >
                    Clear all filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
              {filteredVoices.map(voice => (
                <VoiceCard
                  key={`modal-voice-${voice.id}`}
                  voice={voice}
                  isFavorite={favoriteIds.includes(voice.id)}
                  isSelected={voice.id === selectedVoiceId}
                  onToggleFavorite={onToggleFavorite}
                  onSelectVoice={(v) => {
                    onSelectVoice(v);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-[#E5E7E8] dark:border-[#292E36] bg-white dark:bg-[#181B20] flex items-center justify-between text-xs text-[#69717C] dark:text-[#8E97A4]">
          <span>Showing <strong className="font-semibold text-[#20242B] dark:text-[#F0F2F5]">{filteredVoices.length}</strong> of {combinedVoices.length} voices</span>
          <button
            onClick={onClose}
            className="min-h-[36px] px-4 py-1.5 rounded-lg bg-[#F0F2F5] dark:bg-[#20252C] hover:bg-[#E5E7E8] dark:hover:bg-[#2C323B] text-[#20242B] dark:text-[#E2E8F0] font-semibold transition-colors active:scale-95 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
