import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authService } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { recordAuditLog } from '../services/supabaseService';

const UserContext = createContext(null);

const DEFAULT_TIMEOUT_MINUTES = 3; // Default 3 minutes idle timeout

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(() => {
    const saved = localStorage.getItem('qh_session_timeout_minutes');
    return saved ? Math.max(1, Number(saved)) : DEFAULT_TIMEOUT_MINUTES;
  });

  const lastActivityRef = useRef(Date.now());
  const userRef = useRef(null);
  userRef.current = user;

  const logout = useCallback(async (reason = 'User initiated sign out') => {
    const currentUser = userRef.current;
    if (currentUser) {
      try {
        await recordAuditLog({
          user: currentUser.username || currentUser.email || 'User',
          userId: currentUser.id,
          action: 'Logout',
          resourceType: 'AUTH',
          resourceId: currentUser.id,
          details: {
            summary: `User ${currentUser.username || currentUser.email} signed out (${reason})`,
            email: currentUser.email,
            role: currentUser.role,
            reason,
          },
        });
      } catch (logErr) {
        console.warn('Audit log write on logout warning:', logErr);
      }
    }

    try {
      await authService.logout();
    } catch (_) {}

    try {
      await supabase.auth.signOut();
    } catch (_) {}

    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    sessionStorage.clear();

    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await authService.getProfile();
      if (profile && profile.is_active === false) {
        localStorage.setItem('qh_logout_notice', 'Your account has been deactivated. Please contact an administrator.');
        await logout('Account deactivated');
        return null;
      }
      setUser(profile);
      return profile;
    } catch {
      setUser(null);
      return null;
    }
  }, [logout]);

  // Fetch security configuration from system_config for session timeout
  const fetchTimeoutConfig = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('system_config')
        .select('data')
        .eq('section', 'security')
        .maybeSingle();

      if (data?.data?.session_timeout_min) {
        const mins = Math.max(1, Number(data.data.session_timeout_min));
        setSessionTimeoutMinutes(mins);
        localStorage.setItem('qh_session_timeout_minutes', String(mins));
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchTimeoutConfig();
  }, [fetchTimeoutConfig]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const session = await authService.getSession();
        if (session) {
          const profile = await authService.getProfile();
          if (mounted) {
            if (profile && profile.is_active === false) {
              localStorage.setItem('qh_logout_notice', 'Your account has been deactivated. Please contact an administrator.');
              await logout('Account deactivated');
            } else {
              setUser(profile);
            }
          }
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    };
    check();
    return () => { mounted = false; };
  }, [logout]);

  // Session Inactivity Tracker (Auto-logout after timeout)
  useEffect(() => {
    if (!user) return;

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(ev => window.addEventListener(ev, recordActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      const timeoutMs = (sessionTimeoutMinutes || DEFAULT_TIMEOUT_MINUTES) * 60 * 1000;
      const idleTime = Date.now() - lastActivityRef.current;

      if (idleTime >= timeoutMs) {
        console.warn(`[Auto-logout] User idle for ${Math.round(idleTime / 1000)}s (limit: ${sessionTimeoutMinutes}m). Triggering auto logout.`);
        localStorage.setItem(
          'qh_logout_notice',
          `You were automatically signed out due to ${sessionTimeoutMinutes} minute(s) of inactivity.`
        );
        logout(`Auto-logout after ${sessionTimeoutMinutes}m inactivity`);
        window.location.assign('/login?reason=session_timeout');
      }
    }, 10000); // Check every 10 seconds

    return () => {
      clearInterval(checkInterval);
      events.forEach(ev => window.removeEventListener(ev, recordActivity));
    };
  }, [user, sessionTimeoutMinutes, logout]);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        loading,
        refreshProfile,
        logout,
        sessionTimeoutMinutes,
        setSessionTimeoutMinutes,
        fetchTimeoutConfig,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside UserProvider');
  return ctx;
};

export default UserContext;

