import axios from 'axios';

let __viteEnvCache = null;
const viteEnv = () => {
  if (__viteEnvCache !== null) return __viteEnvCache;
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      __viteEnvCache = import.meta.env;
    } else {
      __viteEnvCache = {};
    }
  } catch (_) {
    __viteEnvCache = {};
  }
  return __viteEnvCache;
};

const REACT_APP_API_URL =
  process.env.REACT_APP_API_URL ||
  (viteEnv().REACT_APP_API_URL) ||
  (viteEnv().VITE_API_URL) ||
  undefined;

const REACT_APP_USE_SUPABASE_AUTH =
  process.env.REACT_APP_USE_SUPABASE_AUTH ||
  (viteEnv().REACT_APP_USE_SUPABASE_AUTH) ||
  (viteEnv().VITE_USE_SUPABASE_AUTH) ||
  'false';

const API_URL = REACT_APP_API_URL || 'http://localhost:8000/api';

const USE_SUPABASE_AUTH =
  REACT_APP_USE_SUPABASE_AUTH.toString().toLowerCase() === 'true';

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error && error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

const KNOWN_APP_ROLES = ['admin', 'company', 'recruiter'];
const isAppRole = (v) =>
  typeof v === 'string' && KNOWN_APP_ROLES.includes(v.trim().toLowerCase());

const normalizeUser = (u) => {
  if (!u) return null;
  const meta =
    (u.user_metadata && typeof u.user_metadata === 'object' ? u.user_metadata : {}) || {};
  const appMeta =
    (u.app_metadata && typeof u.app_metadata === 'object' ? u.app_metadata : {}) || {};

  let rawRole = null;
  if (isAppRole(u.role)) rawRole = u.role;
  else if (isAppRole(appMeta.role)) rawRole = appMeta.role;
  else if (isAppRole(meta.role)) rawRole = meta.role;
  if (!rawRole) rawRole = 'recruiter';

  const company_id =
    u.company_id ||
    meta.company_id ||
    appMeta.company_id ||
    (u.companies && u.companies.id) ||
    u.company ||
    null;
  const company_name =
    (u.companies && u.companies.name) ||
    (typeof u.company === 'object' && u.company !== null ? u.company.name : null) ||
    null;
  const company_code =
    u.company_code ||
    (u.companies && u.companies.company_code) ||
    meta.company_code ||
    appMeta.company_code ||
    null;
  const id_number = u.id_number || meta.id_number || appMeta.id_number || null;
  const employee_id = u.employee_id || meta.employee_id || appMeta.employee_id || null;
  const date_of_birth = u.date_of_birth || meta.date_of_birth || appMeta.date_of_birth || null;
  const registration_number =
    u.registration_number ||
    (u.companies && u.companies.registration_number) ||
    meta.registration_number ||
    appMeta.registration_number ||
    null;

  const username =
    u.username ||
    meta.username ||
    appMeta.username ||
    (u.email ? u.email.split('@')[0] : null);
  const first_name = u.first_name || u.firstname || meta.first_name || appMeta.first_name || null;
  const last_name = u.last_name || u.lastname || meta.last_name || appMeta.last_name || null;
  return {
    id: u.id,
    username,
    email: u.email,
    first_name,
    last_name,
    role: String(rawRole || 'recruiter').toString().toLowerCase(),
    is_active: u.is_active !== false,
    company_id,
    company_code,
    company_name,
    registration_number,
    id_number,
    employee_id,
    date_of_birth,
    companies: u.companies || (company_name ? { id: company_id, name: company_name, company_code, registration_number } : null),
    created_at: u.created_at || null,
    raw: u,
  };
};

export const normalizeRole = (role) => {
  const r = String(role == null ? '' : role).toString().trim().toLowerCase();
  if (KNOWN_APP_ROLES.includes(r)) return r;
  return 'recruiter';
};

export const dashboardForRole = (role) => {
  const r = normalizeRole(role);
  if (r === 'admin') return '/admin/dashboard';
  if (r === 'company') return '/company/dashboard';
  return '/recruiter/dashboard';
};

