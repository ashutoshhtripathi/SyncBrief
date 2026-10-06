import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { exchangeOAuthCode, verifyOAuthPassword } from '../api';
import { ShieldCheck, AlertCircle, ArrowLeft, Lock, KeyRound } from 'lucide-react';

// Module-level in-flight exchange cache to completely prevent duplicate network requests in StrictMode
const inFlightExchanges = new Map<string, Promise<any>>();

export const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithOAuthResult } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [providerName, setProviderName] = useState<string>('Identity Provider');

  // Password verification step state
  const [step, setStep] = useState<'exchange' | 'verify_password'>('exchange');
  const [pendingToken, setPendingToken] = useState<string>('');
  const [verifiedEmail, setVerifiedEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function processCallback() {
      // 1. Check if there is an in-progress password verification session (e.g., user refreshed the page)
      const savedPending = typeof window !== 'undefined' ? window.sessionStorage?.getItem('syncbrief_pending_oauth') : null;

      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDesc = searchParams.get('error_description');

      // If already on verify_password step (e.g. user refreshed the page):
      if (savedPending) {
        try {
          const parsed = JSON.parse(savedPending);
          if (parsed.pending_token && parsed.email) {
            if (isMounted) {
              setPendingToken(parsed.pending_token);
              setVerifiedEmail(parsed.email);
              setStep('verify_password');
              setIsProcessing(false);
              setProviderName(parsed.provider === 'microsoft' ? 'Microsoft Entra ID' : 'Google Identity');
              if (typeof window !== 'undefined' && window.history && location.search) {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            }
            return;
          }
        } catch (_) {}
      }

      if (errorParam) {
        if (isMounted) {
          setError(errorDesc || `Authentication was cancelled or rejected by provider (${errorParam}).`);
          setIsProcessing(false);
        }
        return;
      }

      if (!code) {
        if (isMounted) {
          setError('No authorization code was found in the callback request.');
          setIsProcessing(false);
        }
        return;
      }

      const storedProvider = (typeof window !== 'undefined' ? (window.sessionStorage?.getItem('syncbrief_oauth_provider') || (state ? window.sessionStorage?.getItem(`syncbrief_state_${state}`) : null)) : null) as 'google' | 'microsoft' | null;
      const provider = storedProvider || (location.pathname.includes('microsoft') ? 'microsoft' : 'google');
      const providerLabel = provider === 'microsoft' ? 'Microsoft Entra ID' : 'Google Identity';
      const providerTitle = provider === 'microsoft' ? 'Microsoft' : 'Google';
      if (isMounted) {
        setProviderName(providerLabel);
      }

      // Guard: check sessionStorage to prevent browser refresh from resubmitting same code
      const consumedKey = `syncbrief_consumed_code_${code}`;
      if (!inFlightExchanges.has(code) && typeof window !== 'undefined' && window.sessionStorage?.getItem(consumedKey)) {
        if (isMounted) {
          setError(`${providerTitle} sign-in expired or was already used. Please try again.`);
          setIsProcessing(false);
        }
        return;
      }

      // CSRF state verification (supports both single-tab and multi-tab state tracking)
      const savedState = typeof window !== 'undefined' ? window.sessionStorage?.getItem('syncbrief_oauth_state') : null;
      const specificState = state && typeof window !== 'undefined' ? window.sessionStorage?.getItem(`syncbrief_state_${state}`) : null;
      if ((savedState || specificState) && state) {
        if (savedState !== state && !specificState) {
          if (isMounted) {
            setError('OAuth state parameter mismatch. For security reasons, authentication was aborted.');
            setIsProcessing(false);
          }
          return;
        }
      }

      const codeVerifier = typeof window !== 'undefined' ? window.sessionStorage?.getItem('syncbrief_pkce_verifier') || undefined : undefined;
      const redirectUri = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5173/auth/callback'
        : `${window.location.origin}/auth/callback`;

      // Deduplicate in-flight exchange request across React StrictMode invocations
      let exchangePromise = inFlightExchanges.get(code);
      if (!exchangePromise) {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(consumedKey, 'consumed');
        }
        exchangePromise = exchangeOAuthCode({
          provider,
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
          state: state || undefined,
        });
        inFlightExchanges.set(code, exchangePromise);
      }

      try {
        const result = await exchangePromise;

        // Clean transient state from storage
        if (typeof window !== 'undefined' && window.sessionStorage && state) {
          window.sessionStorage.removeItem(`syncbrief_state_${state}`);
        }

        // Identity verified: check if password verification is required
        if (result.requires_password_verification && result.pending_token) {
          if (isMounted) {
            setPendingToken(result.pending_token);
            setVerifiedEmail(result.email || '');
            setStep('verify_password');
            setIsProcessing(false);

            if (typeof window !== 'undefined' && window.sessionStorage) {
              window.sessionStorage.setItem('syncbrief_pending_oauth', JSON.stringify({
                pending_token: result.pending_token,
                email: result.email || '',
                provider: provider
              }));
            }
            if (typeof window !== 'undefined' && window.history && location.search) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
          return;
        }

        // Fallback for direct token result (if any)
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem('syncbrief_oauth_state');
          window.sessionStorage.removeItem('syncbrief_oauth_provider');
          window.sessionStorage.removeItem('syncbrief_pkce_verifier');
          window.sessionStorage.removeItem('syncbrief_pending_oauth');
        }

        loginWithOAuthResult(result as any);
        navigate('/', { replace: true });
      } catch (err: any) {
        inFlightExchanges.delete(code);
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem('syncbrief_pending_oauth');
        }
        if (isMounted) {
          const rawMsg = err?.message || 'Failed to complete OAuth authentication with the backend.';
          if (rawMsg.includes('invalid_grant') || rawMsg.includes('already used') || rawMsg.includes('expired')) {
            setError(`${providerTitle} sign-in expired or was already used. Please try again.`);
          } else {
            setError(rawMsg);
          }
          setIsProcessing(false);
        }
      }
    }

    processCallback();

    return () => {
      isMounted = false;
    };
  }, [location, loginWithOAuthResult, navigate]);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setVerifyError('Please enter your SyncBrief password.');
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);

    try {
      const sessionResult = await verifyOAuthPassword({
        pending_token: pendingToken,
        password,
      });

      // Clear transient OAuth session storage on full authentication success
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem('syncbrief_pending_oauth');
        window.sessionStorage.removeItem('syncbrief_oauth_state');
        window.sessionStorage.removeItem('syncbrief_oauth_provider');
        window.sessionStorage.removeItem('syncbrief_pkce_verifier');
      }

      // Password verified successfully: log in and navigate to dashboard
      loginWithOAuthResult(sessionResult);
      navigate('/', { replace: true });
    } catch (err: any) {
      setVerifyError(err?.message || 'Incorrect SyncBrief password.');
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              SyncBrief <span className="text-blue-600 dark:text-blue-400">AI</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Enterprise Single Sign-On</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-8 shadow-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl text-center">
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Completing {providerName} Sign-In...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verifying enterprise identity with {providerName}.
                </p>
              </div>
            </div>
          ) : step === 'verify_password' ? (
            /* Dedicated Password Verification Screen */
            <div className="py-2 space-y-5 text-left">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Verify your SyncBrief password
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Your <span className="font-semibold text-slate-700 dark:text-slate-300">{providerName}</span> account identity was successfully verified. Please enter your SyncBrief account password to complete sign-in.
                </p>
              </div>

              <form onSubmit={handleVerifyPassword} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Email
                  </label>
                  <div className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-xs font-mono font-medium">
                    {verifiedEmail}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      autoFocus
                      placeholder="Enter your SyncBrief password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setVerifyError(null);
                      }}
                      className="w-full px-3.5 py-2 pl-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {verifyError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <div className="pt-2 space-y-2.5">
                  <button
                    type="submit"
                    disabled={isVerifying || !password}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isVerifying ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Continue</span>
                    )}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined' && window.sessionStorage) {
                          window.sessionStorage.removeItem('syncbrief_pending_oauth');
                          window.sessionStorage.removeItem('syncbrief_oauth_state');
                          window.sessionStorage.removeItem('syncbrief_oauth_provider');
                          window.sessionStorage.removeItem('syncbrief_pkce_verifier');
                        }
                        navigate('/login', { replace: true });
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
                    >
                      Return to Sign In
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            /* OAuth Error State */
            <div className="py-4 space-y-5">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                  Single Sign-On Failed
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {error}
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.sessionStorage) {
                      window.sessionStorage.removeItem('syncbrief_pending_oauth');
                      window.sessionStorage.removeItem('syncbrief_oauth_state');
                      window.sessionStorage.removeItem('syncbrief_oauth_provider');
                      window.sessionStorage.removeItem('syncbrief_pkce_verifier');
                    }
                    navigate('/login', { replace: true });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

