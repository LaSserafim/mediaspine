// MediaSpine Application Master Entry Point
import { initAuth, supabase } from './auth.js';
import { initBiomechanicalGraphHD } from './graph.js';
import { initScanner } from './scanner.js';
import { loadProgressData, downloadCSV } from './progress.js';
import { renderResultCard, loadCardFonts } from './card.js';
import { I18N } from './i18n.js';

window.currentLang = 'en';

export function applyLanguage(lang) {
  window.currentLang = lang;
  const t = I18N[lang] || I18N.en;

  const setT = (sel, val) => {
    const el = document.querySelector(sel);
    if (el && val != null) el.innerHTML = val;
  };

  const setVal = (sel, val) => {
    const el = document.querySelector(sel);
    if (el && val != null) el.textContent = val;
  };

  setVal('#langToggleBtn', t.langBtn);
  setVal('a[href="#scan"]', t.navScan);
  setVal('a[href="#graph"]', t.navGraph);
  setVal('a[href="#standards"]', t.navStandards);
  setVal('a[href="#progress"]', t.navProgress);
  setVal('a[href="#feedback"]', t.navFeedback);

  setVal('.hero h1', t.heroTitle);
  setVal('.hero .lede', t.heroLede);
  setVal('.hero a[href="#scan"]', t.heroBtnStart);
  setVal('.hero a[href="#graph"]', t.heroBtnGraph);
  setT('.hero-privacy-note', t.heroPrivacy);

  setVal('#scan .section-tag', t.scanEyebrow);
  setVal('#scan h2', t.scanTitle);
  setVal('#scan .section-head p', t.scanDesc);
  setVal('#startBtn', t.btnStartCam);
  setVal('#snapshotBtn', t.btnSnapshot);

  setVal('#graph .section-tag', t.graphEyebrow);
  setVal('#graph h2', t.graphTitle);
  setVal('#graph .section-head p', t.graphDesc);
  setVal('#canvasScanNotice', t.graphNotice);

  setVal('#standards .section-tag', t.standardsEyebrow);
  setVal('#standards h2', t.standardsTitle);
  setVal('#standards .section-head p', t.standardsDesc);

  const stdCards = document.querySelectorAll('.standard-card');
  if (stdCards[0]) {
    stdCards[0].querySelector('h3').textContent = t.s1Title;
    stdCards[0].querySelector('p').textContent = t.s1Desc;
  }
  if (stdCards[1]) {
    stdCards[1].querySelector('h3').textContent = t.s2Title;
    stdCards[1].querySelector('p').textContent = t.s2Desc;
  }
  if (stdCards[2]) {
    stdCards[2].querySelector('h3').textContent = t.s3Title;
    stdCards[2].querySelector('p').textContent = t.s3Desc;
  }
  if (stdCards[3]) {
    stdCards[3].querySelector('h3').textContent = t.s4Title;
    stdCards[3].querySelector('p').textContent = t.s4Desc;
  }

  setVal('#feedback .section-tag', t.fbEyebrow);
  setVal('#feedback h2', t.fbTitle);
  setVal('#feedback .section-head p', t.fbDesc);
  setVal('label[for="fbName"]', t.fbName);
  setVal('label[for="fbEmail"]', t.fbEmail);
  setVal('label[for="fbMsg"]', t.fbMsg);
  setVal('#feedbackForm button[type="submit"]', t.fbBtn);

  setVal('#progress .section-tag', t.progEyebrow);
  setVal('#progress h2', t.progTitle);
  setVal('#progress .section-head p', t.progDesc);
  setVal('#progress .chart-header h3', t.readingsOverTime);

  const presets = document.querySelectorAll('.presets-row .preset-btn');
  if (presets[0]) presets[0].textContent = t.preset0;
  if (presets[1]) presets[1].textContent = t.preset15;
  if (presets[2]) presets[2].textContent = t.preset30;
  if (presets[3]) presets[3].textContent = t.preset45;
  if (presets[4]) presets[4].textContent = t.preset60;

  if (typeof window.renderBiomechanicalGraph === 'function') {
    window.renderBiomechanicalGraph();
  }

  loadProgressData();
}

window.toggleLanguage = function() {
  applyLanguage(window.currentLang === 'en' ? 'id' : 'en');
};

// Feedback form
function initFeedbackForm() {
  const fbForm = document.getElementById('feedbackForm');
  const fbSuccess = document.getElementById('feedbackSuccess');
  if (!fbForm) return;

  fbForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = fbForm.querySelector('button[type="submit"]');
    const name = document.getElementById('fbName')?.value || '';
    const email = document.getElementById('fbEmail')?.value || '';
    const message = document.getElementById('fbMsg')?.value || '';
    if (!message.trim()) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending…';
    }

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() })
      });
      if (!res.ok) {
        throw new Error('Service unavailable');
      }
      fbForm.style.display = 'none';
      if (fbSuccess) fbSuccess.classList.add('show');
    } catch (err) {
      window.showAuthToast?.('Unable to deliver feedback at this time. Please check your connection.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Send feedback';
      }
    }
  });
}

// Public Route (Hash #/r/<id>)
async function handleSharedRoute() {
  const hash = window.location.hash || '';
  const sharedView = document.getElementById('sharedResultView');
  const mainElements = document.querySelectorAll('header.hero, #scan, #graph, #standards, #feedback, footer');

  if (hash.startsWith('#/r/')) {
    const id = hash.slice(4).split('?')[0].trim();
    const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!id || !validId) return;

    mainElements.forEach((el) => { el.style.display = 'none'; });
    document.body.classList.add('shared-view');
    if (sharedView) sharedView.style.display = 'block';
    window.scrollTo(0, 0);

    const cardContent = document.getElementById('sharedCardContent');
    const cardExpired = document.getElementById('sharedCardExpired');
    const publicCanvas = document.getElementById('sharedPublicCanvas');

    let resultData = null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('shared_results')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) {
          resultData = {
            id: data.id,
            score: data.score,
            severity: data.severity,
            neck_deviation: data.neck_deviation,
            shoulder_tilt: data.shoulder_tilt,
            head_tilt: data.head_tilt,
            shoulder_stability: data.shoulder_stability,
            head_stability: data.head_stability,
            summary: data.summary,
            scanned_at: data.created_at
          };
        }
      } catch (err) {}
    }

    if (resultData && publicCanvas) {
      if (cardContent) cardContent.style.display = 'block';
      if (cardExpired) cardExpired.style.display = 'none';
      loadCardFonts().then(() => renderResultCard(publicCanvas, resultData));
    } else {
      if (cardContent) cardContent.style.display = 'none';
      if (cardExpired) cardExpired.style.display = 'block';
    }
  } else {
    if (sharedView) sharedView.style.display = 'none';
    document.body.classList.remove('shared-view');
    mainElements.forEach((el) => { el.style.display = ''; });
  }
}

// Initializing application
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initBiomechanicalGraphHD();
  initScanner();
  initFeedbackForm();
  loadProgressData();
  applyLanguage('en');

  window.addEventListener('hashchange', handleSharedRoute);
  handleSharedRoute();

  const csvBtn = document.getElementById('csvBtn');
  if (csvBtn) csvBtn.onclick = downloadCSV;
});
