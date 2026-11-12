import React, { useState } from 'react';
import {
  History,
  Trash2,
  Download,
  Copy,
  Check,
  Clock,
  Mic,
  AlertTriangle,
  Play,
  Pause,
  ExternalLink,
} from 'lucide-react';
import { GenerationHistoryItem } from '../types/index.js';
import { AudioPlayer } from '../components/AudioPlayer.js';
import { getDownloadUrl } from '../services/api.js';
import { useToast } from '../context/ToastContext.js';

interface HistoryViewProps {
  history: GenerationHistoryItem[];
  onRemoveItem: (id: string) => void;
  onClearHistory: () => void;
  onUseTextInCreate: (text: string, voiceId: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onRemoveItem,
  onClearHistory,
  onUseTextInCreate,
}) => {
  const { showToast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Script text copied to clipboard', 'info');
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 pb-24 lg:pb-8">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#20242B] dark:text-[#F0F2F5] flex items-center gap-2.5">
            <History className="w-5 h-5 text-[#315BCB] dark:text-blue-400 shrink-0" />
            <span>Generation History</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#69717C] dark:text-[#8E97A4] mt-0.5">
            Review past speeches, audition tracks, and download your audio assets
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="min-h-[38px] px-3.5 py-2 rounded-lg bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] hover:border-[#C04444]/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold text-[#69717C] hover:text-[#C04444] transition-colors flex items-center gap-2 self-start shadow-xs active:scale-[0.98]"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Storage & Expiration Notice */}
      <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-amber-50 dark:bg-amber-400/10 border border-[#B7791F]/30 text-xs text-[#B7791F] dark:text-amber-400 shadow-2xs">
        <AlertTriangle className="w-4 h-4 text-[#B7791F] dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Audio asset persistence: </span>
          Full script texts and generation metadata are saved in your local browser storage. Upstream provider streaming URLs expire over time; download your MP3 audio files to archive them permanently.
        </div>
      </div>

      {/* Content List */}
      {history.length === 0 ? (
        <div className="py-16 sm:py-20 px-6 text-center bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-2xl max-w-xl mx-auto flex flex-col items-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-[#315BCB]/10 border border-[#315BCB]/20 flex items-center justify-center text-[#315BCB] dark:text-blue-400 mb-4">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#20242B] dark:text-[#F0F2F5]">No generation history yet</h3>
          <p className="text-xs text-[#69717C] dark:text-[#8E97A4] mt-1.5 max-w-sm leading-relaxed">
            Your generated speech tracks will appear here with full script text, audio playback, and direct download links.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-[#69717C] dark:text-[#8E97A4] font-mono tabular-nums">
            Showing <strong className="font-semibold text-[#20242B] dark:text-[#F0F2F5]">{history.length}</strong> {history.length === 1 ? 'recording' : 'recordings'} in local session
          </div>

          <div className="space-y-4">
            {history.map(item => (
              <div
                key={item.id}
                className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] flex flex-col gap-4 shadow-xs"
              >
                {/* Header: Title, voice actor, date, controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7E8] dark:border-[#292E36]">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#20242B] dark:text-[#F0F2F5] truncate">
                      {item.fileName || `${item.voiceName} Narration`}
                    </h3>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-[#69717C] dark:text-[#8E97A4] mt-1 font-mono">
                      <span>Performer: <strong className="font-semibold text-[#20242B] dark:text-white">{item.voiceName}</strong></span>
                      <span aria-hidden="true" className="text-[#CBD0D6] dark:text-[#3D4450]">·</span>
                      <span className="tabular-nums">{item.charCount} chars</span>
                      <span aria-hidden="true" className="text-[#CBD0D6] dark:text-[#3D4450]">·</span>
                      <span className="tabular-nums">{item.wordCount} words</span>
                      {item.speed && item.speed !== 1 && (
                        <>
                          <span aria-hidden="true" className="text-[#CBD0D6] dark:text-[#3D4450]">·</span>
                          <span>{item.speed.toFixed(2)}x</span>
                        </>
                      )}
                      {item.creditCost !== null && item.creditCost !== undefined && (
                        <>
                          <span aria-hidden="true" className="text-[#CBD0D6] dark:text-[#3D4450]">·</span>
                          <span>Cost: {item.creditCost}</span>
                        </>
                      )}
                      <span aria-hidden="true" className="text-[#CBD0D6] dark:text-[#3D4450]">·</span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => onUseTextInCreate(item.text, item.voiceId)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#F0F2F5] dark:bg-[#20252C] hover:bg-[#E5E7E8] text-[#20242B] dark:text-[#F0F2F5] text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs active:scale-95"
                      title="Load this script back into the editor"
                    >
                      <Mic className="w-3.5 h-3.5 text-[#315BCB] dark:text-blue-400 shrink-0" />
                      <span>Load in Editor</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyText(item.text, item.id)}
                      className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-[#8E97A4] hover:text-[#20242B] dark:hover:text-white hover:bg-[#F0F2F5] dark:hover:bg-[#20252C] transition-colors flex items-center justify-center active:scale-95"
                      title="Copy full script"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-4 h-4 text-[#23865A]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-[#8E97A4] hover:text-[#C04444] hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center justify-center active:scale-95"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Preserved Full Text */}
                <div className="p-3.5 sm:p-4 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] text-xs text-[#4F5763] dark:text-[#CBD0D6] font-sans leading-relaxed whitespace-pre-wrap max-h-44 sm:max-h-52 overflow-y-auto">
                  {item.text}
                </div>

                {/* Embedded Audio Player */}
                {item.audioUrl && (
                  <AudioPlayer
                    audioUrl={item.audioUrl}
                    downloadUrl={getDownloadUrl(item.taskId, item.fileName?.trim() || 'Voice', item.audioUrl)}
                    downloadFileName={item.fileName?.trim() || 'Voice'}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
