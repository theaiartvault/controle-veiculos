// ===== Controle de Veículos — Portaria =====

const STORAGE_KEY = 'cv_registros_v1';
const NOMES_KEY   = 'cv_nomes_v1';

let state   = { tipo: 'morador', torre: null };
let docMode = 'informar';
let niMotivoSel = null;

// ── Persistência ──────────────────────────────────────────────
function loadRegistros()  { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function saveRegistros(l) { localStorage.setItem(STORAGE_KEY, JSON.stringify(l)); }
function loadNomes()      { try { return JSON.parse(localStorage.getItem(NOMES_KEY))   || {}; } catch { return {}; } }
function saveNomes(m)     { localStorage.setItem(NOMES_KEY, JSON.stringify(m)); }

// ── Helpers ───────────────────────────────────────────────────
function pad(n)           { return n.toString().padStart(2, '0'); }
function formatHora(ts)   { const d=new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function formatData(ts)   { const d=new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
function formatDataHora(ts){ return `${formatData(ts)} ${formatHora(ts)}`; }
function fmtCurto(ts)     { const d=new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function isSameDay(t1,t2) { const a=new Date(t1),b=new Date(t2); return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function diffDuration(s,e){ const m=Math.round((e-s)/60000); return m<60?`${m}min`:`${Math.floor(m/60)}h${m%60>0?pad(m%60)+'min':''}`; }
function uid()            { return 'r'+Date.now()+Math.random().toString(36).slice(2,7); }
function normalizePlaca(r){ return r.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7); }
function isPlacaValida(p) { return /^[A-Z]{3}[0-9]{4}$/.test(p)||/^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(p); }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ── Tabs ──────────────────────────────────────────────────────
const tabEls   = document.querySelectorAll('.tab');
const sections = {
  novo:      document.getElementById('tab-novo'),
  dentro:    document.getElementById('tab-dentro'),
  historico: document.getElementById('tab-historico'),
};
tabEls.forEach(tab => {
  tab.addEventListener('click', () => {
    tabEls.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    Object.values(sections).forEach(s => s.style.display = 'none');
    sections[tab.dataset.tab].style.display = '';
    if (tab.dataset.tab === 'dentro')    renderDentro();
    if (tab.dataset.tab === 'historico') renderHistorico();
  });
});

// ── Tipo de entrada ───────────────────────────────────────────
const segTipo      = document.getElementById('segTipo');
const formPadrao   = document.getElementById('formPadrao');
const formNaoIdent = document.getElementById('formNaoIdent');
const docBlock     = document.getElementById('docBlock');
const docInput     = document.getElementById('docInput');

function tipoExigeDoc(t) { return t === 'visitante' || t === 'prestador'; }

function updateDocBlock() {
  docBlock.style.display = tipoExigeDoc(state.tipo) ? '' : 'none';
  if (!tipoExigeDoc(state.tipo)) docInput.value = '';
  validateForm();
}

segTipo.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    segTipo.querySelectorAll('button').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    state.tipo = btn.dataset.val;

    if (state.tipo === 'naoident') {
      formPadrao.style.display   = 'none';
      formNaoIdent.style.display = '';
    } else {
      formPadrao.style.display   = '';
      formNaoIdent.style.display = 'none';
      const ph = { morador:'Nome do morador', visitante:'Nome do visitante', prestador:'Nome do prestador / empresa' };
      document.getElementById('nomeInput').placeholder = ph[state.tipo];
      docMode = 'informar';
      document.getElementById('docBtnInformar').classList.add('on');
      document.getElementById('docBtnNao').classList.remove('on');
      docInput.style.display = '';
      docInput.value = '';
      updateDocBlock();
    }
  });
});

// Documento toggle
document.getElementById('docBtnInformar').addEventListener('click', () => {
  docMode = 'informar';
  document.getElementById('docBtnInformar').classList.add('on');
  document.getElementById('docBtnNao').classList.remove('on');
  docInput.style.display = '';
  docInput.focus();
  validateForm();
});
document.getElementById('docBtnNao').addEventListener('click', () => {
  docMode = 'nao';
  document.getElementById('docBtnNao').classList.add('on');
  document.getElementById('docBtnInformar').classList.remove('on');
  docInput.value = '';
  docInput.style.display = 'none';
  validateForm();
});
docInput.addEventListener('input', validateForm);

