import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Star,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  SlidersHorizontal,
  Clock,
  Layers,
} from 'lucide-react';
import { Voice, CatalogInspection } from '../types/index.js';
import { VoiceCard } from '../components/VoiceCard.js';
import { filterAndRankVoices } from '../utils/search.js';

interface VoiceLibraryViewProps {
  voices: Voice[];
  inspection: CatalogInspection | null;
  favoriteIds: string[];
  recentIds: string[];
  selectedVoiceId: string | null;
  isLoading: boolean;
  onRefreshCatalog: () => void;
  onToggleFavorite: (voiceId: string) => void;
  onSelectVoice: (voice: Voice) => void;
  onNavigateToCreate: () => void;
}

type SortOption = 'name-asc' | 'name-desc' | 'category-asc';

const PAGE_SIZE = 24;

export const VoiceLibraryView: React.FC<VoiceLibraryViewProps> = ({
  voices,
  inspection,
  favoriteIds,
  recentIds,
  selectedVoiceId,
  isLoading,
  onRefreshCatalog,
  onToggleFavorite,
  onSelectVoice,
  onNavigateToCreate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedAccent, setSelectedAccent] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void, val: string) => {
    setter(val);
    setCurrentPage(1);
  };

  // Recent voices resolved objects with deduplication
  const recentVoices = useMemo(() => {
    if (!recentIds.length) return [];
    const seen = new Set<string>();
    const list: Voice[] = [];
    for (const id of recentIds) {
      if (seen.has(id)) continue;
      const v = voices.find(voice => voice.id === id);
      if (v) {
        seen.add(id);
        list.push(v);
      }
    }
    return list.slice(0, 4);
  }, [voices, recentIds]);

  // Filter dynamic options from inspection or catalog data
  const availableGenders = inspection?.discoveredGenders || [];
  const availableLanguages = inspection?.discoveredLanguages || [];
  const availableAccents = inspection?.discoveredAccents || [];
  const availableCategories = inspection?.discoveredCategories || [];

  // Active filters list for chips
  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (debouncedSearch) {
    activeChips.push({
      label: `Search: "${debouncedSearch}"`,
      onRemove: () => setSearchTerm(''),
    });
  }
  if (selectedGender !== 'all') {
    activeChips.push({
      label: `Gender: ${selectedGender}`,
      onRemove: () => setSelectedGender('all'),
    });
  }
  if (selectedLanguage !== 'all') {
    activeChips.push({
      label: `Language: ${selectedLanguage}`,
      onRemove: () => setSelectedLanguage('all'),
    });
  }
  if (selectedAccent !== 'all') {
    activeChips.push({
      label: `Accent: ${selectedAccent}`,
      onRemove: () => setSelectedAccent('all'),
    });
  }
  if (selectedCategory !== 'all') {
    activeChips.push({
      label: `Category: ${selectedCategory}`,
      onRemove: () => setSelectedCategory('all'),
    });
  }
  if (showFavoritesOnly) {
    activeChips.push({
      label: 'Favorites Only',
      onRemove: () => setShowFavoritesOnly(false),
    });
  }

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedGender('all');
    setSelectedLanguage('all');
    setSelectedAccent('all');
    setSelectedCategory('all');
    setShowFavoritesOnly(false);
    setCurrentPage(1);
  };

  // Filtered & Sorted Voices with guaranteed deduplication by ID
  const filteredVoices = useMemo(() => {
    const seen = new Set<string>();
    // 1. Structured filters (gender, language, accent, category, favorites)
    const baseFiltered = voices.filter(v => {
      if (!v || !v.id) return false;
      if (seen.has(v.id)) return false;
      seen.add(v.id);

      if (showFavoritesOnly && !favoriteIds.includes(v.id)) return false;
      if (selectedGender !== 'all' && v.gender?.toLowerCase() !== selectedGender.toLowerCase()) return false;
      if (selectedLanguage !== 'all' && v.language?.toLowerCase() !== selectedLanguage.toLowerCase()) return false;
      if (selectedAccent !== 'all' && v.accent?.toLowerCase() !== selectedAccent.toLowerCase()) return false;
      if (selectedCategory !== 'all' && v.category?.toLowerCase() !== selectedCategory.toLowerCase()) return false;

      return true;
    });

    // 2. Search query with Voice ID, multi-keyword tokens, and relevance ranking
    if (debouncedSearch.trim()) {
      return filterAndRankVoices(baseFiltered, debouncedSearch);
    }

    // 3. Fallback to chosen sort option when no search query is active
    return [...baseFiltered].sort((a, b) => {
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'category-asc') {
        return (a.category || '').localeCompare(b.category || '');
      }
      return 0;
    });
  }, [
    voices,
    debouncedSearch,
    selectedGender,
    selectedLanguage,
    selectedAccent,
    selectedCategory,
    showFavoritesOnly,
    favoriteIds,
    sortBy,
  ]);

  // Pagination calculation
  const totalMatches = filteredVoices.length;
  const totalPages = Math.ceil(totalMatches / PAGE_SIZE) || 1;
  const paginatedVoices = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const slice = filteredVoices.slice(start, start + PAGE_SIZE);
    const seen = new Set<string>();
    return slice.filter(v => {
      if (!v || !v.id || seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }, [filteredVoices, currentPage]);

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 pb-24 lg:pb-8">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#20242B] dark:text-[#F0F2F5]">
            Voice Library
          </h1>
          <p className="text-xs sm:text-sm text-[#69717C] dark:text-[#8E97A4] mt-0.5">
            Browse and audition the complete ElevenLabs voice collection ({voices.length.toLocaleString()} verified profiles)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onRefreshCatalog}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-lg bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] hover:bg-[#F0F2F5] dark:hover:bg-[#20252C] text-xs font-semibold text-[#20242B] dark:text-[#F0F2F5] transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
            title="Refresh voices catalog from upstream"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#315BCB]' : ''}`} />
            <span>Sync Catalog</span>
          </button>
        </div>
      </div>

      {/* Recently Used Voices Strip if available */}
      {recentVoices.length > 0 && !showFavoritesOnly && !debouncedSearch && (
        <div className="bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wider text-[#69717C] dark:text-[#8E97A4]">
            <Clock className="w-3.5 h-3.5 text-[#315BCB] dark:text-blue-400" />
            <span>Recently Selected</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {recentVoices.map((voice, idx) => (
              <button
                key={`recent-voice-${voice.id}-${idx}`}
                type="button"
                onClick={() => {
                  onSelectVoice(voice);
                  onNavigateToCreate();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] hover:bg-[#F0F2F5] dark:hover:bg-[#20252C] border border-[#E5E7E8] dark:border-[#292E36] text-xs text-[#20242B] dark:text-[#F0F2F5] transition-colors flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
              >
                <span className="font-semibold">{voice.name}</span>
                {voice.language && <span className="text-[#8E97A4]">· {voice.language}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E97A4] pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Voice ID (e.g. elevenlabs_...), name, keywords, tone, accent..."
              className="w-full pl-10 pr-9 h-10 bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] rounded-lg text-xs text-[#20242B] dark:text-[#F0F2F5] placeholder:text-[#8E97A4] focus:outline-none focus:border-[#315BCB] focus:ring-1 focus:ring-[#315BCB]/25"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E97A4] hover:text-[#20242B] p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters Group: Responsive grid on mobile, inline on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center gap-2 w-full lg:w-auto">
            {/* Gender Filter */}
            {availableGenders.length > 0 && (
              <select
                value={selectedGender}
                onChange={(e) => handleFilterChange(setSelectedGender, e.target.value)}
                aria-label="Filter by gender"
                className="w-full lg:w-auto h-9 bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] rounded-lg px-2.5 text-xs text-[#20242B] dark:text-[#F0F2F5] font-medium focus:outline-none focus:border-[#315BCB] capitalize cursor-pointer"
              >
                <option value="all">All Genders</option>
                {availableGenders.map((g, idx) => (
                  <option key={`opt-gender-${g}-${idx}`} value={g} className="capitalize">{g}</option>
                ))}
              </select>
            )}

            {/* Language Filter */}
            {availableLanguages.length > 0 && (
              <select
                value={selectedLanguage}
                onChange={(e) => handleFilterChange(setSelectedLanguage, e.target.value)}
                aria-label="Filter by language"
                className="w-full lg:w-auto h-9 bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] rounded-lg px-2.5 text-xs text-[#20242B] dark:text-[#F0F2F5] font-medium focus:outline-none focus:border-[#315BCB] cursor-pointer"
              >
                <option value="all">All Languages</option>
                {availableLanguages.map((l, idx) => (
                  <option key={`opt-lang-${l}-${idx}`} value={l}>{l}</option>
                ))}
              </select>
            )}

            {/* Accent Filter */}
            {availableAccents.length > 0 && (
              <select
                value={selectedAccent}
                onChange={(e) => handleFilterChange(setSelectedAccent, e.target.value)}
                aria-label="Filter by accent"
                className="w-full lg:w-auto h-9 bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] rounded-lg px-2.5 text-xs text-[#20242B] dark:text-[#F0F2F5] font-medium focus:outline-none focus:border-[#315BCB] capitalize cursor-pointer"
              >
                <option value="all">All Accents</option>
                {availableAccents.map((a, idx) => (
                  <option key={`opt-accent-${a}-${idx}`} value={a} className="capitalize">{a}</option>
                ))}
              </select>
            )}

            {/* Category Filter */}
            {availableCategories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => handleFilterChange(setSelectedCategory, e.target.value)}
                aria-label="Filter by category"
                className="w-full lg:w-auto h-9 bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] rounded-lg px-2.5 text-xs text-[#20242B] dark:text-[#F0F2F5] font-medium focus:outline-none focus:border-[#315BCB] capitalize cursor-pointer"
              >
                <option value="all">All Categories</option>
                {availableCategories.map((c, idx) => (
                  <option key={`opt-cat-${c}-${idx}`} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            )}

            {/* Favorites Toggle */}
            <button
              type="button"
              onClick={() => {
                setShowFavoritesOnly(prev => !prev);
                setCurrentPage(1);
              }}
              className={`w-full lg:w-auto h-9 flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                showFavoritesOnly
                  ? 'bg-amber-50 dark:bg-amber-400/10 border-[#B7791F]/40 text-[#B7791F] dark:text-amber-400'
                  : 'bg-[#FAFBFB] dark:bg-[#131518] border-[#E5E7E8] dark:border-[#292E36] text-[#4F5763] dark:text-[#8E97A4] hover:text-[#20242B] dark:hover:text-white'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-[#B7791F] dark:fill-amber-400' : ''}`} />
              <span>Favorites ({favoriteIds.length})</span>
            </button>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort voices by"
              className="w-full lg:w-auto h-9 bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] rounded-lg px-2.5 text-xs text-[#20242B] dark:text-[#F0F2F5] font-medium focus:outline-none focus:border-[#315BCB] cursor-pointer"
            >
              <option value="name-asc">Sort: Name (A-Z)</option>
              <option value="name-desc">Sort: Name (Z-A)</option>
              <option value="category-asc">Sort: Category</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips & Match Counts */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-[#69717C] dark:text-[#8E97A4] border-t border-[#E5E7E8] dark:border-[#292E36]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono tabular-nums text-[#20242B] dark:text-[#F0F2F5] font-semibold">
              {totalMatches.toLocaleString()} {totalMatches === 1 ? 'voice' : 'voices'} found
            </span>

            {activeChips.map((chip, idx) => (
              <span
                key={`chip-${idx}-${chip.label}`}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#F0F2F5] dark:bg-[#20252C] border border-[#E5E7E8] dark:border-[#292E36] text-[#20242B] dark:text-[#F0F2F5] text-xs font-medium"
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="hover:text-[#C04444] transition-colors ml-0.5"
                  aria-label={`Remove filter ${chip.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {activeChips.length > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-[#315BCB] dark:text-blue-400 hover:text-[#264BAF] transition-colors underline underline-offset-4 ml-1 font-semibold cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1 font-mono text-xs">
              <span>Page {currentPage} of {totalPages}</span>
            </div>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && voices.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] flex flex-col justify-between h-44 animate-pulse"
            >
              <div className="space-y-2">
                <div className="h-4 bg-[#E5E7E8] dark:bg-[#292E36] rounded w-1/2" />
                <div className="h-3 bg-[#E5E7E8]/60 dark:bg-[#292E36]/60 rounded w-3/4" />
                <div className="h-3 bg-[#E5E7E8]/40 dark:bg-[#292E36]/40 rounded w-full mt-2" />
              </div>
              <div className="h-8 bg-[#E5E7E8]/50 dark:bg-[#292E36]/50 rounded w-full mt-4" />
            </div>
          ))}
        </div>
      ) : paginatedVoices.length === 0 ? (
        /* Empty Results State */
        <div className="py-16 text-center bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-8 shadow-xs">
          <SlidersHorizontal className="w-8 h-8 text-[#8E97A4] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#20242B] dark:text-[#F0F2F5]">No voices found</h3>
          <p className="text-xs text-[#69717C] dark:text-[#8E97A4] mt-1 max-w-sm mx-auto">
            {showFavoritesOnly
              ? "You haven't saved any favorites yet or none match your search."
              : 'No voices matched the selected filters and search query.'}
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="mt-4 px-4 py-2 rounded-lg bg-[#315BCB] hover:bg-[#264BAF] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        /* Grid of Voices: 1 col on mobile, 2 on sm, 3 on lg, 4 on xl */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedVoices.map(voice => (
            <VoiceCard
              key={`library-voice-${voice.id}`}
              voice={voice}
              isFavorite={favoriteIds.includes(voice.id)}
              isSelected={voice.id === selectedVoiceId}
              onToggleFavorite={onToggleFavorite}
              onSelectVoice={(v) => {
                onSelectVoice(v);
                onNavigateToCreate();
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls with Responsive Layout */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[#E5E7E8] dark:border-[#292E36] text-xs text-[#69717C] dark:text-[#8E97A4]">
          <div>
            Showing <strong className="font-semibold text-[#20242B] dark:text-[#F0F2F5]">{(currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
            <strong className="font-semibold text-[#20242B] dark:text-[#F0F2F5]">{Math.min(currentPage * PAGE_SIZE, totalMatches)}</strong> of <strong className="font-semibold text-[#20242B] dark:text-[#F0F2F5]">{totalMatches.toLocaleString()}</strong> voices
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-[#E5E7E8] dark:border-[#292E36] bg-white dark:bg-[#181B20] hover:bg-[#F0F2F5] dark:hover:bg-[#20252C] text-[#20242B] dark:text-[#F0F2F5] disabled:opacity-40 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>
            <span className="font-mono px-2 font-medium">{currentPage} / {totalPages}</span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-[#E5E7E8] dark:border-[#292E36] bg-white dark:bg-[#181B20] hover:bg-[#F0F2F5] dark:hover:bg-[#20252C] text-[#20242B] dark:text-[#F0F2F5] disabled:opacity-40 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
              aria-label="Next page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
