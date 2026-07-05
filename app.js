// ===== Controle de Veículos — Portaria v3 =====

const STORAGE_KEY  = 'cv_registros_v1';
const NOMES_KEY    = 'cv_nomes_v1';
const OC_KEY       = 'cv_ocorrencias_v1';
const OC_SEQ_KEY   = 'cv_oc_seq_v1';

let state = { tipo: 'morador', torre: null };
let docMode = 'informar';
let niMotivoSel = null;
let ocMotivoSel = null;

// ── Persistência ──────────────────────────────────────────────
function loadRegistros()  { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))  || []; } catch { return []; } }
function saveRegistros(l) { localStorage.setItem(STORAGE_KEY, JSON.stringify(l)); }
function loadNomes()      { try { return JSON.parse(localStorage.getItem(NOMES_KEY))    || {}; } catch { return {}; } }
function saveNomes(m)     { localStorage.setItem(NOMES_KEY, JSON.stringify(m)); }
function loadOcorrencias(){ try { return JSON.parse(localStorage.getItem(OC_KEY))       || []; } catch { return []; } }
function saveOcorrencias(l){ localStorage.setItem(OC_KEY, JSON.stringify(l)); }
function nextOcSeq() {
  const n = (parseInt(localStorage.getItem(OC_SEQ_KEY) || '0') + 1);
  localStorage.setItem(OC_SEQ_KEY, n);
  return String(n).padStart(4, '0');
}