// ── Torre ─────────────────────────────────────────────────────
const torreGrid = document.getElementById('torreGrid');
for (let i = 1; i <= 9; i++) {
  const b = document.createElement('button');
  b.className = 'torre-btn';
  b.textContent = i;
  b.dataset.val = i;
  b.addEventListener('click', () => {
    torreGrid.querySelectorAll('.torre-btn').forEach(x => x.classList.remove('on'));
    state.torre = (state.torre === i) ? null : i;
    if (state.torre) { b.classList.add('on'); checkSuggestNome(); }
    validateForm();
  });
  torreGrid.appendChild(b);
}

// ── Sugestão de nome ──────────────────────────────────────────
const aptoInput  = document.getElementById('aptoInput');
const nomeInput  = document.getElementById('nomeInput');
const suggestBox = document.getElementById('suggestBox');

function checkSuggestNome() {
  suggestBox.innerHTML = '';
  if (!state.torre || !aptoInput.value) return;
  const lista = (loadNomes()[`${state.torre}-${aptoInput.value}`] || []);
  lista.slice(0, 3).forEach(nome => {
    const div = document.createElement('div');
    div.className = 'suggest-item';
    div.innerHTML = `<span>Torre ${state.torre}, Apto ${aptoInput.value}</span><b>${nome}</b>`;
    div.addEventListener('click', () => { nomeInput.value = nome; suggestBox.innerHTML = ''; validateForm(); });
    suggestBox.appendChild(div);
  });
}
aptoInput.addEventListener('input', () => { checkSuggestNome(); validateForm(); });

function rememberNome(torre, apto, nome) {
  if (!torre || !apto || !nome) return;
  const nomes = loadNomes();
  const key   = `${torre}-${apto}`;
  let lista   = nomes[key] || [];
  lista = [nome, ...lista.filter(n => n.toLowerCase() !== nome.toLowerCase())].slice(0, 5);
  nomes[key] = lista;
  saveNomes(nomes);
}

// ── Placa (form padrão) ───────────────────────────────────────
const placaInput = document.getElementById('placaInput');
const placaHint  = document.getElementById('placaHint');
placaInput.addEventListener('input', () => {
  placaInput.value = normalizePlaca(placaInput.value);
  const v = placaInput.value;
  if (v.length === 7) {
    placaHint.textContent = isPlacaValida(v) ? '✓ placa válida' : 'formato não reconhecido — confira';
    placaHint.style.color = isPlacaValida(v) ? 'var(--ok)' : 'var(--warn)';
  } else {
    placaHint.textContent = 'Aceita formato antigo e Mercosul';
    placaHint.style.color = 'var(--muted)';
  }
  validateForm();
});

// ── Validação form padrão ─────────────────────────────────────
const submitBtn = document.getElementById('submitBtn');
function validateForm() {
  if (state.tipo === 'naoident') return;
  const base  = state.torre && aptoInput.value.trim() && nomeInput.value.trim() && placaInput.value.length >= 6;
  const docOk = !tipoExigeDoc(state.tipo) || docMode === 'nao' || docInput.value.trim().length >= 3;
  submitBtn.disabled = !(base && docOk);
}
nomeInput.addEventListener('input', validateForm);

// ── Registrar entrada (form padrão) ───────────────────────────
submitBtn.addEventListener('click', () => {
  const torre = state.torre;
  const apto  = aptoInput.value.trim();
  const nome  = nomeInput.value.trim();
  const placa = placaInput.value.trim();
  let documento = null;
  if (tipoExigeDoc(state.tipo))
    documento = docMode === 'nao' ? 'Não informado' : docInput.value.trim();

  const reg = { id: uid(), tipo: state.tipo, torre, apto, nome, placa, documento, obs: null, entrada: Date.now(), saida: null };
  const list = loadRegistros();
  list.unshift(reg);
  saveRegistros(list);
  rememberNome(torre, apto, nome);
  showToast(`✓ ${placa} registrada — Torre ${torre}, Apto ${apto}`);

  // reset
  state.torre = null;
  torreGrid.querySelectorAll('.torre-btn').forEach(x => x.classList.remove('on'));
  aptoInput.value = '';
  nomeInput.value = '';
  placaInput.value = '';
  placaHint.textContent = 'Aceita formato antigo e Mercosul';
  placaHint.style.color = 'var(--muted)';
  docInput.value = '';
  suggestBox.innerHTML = '';
  docMode = 'informar';
  document.getElementById('docBtnInformar').classList.add('on');
  document.getElementById('docBtnNao').classList.remove('on');
  docInput.style.display = '';
  validateForm();
  updateCounts();
});

// ── Não identificado: chips ───────────────────────────────────
document.getElementById('niMotivos').querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.getElementById('niMotivos').querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    niMotivoSel = chip.dataset.m;
    validateNI();
  });
});

