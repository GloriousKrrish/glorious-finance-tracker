# GloriousFinance Engineering Guidelines

This repository contains the hardened enterprise codebase for GloriousFinance private wealth management platform.

## Security & Architecture Guidelines
1. **Least Privilege & RLS**: All Supabase table accesses are governed by Row Level Security (RLS) bound to authenticated user sessions (`auth.uid()`).
2. **Secrets & Environment Safety**: Never commit secrets or credentials. Use `.env.example` as the canonical template.
3. **Browser Security**: Server responses in `src/server.ts` enforce CSP, HSTS, X-Frame-Options, and nosniff headers.
