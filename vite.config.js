import { defineConfig, loadEnv } from 'vite';
import evaluateHandler from './api/evaluate.js';
import statsHandler from './api/stats.js';
import activityHandler from './api/activity.js';
import feedbackHandler from './api/feedback.js';

const routes = {
  '/api/evaluate': evaluateHandler,
  '/api/stats': statsHandler,
  '/api/activity': activityHandler,
  '/api/feedback': feedbackHandler
};

export default defineConfig(({ mode }) => {
  // The handlers read process.env, as they do on Vercel, so copy .env.local into it.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    server: {
      port: 5173
    },
    plugins: [
      {
        name: 'vercel-api-dev-server',
        configureServer(server) {
          for (const [path, handler] of Object.entries(routes)) {
            server.middlewares.use(path, async (req, res) => {
              // Mimic the helpers Vercel adds to req and res.
              res.status = (statusCode) => {
                res.statusCode = statusCode;
                return res;
              };
              res.json = (jsonData) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(jsonData));
                return res;
              };
              req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);

              let body = '';
              if (req.method !== 'GET' && req.method !== 'HEAD') {
                for await (const chunk of req) body += chunk;
              }
              try {
                req.body = JSON.parse(body || '{}');
              } catch (e) {
                req.body = {};
              }

              try {
                await handler(req, res);
              } catch (err) {
                console.error(`[API ${path} dev error]`, err);
                if (!res.writableEnded) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message }));
                }
              }
            });
          }
        }
      }
    ]
  };
});
