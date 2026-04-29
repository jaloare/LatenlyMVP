const LatenlyConfig = {
    API_BASE: "https://api.latenly.com",
    POLL_INTERVAL_MS: 3000,
    POLL_MAX_ATTEMPTS: 60,

    // Supabase
    SUPABASE_URL: "https://ifrwbnvdflbrswwvloae.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_ZBKvI9mmLp0bdDBj0O-jLQ_BHV0sgeu"
};

// Export to window for global access
window.LatenlyConfig = LatenlyConfig;