// ── Helpers ───────────────────────────────────────────────────
function pad(n) { return n.toString().padStart(2, '0'); }
function formatHora(ts)     { const d=new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function formatData(ts)     { const d=new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
function formatDataHora(ts) { return `${formatData(ts)} ${formatHora(ts)}`; }
function fmtCurto(ts)       { const d=new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function isSameDay(t1,t2)   { const a=new Date(t1),b=new Date(t2); return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function diffDuration(s,e)  { const m=Math.round((e-s)/60000); if(m<60) return `${m}min`; const h=Math.floor(m/60),r=m%60; return `${h}h${r>0?pad(r)+'min':''}`; }
function uid()              { return 'r'+Date.now()+Math.random().toString(36).slice(2,7); }
function normalizePlaca(r)  { return r.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7); }
function isPlacaValida(p)   { return /^[A-Z]{3}[0-9]{4}$/.test(p) || /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(p); }

function showToast(msg, color) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = color || 'var(--accent)';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ── Tabs ──────────────────────────────────────────────────────
const tabEls = document.querySelectorAll('.tab');
const sections = {
  novo:        document.getElementById('tab-novo'),
  dentro:      document.getElementById('tab-dentro'),
  historico:   document.getElementById('tab-historico'),
  ocorrencias: document.getElementById('tab-ocorrencias'),
};
tabEls.forEach(tab => {
  tab.addEventListener('click', () => {
    tabEls.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    Object.values(sections).forEach(s => s.style.display = 'none');
    sections[tab.dataset.tab].style.display = '';
    if (tab.dataset.tab === 'dentro')      renderDentro();
    if (tab.dataset.tab === 'historico')   renderHistorico();
    if (tab.dataset.tab === 'ocorrencias') renderOcorrencias();
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
      document.getElementById('nomeInput').placeholder = ph[state.tipo] || 'Nome';
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
  const nomes = loadNomes();
  const lista = nomes[`${state.torre}-${aptoInput.value}`];
  if (lista && lista.length) {
    lista.slice(0, 3).forEach(nome => {
      const div = document.createElement('div');
      div.className = 'suggest-item';
      div.innerHTML = `<span>Torre ${state.torre}, Apto ${aptoInput.value}</span><b>${nome}</b>`;
      div.addEventListener('click', () => { nomeInput.value = nome; suggestBox.innerHTML = ''; validateForm(); });
      suggestBox.appendChild(div);
    });
  }
}
aptoInput.addEventListener('input', () => { checkSuggestNome(); validateForm(); });

function rememberNome(torre, apto, nome) {
  if (!torre || !apto || !nome) return;
  const nomes = loadNomes();
  const key = `${torre}-${apto}`;
  let lista = nomes[key] || [];
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
  if (state.tipo === 'naoident') return; // tem validação própria
  const base = state.torre && aptoInput.value.trim() && nomeInput.value.trim() && placaInput.value.length >= 6;
  const docOk = !tipoExigeDoc(state.tipo) || docMode === 'nao' || docInput.value.trim().length >= 3;
  submitBtn.disabled = !(base && docOk);
}
nomeInput.addEventListener('input', validateForm);

// ── Registrar entrada (form padrão) ──────────────────────────
submitBtn.addEventListener('click', () => {
  const torre    = state.torre;
  const apto     = aptoInput.value.trim();
  const nome     = nomeInput.value.trim();
  const placa    = placaInput.value.trim();
  const obs      = document.getElementById('obsInput').value.trim();
  let documento  = null;
  if (tipoExigeDoc(state.tipo)) {
    documento = docMode === 'nao' ? 'Não informado' : docInput.value.trim();
  }

  const reg = { id: uid(), tipo: state.tipo, torre, apto, nome, placa, documento, obs, entrada: Date.now(), saida: null };
  const list = loadRegistros();
  list.unshift(reg);
  saveRegistros(list);
  rememberNome(torre, apto, nome);
  showToast(`✓ ${placa || nome} registrado — Torre ${torre}, Apto ${apto}`);

  // reset
  state.torre = null;
  torreGrid.querySelectorAll('.torre-btn').forEach(x => x.classList.remove('on'));
  aptoInput.value = '';
  nomeInput.value = '';
  placaInput.value = '';
  placaHint.textContent = 'Aceita formato antigo e Mercosul';
  placaHint.style.color = 'var(--muted)';
  docInput.value = '';
  document.getElementById('obsInput').value = '';
  suggestBox.innerHTML = '';
  docMode = 'informar';
  document.getElementById('docBtnInformar').classList.add('on');
  document.getElementById('docBtnNao').classList.remove('on');
  docInput.style.display = '';
  validateForm();
  updateCounts();
});

// ── Não identificado: chips de motivo ─────────────────────────
document.getElementById('niMotivos').querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.getElementById('niMotivos').querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    niMotivoSel = chip.dataset.m;
    validateNI();
  });
});

// ── Placa não identificado ────────────────────────────────────
const niPlacaInput = document.getElementById('niPlacaInput');
const niPlacaHint  = document.getElementById('niPlacaHint');
niPlacaInput.addEventListener('input', () => {
  niPlacaInput.value = normalizePlaca(niPlacaInput.value);
  const v = niPlacaInput.value;
  if (v.length === 7) {
    niPlacaHint.textContent = isPlacaValida(v) ? '✓ placa válida' : 'formato não reconhecido';
    niPlacaHint.style.color = isPlacaValida(v) ? 'var(--ok)' : 'var(--warn)';
  } else {
    niPlacaHint.textContent = 'Deixe em branco se não conseguiu ver a placa';
    niPlacaHint.style.color = 'var(--muted)';
  }
  validateNI();
});
document.getElementById('niObsInput').addEventListener('input', validateNI);

const niSubmitBtn = document.getElementById('niSubmitBtn');
function validateNI() {
  // precisa de pelo menos: motivo selecionado
  niSubmitBtn.disabled = !niMotivoSel;
}
validateNI();

niSubmitBtn.addEventListener('click', () => {
  const placa = niPlacaInput.value.trim();
  const obs   = document.getElementById('niObsInput').value.trim();
  const reg = {
    id: uid(), tipo: 'naoident',
    placa: placa || 'NÃO IDENTIFICADO',
    motivo: niMotivoSel, obs,
    torre: null, apto: null, nome: null, documento: null,
    entrada: Date.now(), saida: null,
  };
  const list = loadRegistros();
  list.unshift(reg);
  saveRegistros(list);
  showToast('⚠️ Entrada não identificada registrada', 'var(--warn)');

  // reset
  niPlacaInput.value = '';
  niPlacaHint.textContent = 'Deixe em branco se não conseguiu ver a placa';
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
  const f = filter.trim().toUpperCase();
  const filtered = f
    ? list.filter(r => (r.placa||'').includes(f) || String(r.torre||'').includes(f) || String(r.apto||'').includes(f) || (r.nome||'').toUpperCase().includes(f))
    : list;
  const c = document.getElementById('listDentro');
  c.innerHTML = '';
  if (!filtered.length) {
    c.innerHTML = `<div class="list-empty"><span class="big">🅿️</span>${f ? 'Nada encontrado.' : 'Nenhum veículo no pátio agora.'}</div>`;
    return;
  }
  filtered.forEach(r => c.appendChild(buildCard(r, true)));
}

// ── Renderizar: Histórico ─────────────────────────────────────
function renderHistorico(filter = '') {
  const list = loadRegistros();
  const f = filter.trim().toUpperCase();
  const filtered = f
    ? list.filter(r => (r.placa||'').includes(f) || String(r.torre||'').includes(f) || String(r.apto||'').includes(f) || (r.nome||'').toUpperCase().includes(f) || (r.motivo||'').toUpperCase().includes(f))
    : list;
  const c = document.getElementById('listHistorico');
  c.innerHTML = '';
  if (!filtered.length) {
    c.innerHTML = `<div class="list-empty"><span class="big">📋</span>${f ? 'Nada encontrado.' : 'Nenhum registro ainda.'}</div>`;
    return;
  }
  let lastDay = null;
  filtered.forEach(r => {
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

// ── Card de registro ──────────────────────────────────────────
function buildCard(r, showSaidaBtn) {
  const isNI = r.tipo === 'naoident';
  const card = document.createElement('div');
  card.className = 'card' + (r.saida ? ' saiu' : '') + (isNI ? ' card-ni' : '');

  const tag = document.createElement('div');
  const icones = { morador:'🏠', visitante:'🚪', prestador:'🔧', naoident:'⚠️' };
  tag.className = `tag ${r.tipo}`;
  tag.textContent = icones[r.tipo] || '🚗';
  card.appendChild(tag);

  const body = document.createElement('div');
  body.className = 'body';

  const row1 = document.createElement('div');
  row1.className = 'row1';
  row1.innerHTML = `<span class="placa">${r.placa || 'SEM PLACA'}</span><span class="hora">${formatHora(r.entrada)}</span>`;
  body.appendChild(row1);

  const meta = document.createElement('div');
  meta.className = 'meta';
  if (isNI) {
    meta.innerHTML = `<b style="color:var(--warn)">${r.motivo || 'Não identificado'}</b>`;
  } else {
    meta.innerHTML = `Torre <b>${r.torre}</b> · Apto <b>${r.apto}</b> · <b>${r.nome}</b>`;
  }
  body.appendChild(meta);

  if (r.documento) {
    const de = document.createElement('div');
    de.style.cssText = 'margin-top:4px;';
    const ni = r.documento === 'Não informado';
    de.innerHTML = `<span class="doc-badge${ni?' nao-info':''}">Doc: ${r.documento}</span>`;
    body.appendChild(de);
  }

  if (r.obs) {
    const obsEl = document.createElement('div');
    obsEl.className = 'obs-line';
    obsEl.textContent = `💬 ${r.obs}`;
    body.appendChild(obsEl);
  }

  const statusLine = document.createElement('div');
  if (r.saida) {
    statusLine.className = 'status-line';
    statusLine.textContent = `Saiu às ${formatHora(r.saida)} · ficou ${diffDuration(r.entrada, r.saida)}`;
  } else if (isNI) {
    statusLine.className = 'status-line alerta';
    statusLine.textContent = '⚠️ não identificado · no pátio';
  } else {
    statusLine.className = 'status-line dentro';
    statusLine.textContent = '● no pátio';
  }
  body.appendChild(statusLine);
  card.appendChild(body);

  if (showSaidaBtn && !r.saida) {
    const btn = document.createElement('button');
    btn.className = 'btn-saida';
    btn.textContent = 'Marcar saída';
    btn.addEventListener('click', () => marcarSaida(r.id));
    card.appendChild(btn);
  }
  return card;
}

function marcarSaida(id) {
  const list = loadRegistros();
  const idx = list.findIndex(r => r.id === id);
  if (idx === -1) return;
  list[idx].saida = Date.now();
  saveRegistros(list);
  showToast(`✓ Saída registrada — ${list[idx].placa}`);
  renderDentro(document.getElementById('searchDentro').value);
  updateCounts();
}

// ── Buscas ────────────────────────────────────────────────────
document.getElementById('searchDentro').addEventListener('input',    e => renderDentro(e.target.value));
document.getElementById('searchHistorico').addEventListener('input', e => renderHistorico(e.target.value));

// ── Contadores ────────────────────────────────────────────────
function updateCounts() {
  document.getElementById('countDentro').textContent = loadRegistros().filter(r => !r.saida).length;
  document.getElementById('countOc').textContent     = loadOcorrencias().length;
}

// ── Limpar registros ──────────────────────────────────────────
document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Apagar todos os registros de entrada/saída? Essa ação não pode ser desfeita.')) {
    saveRegistros([]);
    renderHistorico(); renderDentro(); updateCounts();
    showToast('Registros apagados.');
  }
});

// ── OCORRÊNCIAS ───────────────────────────────────────────────
// Chips de tipo de ocorrência
document.getElementById('ocMotivos').querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.getElementById('ocMotivos').querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    ocMotivoSel = chip.dataset.m;
    validateOc();
  });
});