// ── Placa NI ─────────────────────────────────────────────────
const niPlacaInput = document.getElementById('niPlacaInput');
const niPlacaHint  = document.getElementById('niPlacaHint');
niPlacaInput.addEventListener('input', () => {
  niPlacaInput.value = normalizePlaca(niPlacaInput.value);
  const v = niPlacaInput.value;
  if (v.length === 7) {
    niPlacaHint.textContent = isPlacaValida(v) ? '✓ placa válida' : 'formato não reconhecido';
    niPlacaHint.style.color = isPlacaValida(v) ? 'var(--ok)' : 'var(--warn)';
  } else {
    niPlacaHint.textContent = 'Aceita formato antigo e Mercosul';
    niPlacaHint.style.color = 'var(--muted)';
  }
});

const niSubmitBtn = document.getElementById('niSubmitBtn');
function validateNI() { niSubmitBtn.disabled = !niMotivoSel; }

niSubmitBtn.addEventListener('click', () => {
  const placa = niPlacaInput.value.trim();
  const obs   = document.getElementById('niObsInput').value.trim();
  const reg = {
    id: uid(), tipo: 'naoident',
    placa:     placa || null,
    motivo:    niMotivoSel,
    obs:       obs || null,
    torre: null, apto: null, nome: null, documento: null,
    entrada: Date.now(), saida: null,
  };
  const list = loadRegistros();
  list.unshift(reg);
  saveRegistros(list);
  showToast('⚠️ Entrada não identificada registrada');

  // reset
  niPlacaInput.value = '';
  niPlacaHint.textContent = 'Aceita formato antigo e Mercosul';
  niPlacaHint.style.color = 'var(--muted)';
  document.getElementById('niObsInput').value = '';
  document.getElementById('niMotivos').querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
  niMotivoSel = null;
  validateNI();
  updateCounts();
});

// ── Renderizar: No pátio ──────────────────────────────────────
function renderDentro(filter = '') {
  const list = loadRegistros().filter(r => !r.saida);
  const f    = filter.trim().toUpperCase();
  const fil  = f ? list.filter(r =>
    (r.placa||'').includes(f) ||
    String(r.torre||'').includes(f) ||
    String(r.apto||'').includes(f) ||
    (r.nome||'').toUpperCase().includes(f) ||
    (r.motivo||'').toUpperCase().includes(f)
  ) : list;
  const c = document.getElementById('listDentro');
  c.innerHTML = '';
  if (!fil.length) {
    c.innerHTML = `<div class="list-empty"><span class="big">🅿️</span>${f?'Nada encontrado.':'Nenhum veículo no pátio agora.'}</div>`;
    return;
  }
  fil.forEach(r => c.appendChild(buildCard(r, true)));
}

// ── Renderizar: Histórico ─────────────────────────────────────
function renderHistorico(filter = '') {
  const list = loadRegistros();
  const f    = filter.trim().toUpperCase();
  const fil  = f ? list.filter(r =>
    (r.placa||'').includes(f) ||
    String(r.torre||'').includes(f) ||
    String(r.apto||'').includes(f) ||
    (r.nome||'').toUpperCase().includes(f) ||
    (r.motivo||'').toUpperCase().includes(f)
  ) : list;
  const c = document.getElementById('listHistorico');
  c.innerHTML = '';
  if (!fil.length) {
    c.innerHTML = `<div class="list-empty"><span class="big">📋</span>${f?'Nada encontrado.':'Nenhum registro ainda.'}</div>`;
    return;
  }
  let lastDay = null;
  fil.forEach(r => {
    const dl = formatData(r.entrada);
    if (dl !== lastDay) {
      const div = document.createElement('div');
      div.className = 'day-divider';
      div.textContent = isSameDay(r.entrada, Date.now()) ? `Hoje · ${dl}` : dl;
      c.appendChild(div);
      lastDay = dl;
    }
    c.appendChild(buildCard(r, false));
  });
}

