import { defineConfig, loadEnv } from 'vite';
import evaluateHandler from './api/evaluate.js';
import statsHandler from './api/stats.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 5173
    },
    plugins: [
      {
        name: 'vercel-api-dev-server',
        configureServer(server) {
          // Helper to mock Vercel serverless response helpers
          const attachHelpers = (res) => {
            res.status = (statusCode) => {
              res.statusCode = statusCode;
              return res;
            };
            res.json = (jsonData) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(jsonData));
              return res;
            };
          };

          // /api/evaluate middleware
          server.middlewares.use('/api/evaluate', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                req.body = JSON.parse(body || '{}');
              } catch (e) {
                req.body = {};
              }

              attachHelpers(res);

              if (!process.env.GROQ_API_KEY && env.GROQ_API_KEY) {
                process.env.GROQ_API_KEY = env.GROQ_API_KEY;
              }

              try {
                await evaluateHandler(req, res);
              } catch (err) {
                console.error('[API evaluate dev error]', err);
                if (!res.writableEnded) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message }));
                }
              }
            });
          });

          // /api/stats and /api/activity middleware
          const handleStats = async (req, res) => {
            attachHelpers(res);
            if (!process.env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY) {
              process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
            }
            try {
              await statsHandler(req, res);
            } catch (err) {
              console.error('[API stats dev error]', err);
              if (!res.writableEnded) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            }
          };

          server.middlewares.use('/api/stats', handleStats);
          server.middlewares.use('/api/activity', handleStats);
        }
      }
    ]
  };
});
