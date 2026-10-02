import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { exchangeOAuthCode } from '../api';
import { ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';

export const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithOAuthResult } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [providerName, setProviderName] = useState<string>('Identity Provider');

  useEffect(() => {
    let isMounted = true;

    async function processCallback() {
      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDesc = searchParams.get('error_description');

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

      // CSRF state verification
      const savedState = typeof window !== 'undefined' ? window.sessionStorage?.getItem('syncbrief_oauth_state') : null;
      if (savedState && state && state !== savedState) {
        if (isMounted) {
          setError('OAuth state parameter mismatch. For security reasons, authentication was aborted.');
          setIsProcessing(false);
        }
        return;
      }

      const storedProvider = (typeof window !== 'undefined' ? window.sessionStorage?.getItem('syncbrief_oauth_provider') : null) as 'google' | 'microsoft' | null;
      const provider = storedProvider || (location.pathname.includes('microsoft') ? 'microsoft' : 'google');
      if (isMounted) {
        setProviderName(provider === 'microsoft' ? 'Microsoft Entra ID' : 'Google Identity');
      }

      const codeVerifier = typeof window !== 'undefined' ? window.sessionStorage?.getItem('syncbrief_pkce_verifier') || undefined : undefined;
      const redirectUri = `${window.location.origin}/auth/callback`;

      try {
        const result = await exchangeOAuthCode({
          provider,
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        });

        // Clear temporary session OAuth keys
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem('syncbrief_oauth_state');
          window.sessionStorage.removeItem('syncbrief_oauth_provider');
          window.sessionStorage.removeItem('syncbrief_pkce_verifier');
        }

        loginWithOAuthResult(result);
        navigate('/', { replace: true });
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to complete OAuth authentication with the backend.');
          setIsProcessing(false);
        }
      }
    }

    processCallback();

    return () => {
      isMounted = false;
    };
  }, [location, loginWithOAuthResult, navigate]);

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
                  Verifying enterprise identity and establishing secure session.
                </p>
              </div>
            </div>
          ) : (
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
                  onClick={() => navigate('/login', { replace: true })}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
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