// ── Card ─────────────────────────────────────────────────────
function buildCard(r, showSaidaBtn) {
  const isNI = r.tipo === 'naoident';
  const card = document.createElement('div');
  card.className = 'card' + (r.saida ? ' saiu' : '') + (isNI ? ' card-ni' : '');

  const tag = document.createElement('div');
  const icones = { morador:'🏠', visitante:'🚪', prestador:'🔧', naoident:'⚠️' };
  tag.className   = `tag ${r.tipo}`;
  tag.textContent = icones[r.tipo] || '🚗';
  card.appendChild(tag);

  const body = document.createElement('div');
  body.className = 'body';

  // Linha 1: placa + hora
  const row1 = document.createElement('div');
  row1.className = 'row1';
  const placaLabel = isNI ? (r.placa || 'SEM PLACA') : r.placa;
  row1.innerHTML = `<span class="placa">${placaLabel}</span><span class="hora">${formatHora(r.entrada)}</span>`;
  body.appendChild(row1);

  // Meta
  const meta = document.createElement('div');
  meta.className = 'meta';
  if (isNI) {
    meta.innerHTML = `<b style="color:var(--warn)">${r.motivo}</b>`;
  } else {
    meta.innerHTML = `Torre <b>${r.torre}</b> · Apto <b>${r.apto}</b> · <b>${r.nome}</b>`;
  }
  body.appendChild(meta);

  // Documento (visitante/prestador)
  if (r.documento) {
    const de = document.createElement('div');
    de.style.cssText = 'margin-top:4px;';
    const ni = r.documento === 'Não informado';
    de.innerHTML = `<span class="doc-badge${ni?' nao-info':''}">Doc: ${r.documento}</span>`;
    body.appendChild(de);
  }

  // Observação
  if (r.obs) {
    const obsEl = document.createElement('div');
    obsEl.className = 'obs-line';
    obsEl.textContent = `💬 ${r.obs}`;
    body.appendChild(obsEl);
  }

  // Status
  const sl = document.createElement('div');
  if (r.saida) {
    sl.className   = 'status-line';
    sl.textContent = `Saiu às ${formatHora(r.saida)} · ficou ${diffDuration(r.entrada, r.saida)}`;
  } else if (isNI) {
    sl.className   = 'status-line alerta';
    sl.textContent = '⚠️ não identificado · no pátio';
  } else {
    sl.className   = 'status-line dentro';
    sl.textContent = '● no pátio';
  }
  body.appendChild(sl);
  card.appendChild(body);

  if (showSaidaBtn && !r.saida) {
    const btn = document.createElement('button');
    btn.className   = 'btn-saida';
    btn.textContent = 'Marcar saída';
    btn.addEventListener('click', () => marcarSaida(r.id));
    card.appendChild(btn);
  }
  return card;
}

function marcarSaida(id) {
  const list = loadRegistros();
  const idx  = list.findIndex(r => r.id === id);
  if (idx === -1) return;
  list[idx].saida = Date.now();
  saveRegistros(list);
  showToast(`✓ Saída registrada — ${list[idx].placa || 'veículo não identificado'}`);
  renderDentro(document.getElementById('searchDentro').value);
  updateCounts();
}

// ── Buscas ────────────────────────────────────────────────────
document.getElementById('searchDentro').addEventListener('input',    e => renderDentro(e.target.value));
document.getElementById('searchHistorico').addEventListener('input', e => renderHistorico(e.target.value));

// ── Contador ─────────────────────────────────────────────────
function updateCounts() {
  document.getElementById('countDentro').textContent = loadRegistros().filter(r => !r.saida).length;
}

// ── Limpar ────────────────────────────────────────────────────
document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Apagar todos os registros salvos neste dispositivo? Essa ação não pode ser desfeita.')) {
    saveRegistros([]);
    renderHistorico(); renderDentro(); updateCounts();
    showToast('Registros apagados.');
  }
});

