import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  ShieldAlert,
  Server,
  RefreshCw,
  Database,
  Key,
  Trash2,
  ExternalLink,
  Check,
  Info,
  Layers,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ServerAppConfig, CatalogInspection } from '../types/index.js';
import { checkServerHealth, refreshVoiceCatalog, verifyAccessCode } from '../services/api.js';
import {
  clearGenerationHistory,
  saveFavorites,
  getStoredAccessCode,
  setStoredAccessCode,
} from '../services/storage.js';
import { useToast } from '../context/ToastContext.js';

interface SettingsViewProps {
  config: ServerAppConfig;
  inspection: CatalogInspection | null;
  favoritesCount: number;
  historyCount: number;
  onRefreshCatalog: () => void;
  onFavoritesCleared: () => void;
  onHistoryCleared: () => void;
  onConfigUpdated: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  inspection,
  favoritesCount,
  historyCount,
  onRefreshCatalog,
  onFavoritesCleared,
  onHistoryCleared,
}) => {
  const { showToast } = useToast();
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [accessCode, setAccessCode] = useState(() => getStoredAccessCode());
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isCodeAuthenticated, setIsCodeAuthenticated] = useState<boolean>(!config.requiresAccessCode);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const testConnection = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await checkServerHealth();
      setHealthStatus(res);
      if (res.status === 'ok') {
        showToast('Connection verified successfully', 'success');
      } else {
        showToast(res.message || 'Server connection degraded', 'warning');
      }
    } catch (err: any) {
      setHealthStatus({ status: 'error', message: err.message });
      showToast(err.message || 'Health check failed', 'error');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    testConnection();

    // Check stored access code against criteria
    if (config.requiresAccessCode) {
      const stored = getStoredAccessCode();
      if (stored && stored.trim()) {
        verifyAccessCode(stored.trim())
          .then((res) => {
            setIsCodeAuthenticated(res.valid);
          })
          .catch(() => {
            setIsCodeAuthenticated(false);
          });
      } else {
        setIsCodeAuthenticated(false);
      }
    }
  }, [config.requiresAccessCode]);

  const handleSaveAndVerifyAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = accessCode.trim();
    if (!trimmed) {
      setCodeError('Please provide an access code to verify.');
      return;
    }

    setIsVerifyingCode(true);
    setCodeError(null);

    try {
      const res = await verifyAccessCode(trimmed);
      if (res.valid) {
        setStoredAccessCode(trimmed);
        setIsCodeAuthenticated(true);
        setCodeError(null);
        showToast('Access code verified & saved successfully', 'success');
      } else {
        setIsCodeAuthenticated(false);
        setCodeError(res.message || 'Invalid access code. Please check credentials.');
        showToast(res.message || 'Invalid access code', 'error');
      }
    } catch (err: any) {
      setIsCodeAuthenticated(false);
      const msg = err.message || 'Verification failed';
      setCodeError(msg);
      showToast(msg, 'error');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleClearAccessCode = () => {
    setStoredAccessCode('');
    setAccessCode('');
    setIsCodeAuthenticated(false);
    setCodeError(null);
    showToast('App access code cleared from browser', 'info');
  };

  const handleManualCatalogRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshVoiceCatalog();
      onRefreshCatalog();
      showToast(result.message || 'Voice catalog cache refreshed', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to refresh catalog cache', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearFavorites = () => {
    if (window.confirm('Are you sure you want to clear all saved favorite voices?')) {
      saveFavorites([]);
      onFavoritesCleared();
      showToast('Favorite voices cleared', 'info');
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to delete all speech generation history?')) {
      clearGenerationHistory();
      onHistoryCleared();
      showToast('Generation history cleared', 'info');
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 pb-24 lg:pb-8">
      {/* View Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#20242B] dark:text-[#F0F2F5] flex items-center gap-2.5">
          <Settings className="w-5 h-5 text-[#315BCB] dark:text-blue-400 shrink-0" />
          <span>Workstation & Voice Settings</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#69717C] dark:text-[#8E97A4] mt-0.5">
          Verify backend connectivity, inspect ElevenLabs voice telemetry, and manage preferences
        </p>
      </div>

      {/* 2-Column Responsive Workstation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: API Health, Access Code, Local Storage */}
        <div className="space-y-6">
          {/* Connection & Upstream Status */}
          <div className="bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-[#315BCB] dark:text-blue-400 shrink-0" />
                <h2 className="text-sm font-bold text-[#20242B] dark:text-[#F0F2F5]">Backend & Provider API Status</h2>
              </div>
              <button
                type="button"
                onClick={testConnection}
                disabled={isCheckingHealth}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#F0F2F5] dark:bg-[#20252C] hover:bg-[#E5E7E8] text-[#20242B] dark:text-[#F0F2F5] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-2xs self-start sm:self-auto active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin text-[#315BCB]' : ''}`} />
                <span>Test Connection</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 sm:p-3.5 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] flex items-center justify-between">
                <span className="text-[#69717C] dark:text-[#8E97A4] font-medium">OpenSpeaker Key</span>
                <div className="flex items-center gap-1.5">
                  {config.isConfigured ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-[#23865A] shrink-0" />
                      <span className="font-semibold text-[#23865A]">Configured in Secrets</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4 text-[#B7791F] shrink-0" />
                      <span className="font-semibold text-[#B7791F]">Missing Secret Key</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 sm:p-3.5 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] flex items-center justify-between">
                <span className="text-[#69717C] dark:text-[#8E97A4] font-medium">Upstream Base URL</span>
                <span className="font-mono text-[#20242B] dark:text-white font-medium truncate max-w-[150px]" title={config.apiBaseUrl}>{config.apiBaseUrl}</span>
              </div>

              <div className="p-3 sm:p-3.5 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] flex items-center justify-between">
                <span className="text-[#69717C] dark:text-[#8E97A4] font-medium">Max Text Chars</span>
                <span className="font-mono text-[#20242B] dark:text-white font-medium tabular-nums">
                  {config.maxTextChars.toLocaleString()} chars
                </span>
              </div>

              <div className="p-3 sm:p-3.5 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] flex items-center justify-between">
                <span className="text-[#69717C] dark:text-[#8E97A4] font-medium">Health Status</span>
                <span className="font-mono capitalize text-[#20242B] dark:text-white font-semibold">
                  {healthStatus?.status || 'Active'}
                </span>
              </div>
            </div>

            {!config.isConfigured && (
              <div className="p-3.5 sm:p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-[#315BCB]/30 text-xs text-[#4F5763] dark:text-slate-300 space-y-2">
                <div className="font-semibold text-[#315BCB] dark:text-blue-400 flex items-center gap-1.5">
                  <Key className="w-4 h-4 shrink-0" />
                  <span>How to add OPENSPEAKER_API_KEY:</span>
                </div>
                <p className="leading-relaxed">
                  Open the <strong>Secrets panel</strong> in Google AI Studio and configure the
                  environment variable <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-[#315BCB] font-mono border border-[#E5E7E8] dark:border-slate-800">OPENSPEAKER_API_KEY</code> with
                  your OpenSpeaker / ElevenLabs API key. The server will automatically use it for TTS generation and voice catalog synchronization without exposing the secret to the browser.
                </p>
              </div>
            )}
          </div>

          {/* App Access Code (Optional) */}
          {config.requiresAccessCode && (
            <div className="bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Key className="w-4 h-4 text-[#B7791F] dark:text-amber-400 shrink-0" />
                  <h2 className="text-sm font-bold text-[#20242B] dark:text-[#F0F2F5]">App Access Code Unlock</h2>
                </div>
                {isCodeAuthenticated ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-[#23865A] dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Authenticated</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-[#B7791F] dark:text-amber-400 border border-amber-500/20 text-xs font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Access Code Required</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-[#69717C] dark:text-[#8E97A4] leading-relaxed">
                This deployment requires an authorized passcode to safeguard synthesis credits. Once authenticated, the access code card is hidden from the sidebar.
              </p>

              <form onSubmit={handleSaveAndVerifyAccessCode} className="space-y-3">
                <div className="relative">
                  <input
                    type={showCode ? 'text' : 'password'}
                    value={accessCode}
                    onChange={(e) => {
                      setAccessCode(e.target.value);
                      if (codeError) setCodeError(null);
                    }}
                    placeholder="Enter required access code"
                    disabled={isVerifyingCode}
                    className={`w-full min-h-[40px] pl-3.5 pr-10 py-2 bg-[#FAFBFB] dark:bg-[#131518] border rounded-lg text-xs text-[#20242B] dark:text-[#F0F2F5] focus:outline-none focus:ring-1 transition-colors ${
                      codeError
                        ? 'border-red-500 focus:ring-red-500/30'
                        : 'border-[#E5E7E8] dark:border-[#292E36] focus:border-[#315BCB] focus:ring-[#315BCB]/25'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E97A4] hover:text-[#20242B] dark:hover:text-white p-1 transition-colors cursor-pointer"
                    title={showCode ? 'Hide code' : 'Show code'}
                  >
                    {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {codeError && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{codeError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isVerifyingCode || !accessCode.trim()}
                    className="flex-1 min-h-[40px] px-4 py-2 bg-[#315BCB] hover:bg-[#264BAF] active:bg-[#1E3F96] text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isVerifyingCode ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying Criteria...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify & Save Code</span>
                      </>
                    )}
                  </button>

                  {accessCode && (
                    <button
                      type="button"
                      onClick={handleClearAccessCode}
                      className="min-h-[40px] px-3.5 py-2 bg-white dark:bg-[#20252C] hover:bg-red-50 dark:hover:bg-red-950/20 text-[#69717C] hover:text-red-600 dark:hover:text-red-400 border border-[#E5E7E8] dark:border-[#292E36] rounded-lg text-xs font-semibold transition-colors cursor-pointer active:scale-95"
                      title="Clear saved access code"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Local Storage & Cache Management */}
          <div className="bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-[#20242B] dark:text-[#F0F2F5]">Local Browser Storage</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 sm:p-4 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#20242B] dark:text-[#F0F2F5] block">Favorite Voices</span>
                  <span className="text-[#69717C] dark:text-[#8E97A4] text-[11px]">
                    {favoritesCount} saved in browser
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearFavorites}
                  disabled={favoritesCount === 0}
                  className="min-h-[34px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#20252C] hover:bg-red-50 hover:text-[#C04444] border border-[#E5E7E8] dark:border-[#292E36] text-[#69717C] font-semibold transition-colors disabled:opacity-40 shadow-2xs active:scale-95"
                >
                  Clear
                </button>
              </div>

              <div className="p-3.5 sm:p-4 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#20242B] dark:text-[#F0F2F5] block">Generation History</span>
                  <span className="text-[#69717C] dark:text-[#8E97A4] text-[11px]">
                    {historyCount} past recordings stored
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  disabled={historyCount === 0}
                  className="min-h-[34px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#20252C] hover:bg-red-50 hover:text-[#C04444] border border-[#E5E7E8] dark:border-[#292E36] text-[#69717C] font-semibold transition-colors disabled:opacity-40 shadow-2xs active:scale-95"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Catalog Inspection Report & Schema Discovery */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#181B20] border border-[#E5E7E8] dark:border-[#292E36] rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-[#315BCB] dark:text-blue-400 shrink-0" />
                <h2 className="text-sm font-bold text-[#20242B] dark:text-[#F0F2F5]">Voice Catalog Inspection & Telemetry</h2>
              </div>

              <button
                type="button"
                onClick={handleManualCatalogRefresh}
                disabled={isRefreshing}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#315BCB] hover:bg-[#264BAF] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-2xs self-start sm:self-auto active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Force Re-fetch Upstream</span>
              </button>
            </div>

            {inspection ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="p-3 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36]">
                    <span className="text-[#69717C] dark:text-[#8E97A4] block font-medium">Total Voices</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-[#20242B] dark:text-[#F0F2F5] tabular-nums">
                      {inspection.totalVoices.toLocaleString()}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36]">
                    <span className="text-[#69717C] dark:text-[#8E97A4] block font-medium">Pages Fetched</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-[#20242B] dark:text-[#F0F2F5] tabular-nums">
                      {inspection.pageCount}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36]">
                    <span className="text-[#69717C] dark:text-[#8E97A4] block font-medium">Audio Previews</span>
                    <span className="text-sm sm:text-base font-bold text-[#23865A] block truncate">
                      {inspection.hasPreviewUrls ? 'Available' : 'None'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36]">
                    <span className="text-[#69717C] dark:text-[#8E97A4] block font-medium">Languages</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-[#20242B] dark:text-[#F0F2F5] tabular-nums">
                      {inspection.discoveredLanguages.length}
                    </span>
                  </div>
                </div>

                {/* Raw Sample Record Keys */}
                <div className="p-3.5 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] space-y-1.5">
                  <span className="font-bold text-[#20242B] dark:text-slate-200 block">
                    Upstream Provider Record Schema Discovered:
                  </span>
                  <p className="text-[#69717C] dark:text-[#8E97A4] font-mono text-[11px] leading-relaxed break-words">
                    {inspection.sampleRecordKeys.length > 0
                      ? inspection.sampleRecordKeys.join(', ')
                      : 'No sample fields detected.'}
                  </p>
                </div>

                {/* Discovered Genders, Accents, Categories */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36]">
                    <span className="font-bold text-[#20242B] dark:text-slate-200 block mb-1">Genders:</span>
                    <span className="text-[#69717C] dark:text-[#8E97A4] capitalize font-medium">
                      {inspection.discoveredGenders.join(', ') || 'None found'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36]">
                    <span className="font-bold text-[#20242B] dark:text-slate-200 block mb-1">Categories:</span>
                    <span className="text-[#69717C] dark:text-[#8E97A4] capitalize font-medium">
                      {inspection.discoveredCategories.join(', ') || 'None found'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36]">
                    <span className="font-bold text-[#20242B] dark:text-slate-200 block mb-1">Accents ({inspection.discoveredAccents.length}):</span>
                    <span className="text-[#69717C] dark:text-[#8E97A4] capitalize truncate block font-medium">
                      {inspection.discoveredAccents.slice(0, 5).join(', ')}
                      {inspection.discoveredAccents.length > 5 ? '...' : ''}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#FAFBFB] dark:bg-[#131518] border border-[#E5E7E8] dark:border-[#292E36] text-xs text-[#69717C] dark:text-[#8E97A4] text-center">
                Catalog inspection data will populate once voices are retrieved from upstream.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
