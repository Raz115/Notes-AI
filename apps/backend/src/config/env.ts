import "dotenv/config";

/**
 * Centralized environment configuration.
 *
 * All AI provider secrets and database credentials live only here, on the
 * backend. The browser must never receive them (technical-requirements.md
 * section 30).
 */

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "8787")),

  // Supabase / Postgres (wired up in Phase 6 - Authentication and Cloud).
  supabaseUrl: optional("SUPABASE_URL"),
  supabaseServiceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY"),

  // AI provider (wired up behind the AIProvider abstraction in Phase 8).
  aiProvider: optional("AI_PROVIDER", "gemini"),
  geminiApiKey: optional("GEMINI_API_KEY"),
  anthropicApiKey: optional("ANTHROPIC_API_KEY"),

  // CORS
  corsOrigin: optional("CORS_ORIGIN", "http://localhost:5173"),
};

export function isProduction(): boolean {
  return env.nodeEnv === "production";
}