// ── Exportar PDF ──────────────────────────────────────────────
document.getElementById('exportPdfBtn').addEventListener('click', () => {
  const list = loadRegistros();
  if (!list.length) { showToast('Nenhum registro para exportar.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const mx  = 40;
  let y = 50;

  // ── Cabeçalho do relatório ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20);
  doc.text('Relatório de Controle de Veículos', mx, y); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100);
  doc.text('Condomínio Viva Mais Barueri · Portaria', mx, y); y += 14;
  doc.text(`Gerado em ${formatDataHora(Date.now())}`, mx, y); y += 24;
  doc.setDrawColor(200); doc.line(mx, y, pw - mx, y); y += 18;

  // ── Layout de colunas ──
  // A4 útil: 595 - 40*2 = 515pt
  // Tipo(50) Torre(28) Apto(28) Denom(140) Doc(90) Placa(54) Entrada(62) Saída(63) = 515
  const col = {
    tipo:    mx,          // 50pt de largura
    torre:   mx + 50,     // 28pt
    apto:    mx + 78,     // 28pt
    denom:   mx + 106,    // 140pt  ← "Denominação"
    doc:     mx + 246,    // 90pt
    placa:   mx + 336,    // 54pt
    entrada: mx + 390,    // 62pt
    saida:   mx + 452,    // até 555 (63pt)
  };
  // Larguras máximas para splitTextToSize em cada coluna
  const maxW = {
    tipo:   48, torre: 26, apto: 26,
    denom: 138, doc:   88, placa: 52,
    entrada: 60, saida: 62,
  };

  const LINE_H  = 11;  // altura de cada linha de texto (pt)
  const ROW_PAD = 5;   // espaço extra entre linhas de registro

  function drawHeader() {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(40);
    doc.text('Tipo',         col.tipo,    y);
    doc.text('Torre',        col.torre,   y);
    doc.text('Apto',         col.apto,    y);
    doc.text('Denominação',  col.denom,   y);
    doc.text('Doc.',         col.doc,     y);
    doc.text('Placa',        col.placa,   y);
    doc.text('Entrada',      col.entrada, y);
    doc.text('Saída',        col.saida,   y);
    y += 8;
    doc.setDrawColor(200); doc.line(mx, y, pw - mx, y); y += 12;
  }
  drawHeader();

  const tipoLabel = { morador:'Morador', visitante:'Visitante', prestador:'Prestador', naoident:'Não ident.' };
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(20);

  list.slice().reverse().forEach(r => {
    const isNI = r.tipo === 'naoident';

    // Textos de cada célula — sem truncamento, com quebra controlada
    const denomStr  = isNI
      ? (r.motivo || '—')
      : (r.nome   || '—');
    const placaStr  = r.placa || (isNI ? 'S/ PLACA' : '—');
    const docStr    = r.documento || '—';
    const entradaStr= fmtCurto(r.entrada);
    const saidaStr  = r.saida ? fmtCurto(r.saida) : '— pátio';
    const obsStr    = r.obs || null;  // linha extra de descrição, quando existir

    // Quebrar textos que podem ser longos
    const denomLines  = doc.splitTextToSize(denomStr,  maxW.denom);
    const docLines    = doc.splitTextToSize(docStr,     maxW.doc);
    const placaLines  = doc.splitTextToSize(placaStr,   maxW.placa);
    const entradaLines= doc.splitTextToSize(entradaStr, maxW.entrada);
    const saidaLines  = doc.splitTextToSize(saidaStr,   maxW.saida);
    const obsLines    = obsStr ? doc.splitTextToSize(`* ${obsStr}`, pw - mx * 2) : [];

    // Altura da linha: o campo mais alto determina
    const mainLines = Math.max(
      denomLines.length, docLines.length,
      placaLines.length, entradaLines.length, saidaLines.length, 1
    );
    const rowH = mainLines * LINE_H + (obsLines.length > 0 ? obsLines.length * 10 + 4 : 0) + ROW_PAD;

    // Virar de página se necessário
    if (y + rowH > 760) { doc.addPage(); y = 50; drawHeader(); }

    // Renderizar cada célula alinhada ao topo da linha
    doc.text(tipoLabel[r.tipo] || r.tipo,         col.tipo,    y);
    doc.text(r.torre ? String(r.torre) : '—',     col.torre,   y);
    doc.text(r.apto  ? String(r.apto)  : '—',     col.apto,    y);
    doc.text(denomLines,                           col.denom,   y);
    doc.text(docLines,                             col.doc,     y);
    doc.text(placaLines,                           col.placa,   y);
    doc.text(entradaLines,                         col.entrada, y);
    doc.text(saidaLines,                           col.saida,   y);

    // Linha de descrição (obs), quando houver, em itálico logo abaixo
    if (obsLines.length > 0) {
      const obsY = y + mainLines * LINE_H + 2;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(100);
      doc.text(obsLines, col.denom, obsY);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(20);
    }

    y += rowH;
  });

  doc.save(`controle-veiculos-${formatData(Date.now()).replace(/\//g,'-')}.pdf`);
  showToast('✓ PDF gerado — verifique os downloads');
});

// ── Online/offline ────────────────────────────────────────────
function updateOnlineStatus() {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  if (navigator.onLine) { pill.classList.remove('offline'); text.textContent = 'online'; }
  else { pill.classList.add('offline'); text.textContent = 'offline · salvando local'; }
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ── PWA Install ───────────────────────────────────────────────
let deferredPrompt;
const installBar = document.getElementById('installBar');
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  if (!localStorage.getItem('cv_install_dismissed')) installBar.classList.remove('hidden');
});
document.getElementById('installBtn').addEventListener('click', async () => {
  installBar.classList.add('hidden');
  if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; }
});
document.getElementById('installClose').addEventListener('click', () => {
  installBar.classList.add('hidden');
  localStorage.setItem('cv_install_dismissed', '1');
});

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator)
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

// ── Init ──────────────────────────────────────────────────────
updateOnlineStatus();
updateCounts();
validateForm();
