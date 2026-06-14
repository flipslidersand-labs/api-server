import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { loadKeysFromEnv } from '../utils/cryptoKeys.js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost',
  process.env.SUPABASE_KEY || 'placeholder'
);

const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

let keys;
try {
  keys = loadKeysFromEnv();
} catch (err) {
  console.warn('RS256 keys not configured, falling back to HS256. Set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY for RS256 mode.');
}

function signAccess(payload) {
  return keys
    ? jwt.sign(payload, keys.privateKey, { expiresIn: '15m', algorithm: 'RS256' })
    : jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function signRefresh(payload) {
  return keys
    ? jwt.sign(payload, keys.privateKey, { expiresIn: '30d', algorithm: 'RS256' })
    : jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '30d' });
}

class AuthService {
  async login(email, password) {
    if (!email || !password) {
      throw Object.assign(new Error('Email and password are required'), { code: 'VALIDATION_ERROR', status: 400 });
    }

    let userId, userRole, userName;

    if (supabaseConfigured) {
      // Verify credentials via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError || !authData.user) {
        throw Object.assign(new Error('Invalid email or password'), { code: 'INVALID_CREDENTIALS', status: 401 });
      }
      userId = authData.user.id;

      // Fetch role + profile from custom users table
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', userId)
        .single();
      if (error || !user) {
        throw Object.assign(new Error('User profile not found'), { code: 'NOT_FOUND', status: 404 });
      }
      userRole = user.role ?? 'viewer';
      userName = user.name;
    } else {
      // Dev fallback: look up by email only (no password check — Supabase not configured)
      console.warn('[AuthService] SUPABASE not configured — skipping password verification (dev mode)');
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('email', email)
        .single();
      if (error || !user) {
        throw Object.assign(new Error('User not found'), { code: 'INVALID_CREDENTIALS', status: 401 });
      }
      userId = user.id;
      userRole = user.role ?? 'viewer';
      userName = user.name;
    }

    const accessToken = signAccess({ user_id: userId, email, role: userRole });
    const refreshToken = signRefresh({ user_id: userId });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 900,
      user: { id: userId, name: userName, email, role: userRole },
    };
  }

  async register(email, password, name) {
    if (!email || !password || !name) {
      throw Object.assign(new Error('email, password and name are required'), { code: 'VALIDATION_ERROR', status: 400 });
    }
    if (password.length < 8) {
      throw Object.assign(new Error('Password must be at least 8 characters'), { code: 'VALIDATION_ERROR', status: 400 });
    }

    if (!supabaseConfigured) {
      throw Object.assign(new Error('Registration requires Supabase to be configured'), { code: 'SERVICE_UNAVAILABLE', status: 503 });
    }

    const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      const status = signUpError.message?.includes('already') ? 409 : 400;
      throw Object.assign(new Error(signUpError.message), { code: 'REGISTRATION_FAILED', status });
    }

    // Insert into custom users table (role defaults to viewer)
    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({ id: authData.user.id, name, email, role: 'viewer', created_at: new Date().toISOString() })
      .select('id, name, email, role')
      .single();
    if (insertError) {
      throw Object.assign(new Error('Failed to create user profile'), { code: 'REGISTRATION_FAILED', status: 500 });
    }

    const accessToken = signAccess({ user_id: user.id, email, role: user.role });
    const refreshToken = signRefresh({ user_id: user.id });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 900,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async refreshToken(token) {
    let decoded;
    try {
      decoded = keys
        ? jwt.verify(token, keys.publicKey)
        : jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    } catch {
      throw Object.assign(new Error('Invalid or expired refresh token'), { code: 'INVALID_TOKEN', status: 401 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('role, email')
      .eq('id', decoded.user_id)
      .single();
    if (error || !user) {
      throw Object.assign(new Error('User not found'), { code: 'INVALID_TOKEN', status: 401 });
    }

    return {
      access_token: signAccess({ user_id: decoded.user_id, email: user.email, role: user.role }),
      token_type: 'Bearer',
      expires_in: 900,
    };
  }

  async getMe(userId) {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at')
      .eq('id', userId)
      .single();
    if (error || !user) {
      throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND', status: 404 });
    }
    return user;
  }
}

export default new AuthService();
