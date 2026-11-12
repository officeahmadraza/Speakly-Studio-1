import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Voice } from '../types/index.js';

interface AudioPlayerContextType {
  isPlaying: boolean;
  isLoading: boolean;
  activeUrl: string | null;
  activeVoiceId: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  error: string | null;
  auditionedVoiceIds: Set<string>;
  playVoicePreview: (voice: Voice) => Promise<void>;
  playUrl: (url: string, id?: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  setPlaybackRate: (rate: number) => void;
  isVoicePlaying: (voiceId: string) => boolean;
  isVoiceLoading: (voiceId: string) => boolean;
  isVoiceAuditioned: (voiceId: string) => boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [auditionedVoiceIds, setAuditionedVoiceIds] = useState<Set<string>>(new Set());

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const onWaiting = () => {
      setIsLoading(true);
    };

    const onCanPlay = () => {
      setIsLoading(false);
    };

    const onPlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
      setError(null);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setError('Unable to stream audio sample. The link may have expired or is blocked.');
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsLoading(false);
    setActiveUrl(null);
    setActiveVoiceId(null);
    setCurrentTime(0);
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    if (!audioRef.current || !activeUrl) return;

    if (!audioRef.current.src || audioRef.current.error) {
      const isRemote = activeUrl.startsWith('http://') || activeUrl.startsWith('https://');
      const targetUrl = isRemote ? `/api/audio-proxy?url=${encodeURIComponent(activeUrl)}` : activeUrl;
      audioRef.current.src = targetUrl;
      audioRef.current.load();
    }

    audioRef.current.play().catch(e => {
      console.error('Playback resume error:', e);
      setIsPlaying(false);
    });
  }, [activeUrl]);

  const seek = useCallback((seconds: number) => {
    if (audioRef.current && isFinite(seconds)) {
      audioRef.current.currentTime = Math.max(0, Math.min(seconds, audioRef.current.duration || 0));
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const validRate = Math.max(0.5, Math.min(2.0, rate));
    setPlaybackRateState(validRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = validRate;
    }
  }, []);

  const playUrl = useCallback(async (url: string, id?: string) => {
    if (!audioRef.current || !url) return;

    // Resolve playable URL: if it's a remote URL (http/https), route through /api/audio-proxy
    // to bypass CORS and fix GCS 'text/plain' Content-Type
    const isRemote = url.startsWith('http://') || url.startsWith('https://');
    const proxyUrl = isRemote ? `/api/audio-proxy?url=${encodeURIComponent(url)}` : url;

    // If already playing this url or its proxy, toggle pause
    if ((activeUrl === url || activeUrl === proxyUrl) && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if ((activeUrl === url || activeUrl === proxyUrl) && !isPlaying) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        return;
      } catch (err: any) {
        console.warn('Resume playback error, will re-initialize source:', err);
      }
    }

    // Stop current audio before starting new
    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    setActiveUrl(url);
    setActiveVoiceId(id || null);
    setIsLoading(true);
    setError(null);
    setCurrentTime(0);
    setDuration(0);

    const tryPlaySource = async (srcUrl: string): Promise<boolean> => {
      if (!audioRef.current) return false;
      audioRef.current.src = srcUrl;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.load();
      await audioRef.current.play();
      return true;
    };

    try {
      // First attempt: try proxyUrl (or direct if already local)
      await tryPlaySource(proxyUrl);
      setIsPlaying(true);
      if (id) {
        setAuditionedVoiceIds(prev => new Set(prev).add(id));
      }
    } catch (primaryErr: any) {
      console.warn('Primary audio stream load error, trying fallback:', primaryErr);
      // Fallback attempt: if proxyUrl was used and failed, try direct url
      if (proxyUrl !== url) {
        try {
          await tryPlaySource(url);
          setIsPlaying(true);
          if (id) {
            setAuditionedVoiceIds(prev => new Set(prev).add(id));
          }
          return;
        } catch (fallbackErr: any) {
          console.error('Direct audio fallback also failed:', fallbackErr);
        }
      }

      setIsLoading(false);
      setIsPlaying(false);
      setError('Unable to play audio sample. Please try again.');
      console.error('Audio play error:', primaryErr);
    }
  }, [activeUrl, isPlaying, playbackRate]);

  const playVoicePreview = useCallback(async (voice: Voice) => {
    if (!voice.previewUrl) {
      setError(`No preview sample available for "${voice.name}".`);
      return;
    }

    // Route through backend stream proxy to guarantee 'Content-Type: audio/mpeg' (bypassing GCS 'text/plain')
    const proxyUrl = `/api/voices/${encodeURIComponent(voice.id)}/preview?url=${encodeURIComponent(voice.previewUrl)}`;
    await playUrl(proxyUrl, voice.id);
  }, [playUrl]);

  const isVoicePlaying = useCallback((voiceId: string) => {
    return Boolean(activeVoiceId === voiceId && isPlaying);
  }, [activeVoiceId, isPlaying]);

  const isVoiceLoading = useCallback((voiceId: string) => {
    return Boolean(activeVoiceId === voiceId && isLoading);
  }, [activeVoiceId, isLoading]);

  const isVoiceAuditioned = useCallback((voiceId: string) => {
    return auditionedVoiceIds.has(voiceId);
  }, [auditionedVoiceIds]);

  return (
    <AudioPlayerContext.Provider
      value={{
        isPlaying,
        isLoading,
        activeUrl,
        activeVoiceId,
        currentTime,
        duration,
        volume,
        playbackRate,
        error,
        auditionedVoiceIds,
        playVoicePreview,
        playUrl,
        pause,
        resume,
        stop,
        seek,
        setVolume,
        setPlaybackRate,
        isVoicePlaying,
        isVoiceLoading,
        isVoiceAuditioned,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}
