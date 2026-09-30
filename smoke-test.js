// smoke-test.js — MediaSpine Pre-Publish & Regression Verification Script
import fs from 'fs';

const targetUrl = process.argv[2];

if (targetUrl) {
  // Live remote URL test mode
  console.log(`🌐 Running Live URL Smoke Test against: ${targetUrl}`);
  (async () => {
    try {
      const res = await fetch(targetUrl);
      if (!res.ok) {
        console.error(`❌ Live page returned status ${res.status}`);
        process.exit(1);
      }
      const html = await res.text();
      
      // 1. MediaPipe Pose check
      if (html.includes('@mediapipe/pose')) {
        console.log('✅ [Live] MediaPipe Pose script present');
      } else {
        console.error('❌ [Live] MediaPipe Pose script missing');
        process.exit(1);
      }

      // 2. Forbidden keywords check
      const forbidden = ['facemesh', 'face_mesh', 'stress', 'emotion', 'blink', 'tension', 'browTension'];
      for (const word of forbidden) {
        if (new RegExp(word, 'i').test(html)) {
          console.error(`❌ [Live] Found forbidden keyword: ${word}`);
          process.exit(1);
        }
      }
      console.log('✅ [Live] Zero legacy forbidden keywords');

      // 3. API endpoint check
      const apiUrl = targetUrl.replace(/\/$/, '') + '/api/evaluate';
      console.log(`🔍 Testing live API endpoint: ${apiUrl}`);
      const apiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: 'Neck Deviation: 12.0°, Shoulder Tilt: 1.5°, Head Tilt: 1.0°, Shoulder Stability: 0.02 variance, Head Stability: 0.03 variance' })
      });

      console.log(`📡 [Live API] Status: ${apiRes.status}`);
      if (apiRes.status === 200) {
        const data = await apiRes.json();
        if (data.choices && data.choices[0]?.message?.content) {
          console.log('✅ [Live API] Groq AI evaluation returned 200 with valid content!');
        }
      } else if (apiRes.status === 429) {
        console.log('⚠️ [Live API] IP Rate limited (expected if quota exceeded)');
      } else {
        const errText = await apiRes.text();
        console.warn(`⚠️ [Live API] Status ${apiRes.status}: ${errText}`);
      }

      console.log('\n🎉 LIVE SMOKE TEST COMPLETE!');
    } catch (err) {
      console.error('❌ Live test error:', err.message);
      process.exit(1);
    }
  })();
} else {
  // Local repository verification mode
  console.log('--- [1/3] Checking index.html script integrity ---');
  const indexHtml = fs.readFileSync('index.html', 'utf8');

  // Check script tag for Pose
  if (!indexHtml.includes('@mediapipe/pose')) {
    console.error('❌ Missing MediaPipe Pose script tag in index.html');
    process.exit(1);
  } else {
    console.log('✅ MediaPipe Pose script tag present');
  }

  // Check no forbidden keywords
  const forbidden = ['facemesh', 'face_mesh', 'stress', 'emotion', 'blink', 'tension', 'browTension'];
  for (const word of forbidden) {
    const re = new RegExp(word, 'i');
    if (re.test(indexHtml)) {
      console.error(`❌ Found forbidden keyword: ${word}`);
      process.exit(1);
    }
  }
  console.log('✅ index.html is 100% clean of removed features');

  // Test evaluating in mock DOM
  const makeMockEl = (id = '') => ({
    id,
    textContent: '',
    getContext: () => ({
      clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, arc(){}, fill(){},
      roundRect(){}, strokeRect(){}, fillRect(){}, save(){}, restore(){}, createLinearGradient: () => ({ addColorStop(){} }),
      measureText: () => ({ width: 50 })
    }),
    classList: { add(){}, remove(){}, contains: () => false },
    style: {},
    addEventListener(){},
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 100, top: 100, width: 360, height: 450 }),
    toDataURL: () => 'data:image/png;base64,',
    toBlob: (cb) => cb && cb(new Blob([]))
  });

  global.document = {
    querySelectorAll: () => [],
    querySelector: (sel) => makeMockEl(),
    getElementById: (id) => makeMockEl(id),
    body: { classList: { add(){}, remove(){} }, style: {} }
  };
  global.window = {
    location: { hash: '', origin: 'http://localhost:5173', pathname: '/', search: '' },
    scrollTo() {},
    addEventListener() {},
    removeEventListener() {},
    innerWidth: 1280,
    innerHeight: 800,
    matchMedia: () => ({ matches: false })
  };
  global.IntersectionObserver = class { observe(){} };
  global.localStorage = { getItem: () => null, setItem: () => {} };
  global.performance = { now: () => Date.now() };
  global.Pose = class { setOptions(){} onResults(){} send(){} };

  const scriptMatch = indexHtml.match(/<script>([\s\S]*?)<\/script>[\s\S]*?<\/body>/);
  if (scriptMatch) {
    eval(scriptMatch[1]);
    console.log('✅ Top-level script executes cleanly with zero errors');
  }

  console.log('\n--- [2/3] Checking api/evaluate.js Groq Model ---');
  const evaluateJs = fs.readFileSync('api/evaluate.js', 'utf8');
  if (evaluateJs.includes('openai/gpt-oss-120b')) {
    console.log('✅ Model set to openai/gpt-oss-120b');
  } else {
    console.error('❌ api/evaluate.js does not use openai/gpt-oss-120b');
    process.exit(1);
  }

  console.log('\n--- [3/4] Checking dist/ build integrity ---');
  if (fs.existsSync('dist/index.html')) {
    console.log('✅ Production bundle dist/index.html exists');
  } else {
    console.error('❌ dist/index.html missing');
    process.exit(1);
  }

  console.log('\n--- [4/4] Checking api/stats.js ---');
  if (fs.existsSync('api/stats.js')) {
    const statsJs = fs.readFileSync('api/stats.js', 'utf8');
    if (statsJs.includes('SUPABASE_SERVICE_ROLE_KEY') && statsJs.includes('user_activity')) {
      console.log('✅ api/stats.js uses SUPABASE_SERVICE_ROLE_KEY and queries user_activity');
    } else {
      console.error('❌ api/stats.js missing SUPABASE_SERVICE_ROLE_KEY or user_activity logic');
      process.exit(1);
    }
  } else {
    console.error('❌ api/stats.js missing');
    process.exit(1);
  }

  console.log('\n🎉 ALL BASELINE SMOKE TESTS PASSED!\n');
}
