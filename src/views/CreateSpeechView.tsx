import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Mic,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Download,
  Copy,
  Trash2,
  Sparkles,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Star,
  Check,
  User,
} from 'lucide-react';
import { Voice, ServerAppConfig, GenerationHistoryItem, ActiveGenerationTask } from '../types/index.js';
import { createTTSSpeech, fetchTaskStatus, getDownloadUrl, verifyAccessCode } from '../services/api.js';
import {
  getActiveTask,
  saveActiveTask,
  clearActiveTask,
  saveGenerationItem,
  addRecentVoiceId,
  getStoredAccessCode,
  setStoredAccessCode,
} from '../services/storage.js';
import { useAudioPlayer } from '../context/AudioPlayerContext.js';
import { useToast } from '../context/ToastContext.js';
import { AudioPlayer } from '../components/AudioPlayer.js';
import { getVoiceInitials, getVoiceAvatarGradient } from '../components/VoiceCard.js';

interface CreateSpeechViewProps {
  voices: Voice[];
  selectedVoice: Voice | null;
  onOpenVoiceSelector: () => void;
  config: ServerAppConfig;
  onGenerationComplete: (item: GenerationHistoryItem) => void;
  onSelectVoice?: (voice: Voice) => void;
  favoriteIds?: string[];
  onToggleFavorite?: (voiceId: string) => void;
}

type GenerationStage = 'idle' | 'preparing' | 'processing' | 'generating' | 'completed' | 'failed';