const syncAuthMetadataFromProfile = async (supabase, profile) => {
  if (!supabase || !profile) return;
  const nextMeta = {};
  if (profile.role) nextMeta.role = String(profile.role).trim().toLowerCase();
  if (profile.username) nextMeta.username = profile.username;
  if (profile.company_id != null) nextMeta.company_id = profile.company_id;
  if (profile.company_code != null) nextMeta.company_code = profile.company_code;
  if (profile.company_name != null) nextMeta.company_name = profile.company_name;
  if (profile.registration_number != null) nextMeta.registration_number = profile.registration_number;
  if (profile.first_name != null) nextMeta.first_name = profile.first_name;
  if (profile.last_name != null) nextMeta.last_name = profile.last_name;
  if (profile.id_number != null) nextMeta.id_number = profile.id_number;
  if (profile.employee_id != null) nextMeta.employee_id = profile.employee_id;
  if (profile.date_of_birth != null) nextMeta.date_of_birth = profile.date_of_birth;
  if (!Object.keys(nextMeta).length) return;
  try {
    const { error: metaErr } = await supabase.auth.updateUser({ data: nextMeta });
    if (metaErr) {
      console.warn('[syncAuthMetadataFromProfile] metadata update warn (continuing):', metaErr?.code || metaErr?.message || metaErr);
    }
  } catch (metaExc) {
    console.warn('[syncAuthMetadataFromProfile] metadata update exception (continuing):', metaExc?.message || metaExc);
  }
};

