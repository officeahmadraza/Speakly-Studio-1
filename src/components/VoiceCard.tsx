import React, { useState } from 'react';
import { Play, Pause, Loader2, Star, Check, VolumeX, Sparkles, Copy } from 'lucide-react';
import { Voice } from '../types/index.js';
import { useAudioPlayer } from '../context/AudioPlayerContext.js';

export function getVoiceInitials(name: string): string {
  if (!name) return 'VA';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function getVoiceAvatarGradient(name: string): string {
  const gradients = [
    'from-indigo-600 to-blue-600',
    'from-violet-600 to-purple-600',
    'from-emerald-600 to-teal-600',
    'from-rose-600 to-pink-600',
    'from-amber-600 to-orange-600',
    'from-cyan-600 to-blue-600',
    'from-fuchsia-600 to-pink-600',
    'from-teal-600 to-emerald-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

interface VoiceCardProps {
  voice: Voice;
  isFavorite: boolean;
  isSelected: boolean;
  onToggleFavorite: (voiceId: string) => void;
  onSelectVoice: (voice: Voice) => void;
}

export const VoiceCard: React.FC<VoiceCardProps> = ({
  voice,
  isFavorite,
  isSelected,
  onToggleFavorite,
  onSelectVoice,
}) => {
  const { playVoicePreview, pause, isVoicePlaying, isVoiceLoading, isVoiceAuditioned } = useAudioPlayer();
  const [copiedId, setCopiedId] = useState(false);

  const playing = isVoicePlaying(voice.id);
  const loading = isVoiceLoading(voice.id);
  const auditioned = isVoiceAuditioned(voice.id);
  const hasPreview = Boolean(voice.previewUrl);

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasPreview) return;
    if (playing) {
      pause();
    } else {
      playVoicePreview(voice);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(voice.id);
  };

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(voice.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Build clean unboxed metadata items with typographic separators
  const metadataParts: string[] = [];
  if (voice.gender) metadataParts.push(voice.gender);
  if (voice.accent) metadataParts.push(voice.accent);
  if (voice.age) metadataParts.push(voice.age);
  if (voice.language) metadataParts.push(voice.language);
  if (voice.category) metadataParts.push(voice.category);

  return (
    <div
      onClick={() => onSelectVoice(voice)}
      className={`group relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-150 cursor-pointer ${
        isSelected
          ? 'bg-blue-50/50 dark:bg-[#315BCB]/15 border-[#315BCB] dark:border-[#315BCB]/80 shadow-sm ring-2 ring-[#315BCB]/25'
          : 'bg-white dark:bg-[#181B20] border-[#E5E7E8] dark:border-[#292E36] hover:border-[#315BCB]/50 dark:hover:border-blue-400/50 hover:shadow-sm'
      }`}
    >
      {/* Top Row: Avatar Monogram, Name & Favorite */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {/* Avatar Monogram */}
            <div
              className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getVoiceAvatarGradient(
                voice.name
              )} flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs select-none ${
                playing ? 'ring-2 ring-[#315BCB] animate-pulse' : ''
              }`}
            >
              {getVoiceInitials(voice.name)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#20242B] dark:text-[#F0F2F5] group-hover:text-[#315BCB] dark:group-hover:text-blue-400 text-sm tracking-tight truncate transition-colors">
                  {voice.name}
                </h3>
                {isSelected && (
                  <span className="inline-flex items-center text-[#315BCB] dark:text-blue-400 text-[11px] font-bold shrink-0 bg-[#315BCB]/10 px-1.5 py-0.2 rounded border border-[#315BCB]/20">
                    <Check className="w-3 h-3 mr-0.5 stroke-[2.5]" />
                    Selected
                  </span>
                )}
              </div>

              {/* Voice ID with 1-click copy */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-[11px] text-[#69717C] dark:text-[#8E97A4] truncate max-w-[125px] xs:max-w-[150px] sm:max-w-[180px]" title={`Voice ID: ${voice.id}`}>
                  {voice.id}
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="min-w-[24px] min-h-[24px] p-0.5 rounded text-[#8E97A4] hover:text-[#20242B] dark:hover:text-[#F0F2F5] transition-colors shrink-0 flex items-center justify-center active:scale-90"
                  title="Copy Voice ID"
                  aria-label="Copy Voice ID"
                >
                  {copiedId ? (
                    <Check className="w-3 h-3 text-[#23865A]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Favorite Toggle Button */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            className={`min-w-[34px] min-h-[34px] p-1.5 rounded-lg transition-colors shrink-0 flex items-center justify-center active:scale-90 ${
              isFavorite
                ? 'text-amber-500 bg-amber-50 dark:bg-amber-400/10'
                : 'text-[#8E97A4] hover:text-[#20242B] dark:hover:text-slate-200 hover:bg-[#F0F2F5] dark:hover:bg-[#20252C]'
            }`}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            title={isFavorite ? 'Remove from favorites' : 'Save as favorite'}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-500' : ''}`} />
          </button>
        </div>

        {/* Typographic Metadata Line */}
        {metadataParts.length > 0 && (
          <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-xs text-[#69717C] dark:text-[#9CA3AF] mb-2 capitalize pl-0.5">
            {metadataParts.map((part, index) => (
              <React.Fragment key={`meta-${index}-${part}`}>
                {index > 0 && <span className="text-[#CBD0D6] dark:text-[#4A5361]" aria-hidden="true">·</span>}
                <span className="font-medium">{part}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Description / Use Case */}
        {voice.description ? (
          <p className="text-xs text-[#4F5763] dark:text-[#9CA3AF] line-clamp-2 leading-relaxed">
            {voice.description}
          </p>
        ) : voice.useCase ? (
          <p className="text-xs text-[#69717C] dark:text-[#8E97A4] line-clamp-2 leading-relaxed italic">
            Use case: {voice.useCase}
          </p>
        ) : null}

        {/* Tags if present */}
        {voice.tags && voice.tags.length > 0 && (
          <div className="flex items-center flex-wrap gap-1 text-[11px] text-[#8E97A4] dark:text-[#717B8A] mt-2">
            {voice.tags.slice(0, 3).map((tag, i) => (
              <span key={`tag-${i}-${tag}`} className="bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded">
                #{tag}
              </span>
            ))}
            {voice.tags.length > 3 && (
              <span className="text-[#8E97A4]">+{voice.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between gap-2.5 pt-3 mt-3 border-t border-[#E5E7E8] dark:border-[#292E36]">
        {/* Sample Preview Audition */}
        {hasPreview ? (
          <button
            type="button"
            onClick={handlePreviewClick}
            disabled={loading}
            className={`min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
              playing
                ? 'bg-[#315BCB] text-white shadow-xs'
                : 'bg-[#F0F2F5] dark:bg-[#20252C] text-[#20242B] dark:text-[#E2E8F0] hover:bg-[#E5E7E8] dark:hover:bg-[#292E36]'
            }`}
            title={playing ? 'Pause audio sample' : 'Play authentic voice preview sample'}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#315BCB]" />
            ) : playing ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{loading ? 'Loading...' : playing ? 'Playing' : 'Audition'}</span>
            {playing && (
              <span className="flex items-center gap-0.5 h-2.5 ml-0.5">
                <span className="w-0.5 bg-white rounded-full animate-[pulse_0.5s_infinite] h-full" />
                <span className="w-0.5 bg-white rounded-full animate-[pulse_0.7s_0.2s_infinite] h-2/3" />
                <span className="w-0.5 bg-white rounded-full animate-[pulse_0.4s_0.4s_infinite] h-4/5" />
              </span>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-[#8E97A4] italic py-1.5">
            <VolumeX className="w-3.5 h-3.5" />
            <span>No sample</span>
          </div>
        )}

        {/* Select Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectVoice(voice);
          }}
          className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
            isSelected
              ? 'bg-[#315BCB] text-white shadow-xs'
              : 'bg-[#315BCB]/10 hover:bg-[#315BCB]/20 text-[#315BCB] dark:text-blue-400 border border-[#315BCB]/25'
          }`}
        >
          {isSelected ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Selected</span>
            </>
          ) : (
            <span>Select Actor</span>
          )}
        </button>
      </div>
    </div>
  );
};