export const CreateSpeechView: React.FC<CreateSpeechViewProps> = ({
  voices,
  selectedVoice,
  onOpenVoiceSelector,
  config,
  onGenerationComplete,
  onSelectVoice,
  favoriteIds = [],
  onToggleFavorite,
}) => {
  const { playVoicePreview, pause, isVoicePlaying, isVoiceLoading } = useAudioPlayer();
  const { showToast } = useToast();
  const [copiedVoiceId, setCopiedVoiceId] = useState<boolean>(false);

  const [text, setText] = useState('');
  const [speed, setSpeed] = useState<number>(1.0);
  const [withTranscript, setWithTranscript] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [accessCode, setAccessCode] = useState<string>(() => getStoredAccessCode());
  const [isAccessCodeAuthenticated, setIsAccessCodeAuthenticated] = useState<boolean>(() => {
    return !config.requiresAccessCode;
  });
  const [isVerifyingCode, setIsVerifyingCode] = useState<boolean>(false);
  const [codeVerificationError, setCodeVerificationError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Task execution state
  const [stage, setStage] = useState<GenerationStage>('idle');
  const [stageMessage, setStageMessage] = useState<string>('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [completedItem, setCompletedItem] = useState<GenerationHistoryItem | null>(null);

  // Auto-verify stored access code against criteria
  useEffect(() => {
    if (!config.requiresAccessCode) {
      setIsAccessCodeAuthenticated(true);
      return;
    }

    const savedCode = getStoredAccessCode();
    if (savedCode && savedCode.trim()) {
      setIsVerifyingCode(true);
      verifyAccessCode(savedCode.trim())
        .then((res) => {
          if (res.valid) {
            setIsAccessCodeAuthenticated(true);
            setCodeVerificationError(null);
          } else {
            setIsAccessCodeAuthenticated(false);
          }
        })
        .catch(() => {
          setIsAccessCodeAuthenticated(false);
        })
        .finally(() => {
          setIsVerifyingCode(false);
        });
    } else {
      setIsAccessCodeAuthenticated(false);
    }
  }, [config.requiresAccessCode]);

  // Handle Verify Access Code
  const handleVerifyAccessCode = async () => {
    const trimmed = accessCode.trim();
    if (!trimmed) {
      setCodeVerificationError('Please enter an access code to verify.');
      return;
    }

    setIsVerifyingCode(true);
    setCodeVerificationError(null);

    try {
      const res = await verifyAccessCode(trimmed);
      if (res.valid) {
        setStoredAccessCode(trimmed);
        setIsAccessCodeAuthenticated(true);
        setCodeVerificationError(null);
        showToast('App access code authenticated successfully!', 'success', 'Unlocked');
      } else {
        setIsAccessCodeAuthenticated(false);
        setCodeVerificationError(res.message || 'Invalid access code. Please check credentials.');
        showToast(res.message || 'Invalid access code.', 'error');
      }
    } catch (err: any) {
      setIsAccessCodeAuthenticated(false);
      const msg = err.message || 'Failed to verify access code with server.';
      setCodeVerificationError(msg);
      showToast(msg, 'error');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Polling ref
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);

  // Counters & Math
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const maxChars = config.maxTextChars || 5000;
  const isOverLimit = charCount > maxChars;
  const charUsagePercent = Math.min(100, Math.round((charCount / maxChars) * 100));
  // Est speech duration in seconds at standard ~145 words/min adjusted for speed
  const estimatedSeconds = wordCount > 0 ? Math.max(1, Math.round((wordCount / 145) * 60 / speed)) : 0;

  // Cleanup polling timeout on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  // Poll Task Status with exponential backoff and jitter
  const pollTask = useCallback(
    async (taskId: string, currentTaskMeta: ActiveGenerationTask, attempt = 1, delay = 2500) => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const taskData = await fetchTaskStatus(taskId);

        if (taskData.status === 'done' || taskData.status === 'completed') {
          // Terminal Success
          setStage('completed');
          setStageMessage('Speech generated successfully!');
          clearActiveTask();
          isPollingRef.current = false;

          const historyItem: GenerationHistoryItem = {
            id: `gen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            taskId,
            voiceId: currentTaskMeta.voiceId,
            voiceName: currentTaskMeta.voiceName,
            text: currentTaskMeta.text,
            charCount: currentTaskMeta.text.length,
            wordCount: currentTaskMeta.text.trim().split(/\s+/).length,
            speed: currentTaskMeta.speed,
            withTranscript: currentTaskMeta.withTranscript,
            fileName: currentTaskMeta.fileName || undefined,
            audioUrl: taskData.audioUrl || null,
            creditCost: taskData.creditCost,
            createdAt: new Date().toISOString(),
          };

          setCompletedItem(historyItem);
          saveGenerationItem(historyItem);
          onGenerationComplete(historyItem);
          showToast('Speech audio ready for playback & download!', 'success', 'Generation Completed');
          return;
        }

        if (taskData.status === 'failed' || taskData.status === 'error') {
          // Terminal Failure
          setStage('failed');
          const errorMsg = taskData.errorMessage || 'Voice generation failed upstream.';
          setTaskError(errorMsg);
          clearActiveTask();
          isPollingRef.current = false;
          showToast(errorMsg, 'error', 'Generation Failed');
          return;
        }

        // Still in progress
        setStage(taskData.progress && taskData.progress > 40 ? 'generating' : 'processing');
        setStageMessage(
          taskData.progress
            ? `Generating audio (${taskData.progress}%)...`
            : 'Processing speech synthesis upstream...'
        );

        isPollingRef.current = false;

        // Schedule next poll (2-3 seconds with slight jitter)
        const jitter = Math.floor(Math.random() * 500);
        pollingTimeoutRef.current = setTimeout(() => {
          pollTask(taskId, currentTaskMeta, attempt + 1, 2500 + jitter);
        }, delay + jitter);
      } catch (err: any) {
        isPollingRef.current = false;

        const retryDelay = err.retryAfter ? err.retryAfter * 1000 : Math.min(delay * 1.5, 10000);
        const jitter = Math.floor(Math.random() * 400);

        if (attempt > 40) {
          setStage('failed');
          setTaskError('Task status polling timed out after multiple attempts.');
          clearActiveTask();
          return;
        }

        pollingTimeoutRef.current = setTimeout(() => {
          pollTask(taskId, currentTaskMeta, attempt + 1, retryDelay + jitter);
        }, retryDelay + jitter);
      }
    },
    [onGenerationComplete, showToast]
  );

  // Resume active task if page was refreshed during generation
  useEffect(() => {
    const saved = getActiveTask();
    if (saved && saved.taskId && stage === 'idle') {
      setActiveTaskId(saved.taskId);
      setStage('processing');
      setStageMessage('Resuming background generation task...');
      setText(saved.text);
      setSpeed(saved.speed);
      setWithTranscript(saved.withTranscript);
      setFileName(saved.fileName || '');
      pollTask(saved.taskId, saved);
    }
  }, [pollTask, stage]);

  // Handle Start Generation
  const handleGenerate = async () => {
    if (!selectedVoice) {
      showToast('Please select a voice profile first.', 'warning');
      onOpenVoiceSelector();
      return;
    }

    if (!text.trim()) {
      showToast('Please enter text to generate speech.', 'warning');
      return;
    }

    if (isOverLimit) {
      showToast(`Text exceeds character limit of ${maxChars}.`, 'error');
      return;
    }

    if (config.requiresAccessCode && !isAccessCodeAuthenticated) {
      showToast('Please authenticate your access code in the sidebar to generate speech.', 'warning');
      return;
    }

    setStage('preparing');
    setStageMessage('Submitting request to OpenSpeaker...');
    setTaskError(null);
    setCompletedItem(null);

    try {
      const response = await createTTSSpeech({
        text: text.trim(),
        voiceId: selectedVoice.id,
        speed: speed !== 1.0 ? speed : undefined,
        withTranscript,
        fileName: fileName.trim() || undefined,
        accessCode: accessCode.trim() || undefined,
      });

      const currentTaskMeta: ActiveGenerationTask = {
        taskId: response.taskId,
        voiceId: selectedVoice.id,
        voiceName: selectedVoice.name,
        text: text.trim(),
        speed,
        withTranscript,
        fileName: fileName.trim(),
        startedAt: Date.now(),
      };

      setActiveTaskId(response.taskId);
      saveActiveTask(currentTaskMeta);
      addRecentVoiceId(selectedVoice.id);

      setStage('processing');
      setStageMessage('Queued in upstream ElevenLabs synthesizer...');

      // Start polling
      pollTask(response.taskId, currentTaskMeta);
    } catch (err: any) {
      setStage('failed');
      const msg = err.message || 'Failed to start text-to-speech task.';
      if (err.statusCode === 403 || msg.toLowerCase().includes('access code')) {
        setIsAccessCodeAuthenticated(false);
        setCodeVerificationError(msg);
      }
      setTaskError(msg);
      showToast(msg, 'error', 'Error');
    }
  };

  const handleClearText = () => {
    setText('');
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.preventDefault();
    const textarea = document.getElementById('tts-editor') as HTMLTextAreaElement;
    if (textarea) {
      textarea.select();
    }
  };

  const handleResetToNew = () => {
    setStage('idle');
    setCompletedItem(null);
    setActiveTaskId(null);
    setTaskError(null);
  };

  const handleVoicePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedVoice || !selectedVoice.previewUrl) return;
    if (isVoicePlaying(selectedVoice.id)) {
      pause();
    } else {
      playVoicePreview(selectedVoice);
    }
  };

  const handleCopyVoiceId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedVoice?.id) return;
    navigator.clipboard.writeText(selectedVoice.id);
    setCopiedVoiceId(true);
    showToast('Voice ID copied to clipboard', 'info');
    setTimeout(() => setCopiedVoiceId(false), 2000);
  };

  const isVoiceFavorite = Boolean(selectedVoice && favoriteIds.includes(selectedVoice.id));

  const handleLoadSampleScript = () => {
    setText(
      'Welcome to Speakly Studio. In a world of fleeting moments, the voice is how we connect, inspire, and endure. Every story deserves to be heard with nuance, authentic emotion, and effortless clarity.'
    );
  };

  const isGenerating = stage === 'preparing' || stage === 'processing' || stage === 'generating';

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 pb-28 lg:pb-8">
      {/* Studio Workstation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#20242B] dark:text-[#F0F2F5]">
            Create Speech
          </h1>
          <p className="text-xs sm:text-sm text-[#69717C] dark:text-[#8E97A4] mt-0.5">
            Discover voices. Create naturally. Bring your words to life.
          </p>
        </div>

        {/* Server Config Warning if API key is missing */}
        {!config.isConfigured && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-50 dark:bg-amber-400/10 border border-[#B7791F]/30 text-[#B7791F] dark:text-amber-400 text-xs font-medium self-start sm:self-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>API Key pending. Configure in AI Studio Secrets to generate speech.</span>
          </div>
        )}
      </div>

      {/* Mobile-Only Quick Performer Header Strip */}
      <div className="lg:hidden bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {selectedVoice ? (
            <div
              className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getVoiceAvatarGradient(
                selectedVoice.name
              )} flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs ${
                isVoicePlaying(selectedVoice.id) ? 'ring-2 ring-[#315BCB] animate-pulse' : ''
              }`}
            >
              {getVoiceInitials(selectedVoice.name)}
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-[#315BCB]/10 dark:bg-[#4C77EA]/15 border border-[#315BCB]/20 flex items-center justify-center text-[#315BCB] dark:text-[#4C77EA] shrink-0 font-bold text-xs">
              <Mic className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#69717C] dark:text-[#8E97A4]">
              Voice Actor
            </div>
            <div className="text-sm font-bold text-[#20242B] dark:text-[#F0F2F5] truncate">
              {selectedVoice ? selectedVoice.name : 'No actor selected'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedVoice?.previewUrl && (
            <button
              type="button"
              onClick={handleVoicePreview}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                isVoicePlaying(selectedVoice.id)
                  ? 'bg-[#315BCB] text-white border-[#315BCB]'
                  : 'bg-[#F0F2F5] dark:bg-[#20252C] hover:bg-[#E5E7E8] text-[#20242B] dark:text-white border-[#E5E7E8] dark:border-[#292E36]'
              }`}
              title={isVoicePlaying(selectedVoice.id) ? 'Pause audition' : 'Audition actor sample'}
            >
              {isVoiceLoading(selectedVoice.id) ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#315BCB]" />
              ) : isVoicePlaying(selectedVoice.id) ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenVoiceSelector}
            className="px-3 py-1.5 rounded-lg bg-[#315BCB]/10 dark:bg-[#4C77EA]/15 text-[#315BCB] dark:text-blue-400 font-semibold text-xs border border-[#315BCB]/30 hover:bg-[#315BCB]/20 transition-colors cursor-pointer"
          >
            {selectedVoice ? 'Change' : 'Select'}
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Desktop 7 cols Canvas / 5 cols Control Rack */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Script / Narration Canvas (7 cols on lg, 8 cols on xl) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          <div className="bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-4 sm:p-5 flex flex-col shadow-xs">
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7E8] dark:border-[#292E36] mb-3 text-xs">
              <span className="font-semibold text-[#20242B] dark:text-[#F0F2F5] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#315BCB] dark:text-blue-400" />
                Script / Narration Canvas
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={handleLoadSampleScript}
                  className="px-2.5 py-1 rounded text-[#315BCB] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors font-medium text-xs whitespace-nowrap"
                  title="Insert a sample script to test speech"
                >
                  Sample Script
                </button>
                <span className="text-[#CBD0D6] dark:text-[#3D4450]" aria-hidden="true">|</span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={!text}
                  className="px-2 py-1 rounded text-[#69717C] dark:text-[#8E97A4] hover:text-[#20242B] dark:hover:text-white hover:bg-[#F0F2F5] dark:hover:bg-[#20252C] transition-colors disabled:opacity-40 text-xs whitespace-nowrap"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearText}
                  disabled={!text}
                  className="px-2 py-1 rounded text-[#69717C] dark:text-[#8E97A4] hover:text-[#C04444] hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-40 flex items-center gap-1 text-xs whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div className="relative flex-1 min-h-[300px] sm:min-h-[360px] lg:min-h-[420px] flex flex-col">
              <textarea
                id="tts-editor"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isGenerating}
                placeholder="Type or paste narration script here. Punctuation marks (. , ! ?) naturally guide pauses and conversational cadences..."
                className={`w-full flex-1 p-3.5 sm:p-4 bg-[#FAFBFB] dark:bg-[#131518] border rounded-lg text-sm text-[#20242B] dark:text-[#F0F2F5] placeholder:text-[#8E97A4] focus:outline-none focus:ring-1 resize-y leading-relaxed font-sans ${
                  isOverLimit
                    ? 'border-[#C04444] focus:ring-[#C04444]'
                    : 'border-[#E5E7E8] dark:border-[#292E36] focus:border-[#315BCB] focus:ring-[#315BCB]/25'
                }`}
                rows={14}
              />
            </div>

            {/* Visual Character Usage Gauge Bar */}
            <div className="w-full bg-[#E5E7E8] dark:bg-[#292E36] h-1 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  isOverLimit ? 'bg-[#C04444]' : charUsagePercent > 80 ? 'bg-[#B7791F]' : 'bg-[#315BCB]'
                }`}
                style={{ width: `${Math.min(100, charUsagePercent)}%` }}
              />
            </div>

            {/* Bottom Character, Word, & Estimated Duration Counter */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs">
              <div className="flex items-center flex-wrap gap-2 text-[#69717C] dark:text-[#8E97A4]">
                <span className="tabular-nums font-mono font-medium">{wordCount} words</span>
                <span className="text-[#CBD0D6] dark:text-[#3D4450]" aria-hidden="true">·</span>
                {wordCount > 0 && (
                  <>
                    <span className="tabular-nums font-mono text-[#315BCB] dark:text-blue-400 font-medium">
                      ~{estimatedSeconds}s audio
                    </span>
                    <span className="text-[#CBD0D6] dark:text-[#3D4450]" aria-hidden="true">·</span>
                  </>
                )}
                <span
                  className={`tabular-nums font-mono ${
                    isOverLimit ? 'text-[#C04444] font-semibold' : 'text-[#69717C] dark:text-[#8E97A4]'
                  }`}
                >
                  {charCount.toLocaleString()} / {maxChars.toLocaleString()} chars
                </span>
              </div>

              {isOverLimit && (
                <span className="text-[#C04444] text-xs font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Exceeds limit by {charCount - maxChars} chars
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Studio Controls & Voice (5 cols on lg, 4 cols on xl) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4 lg:sticky lg:top-24">
          {/* Upgraded Select Voice Actor Card */}
          <div className="bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
            {/* Header: Label and Catalog Link */}
            <div className="flex items-center justify-between pb-1 border-b border-[#E5E7E8] dark:border-[#292E36]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#315BCB] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#69717C] dark:text-[#8E97A4]">
                  Voice Actor
                </span>
                {selectedVoice && (
                  <span className="text-[11px] font-semibold text-[#315BCB] dark:text-blue-400 bg-[#315BCB]/10 dark:bg-[#315BCB]/20 px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onOpenVoiceSelector}
                className="text-xs font-semibold text-[#315BCB] dark:text-blue-400 hover:text-[#264BAF] dark:hover:text-blue-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Browse All {voices.length > 0 && `(${voices.length})`}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedVoice ? (
              <div className="flex flex-col gap-3.5">
                {/* Voice Actor Main Profile */}
                <div className="p-3.5 rounded-xl bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] flex flex-col gap-3">
                  {/* Top: Avatar Monogram, Name, Copy Voice ID, and Favorite */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Avatar Monogram */}
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getVoiceAvatarGradient(
                          selectedVoice.name
                        )} flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-xs select-none ${
                          isVoicePlaying(selectedVoice.id) ? 'ring-2 ring-[#315BCB] animate-pulse' : ''
                        }`}
                      >
                        {getVoiceInitials(selectedVoice.name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-[#20242B] dark:text-[#F0F2F5] text-base leading-tight truncate">
                          {selectedVoice.name}
                        </h3>

                        {/* Voice ID with 1-click Copy */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="font-mono text-[11px] text-[#69717C] dark:text-[#8E97A4] truncate max-w-[140px] sm:max-w-[170px]"
                            title={`Voice ID: ${selectedVoice.id}`}
                          >
                            {selectedVoice.id}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyVoiceId}
                            className="min-w-[22px] min-h-[22px] p-0.5 rounded text-[#8E97A4] hover:text-[#20242B] dark:hover:text-[#F0F2F5] transition-colors shrink-0 flex items-center justify-center active:scale-90 cursor-pointer"
                            title="Copy Voice ID"
                            aria-label="Copy Voice ID"
                          >
                            {copiedVoiceId ? (
                              <Check className="w-3.5 h-3.5 text-[#23865A]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Favorite Toggle Button */}
                    {onToggleFavorite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(selectedVoice.id);
                        }}
                        className={`min-w-[34px] min-h-[34px] p-1.5 rounded-lg transition-colors shrink-0 flex items-center justify-center active:scale-90 cursor-pointer ${
                          isVoiceFavorite
                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-400/10'
                            : 'text-[#8E97A4] hover:text-[#20242B] dark:hover:text-slate-200 hover:bg-[#F0F2F5] dark:hover:bg-[#20252C]'
                        }`}
                        title={isVoiceFavorite ? 'Remove from favorites' : 'Save as favorite'}
                        aria-label="Toggle voice favorite"
                      >
                        <Star className={`w-4 h-4 ${isVoiceFavorite ? 'fill-amber-500' : ''}`} />
                      </button>
                    )}
                  </div>

                  {/* Actor Metadata Line */}
                  <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-xs text-[#69717C] dark:text-[#8E97A4] capitalize pt-1 border-t border-[#E5E7E8]/60 dark:border-[#292E36]/60">
                    {selectedVoice.gender && <span className="font-medium">{selectedVoice.gender}</span>}
                    {selectedVoice.accent && (
                      <>
                        <span className="text-[#CBD0D6] dark:text-[#3D4450]" aria-hidden="true">·</span>
                        <span className="font-medium">{selectedVoice.accent}</span>
                      </>
                    )}
                    {selectedVoice.age && (
                      <>
                        <span className="text-[#CBD0D6] dark:text-[#3D4450]" aria-hidden="true">·</span>
                        <span className="font-medium">{selectedVoice.age}</span>
                      </>
                    )}
                    {selectedVoice.language && (
                      <>
                        <span className="text-[#CBD0D6] dark:text-[#3D4450]" aria-hidden="true">·</span>
                        <span className="font-medium">{selectedVoice.language}</span>
                      </>
                    )}
                    {selectedVoice.category && (
                      <>
                        <span className="text-[#CBD0D6] dark:text-[#3D4450]" aria-hidden="true">·</span>
                        <span className="font-medium">{selectedVoice.category}</span>
                      </>
                    )}
                  </div>

                  {/* Soundwave Audition Player Strip */}
                  {selectedVoice.previewUrl ? (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleVoicePreview}
                        className={`flex-1 min-h-[38px] flex items-center justify-between px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-98 cursor-pointer ${
                          isVoicePlaying(selectedVoice.id)
                            ? 'bg-[#315BCB] text-white shadow-xs'
                            : 'bg-white dark:bg-[#20252C] hover:bg-[#F0F2F5] dark:hover:bg-[#292E36] border border-[#E5E7E8] dark:border-[#292E36] text-[#20242B] dark:text-[#E2E8F0]'
                        }`}
                        title={isVoicePlaying(selectedVoice.id) ? 'Pause audition' : 'Audition voice sample'}
                      >
                        <div className="flex items-center gap-2">
                          {isVoiceLoading(selectedVoice.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#315BCB]" />
                          ) : isVoicePlaying(selectedVoice.id) ? (
                            <Pause className="w-4 h-4 fill-current text-white" />
                          ) : (
                            <Play className="w-4 h-4 fill-current text-[#315BCB]" />
                          )}
                          <span>
                            {isVoiceLoading(selectedVoice.id)
                              ? 'Loading Sample...'
                              : isVoicePlaying(selectedVoice.id)
                              ? 'Playing Sample'
                              : 'Audition Actor Voice'}
                          </span>
                        </div>

                        {/* Animated Equalizer Wave Bars */}
                        <div className="flex items-center gap-0.5 h-3.5">
                          <span
                            className={`w-0.5 rounded-full transition-all duration-150 ${
                              isVoicePlaying(selectedVoice.id)
                                ? 'bg-white animate-[pulse_0.4s_infinite] h-full'
                                : 'bg-[#CBD0D6] dark:bg-[#3D4450] h-1.5'
                            }`}
                          />
                          <span
                            className={`w-0.5 rounded-full transition-all duration-150 ${
                              isVoicePlaying(selectedVoice.id)
                                ? 'bg-white animate-[pulse_0.6s_0.1s_infinite] h-3/4'
                                : 'bg-[#CBD0D6] dark:bg-[#3D4450] h-2.5'
                            }`}
                          />
                          <span
                            className={`w-0.5 rounded-full transition-all duration-150 ${
                              isVoicePlaying(selectedVoice.id)
                                ? 'bg-white animate-[pulse_0.5s_0.2s_infinite] h-full'
                                : 'bg-[#CBD0D6] dark:bg-[#3D4450] h-3'
                            }`}
                          />
                          <span
                            className={`w-0.5 rounded-full transition-all duration-150 ${
                              isVoicePlaying(selectedVoice.id)
                                ? 'bg-white animate-[pulse_0.7s_0.3s_infinite] h-2/3'
                                : 'bg-[#CBD0D6] dark:bg-[#3D4450] h-2'
                            }`}
                          />
                          <span
                            className={`w-0.5 rounded-full transition-all duration-150 ${
                              isVoicePlaying(selectedVoice.id)
                                ? 'bg-white animate-[pulse_0.4s_0.4s_infinite] h-4/5'
                                : 'bg-[#CBD0D6] dark:bg-[#3D4450] h-1.5'
                            }`}
                          />
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#8E97A4] dark:text-[#717B8A] italic px-1">
                      Direct ElevenLabs speech generation enabled for this actor.
                    </div>
                  )}
                </div>

                {/* Action button: Change Voice Actor */}
                <button
                  type="button"
                  onClick={onOpenVoiceSelector}
                  className="w-full py-2 px-3 rounded-lg bg-[#F0F2F5] dark:bg-[#20252C] hover:bg-[#E5E7E8] dark:hover:bg-[#292E36] text-[#20242B] dark:text-[#E2E8F0] font-semibold text-xs border border-[#E5E7E8] dark:border-[#292E36] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#69717C] dark:text-[#8E97A4]" />
                  <span>Change Voice Actor</span>
                </button>
              </div>
            ) : (
              <div
                onClick={onOpenVoiceSelector}
                className="p-6 rounded-xl border border-dashed border-[#CBD0D6] dark:border-[#3D4450] hover:border-[#315BCB] text-center cursor-pointer transition-all bg-[#FAFBFB] dark:bg-[#131518] flex flex-col items-center gap-2 group"
              >
                <div className="w-10 h-10 rounded-full bg-[#315BCB]/10 dark:bg-[#315BCB]/20 flex items-center justify-center text-[#315BCB] dark:text-blue-400 group-hover:scale-105 transition-transform">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-[#20242B] dark:text-[#F0F2F5] font-bold">No Voice Actor Selected</p>
                  <p className="text-xs text-[#69717C] dark:text-[#8E97A4] mt-0.5 max-w-[220px]">
                    Choose an authentic ElevenLabs voice actor from the catalog to bring your speech to life.
                  </p>
                </div>
                <span className="mt-1 px-3.5 py-1.5 rounded-lg bg-[#315BCB] text-white text-xs font-bold shadow-xs group-hover:bg-[#264BAF] transition-colors">
                  Select Voice Actor
                </span>
              </div>
            )}
          </div>

          {/* Voice Tuning Parameters */}
          <div className="bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-[#69717C] dark:text-[#8E97A4]">
              Speech Parameters
            </span>

            {/* Speed / Pacing Slider with Quick Presets */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-[#20242B] dark:text-[#F0F2F5] font-semibold">Pacing / Speed</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono tabular-nums text-[#315BCB] dark:text-blue-400 font-bold">
                    {speed.toFixed(2)}x
                  </span>
                  {speed !== 1.0 && (
                    <button
                      type="button"
                      onClick={() => setSpeed(1.0)}
                      className="text-[10px] text-[#69717C] hover:text-[#20242B] dark:hover:text-white underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#E5E7E8] dark:bg-[#292E36] rounded-lg appearance-none cursor-pointer accent-[#315BCB]"
              />

              {/* Clickable Speed Presets */}
              <div className="flex items-center justify-between gap-1.5 mt-2">
                {[
                  { label: '0.8x Slow', val: 0.8 },
                  { label: '1.0x Normal', val: 1.0 },
                  { label: '1.2x Fast', val: 1.2 },
                  { label: '1.5x Max', val: 1.5 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setSpeed(preset.val)}
                    className={`flex-1 py-1 rounded text-[11px] font-mono transition-colors text-center ${
                      Math.abs(speed - preset.val) < 0.03
                        ? 'bg-[#315BCB]/15 text-[#315BCB] dark:text-blue-400 font-bold border border-[#315BCB]/30'
                        : 'bg-[#FAFBFB] dark:bg-[#131518] text-[#8E97A4] hover:text-[#20242B] dark:hover:text-white border border-[#E5E7E8] dark:border-[#292E36]'
                    }`}
                  >
                    {preset.val}x
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Output File Name */}
            <div>
              <label htmlFor="file-name-input" className="block text-xs text-[#20242B] dark:text-[#F0F2F5] font-semibold mb-1.5">
                Output File Name (optional)
              </label>
              <input
                id="file-name-input"
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Voice (default) or enter custom name"
                className="w-full px-3 py-2 bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] rounded-lg text-xs text-[#20242B] dark:text-[#F0F2F5] placeholder:text-[#8E97A4] focus:outline-none focus:border-[#315BCB]"
              />
            </div>

            {/* Optional Transcript Toggle */}
            <div className="flex items-center justify-between pt-3 border-t border-[#E5E7E8] dark:border-[#292E36]">
              <div>
                <span className="text-xs font-semibold text-[#20242B] dark:text-[#F0F2F5]">Word-Aligned Transcript</span>
                <p className="text-[11px] text-[#69717C] dark:text-[#8E97A4]">Request word timestamps and transcript metadata</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={withTranscript}
                  onChange={(e) => setWithTranscript(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#E5E7E8] dark:bg-[#292E36] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#CBD0D6] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#315BCB]"></div>
              </label>
            </div>

            {/* Access Code if required and NOT yet authenticated */}
            {config.requiresAccessCode && !isAccessCodeAuthenticated && (
              <div className="pt-3 border-t border-[#E5E7E8] dark:border-[#292E36]">
                <div className="rounded-xl border border-amber-500/30 dark:border-amber-400/25 bg-gradient-to-b from-amber-500/[0.08] via-amber-500/[0.03] to-transparent dark:from-amber-400/[0.1] dark:via-amber-400/[0.03] dark:to-transparent p-3.5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>App Access Code Required</span>
                    </label>
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                      Locked
                    </span>
                  </div>

                  <p className="text-[11px] text-[#69717C] dark:text-[#8E97A4] leading-relaxed">
                    Speech synthesis is protected on this server. Please enter your authorized access code to unlock generation.
                  </p>

                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={accessCode}
                        onChange={(e) => {
                          setAccessCode(e.target.value);
                          if (codeVerificationError) setCodeVerificationError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleVerifyAccessCode();
                          }
                        }}
                        placeholder="Enter authorized access code"
                        disabled={isVerifyingCode}
                        className={`w-full pl-3 pr-9 py-2 bg-white dark:bg-[#131518] border rounded-lg text-xs text-[#20242B] dark:text-[#F0F2F5] placeholder:text-[#8E97A4] focus:outline-none focus:ring-1 transition-all ${
                          codeVerificationError
                            ? 'border-[#C04444] focus:ring-[#C04444]/30'
                            : 'border-amber-500/40 dark:border-amber-400/30 focus:border-[#315BCB] focus:ring-[#315BCB]/25'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E97A4] hover:text-[#20242B] dark:hover:text-white p-0.5 transition-colors cursor-pointer"
                        title={showPassword ? 'Hide access code' : 'Show access code'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Criteria Error Feedback */}
                    {codeVerificationError && (
                      <div className="flex items-start gap-1.5 p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-[11px] text-[#C04444] dark:text-red-400 animate-in fade-in duration-150">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="leading-tight">{codeVerificationError}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleVerifyAccessCode}
                      disabled={isVerifyingCode || !accessCode.trim()}
                      className="w-full py-2.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs cursor-pointer active:scale-[0.99]"
                    >
                      {isVerifyingCode ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying Criteria...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verify & Unlock</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Generate Button & Cost Disclaimer */}
          <div className="hidden lg:flex flex-col gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                !text.trim() ||
                isOverLimit ||
                !selectedVoice ||
                (config.requiresAccessCode && !isAccessCodeAuthenticated)
              }
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315BCB] ${
                isGenerating
                  ? 'bg-[#315BCB]/70 text-white cursor-not-allowed'
                  : !text.trim() || isOverLimit || !selectedVoice || (config.requiresAccessCode && !isAccessCodeAuthenticated)
                  ? 'bg-[#E5E7E8] dark:bg-[#20252C] text-[#8E97A4] cursor-not-allowed'
                  : 'bg-[#315BCB] hover:bg-[#264BAF] active:bg-[#1E3F96] text-white active:scale-[0.99] cursor-pointer'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{stageMessage || 'Synthesizing Speech...'}</span>
                </>
              ) : config.requiresAccessCode && !isAccessCodeAuthenticated ? (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Unlock Access Code to Generate</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Speech</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-[#69717C] dark:text-[#8E97A4] text-center leading-relaxed">
              Synthesized upstream via ElevenLabs engine. Consumes provider API credits upon generation.
            </p>
          </div>
        </div>
      </div>

      {/* Progress & Result Panel */}
      {(stage === 'preparing' ||
        stage === 'processing' ||
        stage === 'generating' ||
        stage === 'completed' ||
        stage === 'failed') && (
        <div className="bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-5 sm:p-6 shadow-sm animate-in fade-in duration-200">
          {/* Active Generation Progress Indicator */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-[#315BCB]/20 animate-ping opacity-40" />
                <Loader2 className="w-8 h-8 text-[#315BCB] animate-spin" />
              </div>
              <div>
                <h4 className="text-base font-bold text-[#20242B] dark:text-[#F0F2F5]">{stageMessage}</h4>
                <p className="text-xs text-[#69717C] dark:text-[#8E97A4] mt-1">
                  Task ID: <span className="font-mono text-[#20242B] dark:text-slate-300 font-semibold">{activeTaskId}</span>
                </p>
              </div>
            </div>
          )}

          {/* Failed State */}
          {stage === 'failed' && (
            <div className="flex flex-col items-center justify-center py-4 gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/20 border border-[#C04444]/30 flex items-center justify-center text-[#C04444]">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-[#C04444]">Speech Generation Failed</h4>
                <p className="text-xs text-[#4F5763] dark:text-slate-300 mt-1 max-w-lg">{taskError}</p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="px-4 py-2 rounded-lg bg-[#315BCB] hover:bg-[#264BAF] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Generation</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetToNew}
                  className="px-4 py-2 rounded-lg bg-[#F0F2F5] dark:bg-[#20252C] hover:bg-[#E5E7E8] text-[#20242B] dark:text-slate-200 text-xs font-semibold transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Completed Result Panel */}
          {stage === 'completed' && completedItem && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E7E8] dark:border-[#292E36]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-[#23865A]/30 flex items-center justify-center text-[#23865A] shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#20242B] dark:text-[#F0F2F5] text-base">Generation Completed</h3>
                    <div className="flex items-center gap-2 text-xs text-[#69717C] dark:text-[#8E97A4] mt-0.5">
                      <span>Performer: <strong className="font-semibold text-[#20242B] dark:text-white">{completedItem.voiceName}</strong></span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{completedItem.charCount} chars</span>
                      {completedItem.creditCost !== null && completedItem.creditCost !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">Credits: {completedItem.creditCost}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetToNew}
                    className="px-3.5 py-1.5 rounded-lg bg-[#F0F2F5] dark:bg-[#20252C] hover:bg-[#E5E7E8] text-[#20242B] dark:text-slate-200 text-xs font-semibold transition-colors"
                  >
                    Generate Another
                  </button>
                </div>
              </div>

              {/* Audio Player Console */}
              {completedItem.audioUrl ? (
                <AudioPlayer
                  audioUrl={completedItem.audioUrl}
                  title={fileName.trim() || completedItem.fileName || 'Voice'}
                  subtitle={`Generated on ${new Date(completedItem.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`}
                  downloadUrl={getDownloadUrl(completedItem.taskId, fileName.trim() || completedItem.fileName?.trim() || 'Voice', completedItem.audioUrl)}
                  downloadFileName={fileName.trim() || completedItem.fileName?.trim() || 'Voice'}
                />
              ) : (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-[#B7791F]/30 text-xs text-[#B7791F]">
                  Audio was generated upstream, but no direct streamable URL was returned. Please check task history.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mobile Fixed Bottom Action Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-white/95 dark:bg-[#181B20]/95 backdrop-blur-md border-t border-[#E5E7E8] dark:border-[#292E36] shadow-lg flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-[#8E97A4] truncate font-medium">
            {selectedVoice ? `${selectedVoice.name} · ${speed}x` : 'No voice selected'}
          </div>
          <div className="text-xs font-bold text-[#20242B] dark:text-[#F0F2F5] font-mono">
            {wordCount} words · {charCount} chars
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={
            isGenerating ||
            !text.trim() ||
            isOverLimit ||
            !selectedVoice ||
            (config.requiresAccessCode && !isAccessCodeAuthenticated)
          }
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shrink-0 ${
            isGenerating
              ? 'bg-[#315BCB]/70 text-white cursor-not-allowed'
              : !text.trim() || isOverLimit || !selectedVoice || (config.requiresAccessCode && !isAccessCodeAuthenticated)
              ? 'bg-[#E5E7E8] dark:bg-[#20252C] text-[#8E97A4] cursor-not-allowed'
              : 'bg-[#315BCB] hover:bg-[#264BAF] text-white active:scale-95 cursor-pointer'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating...</span>
            </>
          ) : config.requiresAccessCode && !isAccessCodeAuthenticated ? (
            <>
              <KeyRound className="w-3.5 h-3.5" />
              <span>Access Code Required</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Speech</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
