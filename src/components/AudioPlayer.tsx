import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Loader2,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext.js';
import { useToast } from '../context/ToastContext.js';

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  subtitle?: string;
  voiceName?: string;
  onDownload?: () => void;
  downloadUrl?: string;
  downloadFileName?: string;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 40 deterministic height multipliers for acoustic waveform scrub visualizer
const WAVEFORM_HEIGHTS = [
  28, 42, 65, 30, 80, 52, 90, 70, 40, 60, 95, 82, 45, 68, 75, 55, 88, 62, 35,
  72, 85, 48, 92, 78, 64, 40, 80, 58, 90, 72, 50, 68, 84, 42, 70, 60, 48, 76,
  35, 25,
];

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  title,
  subtitle,
  voiceName,
  onDownload,
  downloadUrl,
  downloadFileName,
}) => {
  const {
    activeUrl,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    playbackRate,
    playUrl,
    pause,
    resume,
    seek,
    setVolume,
    setPlaybackRate,
  } = useAudioPlayer();

  const isCurrentAudio = activeUrl === audioUrl;
  const effectivelyPlaying = isCurrentAudio && isPlaying;
  const effectivelyLoading = isCurrentAudio && isLoading;
  const currentDuration = isCurrentAudio && duration > 0 ? duration : 0;
  const currentPos = isCurrentAudio ? currentTime : 0;
  const progressRatio = currentDuration > 0 ? currentPos / currentDuration : 0;

  const handlePlayToggle = () => {
    if (!isCurrentAudio) {
      playUrl(audioUrl);
    } else if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (!isCurrentAudio) {
      playUrl(audioUrl).then(() => seek(newTime));
    } else {
      seek(newTime);
    }
  };

  const handleRestart = () => {
    if (isCurrentAudio) {
      seek(0);
      if (!isPlaying) resume();
    } else {
      playUrl(audioUrl);
    }
  };

  const handleVolumeToggle = () => {
    setVolume(volume > 0 ? 0 : 1);
  };

  const { showToast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const cyclePlaybackRate = () => {
    const rates = [1.0, 1.25, 1.5, 0.75];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
  };

  const handleDownloadAudio = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      // 1. Build priority URLs to fetch actual audio data
      let targetUrl = downloadUrl;
      if (!targetUrl && audioUrl) {
        targetUrl = `/api/download?url=${encodeURIComponent(audioUrl)}&filename=${encodeURIComponent(downloadFileName?.trim() || 'Voice')}`;
      } else if (targetUrl && audioUrl && !targetUrl.includes('url=')) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${separator}url=${encodeURIComponent(audioUrl)}`;
      }

      let blob: Blob | null = null;
      let lastErrorMessage = '';

      // Attempt 1: Fetch through streaming download endpoint
      if (targetUrl) {
        try {
          const res = await fetch(targetUrl);
          if (res.ok) {
            const contentType = (res.headers.get('content-type') || '').toLowerCase();
            if (contentType.includes('application/json')) {
              const json = await res.json();
              lastErrorMessage = json.error || json.message || 'Server returned invalid audio stream';
            } else {
              blob = await res.blob();
            }
          } else {
            const errText = await res.text();
            try {
              const parsed = JSON.parse(errText);
              lastErrorMessage = parsed.error || parsed.message || `Server error (${res.status})`;
            } catch {
              lastErrorMessage = errText.slice(0, 150) || `Server error (${res.status})`;
            }
          }
        } catch (fetchErr: any) {
          lastErrorMessage = fetchErr.message || 'Network error downloading stream';
        }
      }

      // Attempt 2 (Fallback): If proxy returned error or failed, fetch directly from audioUrl
      if ((!blob || blob.size === 0) && audioUrl) {
        try {
          const directRes = await fetch(audioUrl);
          if (directRes.ok) {
            const contentType = (directRes.headers.get('content-type') || '').toLowerCase();
            if (!contentType.includes('application/json')) {
              blob = await directRes.blob();
            }
          }
        } catch {
          // Direct fetch might be blocked by CORS
        }
      }

      // If still no valid blob, throw informative error so we NEVER save corrupt/json file to disk
      if (!blob || blob.size === 0) {
        throw new Error(
          lastErrorMessage || 'Audio stream could not be retrieved from source. Please try generating a new speech sample.'
        );
      }

      // Verify binary magic bytes to guarantee valid audio format & extension for Windows Media Player
      const headerBytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer());

      // If magic bytes indicate JSON or HTML error, reject it
      if (headerBytes[0] === 0x7B || (headerBytes[0] === 0x3C && headerBytes[1] === 0x21)) {
        throw new Error('Audio file payload contains an upstream error instead of valid audio frames.');
      }

      let detectedExt = 'mp3';
      // WAV signature: 'RIFF' .... 'WAVE'
      if (
        headerBytes.length >= 12 &&
        headerBytes[0] === 0x52 &&
        headerBytes[1] === 0x49 &&
        headerBytes[2] === 0x46 &&
        headerBytes[3] === 0x46 &&
        headerBytes[8] === 0x57 &&
        headerBytes[9] === 0x41 &&
        headerBytes[10] === 0x56 &&
        headerBytes[11] === 0x45
      ) {
        detectedExt = 'wav';
      } else if (
        headerBytes.length >= 4 &&
        headerBytes[0] === 0x4F &&
        headerBytes[1] === 0x67 &&
        headerBytes[2] === 0x67 &&
        headerBytes[3] === 0x53
      ) {
        detectedExt = 'ogg';
      }

      // Clean base name without stale extension: default to 'Voice' unless user entered a custom name
      let baseName = (downloadFileName?.trim() || 'Voice')
        .replace(/\.(mp3|wav|ogg|aac|m4a|bin|json)$/i, '')
        .replace(/[^a-zA-Z0-9_\-\s]/g, '')
        .trim();
      if (!baseName) baseName = 'Voice';
      const finalFileName = `${baseName}.${detectedExt}`;

      // Create object URL and download as real verified audio file
      const blobUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = blobUrl;
      tempLink.download = finalFileName;
      tempLink.style.display = 'none';
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

      if (onDownload) onDownload();
      showToast(`Audio downloaded successfully (${finalFileName})`, 'success');
    } catch (err: any) {
      console.error('Download error:', err);
      showToast(err.message || 'Failed to download audio file.', 'error', 'Download Issue');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="w-full bg-[#FFFFFF] dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all">
      {/* Track Details & Download Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E7E8] dark:border-[#292E36]/80">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-[15px] font-semibold text-[#20242B] dark:text-[#F0F2F5] truncate">
              {title || 'Generated Audio Track'}
            </h4>
            {voiceName && (
              <span className="text-xs text-[#69717C] dark:text-[#9FA7B3] bg-[#F1F2F0] dark:bg-[#272C33] px-2 py-0.5 rounded font-medium">
                {voiceName}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-[#69717C] dark:text-[#9FA7B3] mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {(downloadUrl || audioUrl) && (
          <button
            type="button"
            onClick={handleDownloadAudio}
            disabled={isDownloading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#315BCB] hover:bg-[#264BAF] active:bg-[#1E3F96] transition-colors shadow-sm shrink-0 cursor-pointer disabled:opacity-60"
            title="Download verified audio file to PC"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Audio</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Acoustic Waveform Scrub Section */}
      <div className="py-4 space-y-2">
        <div className="relative group py-2">
          {/* Waveform Bars Representation */}
          <div className="h-12 flex items-center justify-between gap-[3px] sm:gap-[4px] px-1 pointer-events-none select-none">
            {WAVEFORM_HEIGHTS.map((heightPercent, idx) => {
              const barRatio = idx / WAVEFORM_HEIGHTS.length;
              const isPlayed = progressRatio >= barRatio;

              return (
                <div
                  key={idx}
                  className={`flex-1 rounded-full transition-colors duration-100 ${
                    isPlayed
                      ? 'bg-[#315BCB] dark:bg-[#4C77EA]'
                      : 'bg-[#E5E7E8] dark:bg-[#272C33]'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
              );
            })}
          </div>

          {/* Invisible Accessible Scrub Range Input overlay */}
          <input
            type="range"
            min={0}
            max={currentDuration > 0 ? currentDuration : 100}
            step={0.1}
            value={currentPos}
            onChange={handleSeekChange}
            disabled={!isCurrentAudio && !currentDuration}
            aria-label="Seek timeline scrub bar"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        {/* Timestamps */}
        <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[#69717C] dark:text-[#9FA7B3]">
          <span>{formatTime(currentPos)}</span>
          <span>{formatTime(currentDuration)}</span>
        </div>
      </div>

      {/* Studio Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E7E8] dark:border-[#292E36]/80">
        <div className="flex items-center gap-3">
          {/* Main Play/Pause Button */}
          <button
            type="button"
            onClick={handlePlayToggle}
            aria-label={effectivelyPlaying ? 'Pause audio' : 'Play audio'}
            disabled={effectivelyLoading}
            className="w-10 h-10 rounded-full bg-[#315BCB] hover:bg-[#264BAF] text-white flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {effectivelyLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : effectivelyPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Replay */}
          <button
            type="button"
            onClick={handleRestart}
            aria-label="Replay from start"
            className="p-2 rounded-lg text-[#69717C] dark:text-[#9FA7B3] hover:text-[#20242B] dark:hover:text-white hover:bg-[#F1F2F0] dark:hover:bg-[#272C33] transition-colors cursor-pointer"
            title="Replay from beginning"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Playback Speed Cycle */}
          <button
            type="button"
            onClick={cyclePlaybackRate}
            aria-label={`Playback speed: ${playbackRate}x`}
            className="px-2.5 py-1 rounded-md text-xs font-mono font-medium text-[#69717C] dark:text-[#9FA7B3] hover:text-[#20242B] dark:hover:text-white hover:bg-[#F1F2F0] dark:hover:bg-[#272C33] border border-[#E5E7E8] dark:border-[#292E36] transition-colors cursor-pointer"
            title="Toggle playback speed"
          >
            {playbackRate.toFixed(2).replace(/\.00$/, '')}x
          </button>
        </div>

        {/* Volume Scrub */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleVolumeToggle}
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
            className="p-1.5 rounded-md text-[#69717C] dark:text-[#9FA7B3] hover:text-[#20242B] dark:hover:text-white transition-colors cursor-pointer"
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Volume slider"
            className="w-16 sm:w-24 h-1.5 bg-[#E5E7E8] dark:bg-[#272C33] rounded-lg appearance-none cursor-pointer accent-[#315BCB] focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