export const authService = {
  mode: USE_SUPABASE_AUTH ? 'supabase' : 'django',

  login: async (identifier, password) => {
    if (USE_SUPABASE_AUTH) {
      const { supabase } = await import('./supabaseClient');
      const ident = typeof identifier === 'string' ? identifier.trim() : '';
      if (!ident) throw new Error('Email or username is required.');
      const looksLikeEmail = /\S+@\S+\.\S+/.test(ident);
      const identLower = ident.toLowerCase();

      const matchesIdent = (candidateEmail, candidateUsername, candidateMeta) => {
        if (!candidateEmail && !candidateUsername) return false;
        const ce = String(candidateEmail || '').toLowerCase();
        const cu = String(candidateUsername || '').toLowerCase();
        const cm = String((candidateMeta && typeof candidateMeta === 'object' ? candidateMeta.username : null) || '').toLowerCase();
        const emailLocal = ce.includes('@') ? ce.split('@')[0] : '';
        return (
          ce === identLower ||
          cu === identLower ||
          cm === identLower ||
          emailLocal === identLower
        );
      };

      let resolvedEmail = ident;
      if (!looksLikeEmail) {
        try {
          const identLike = ident.replace(/[%_]/g, '\\$&');
          const { data: rows, error: lookupErr } = await supabase
            .from('users')
            .select('id, email, username')
            .or(
              [
                `username.eq.${ident}`,
                `username.ilike.${ident}`,
                `email.ilike.${identLike}@%`,
              ].join(',')
            )
            .limit(10);
          if (lookupErr) {
            const code = String(lookupErr?.code || '');
            const msg = String(lookupErr?.message || '').toLowerCase();
            const isRls = code === '42501' || /permission|rls|policy|denied|forbidden|403/.test(msg);
            if (isRls) {
              console.error(
                '[login] RLS blocks anonymous username lookup on "users" table. ' +
                'Create a SELECT policy allowing anonymous reads on (email, username) for username-based login to work in Supabase mode.'
              );
            } else {
              console.warn('[login] username lookup warning:', lookupErr?.code || lookupErr?.message || lookupErr);
            }
          } else if (rows && rows.length) {
            const exact = rows.filter(r => matchesIdent(r.email, r.username, null));
            const pick = exact.length === 1 ? exact[0] : rows.length === 1 ? rows[0] : null;
            if (pick && pick.email) {
              resolvedEmail = pick.email;
              console.log(`[login] resolved identifier "${ident}" → email "${resolvedEmail}"`);
            } else if (rows.length > 1) {
              console.warn(`[login] identifier "${ident}" matched ${rows.length} users; ambiguous, continuing with raw identifier`);
            } else {
              console.warn(`[login] identifier "${ident}" matched rows but none were unambiguous; continuing with raw identifier`);
            }
          } else {
            console.warn(`[login] no users-table match for identifier "${ident}"; will attempt raw identifier as email`);
          }
        } catch (lookupExc) {
          console.warn('[login] username lookup exception (continuing with raw identifier):', lookupExc?.message || lookupExc);
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });
      if (error) {
        let message = (error && typeof error.message === 'string' && error.message.trim()) ? error.message : 'Sign-in failed. Please try again.';
        if (error && error.code) {
          const c = String(error.code).toLowerCase();
          if (c === 'invalid_credentials' || c === 'invalid_grant') message = 'Invalid email/username or password. Please check your credentials and try again.';
          else if (c === 'email_not_confirmed') message = 'Your email has not been confirmed yet. Please confirm your email or have an admin create the account with "Auto-confirm" enabled.';
          else if (c === 'user_not_found') message = 'No account matches these credentials. Please verify the user exists in Supabase Dashboard → Authentication → Users.';
          else if (c === 'too_many_requests') message = 'Too many requests. Please wait a moment and try again.';
          else if (c === 'over_email_send_rate_limit') message = 'No account found or server rate-limited. Please verify the user exists in Supabase Authentication → Users.';
        }
        const friendly = new Error(message);
        friendly.code = error.code || null;
        friendly.status = error.status || null;
        friendly.cause = error;
        throw friendly;
      }

      const authUser = data?.user;
      if (!authUser) throw new Error('Authentication succeeded but no user was returned.');

      let profile = null;
      try {
        const { data: profiles, error: pErr } = await supabase
          .from('users')
          .select('*, companies(*)')
          .eq('id', authUser.id)
          .limit(1);
        if (pErr) {
          console.warn('[login] users table read warning (falling back to auth user_metadata):', pErr?.code || pErr?.message || pErr);
        } else if (profiles && profiles.length) {
          profile = profiles[0];
        }
      } catch (pExc) {
        console.warn('[login] users table read exception (falling back to auth user_metadata):', pExc?.message || pExc);
      }

      const matched = matchesIdent(
        profile?.email || authUser.email,
        profile?.username || null,
        authUser.user_metadata
      );
      if (!matched) {
        const actual = JSON.stringify({
          email: profile?.email || authUser.email,
          username: profile?.username || authUser?.user_metadata?.username || null,
        });
        console.error(
          `[login] identifier mismatch! Login identifier="${ident}" did not match authenticated user: ${actual}`
        );
        try { await supabase.auth.signOut(); } catch (_) { /* ignore */ }
        throw new Error(
          'Authenticated user does not match the requested identifier. ' +
          'If logging in with a username, make sure the username is stored on the users table or auth user_metadata and that RLS allows username lookups.'
        );
      }

      if (profile) syncAuthMetadataFromProfile(supabase, profile).catch(() => {});

      if (profile && profile.is_active === false) {
        try { await supabase.auth.signOut(); } catch (_) { /* ignore */ }
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        const deactErr = new Error('Your account has been deactivated. Please contact an administrator.');
        deactErr.code = 'account_deactivated';
        throw deactErr;
      }

      const user = normalizeUser(profile || authUser);
      if (data.session) {
        if (data.session.access_token) localStorage.setItem('token', data.session.access_token);
        if (data.session.refresh_token) localStorage.setItem('refresh_token', data.session.refresh_token);
      }
      localStorage.setItem('user', JSON.stringify(user));
      return { session: data.session || {}, user };
    }

    const { data: body } = await api.post('/auth/login/', {
      username: identifier,
      password,
    });
    const user = normalizeUser(body && body.user ? body.user : body);
    if (user && user.is_active === false) {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      const deactErr = new Error('Your account has been deactivated. Please contact an administrator.');
      deactErr.code = 'account_deactivated';
      throw deactErr;
    }
    if (body && body.access) localStorage.setItem('token', body.access);
    if (body && body.refresh) localStorage.setItem('refresh_token', body.refresh);
    localStorage.setItem('user', JSON.stringify(user));
    return { user, access: body.access, refresh: body.refresh, session: body };
  },

  register: async (...args) => {
    let email, password, userData;
    if (args.length >= 3) {
      [email, password, userData] = args;
    } else {
      userData = args[0] || {};
      email = userData.email;
      password = userData.password;
    }
    const payload = {
      email,
      password,
      username: userData.username,
      first_name: userData.first_name || userData.firstName,
      last_name: userData.last_name || userData.lastName,
      role: userData.role || 'recruiter',
      company_id: userData.company_id || null,
      company_code: (userData.company_code || userData.companyCode || '').trim().toUpperCase(),
      companyName: (userData.companyName || '').trim(),
      companySize: userData.companySize || null,
      companyIndustry: userData.companyIndustry || null,
      id_number: (userData.id_number || userData.idNumber || '').trim(),
      employee_id: (userData.employee_id || userData.employeeId || '').trim(),
    };
    if (USE_SUPABASE_AUTH) {
      const { supabase } = await import('./supabaseClient');
      if (!email || !password) throw new Error('Email and password are required.');

      // Check dynamic allow_signup configuration
      try {
        const localOverrides = JSON.parse(localStorage.getItem('qh_system_config_overrides') || '{}');
        const generalCfg = localOverrides.general || {};
        if (generalCfg.allow_signup === false || localStorage.getItem('qh_allow_signup') === 'false') {
          // If public sign up is disabled, only invited recruiters or users with company_code may sign up
          if (payload.role !== 'recruiter' || !payload.company_code) {
            throw new Error('Public registration is currently disabled by system policy. Registration is by invite or authorized company code only.');
          }
        }
      } catch (signupErr) {
        if (signupErr.message && signupErr.message.includes('Public registration')) throw signupErr;
      }

      // Check dynamic password length and complexity rules
      try {
        const localOverrides = JSON.parse(localStorage.getItem('qh_system_config_overrides') || '{}');
        const secCfg = localOverrides.security || {};
        const minLen = Number(secCfg.pwd_min_length) || 6;
        if (password.length < minLen) {
          throw new Error(`Password must be at least ${minLen} characters according to system security policy.`);
        }
        const rules = Array.isArray(secCfg.pwd_rules) ? secCfg.pwd_rules : [];
        if (rules.includes('upper') && !/[A-Z]/.test(password)) {
          throw new Error('Password must contain at least one uppercase letter (A-Z).');
        }
        if (rules.includes('lower') && !/[a-z]/.test(password)) {
          throw new Error('Password must contain at least one lowercase letter (a-z).');
        }
        if (rules.includes('number') && !/\d/.test(password)) {
          throw new Error('Password must contain at least one number (0-9).');
        }
        if (rules.includes('symbol') && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
          throw new Error('Password must contain at least one special symbol (!@#$%...).');
        }
      } catch (pwdErr) {
        if (pwdErr.message && pwdErr.message.includes('Password')) throw pwdErr;
      }

      if (password.length < 6) throw new Error('Password must be at least 6 characters.');

      // --- Recruiter ID Number uniqueness check ---
      if (payload.role === 'recruiter') {
        if (!payload.id_number) {
          throw new Error('South African ID number is required.');
        }
        const cleanedId = String(payload.id_number).trim();
        if (!/^\d{13}$/.test(cleanedId)) {
          throw new Error('Invalid South African ID number: must be exactly 13 numeric digits with no other characters.');
        }
        payload.id_number = cleanedId;

        try {
          const { data: existingIdUsers, error: idErr } = await supabase
            .from('users')
            .select('id, id_number')
            .eq('id_number', payload.id_number)
            .limit(1);
          if (!idErr && existingIdUsers && existingIdUsers.length > 0) {
            throw new Error(`The ID number "${payload.id_number}" is already registered to an existing account.`);
          }
        } catch (chkErr) {
          if (chkErr.message && chkErr.message.includes('already registered')) throw chkErr;
        }

        // Generate simple Employee ID if not provided: EMP-XXXXXX
        if (!payload.employee_id) {
          const rand = Math.floor(100000 + Math.random() * 900000);
          payload.employee_id = `EMP-${rand}`;
        }
      }

      // --- Company Registration & Code lookup ---
      let resolvedCompanyId = payload.company_id || null;
      let finalCompanyCode = payload.company_code || null;
      let finalRegistrationNumber = payload.registration_number ? String(payload.registration_number).trim() : null;

      if (payload.role === 'company') {
        if (!payload.companyName) {
          throw new Error('Company name is required.');
        }

        if (!finalRegistrationNumber) {
          throw new Error('Company ID (CIPC Registration Number) is required.');
        }

        // Validate SA CIPC format: YYYY/NNNNNN/NN (or /CK)
        const cipcRegex = /^(?:19|20)\d{2}\/\d{6}\/(?:06|07|08|21|CK|\d{2})$/i;
        if (!cipcRegex.test(finalRegistrationNumber)) {
          throw new Error('Invalid Company ID format. Must be a valid South African CIPC registration number (e.g. 2021/123456/07).');
        }

        // Always auto-generate simple Company ID: CMP-XXXXXX
        const rand = Math.floor(100000 + Math.random() * 900000);
        finalCompanyCode = `CMP-${rand}`;
        payload.company_code = finalCompanyCode;

        // Check uniqueness of CIPC registration number
        try {
          const { data: existingCipc, error: cipcErr } = await supabase
            .from('companies')
            .select('id, registration_number')
            .eq('registration_number', finalRegistrationNumber)
            .limit(1);
          if (!cipcErr && existingCipc && existingCipc.length > 0) {
            throw new Error(`The Company Registration Number "${finalRegistrationNumber}" is already registered to an existing account.`);
          }
        } catch (cChkErr) {
          if (cChkErr.message && cChkErr.message.includes('already registered')) throw cChkErr;
        }
      } else if (payload.role === 'recruiter') {
        // Look up company by company_code, registration_number, invite OTP, or invite token
        try {
          if (finalCompanyCode) {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalCompanyCode);
            let compQuery = supabase.from('companies').select('id, name, company_code, registration_number');
            if (isUUID) {
              compQuery = compQuery.or(`company_code.eq.${finalCompanyCode},registration_number.eq.${finalCompanyCode},id.eq.${finalCompanyCode}`);
            } else {
              compQuery = compQuery.or(`company_code.eq.${finalCompanyCode},registration_number.eq.${finalCompanyCode}`);
            }
            const { data: matchedComps, error: mErr } = await compQuery.limit(1);
            if (!mErr && matchedComps && matchedComps.length > 0) {
              resolvedCompanyId = matchedComps[0].id;
              payload.company_id = resolvedCompanyId;
              finalCompanyCode = matchedComps[0].company_code || finalCompanyCode;
              payload.companyName = matchedComps[0].name || payload.companyName;
              console.log('[register] Recruiter linked to company:', matchedComps[0].name, resolvedCompanyId);
            }
          }

          // If still not resolved, check pending recruiter invites by email or OTP/token code
          if (!resolvedCompanyId) {
            const cleanEmail = email.trim().toLowerCase();
            const cachedInvites = JSON.parse(localStorage.getItem('qh_company_invites_cache') || '[]');
            const matchingInvite = cachedInvites.find(i => 
              (i.email === cleanEmail || (finalCompanyCode && (i.otp === finalCompanyCode || i.token === finalCompanyCode)))
              && i.company_id
            );
            if (matchingInvite) {
              resolvedCompanyId = matchingInvite.company_id;
              payload.company_id = resolvedCompanyId;
              matchingInvite.status = 'accepted';
              localStorage.setItem('qh_company_invites_cache', JSON.stringify(cachedInvites));
              console.log('[register] Recruiter linked via invite OTP/token:', resolvedCompanyId);
            }
          }
        } catch (findErr) {
          console.warn('[register] company lookup error:', findErr);
        }
      }

      // Pre-check if email or username is already taken in users table
      try {
        const cleanEmail = email.trim().toLowerCase();
        const cleanUsername = (payload.username || email.split('@')[0]).trim().toLowerCase();
        const { data: existingUsers } = await supabase
          .from('users')
          .select('id, email, username')
          .or(`email.ilike.${cleanEmail},username.ilike.${cleanUsername}`)
          .limit(2);

        if (existingUsers && existingUsers.length > 0) {
          const emailMatch = existingUsers.some(u => String(u.email || '').toLowerCase() === cleanEmail);
          if (emailMatch) {
            throw new Error('An account with this email address already exists. Please sign in instead.');
          }
          const usernameMatch = existingUsers.some(u => String(u.username || '').toLowerCase() === cleanUsername);
          if (usernameMatch) {
            throw new Error(`The username "${cleanUsername}" is already taken. Please choose a different username.`);
          }
        }
      } catch (preCheckErr) {
        if (preCheckErr.message && (preCheckErr.message.includes('already exists') || preCheckErr.message.includes('already taken'))) {
          throw preCheckErr;
        }
        console.warn('[register] email/username pre-check non-blocking warn:', preCheckErr);
      }

      const redirectTo = window.location.origin + '/auth/callback';
      const signUpPayload = {
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            username: payload.username,
            first_name: payload.first_name,
            last_name: payload.last_name,
            role: payload.role,
            company_id: resolvedCompanyId,
            company_code: finalCompanyCode,
            company_name: payload.companyName || null,
            registration_number: finalRegistrationNumber,
            id_number: payload.id_number || null,
            employee_id: payload.employee_id || null,
            date_of_birth: payload.date_of_birth || null,
          },
        },
      };
      console.log('[register] calling supabase.auth.signUp with:', { email, role: payload.role, company_code: finalCompanyCode });
      let authData = null;
      let authError = null;
      try {
        const res = await supabase.auth.signUp(signUpPayload);
        authData = res.data;
        authError = res.error;
      } catch (netErr) {
        authError = netErr;
      }
      if (authError) {
        console.error('[register] SUPABASE AUTH ERROR:', authError);
        let rawMsg = '';
        if (typeof authError === 'string') rawMsg = authError;
        else if (typeof authError.message === 'string') rawMsg = authError.message;
        else if (typeof authError.detail === 'string') rawMsg = authError.detail;
        else if (typeof authError.msg === 'string') rawMsg = authError.msg;

        let msg = rawMsg ? rawMsg.trim() : '';
        if (!msg || msg === '{}' || msg === '[]' || msg === '[object Object]') {
          msg = 'An account with this email or username already exists, or registration failed. Please try signing in or use another email.';
        }
        if (authError.code === 'weak_password') msg = 'Password is too weak. Use a stronger password.';
        if (authError.code === 'user_already_registered' || (authError.status === 400 && /already/i.test(msg))) msg = 'An account with this email already exists. Please sign in instead.';
        if (/violates unique constraint.*username/i.test(msg) || /duplicate key.*username/i.test(msg)) {
          msg = 'This username is already taken. Please choose a different username.';
        }
        if (/violates unique constraint.*email/i.test(msg) || /duplicate key.*email/i.test(msg)) {
          msg = 'An account with this email already exists. Please sign in instead.';
        }
        throw new Error(msg);
      }
      console.log('[register] auth user created:', authData?.user?.id);

      if (authData && authData.user) {
        let companyId = resolvedCompanyId;

        if (payload.role === 'company' && payload.companyName) {
          try {
            // Attempt insert with registration_number and company_code
            const compInsertPayload = {
              name: payload.companyName,
              registration_number: finalRegistrationNumber,
              size: payload.companySize || null,
              industry: payload.companyIndustry || null,
              company_code: finalCompanyCode,
            };
            const { data: company, error: companyError } = await supabase
              .from('companies')
              .insert(compInsertPayload)
              .select()
              .single();

            if (!companyError && company) {
              companyId = company.id;
              console.log('[register] company created:', companyId, company.company_code);
            } else if (companyError) {
              console.warn('[register] companies insert full payload warn, retrying base fields:', JSON.stringify(companyError, null, 2));
              // Fallback if registration_number or company_code column doesn't exist yet on remote table
              const { data: compFallback, error: fallbackErr } = await supabase
                .from('companies')
                .insert({
                  name: payload.companyName,
                  size: payload.companySize || null,
                  industry: payload.companyIndustry || null,
                })
                .select()
                .single();
              if (!fallbackErr && compFallback) {
                companyId = compFallback.id;
              }
            }
          } catch (companyExc) {
            console.warn('[register] companies insert exception (continuing):', companyExc);
          }
        }

        // Upsert into users table with all fields: first_name, last_name, company_name, id_number, employee_id, date_of_birth, company_id
        try {
          const userPayload = {
            id: authData.user.id,
            email,
            username: payload.username || email.split('@')[0],
            role: payload.role || 'recruiter',
            first_name: payload.first_name,
            last_name: payload.last_name,
            company_name: payload.companyName || null,
            company_id: companyId,
            id_number: payload.id_number || null,
            employee_id: payload.employee_id || null,
            date_of_birth: payload.date_of_birth || null,
            is_active: true,
          };

          const { error: userUpsertError } = await supabase
            .from('users')
            .upsert(userPayload, { onConflict: 'id' });

          if (userUpsertError) {
            console.warn('[register] users upsert warn (retrying standard fields):', JSON.stringify(userUpsertError, null, 2));
            // Retry without new columns if remote table column not added yet
            await supabase.from('users').upsert({
              id: authData.user.id,
              email,
              username: payload.username || email.split('@')[0],
              role: payload.role || 'recruiter',
              first_name: payload.first_name,
              last_name: payload.last_name,
              company_id: companyId,
              is_active: true,
            }, { onConflict: 'id' });
          } else {
            console.log('[register] users row upserted for id:', authData.user.id);
          }
        } catch (userExc) {
          console.warn('[register] users table upsert exception (continuing):', userExc);
        }

        // Update user_metadata with all fields
        try {
          const { error: metaUpdateErr } = await supabase.auth.updateUser({
            data: {
              username: payload.username || email.split('@')[0],
              first_name: payload.first_name,
              last_name: payload.last_name,
              role: payload.role || 'recruiter',
              company_id: companyId,
              company_code: finalCompanyCode,
              company_name: payload.companyName || null,
              registration_number: finalRegistrationNumber,
              id_number: payload.id_number || null,
              employee_id: payload.employee_id || null,
              date_of_birth: payload.date_of_birth || null,
            },
          });
          if (metaUpdateErr) {
            console.warn('[register] auth user_metadata update warn (continuing):', metaUpdateErr?.message || metaUpdateErr);
          } else {
            console.log('[register] auth user_metadata updated with company_id:', companyId, finalCompanyCode);
          }
        } catch (metaExc) {
          console.warn('[register] auth user_metadata update exception (continuing):', metaExc?.message || metaExc);
        }

        // Return enriched authData with generated fields
        return {
          ...authData,
          company_code: finalCompanyCode,
          registration_number: finalRegistrationNumber,
          employee_id: payload.employee_id,
          id_number: payload.id_number,
          date_of_birth: payload.date_of_birth,
        };
      }
      return authData;
    }
    const { data } = await api.post('/auth/register/', payload);
    return data;
  },

  getProfile: async () => {
    if (USE_SUPABASE_AUTH) {
      const { supabase } = await import('./supabaseClient');
      const { data: userInfo, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!userInfo || !userInfo.user) return null;
      let profile = null;
      try {
        const { data: profiles, error: pErr } = await supabase
          .from('users')
          .select('*, companies(*)')
          .eq('id', userInfo.user.id)
          .limit(1);
        if (pErr) {
          console.warn('[getProfile] users table read warning (falling back to auth user_metadata):', pErr?.code || pErr?.message || pErr);
        } else if (profiles && profiles.length) {
          profile = profiles[0];
        }
      } catch (pExc) {
        console.warn('[getProfile] users table read exception (falling back to auth user_metadata):', pExc?.message || pExc);
      }
      const user = normalizeUser(profile || userInfo.user);
      if (profile && profile.is_active === false) {
        user.is_active = false;
      }
      if (user && !user.company_id && (user.role === 'company' || user.role === 'admin')) {
        try {
          const { ensureCompanyForUser } = await import('./supabaseService');
          user.company_id = await ensureCompanyForUser(user);
        } catch (_) {}
      }
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    }
    try {
      const { data } = await api.get('/auth/profile/');
      const user = normalizeUser(data);
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (_) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try { return JSON.parse(userStr); } catch (_) { return null; }
      }
      return null;
    }
  },

  logout: async () => {
    if (USE_SUPABASE_AUTH) {
      const { supabase } = await import('./supabaseClient');
      try { await supabase.auth.signOut(); } catch (_) {}
    } else {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try { await api.post('/auth/logout/', { refresh }); } catch (_) {}
      }
    }
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('qh_login_attempts');
    return true;
  },

  unlockUser: async (userId) => {
    const { data } = await api.post(`/auth/unlock/${userId}/`);
    return data;
  },

  getSession: async () => {
    if (USE_SUPABASE_AUTH) {
      const { supabase } = await import('./supabaseClient');
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    }
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    if (!token) return null;
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      const user = JSON.parse(userStr);
      return { user, access_token: token, token_type: 'Bearer' };
    } catch {
      return null;
    }
  },

  getUserProfile: async () => {
    return authService.getProfile();
  },

  resetPassword: async (email) => {
    if (USE_SUPABASE_AUTH) {
      const { supabase } = await import('./supabaseClient');
      const cleanEmail = email.trim().toLowerCase();
      const redirectTo = window.location.origin + '/auth/callback';
      
      // 1. Generate a secure 6-digit OTP for reference
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

      // Cache locally for fallback reference
      try {
        const stored = JSON.parse(localStorage.getItem('qh_password_reset_otps') || '{}');
        stored[cleanEmail] = { otp, expiresAt };
        localStorage.setItem('qh_password_reset_otps', JSON.stringify(stored));
      } catch (_) {}

      // 2. Request Supabase to send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
      if (error) {
        console.warn('[resetPassword] Supabase resetPasswordForEmail error:', error);
        const code = String(error.code || '').toLowerCase();
        const msg = String(error.message || '').toLowerCase();
        if (code === 'over_email_send_rate_limit' || msg.includes('rate limit') || msg.includes('after') || error.status === 429) {
          throw new Error('Email rate limit reached for this account. If you recently requested a reset, please check your inbox and spam folder, or wait a few minutes before trying again.');
        }
        throw new Error(error.message || 'Failed to send password reset email. Please verify your email and try again.');
      }

      return { success: true, email: cleanEmail, otp, supabaseSent: true };
    }
    const { data } = await api.post('/auth/reset-password/', { email });
    return data;
  },

  verifyOtpAndResetPassword: async (email, otp, newPassword) => {
    if (USE_SUPABASE_AUTH) {
      const { supabase } = await import('./supabaseClient');
      const cleanEmail = email.trim().toLowerCase();
      const cleanOtp = (otp || '').toString().trim();

      if (!cleanOtp) throw new Error('Recovery code or token is required.');
      if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters.');

      let verifiedSession = false;

      // 1. Try Supabase verifyOtp directly (works with token or recovery code from email)
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanOtp,
          type: 'recovery',
        });
        if (!error && data?.session) {
          verifiedSession = true;
        }
      } catch (vErr) {
        console.warn('[verifyOtpAndResetPassword] Supabase recovery verify note:', vErr?.message || vErr);
      }

      // 2. If recovery token didn't match via verifyOtp, check local OTP cache
      if (!verifiedSession) {
        let validLocalOtp = false;
        try {
          const stored = JSON.parse(localStorage.getItem('qh_password_reset_otps') || '{}');
          const entry = stored[cleanEmail];
          if (entry && String(entry.otp) === cleanOtp) {
            if (Date.now() <= entry.expiresAt) {
              validLocalOtp = true;
              delete stored[cleanEmail];
              localStorage.setItem('qh_password_reset_otps', JSON.stringify(stored));
            } else {
              throw new Error('OTP code has expired. Please request a new one.');
            }
          }
        } catch (storageErr) {
          if (storageErr.message && storageErr.message.includes('expired')) throw storageErr;
        }

        if (!validLocalOtp) {
          throw new Error('Invalid or expired OTP code / token. Please use the reset link sent to your email or request a fresh link.');
        }
      }

      // 3. Update the password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) {
        console.warn('[verifyOtpAndResetPassword] updateUser warning:', updateErr);
        if (updateErr.message?.includes('session') || !verifiedSession) {
          throw new Error('For security, please click the "Reset Password" link sent to your email inbox to verify and update your password.');
        }
        throw new Error(updateErr.message || 'Failed to update password. Please try again.');
      }

      return { success: true, message: 'Password has been reset successfully.' };
    }
    const { data } = await api.post('/auth/verify-reset-password/', { email, otp, new_password: newPassword });
    return data;
  },

  changePassword: async (newPassword) => {
    if (USE_SUPABASE_AUTH) {
      const { supabase } = await import('./supabaseClient');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return true;
    }
    const { data } = await api.post('/auth/change-password/', { new_password: newPassword });
    return data;
  },

  clearLoginAttempts: () => {
    localStorage.removeItem('qh_login_attempts');
  },
};

export const cvService = {
  upload: (formData) => api.post('/upload/cv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getStatus: (taskId) => api.get(`/task/${taskId}/`),
};

export const rankingService = {
  getStats: () => api.get('/dashboard/stats/'),
  getJobs: () => api.get('/jobs/'),
  createJob: (jobData) => api.post('/jobs/', jobData),
  getRankings: (jobId) => api.get(`/ranking/${jobId}/`),
  getCandidate: (id) => api.get(`/candidates/${id}/`),
};

export default api;
