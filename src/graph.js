// MediaSpine Biomechanical Cervical Load Graph & Hansraj Model Simulator
import gsap from 'gsap';

export function initBiomechanicalGraphHD() {
  const canvas = document.getElementById('cervicalGraphCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const canvasBox = document.getElementById('graphCanvasBox');
  const tooltip = document.getElementById('graphTooltip');

  const slider = document.getElementById('angleSlider');
  const angleDisplay = document.getElementById('sliderAngleDisplay');
  const loadVal = document.getElementById('graphLoadVal');
  const loadKg = document.getElementById('graphLoadKg');
  const loadTag = document.getElementById('graphLoadTag');
  const explanation = document.getElementById('graphExplanation');
  const presetBtns = document.querySelectorAll('.preset-btn');

  const state = { angle: 0, measuredScanAngle: null };
  window.__cervicalGraphState = state;

  function calculateLoad(deg) {
    return 11 * (1 + 4.5 * Math.sin((deg * Math.PI) / 180));
  }

  let displayW = 620;
  let displayH = 380;

  function resizeToHD() {
    const dpr = Math.max(2, Math.min(window.devicePixelRatio || 1, 3));
    const rect = canvasBox ? canvasBox.getBoundingClientRect() : canvas.getBoundingClientRect();
    displayW = Math.round(rect.width || 620);
    displayH = Math.round(rect.height || 380);

    const targetW = Math.round(displayW * dpr);
    const targetH = Math.round(displayH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  let isHovering = false;
  let hoverAngle = 0;
  let isDragging = false;

  function renderGraph() {
    resizeToHD();
    ctx.clearRect(0, 0, displayW, displayH);

    const padX = 54;
    const padRight = 54;
    const padY = 32;
    const graphW = displayW - padX - padRight;
    const graphH = displayH - padY - 50;

    const isId = typeof window.currentLang !== 'undefined' && window.currentLang === 'id';
    const zones = [
      { from: 0, to: 15, fill: 'rgba(13, 148, 136, 0.045)', label: 'Optimal', short: isId ? 'Bagus' : 'Good', color: '#0F766E' },
      { from: 15, to: 30, fill: 'rgba(180, 83, 9, 0.04)', label: isId ? 'Tegang ringan' : 'Mild strain', short: isId ? 'Ringan' : 'Mild', color: '#B45309' },
      { from: 30, to: 45, fill: 'rgba(194, 65, 12, 0.04)', label: isId ? 'Beban sedang' : 'Moderate', short: isId ? 'Sedang' : 'Mod.', color: '#C2410C' },
      { from: 45, to: 60, fill: 'rgba(185, 28, 28, 0.045)', label: isId ? 'Beban berat' : 'Severe', short: isId ? 'Berat' : 'Severe', color: '#B91C1C' }
    ];

    for (const z of zones) {
      const x1 = padX + (z.from / 60) * graphW;
      const x2 = padX + (z.to / 60) * graphW;
      ctx.fillStyle = z.fill;
      ctx.fillRect(x1, padY, x2 - x1, graphH);

      const fit = [[z.label, 11], [z.label, 9.5], [z.short, 9.5]].find(([text, px]) => {
        ctx.font = `600 ${px}px Inter, sans-serif`;
        return ctx.measureText(text).width <= x2 - x1 - 4;
      });
      if (fit) {
        ctx.fillStyle = z.color;
        ctx.textAlign = 'center';
        ctx.fillText(fit[0], x1 + (x2 - x1) / 2, padY + 14);
      }
    }

    // Horizontal Force Grid Lines (10 to 60 lbs)
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 0.75;
    ctx.setLineDash([]);
    ctx.font = '500 10.5px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'right';

    for (let lbs = 10; lbs <= 60; lbs += 10) {
      const y = padY + graphH - ((lbs - 10) / 50) * graphH;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(padX + graphW, y);
      ctx.stroke();
      ctx.fillText(`${lbs} lbs`, padX - 8, y + 3.5);
    }

    // Vertical Degree Lines (0° to 60°)
    ctx.textAlign = 'center';
    for (let deg = 0; deg <= 60; deg += 15) {
      const x = padX + (deg / 60) * graphW;
      ctx.beginPath();
      ctx.moveTo(x, padY);
      ctx.lineTo(x, padY + graphH);
      ctx.stroke();
      ctx.fillText(`${deg}°`, x, padY + graphH + 18);
    }

    const refPins = [
      { deg: 0, text: isId ? 'Netral' : 'Neutral' },
      { deg: 15, text: isId ? 'Layar' : 'Desktop' },
      { deg: 30, text: isId ? 'Laptop' : 'Laptop' },
      { deg: 45, text: isId ? 'HP' : 'Phone' },
      { deg: 60, text: isId ? 'Bungkuk' : 'Slump' }
    ];
    ctx.font = '500 10.5px Inter, sans-serif';
    ctx.fillStyle = '#64748B';
    for (const p of refPins) {
      const px = padX + (p.deg / 60) * graphW;
      ctx.fillText(p.text, px, padY + graphH + 32);
    }

    // Smooth Continuous Curve (Hansraj Biomechanics)
    const steps = 240;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * 60;
      const lbs = calculateLoad(d);
      pts.push({ x: padX + (d / 60) * graphW, y: padY + graphH - ((lbs - 10) / 50) * graphH });
    }

    const curve = new Path2D();
    curve.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const cx = (pts[i].x + pts[i + 1].x) / 2;
      const cy = (pts[i].y + pts[i + 1].y) / 2;
      curve.quadraticCurveTo(pts[i].x, pts[i].y, cx, cy);
    }
    curve.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

    const area = new Path2D(curve);
    area.lineTo(padX + graphW, padY + graphH);
    area.lineTo(padX, padY + graphH);
    area.closePath();
    const grad = ctx.createLinearGradient(0, padY, 0, padY + graphH);
    grad.addColorStop(0, 'rgba(13, 148, 136, 0.2)');
    grad.addColorStop(0.6, 'rgba(13, 148, 136, 0.05)');
    grad.addColorStop(1, 'rgba(13, 148, 136, 0.00)');
    ctx.fillStyle = grad;
    ctx.fill(area);

    ctx.strokeStyle = '#0D9488';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke(curve);

    // Hover Scanning Ray
    if (isHovering && hoverAngle >= 0 && hoverAngle <= 60) {
      const hX = padX + (hoverAngle / 60) * graphW;
      const hLbs = calculateLoad(hoverAngle);
      const hY = padY + graphH - ((hLbs - 10) / 50) * graphH;

      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(13, 148, 136, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hX, padY);
      ctx.lineTo(hX, padY + graphH);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(padX, hY);
      ctx.lineTo(hX, hY);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(20, 184, 166, 0.35)';
      ctx.beginPath();
      ctx.arc(hX, hY, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#14B8A6';
      ctx.beginPath();
      ctx.arc(hX, hY, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Active Interactive Marker
    const curX = padX + (state.angle / 60) * graphW;
    const curLbs = calculateLoad(state.angle);
    const curY = padY + graphH - ((curLbs - 10) / 50) * graphH;

    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(13, 148, 136, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(curX, padY + graphH);
    ctx.lineTo(curX, curY);
    ctx.lineTo(padX, curY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(13, 148, 136, 0.22)';
    ctx.beginPath();
    ctx.arc(curX, curY, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F766E';
    ctx.beginPath();
    ctx.arc(curX, curY, 7.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(curX, curY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    const badgeW = 96;
    const badgeH = 22;
    const badgeX = Math.max(padX + 2, Math.min(padX + graphW - badgeW - 2, curX - badgeW / 2));
    const badgeY = Math.max(padY + 18, curY - 26);

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY - 14, badgeW, badgeH, 4);
    ctx.fill();

    ctx.font = '600 10.5px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#2DD4BF';
    ctx.textAlign = 'center';
    ctx.fillText(`${curLbs.toFixed(1)} lbs · ${state.angle.toFixed(0)}°`, badgeX + badgeW / 2, badgeY + 1);

    // Measured Scan Marker
    if (state.measuredScanAngle != null) {
      const sAngle = Math.max(0, Math.min(60, state.measuredScanAngle));
      const sX = padX + (sAngle / 60) * graphW;
      const sLbs = calculateLoad(sAngle);
      const sY = padY + graphH - ((sLbs - 10) / 50) * graphH;

      ctx.fillStyle = 'rgba(217, 119, 6, 0.25)';
      ctx.beginPath();
      ctx.arc(sX, sY, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.arc(sX, sY, 7.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sX, sY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#D97706';
      ctx.textAlign = 'left';
      ctx.fillText(`Your Scan (${state.measuredScanAngle.toFixed(1)}°)`, sX + 10, sY - 6);
    }
  }

  function updateReadouts(deg) {
    state.angle = deg;
    const lbs = calculateLoad(deg);
    const kg = (lbs * 0.453592).toFixed(1);
    const mult = (lbs / 11.0).toFixed(1);

    if (angleDisplay) angleDisplay.textContent = `${deg.toFixed(0)}°`;
    if (loadVal) loadVal.textContent = `${lbs.toFixed(1)} lbs`;
    if (loadKg) loadKg.textContent = `${kg} kg at ${deg.toFixed(1)}° forward tilt`;

    const isId = typeof window.currentLang !== 'undefined' && window.currentLang === 'id';
    if (loadTag) {
      if (deg <= 5) {
        loadTag.textContent = isId ? `Garis Lurus Netral (${mult}x)` : `Neutral Plumb Line (${mult}x)`;
        loadTag.style.background = '#CCFBF1';
        loadTag.style.color = '#0F766E';
      } else if (deg <= 20) {
        loadTag.textContent = isId ? `Ketegangan Otot Ringan (${mult}x)` : `Mild Muscular Strain (${mult}x)`;
        loadTag.style.background = '#FEF3C7';
        loadTag.style.color = '#B45309';
      } else if (deg <= 40) {
        loadTag.textContent = isId ? `Beban Mekanis Sedang (${mult}x)` : `Moderate Mechanical Overload (${mult}x)`;
        loadTag.style.background = '#FFEDD5';
        loadTag.style.color = '#C2410C';
      } else {
        loadTag.textContent = isId ? `Kompresi Servikal Berat (${mult}x)` : `Severe Cervical Compression (${mult}x)`;
        loadTag.style.background = '#FEE2E2';
        loadTag.style.color = '#B91C1C';
      }
    }

    if (explanation) {
      if (isId) {
        if (deg <= 5) {
          explanation.textContent = 'Pada 0 derajat, kepala bertumpu seimbang di atas bahu, hanya memberikan beban alami sekitar 5 kg pada tulang leher.';
        } else if (deg <= 20) {
          explanation.textContent = `Pada ${deg.toFixed(0)} derajat, lengan momen tuas servikal meningkatkan beban gravitasi kepala menjadi ${lbs.toFixed(1)} lbs (${kg} kg), menuntut kontraksi isometrik terus-menerus dari otot leher dan trapezius.`;
        } else if (deg <= 40) {
          explanation.textContent = `Pada ${deg.toFixed(0)} derajat, beban kepala mencapai ${lbs.toFixed(1)} lbs (${kg} kg, ${mult}x lipat dari normal). Posisi kronis ini memicu kelelahan otot dan perubahan postur.`;
        } else {
          explanation.textContent = `Pada ${deg.toFixed(0)} derajat, gaya kompresi mencapai ${lbs.toFixed(1)} lbs (${kg} kg) pada vertebra C1 hingga C7, menyebabkan tekanan regangan berat pada ligamen leher belakang.`;
        }
      } else {
        if (deg <= 5) {
          explanation.textContent = 'At 0 degrees, the head sits balanced over the shoulders, exerting only its resting mass of 10 to 12 pounds on the cervical spine.';
        } else if (deg <= 20) {
          explanation.textContent = `At ${deg.toFixed(0)} degrees, the cervical lever arm increases head gravitational load to ${lbs.toFixed(1)} lbs, requiring continuous compensatory isometric contraction from the upper trapezius and levator scapulae.`;
        } else if (deg <= 40) {
          explanation.textContent = `At ${deg.toFixed(0)} degrees, head load reaches ${lbs.toFixed(1)} lbs (${mult}x baseline). This chronic position accelerates cervical muscle fatigue and forward postural adaptation.`;
        } else {
          explanation.textContent = `At ${deg.toFixed(0)} degrees, compressive forces reach ${lbs.toFixed(1)} lbs on C1 to C7 vertebrae, generating severe shear strain across posterior cervical ligaments and thoracic erectors.`;
        }
      }
    }
    renderGraph();
  }

  function setAngleSmooth(targetDeg) {
    gsap.to(state, {
      angle: targetDeg,
      overwrite: true,
      duration: 0.5,
      ease: 'power2.out',
      onUpdate: () => {
        if (slider) slider.value = state.angle;
        updateReadouts(state.angle);
      }
    });
  }

  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      updateReadouts(val);
      presetBtns.forEach(btn => {
        btn.classList.toggle('active', parseFloat(btn.dataset.angle) === val);
      });
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const deg = parseFloat(btn.dataset.angle);
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setAngleSmooth(deg);
    });
  });

  function handleGraphPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const padX = 54;
    const padRight = 54;
    const graphW = displayW - padX - padRight;
    const rawFrac = (clientX - padX) / graphW;
    const clampedFrac = Math.max(0, Math.min(1, rawFrac));
    hoverAngle = clampedFrac * 60;
    const hLbs = calculateLoad(hoverAngle);
    const hKg = (hLbs * 0.453592).toFixed(1);
    const mult = (hLbs / 11.0).toFixed(1);

    if (isDragging) {
      updateReadouts(hoverAngle);
      if (slider) slider.value = hoverAngle;
    }

    if (tooltip) {
      tooltip.innerHTML = `<strong>${hoverAngle.toFixed(1)}° Tilt</strong><br>Load: ${hLbs.toFixed(1)} lbs (${hKg} kg)<br>${mult}x baseline compressive force`;
      const tooltipX = Math.max(70, Math.min(displayW - 70, clientX));
      const tooltipY = Math.max(34, clientY - 18);
      tooltip.style.left = `${tooltipX}px`;
      tooltip.style.top = `${tooltipY}px`;
      tooltip.style.opacity = '1';
    }

    renderGraph();
  }

  canvas.addEventListener('pointerenter', () => {
    isHovering = true;
    if (tooltip) tooltip.style.opacity = '1';
  });
  canvas.addEventListener('pointerleave', () => {
    isHovering = false;
    isDragging = false;
    if (tooltip) tooltip.style.opacity = '0';
    renderGraph();
  });
  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    handleGraphPointer(e);
  });
  window.addEventListener('pointerup', () => {
    isDragging = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    handleGraphPointer(e);
  });

  new ResizeObserver(() => renderGraph()).observe(canvasBox || canvas);
  if (document.fonts) document.fonts.ready.then(renderGraph);

  updateReadouts(0);
  window.renderBiomechanicalGraph = renderGraph;
  window.updateBiomechanicalGraphScan = function(measuredAngle) {
    state.measuredScanAngle = measuredAngle;
    renderGraph();
    setAngleSmooth(Math.min(60, measuredAngle));
  };
}