const ocDescInput          = document.getElementById('ocDescInput');
const ocNomeControlador    = document.getElementById('ocNomeControlador');
const ocSubmitBtn          = document.getElementById('ocSubmitBtn');

ocDescInput.addEventListener('input', validateOc);
ocNomeControlador.addEventListener('input', validateOc);

function validateOc() {
  const ok = ocMotivoSel && ocNomeControlador.value.trim().length >= 3;
  ocSubmitBtn.disabled = !ok;
}

ocSubmitBtn.addEventListener('click', () => {
  const oc = {
    id:         uid(),
    num:        nextOcSeq(),
    tipo:       ocMotivoSel,
    placa:      normalizePlaca(document.getElementById('ocPlacaInput').value) || null,
    desc:       ocDescInput.value.trim(),
    controlador: ocNomeControlador.value.trim(),
    ts:         Date.now(),
  };
  const list = loadOcorrencias();
  list.unshift(oc);
  saveOcorrencias(list);

  showToast('🚨 Ocorrência registrada — Nº ' + oc.num, 'var(--danger)');

  // reset form
  document.getElementById('ocMotivos').querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
  document.getElementById('ocPlacaInput').value = '';
  ocDescInput.value = '';
  // mantém nome do controlador (provável ser o mesmo no turno inteiro)
  ocMotivoSel = null;
  validateOc();
  renderOcorrencias();
  updateCounts();
});

