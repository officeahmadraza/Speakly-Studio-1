import React from 'react';
import { Mic, Library, Star, History, Settings, Sun, Moon } from 'lucide-react';
import { Voice } from '../types/index.js';

export type NavTab = 'create' | 'library' | 'favorites' | 'history' | 'settings';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  favoritesCount: number;
  historyCount: number;
  selectedVoice: Voice | null;
  isDarkTheme?: boolean;
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  favoritesCount,
  historyCount,
  selectedVoice,
  isDarkTheme = false,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E5E7E8] dark:border-[#292E36] bg-[#FFFFFF]/90 dark:bg-[#181B20]/90 backdrop-blur-md transition-colors">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[70px] flex items-center justify-between gap-6 sm:gap-8">
        {/* Zone 1: Brand Wordmark with Precision Acoustic Waveform Icon */}
        <button
          type="button"
          onClick={() => onSelectTab('create')}
          className="text-base sm:text-lg font-semibold tracking-tight text-[#20242B] dark:text-[#F0F2F5] hover:text-[#315BCB] dark:hover:text-[#4C77EA] transition-colors whitespace-nowrap shrink-0 flex items-center gap-2.5 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315BCB]"
        >
          <div className="w-8 h-8 rounded-lg bg-[#315BCB]/10 dark:bg-[#4C77EA]/15 border border-[#315BCB]/20 dark:border-[#4C77EA]/30 flex items-center justify-center transition-colors group-hover:border-[#315BCB]/40">
            {/* Custom Audio Workstation Soundmark */}
            <svg
              className="w-4 h-4 text-[#315BCB] dark:text-[#4C77EA]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
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
          <span className="font-semibold text-[15px] sm:text-base tracking-[-0.01em]">Speakly Studio</span>
        </button>

        {/* Zone 2: Restrained Text Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 text-[13.5px] font-medium" aria-label="Main Navigation">
          <button
            type="button"
            onClick={() => onSelectTab('create')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'create'
                ? 'bg-[#F1F2F0] dark:bg-[#272C33] text-[#20242B] dark:text-[#F0F2F5] font-semibold'
                : 'text-[#69717C] dark:text-[#9FA7B3] hover:text-[#20242B] dark:hover:text-[#F0F2F5] hover:bg-[#F7F7F5] dark:hover:bg-[#1F2329]'
            }`}
          >
            <Mic className="w-4 h-4 text-[#315BCB] dark:text-[#4C77EA]" />
            <span>Create Speech</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('library')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'library'
                ? 'bg-[#F1F2F0] dark:bg-[#272C33] text-[#20242B] dark:text-[#F0F2F5] font-semibold'
                : 'text-[#69717C] dark:text-[#9FA7B3] hover:text-[#20242B] dark:hover:text-[#F0F2F5] hover:bg-[#F7F7F5] dark:hover:bg-[#1F2329]'
            }`}
          >
            <Library className="w-4 h-4" />
            <span>Voice Library</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('favorites')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'favorites'
                ? 'bg-[#F1F2F0] dark:bg-[#272C33] text-[#20242B] dark:text-[#F0F2F5] font-semibold'
                : 'text-[#69717C] dark:text-[#9FA7B3] hover:text-[#20242B] dark:hover:text-[#F0F2F5] hover:bg-[#F7F7F5] dark:hover:bg-[#1F2329]'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Favorites</span>
            {favoritesCount > 0 && (
              <span className="text-xs font-mono text-[#9299A3] dark:text-[#6C7480]">({favoritesCount})</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('history')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#F1F2F0] dark:bg-[#272C33] text-[#20242B] dark:text-[#F0F2F5] font-semibold'
                : 'text-[#69717C] dark:text-[#9FA7B3] hover:text-[#20242B] dark:hover:text-[#F0F2F5] hover:bg-[#F7F7F5] dark:hover:bg-[#1F2329]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>History</span>
            {historyCount > 0 && (
              <span className="text-xs font-mono text-[#9299A3] dark:text-[#6C7480]">({historyCount})</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#F1F2F0] dark:bg-[#272C33] text-[#20242B] dark:text-[#F0F2F5] font-semibold'
                : 'text-[#69717C] dark:text-[#9FA7B3] hover:text-[#20242B] dark:hover:text-[#F0F2F5] hover:bg-[#F7F7F5] dark:hover:bg-[#1F2329]'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Zone 3: Active Voice Context & Studio Utilities */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {selectedVoice ? (
            <button
              type="button"
              onClick={() => onSelectTab('create')}
              className="hidden sm:flex text-xs font-medium text-[#20242B] dark:text-[#F0F2F5] bg-[#F1F2F0] dark:bg-[#1F2329] hover:bg-[#ECEEEB] dark:hover:bg-[#272C33] border border-[#E5E7E8] dark:border-[#292E36] px-3 py-1.5 rounded-md items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={`Active Voice: ${selectedVoice.name} — Click to compose in studio`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#315BCB] dark:bg-[#4C77EA]" aria-hidden="true" />
              <span className="text-[#69717C] dark:text-[#9FA7B3]">Active:</span>
              <span className="font-semibold truncate max-w-[130px] sm:max-w-[160px]">{selectedVoice.name}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelectTab('library')}
              className="hidden sm:inline-flex text-xs font-medium text-[#315BCB] dark:text-[#4C77EA] bg-[#315BCB]/10 dark:bg-[#4C77EA]/15 hover:bg-[#315BCB]/15 border border-[#315BCB]/25 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Select a Voice
            </button>
          )}

          {/* Theme Toggle (Light / Dark) */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 sm:p-1.5 rounded-md text-[#69717C] dark:text-[#9FA7B3] hover:text-[#20242B] dark:hover:text-[#F0F2F5] hover:bg-[#F1F2F0] dark:hover:bg-[#272C33] border border-transparent hover:border-[#E5E7E8] dark:hover:border-[#292E36] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label={isDarkTheme ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              title={isDarkTheme ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkTheme ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#69717C]" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Secondary Navigation Row with 44px touch targets */}
      <div className="md:hidden flex items-center justify-around px-2 py-1.5 border-t border-[#E5E7E8] dark:border-[#292E36] bg-[#FFFFFF] dark:bg-[#181B20] text-xs font-medium overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => onSelectTab('create')}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-md whitespace-nowrap min-h-[44px] transition-colors active:scale-95 ${
            activeTab === 'create'
              ? 'bg-[#F1F2F0] dark:bg-[#272C33] text-[#315BCB] dark:text-[#4C77EA] font-semibold'
              : 'text-[#69717C] dark:text-[#9FA7B3]'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>Create</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('library')}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-md whitespace-nowrap min-h-[44px] transition-colors active:scale-95 ${
            activeTab === 'library'
              ? 'bg-[#F1F2F0] dark:bg-[#272C33] text-[#315BCB] dark:text-[#4C77EA] font-semibold'
              : 'text-[#69717C] dark:text-[#9FA7B3]'
          }`}
        >
          <Library className="w-4 h-4" />
          <span>Library</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('favorites')}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-md whitespace-nowrap min-h-[44px] transition-colors active:scale-95 ${
            activeTab === 'favorites'
              ? 'bg-[#F1F2F0] dark:bg-[#272C33] text-[#315BCB] dark:text-[#4C77EA] font-semibold'
              : 'text-[#69717C] dark:text-[#9FA7B3]'
          }`}
        >
          <Star className="w-4 h-4" />
          <span>Favorites</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('history')}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-md whitespace-nowrap min-h-[44px] transition-colors active:scale-95 ${
            activeTab === 'history'
              ? 'bg-[#F1F2F0] dark:bg-[#272C33] text-[#315BCB] dark:text-[#4C77EA] font-semibold'
              : 'text-[#69717C] dark:text-[#9FA7B3]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>History</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('settings')}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-md whitespace-nowrap min-h-[44px] transition-colors active:scale-95 ${
            activeTab === 'settings'
              ? 'bg-[#F1F2F0] dark:bg-[#272C33] text-[#315BCB] dark:text-[#4C77EA] font-semibold'
              : 'text-[#69717C] dark:text-[#9FA7B3]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
};
