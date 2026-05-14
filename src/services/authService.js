import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { loadKeysFromEnv } from '../utils/cryptoKeys.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

let keys;
try {
  keys = loadKeysFromEnv();
} catch (err) {
  console.warn('RS256 keys not configured, falling back to HS256. Set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY for RS256 mode.');
}

class AuthService {
  async login(email, password) {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      throw new Error('User not found');
    }

    // Use RS256 (asymmetric) if keys configured, else fallback to HS256 (symmetric)
    const accessToken = keys
      ? jwt.sign(
          {
            user_id: user.id,
            email: user.email,
            role: user.role
          },
          keys.privateKey,
          { expiresIn: '7d', algorithm: 'RS256' }
        )
      : jwt.sign(
          {
            user_id: user.id,
            email: user.email,
            role: user.role
          },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

    const refreshToken = keys
      ? jwt.sign(
          { user_id: user.id },
          keys.privateKey,
          { expiresIn: '30d', algorithm: 'RS256' }
        )
      : jwt.sign(
          { user_id: user.id },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '30d' }
        );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    };
  }

  async refreshToken(refreshToken) {
    try {
      // Verify with appropriate key based on algorithm
      const decoded = keys
        ? jwt.verify(refreshToken, keys.publicKey)
        : jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      const { data: user, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', decoded.user_id)
        .single();

      if (error || !user) {
        throw new Error('User not found');
      }

      const newAccessToken = keys
        ? jwt.sign(
            {
              user_id: decoded.user_id,
              role: user.role
            },
            keys.privateKey,
            { expiresIn: '7d', algorithm: 'RS256' }
          )
        : jwt.sign(
            {
              user_id: decoded.user_id,
              role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
          );

      return { access_token: newAccessToken };
    } catch (err) {
      throw new Error('Invalid refresh token');
    }
  }
}

export default new AuthService();