// Renderizar lista de ocorrências
function renderOcorrencias() {
  const list = loadOcorrencias();
  const c = document.getElementById('listOcorrencias');
  c.innerHTML = '';
  if (!list.length) {
    c.innerHTML = `<div class="list-empty"><span class="big">📋</span>Nenhuma ocorrência registrada.</div>`;
    return;
  }
  list.forEach(oc => {
    const card = document.createElement('div');
    card.className = 'card card-oc';

    const tag = document.createElement('div');
    tag.className = 'tag ocorrencia';
    tag.textContent = '🚨';
    card.appendChild(tag);

    const body = document.createElement('div');
    body.className = 'body';
    body.innerHTML = `
      <div class="num-oc">OC-${oc.num}</div>
      <div class="row1"><span class="placa" style="font-size:13px;color:var(--danger)">${oc.tipo}</span><span class="hora">${formatHora(oc.ts)}</span></div>
      <div class="meta">${oc.placa ? `Placa: <b>${oc.placa}</b> · ` : ''}${formatData(oc.ts)}</div>
      ${oc.desc ? `<div class="obs-line">💬 ${oc.desc}</div>` : ''}
      <div class="status-line" style="color:var(--muted)">Controlador: ${oc.controlador}</div>
    `;
    card.appendChild(body);

    // Botão de exportar PDF individual
    const btn = document.createElement('button');
    btn.className = 'btn-saida';
    btn.textContent = '📄 PDF';
    btn.addEventListener('click', () => exportOcPdfUnico(oc));
    card.appendChild(btn);

    c.appendChild(card);
  });
}

