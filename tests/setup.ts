// Runs before test files import any lib module. lib/llm.ts reads its model
// config at import time, so the chain must be pinned here, not in tests.
process.env.LLM_API_KEY = "test-key";
process.env.LLM_BASE_URL = "http://llm.test/v1";
process.env.LLM_MODEL = "primary-model";
process.env.LLM_FALLBACK_MODELS = "fallback-a,fallback-b";
process.env.FIRECRAWL_API_KEY = "firecrawl-test-key";