// ── Exportar PDF ocorrência individual ───────────────────────
function exportOcPdfUnico(oc) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const mx = 50, pw = doc.internal.pageSize.getWidth();
  let y = 60;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('REGISTRO DE OCORRÊNCIA', mx, y); y += 22;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100);
  doc.text('Condomínio Viva Mais Barueri · Portaria', mx, y); y += 14;
  doc.text(`Gerado em ${formatDataHora(Date.now())}`, mx, y); y += 24;

  doc.setDrawColor(200); doc.line(mx, y, pw - mx, y); y += 20;

  const campos = [
    ['Nº da Ocorrência', `OC-${oc.num}`],
    ['Data / Hora',      formatDataHora(oc.ts)],
    ['Tipo',            oc.tipo],
    ['Placa envolvida', oc.placa || 'Não informada'],
    ['Controlador',     oc.controlador],
  ];

  doc.setTextColor(20);
  campos.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');  doc.setFontSize(9);
    doc.text(label.toUpperCase(), mx, y); y += 13;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
    doc.text(val, mx, y); y += 22;
  });

  if (oc.desc) {
    y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('DESCRIÇÃO DO OCORRIDO', mx, y); y += 13;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    const lines = doc.splitTextToSize(oc.desc, pw - mx * 2);
    doc.text(lines, mx, y); y += lines.length * 14 + 10;
  }

  y += 20;
  doc.setDrawColor(200); doc.line(mx, y, pw - mx, y); y += 30;
  doc.setFontSize(10); doc.setTextColor(100);
  doc.text('Assinatura do Controlador: _______________________________', mx, y); y += 20;
  doc.text(`${oc.controlador} · ${formatDataHora(oc.ts)}`, mx, y);

  doc.save(`ocorrencia-OC${oc.num}-${formatData(oc.ts).replace(/\//g,'-')}.pdf`);
  showToast(`PDF OC-${oc.num} gerado.`);
}

// Exportar PDF de todas as ocorrências
document.getElementById('exportOcPdfBtn').addEventListener('click', () => {
  const list = loadOcorrencias();
  if (!list.length) { showToast('Nenhuma ocorrência para exportar.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const mx = 40, pw = doc.internal.pageSize.getWidth();
  let y = 50;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('Relatório de Ocorrências', mx, y); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100);
  doc.text('Condomínio Viva Mais Barueri · Portaria', mx, y); y += 14;
  doc.text(`Gerado em ${formatDataHora(Date.now())}`, mx, y); y += 24;
  doc.setDrawColor(200); doc.line(mx, y, pw - mx, y); y += 18;

  list.slice().reverse().forEach(oc => {
    if (y > 720) { doc.addPage(); y = 50; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20);
    doc.text(`OC-${oc.num} · ${oc.tipo}`, mx, y); y += 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80);
    doc.text(`${formatDataHora(oc.ts)} | Placa: ${oc.placa || '—'} | ${oc.controlador}`, mx, y); y += 12;
    if (oc.desc) {
      const lines = doc.splitTextToSize(oc.desc, pw - mx * 2);
      doc.text(lines, mx, y); y += lines.length * 12;
    }
    doc.setDrawColor(230); doc.line(mx, y + 4, pw - mx, y + 4); y += 18;
  });

  doc.save(`ocorrencias-${formatData(Date.now()).replace(/\//g,'-')}.pdf`);
  showToast('PDF de ocorrências gerado.');
});

document.getElementById('clearOcBtn').addEventListener('click', () => {
  if (confirm('Apagar todas as ocorrências registradas?')) {
    saveOcorrencias([]); renderOcorrencias(); updateCounts();
    showToast('Ocorrências apagadas.');
  }
});

// ── Exportar PDF geral (histórico) ────────────────────────────
document.getElementById('exportPdfBtn').addEventListener('click', () => {
  const list = loadRegistros();
  if (!list.length) { showToast('Nenhum registro para exportar.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const mx = 40;
  let y = 50;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('Relatório de Controle de Veículos', mx, y); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100);
  doc.text('Condomínio Viva Mais Barueri · Portaria', mx, y); y += 14;
  doc.text(`Gerado em ${formatDataHora(Date.now())}`, mx, y); y += 24;
  doc.setDrawColor(220); doc.line(mx, y, pageWidth - mx, y); y += 18;

  const colX = {
    tipo: mx, torre: mx+52, apto: mx+82, nome: mx+114,
    doc: mx+246, placa: mx+344, entrada: mx+398, saida: mx+462,
  };

  function header() {
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(40);
    doc.text('Tipo',    colX.tipo,    y);
    doc.text('Torre',  colX.torre,   y);
    doc.text('Apto',   colX.apto,    y);
    doc.text('Nome',   colX.nome,    y);
    doc.text('Doc.',   colX.doc,     y);
    doc.text('Placa',  colX.placa,   y);
    doc.text('Entrada',colX.entrada, y);
    doc.text('Saída',  colX.saida,   y);
    y += 8; doc.setDrawColor(220); doc.line(mx, y, pageWidth - mx, y); y += 12;
  }
  header();

  const tipoLabel = { morador:'Morador', visitante:'Visitante', prestador:'Prestador', naoident:'Não ident.' };
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(20);

  list.slice().reverse().forEach(r => {
    if (y > 760) { doc.addPage(); y = 50; header(); }
    const docTxt  = r.documento ? (r.documento.length > 13 ? r.documento.slice(0,12)+'…' : r.documento) : '—';
    const nomeTxt = r.nome ? (r.nome.length > 18 ? r.nome.slice(0,17)+'…' : r.nome) : (r.motivo ? r.motivo.slice(0,17) : '—');
    doc.text(tipoLabel[r.tipo] || r.tipo,           colX.tipo,    y);
    doc.text(r.torre ? String(r.torre) : '—',       colX.torre,   y);
    doc.text(r.apto  ? String(r.apto)  : '—',       colX.apto,    y);
    doc.text(nomeTxt,                                colX.nome,    y);
    doc.text(docTxt,                                 colX.doc,     y);
    doc.text(r.placa || '—',                         colX.placa,   y);
    doc.text(fmtCurto(r.entrada),                    colX.entrada, y);
    doc.text(r.saida ? fmtCurto(r.saida) : '— pátio', colX.saida, y);
    y += 16;
  });

  doc.save(`controle-veiculos-${formatData(Date.now()).replace(/\//g,'-')}.pdf`);
  showToast('PDF gerado.');
});

// ── Status online/offline ─────────────────────────────────────
function updateOnlineStatus() {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  if (navigator.onLine) { pill.classList.remove('offline'); text.textContent = 'online'; }
  else { pill.classList.add('offline'); text.textContent = 'offline · salvando local'; }
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ── PWA: instalação ───────────────────────────────────────────
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

// ── Service worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ── Init ──────────────────────────────────────────────────────
updateOnlineStatus();
updateCounts();
validateForm();
