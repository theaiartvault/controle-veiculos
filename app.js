// ===== Controle de Veículos — Portaria =====
// Tudo fica salvo em localStorage. Funciona 100% sem internet após o primeiro carregamento.

const STORAGE_KEY = 'cv_registros_v1';
const NOMES_KEY = 'cv_nomes_v1'; // memória de nomes por torre+apto, pra sugestão automática

let state = {
  tipo: 'morador',
  torre: null,
};

// ---------- Persistência ----------
function loadRegistros() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveRegistros(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function loadNomes() {
  try { return JSON.parse(localStorage.getItem(NOMES_KEY)) || {}; }
  catch { return {}; }
}
function saveNomes(map) {
  localStorage.setItem(NOMES_KEY, JSON.stringify(map));
}

// ---------- Helpers ----------
function pad(n) { return n.toString().padStart(2, '0'); }
function formatHora(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatData(ts) {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function formatDataHora(ts) {
  return `${formatData(ts)} ${formatHora(ts)}`;
}
function isSameDay(ts1, ts2) {
  const a = new Date(ts1), b = new Date(ts2);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function diffDuration(start, end) {
  const mins = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}h${m > 0 ? pad(m) + 'min' : ''}`;
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}
function uid() {
  return 'r' + Date.now() + Math.random().toString(36).slice(2, 7);
}

// ---------- Validação / máscara de placa ----------
// Formato antigo: ABC1234  |  Mercosul: ABC1D23
function normalizePlaca(raw) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}
function isPlacaValida(p) {
  const antigo = /^[A-Z]{3}[0-9]{4}$/;
  const mercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
  return antigo.test(p) || mercosul.test(p);
}

// ---------- UI: Tabs ----------
const tabs = document.querySelectorAll('.tab');
const sections = {
  novo: document.getElementById('tab-novo'),
  dentro: document.getElementById('tab-dentro'),
  historico: document.getElementById('tab-historico'),
};
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    Object.values(sections).forEach(s => s.style.display = 'none');
    sections[tab.dataset.tab].style.display = '';
    if (tab.dataset.tab === 'dentro') renderDentro();
    if (tab.dataset.tab === 'historico') renderHistorico();
  });
});

// ---------- UI: Tipo (morador / visitante / prestador) ----------
const segTipo = document.getElementById('segTipo');
const docBlock = document.getElementById('docBlock');
const docInput = document.getElementById('docInput');

// Estado do campo de documento
let docMode = 'informar'; // 'informar' | 'nao'

function tipoExigeDoc(tipo) {
  return tipo === 'visitante' || tipo === 'prestador';
}

function updateDocBlock() {
  if (tipoExigeDoc(state.tipo)) {
    docBlock.style.display = '';
  } else {
    docBlock.style.display = 'none';
    docInput.value = '';
  }
  validateForm();
}

// Toggle Informar / Não informado dentro do bloco de documento
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

segTipo.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    segTipo.querySelectorAll('button').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    state.tipo = btn.dataset.val;
    const placeholders = { morador: 'Nome do morador', visitante: 'Nome do visitante', prestador: 'Nome do prestador / empresa' };
    document.getElementById('nomeInput').placeholder = placeholders[state.tipo] || 'Nome';
    // reset doc mode ao trocar tipo
    docMode = 'informar';
    document.getElementById('docBtnInformar').classList.add('on');
    document.getElementById('docBtnNao').classList.remove('on');
    docInput.style.display = '';
    docInput.value = '';
    updateDocBlock();
  });
});

// ---------- UI: Torre grid ----------
const torreGrid = document.getElementById('torreGrid');
for (let i = 1; i <= 9; i++) {
  const b = document.createElement('button');
  b.className = 'torre-btn';
  b.textContent = i;
  b.dataset.val = i;
  b.addEventListener('click', () => {
    torreGrid.querySelectorAll('.torre-btn').forEach(x => x.classList.remove('on'));
    if (state.torre === i) { state.torre = null; } // toggle off
    else { b.classList.add('on'); state.torre = i; checkSuggestNome(); }
    validateForm();
  });
  torreGrid.appendChild(b);
}

// ---------- UI: Sugestão de nome por torre+apto ----------
const aptoInput = document.getElementById('aptoInput');
const nomeInput = document.getElementById('nomeInput');
const suggestBox = document.getElementById('suggestBox');

function checkSuggestNome() {
  suggestBox.innerHTML = '';
  if (!state.torre || !aptoInput.value) return;
  const nomes = loadNomes();
  const key = `${state.torre}-${aptoInput.value}`;
  const lista = nomes[key];
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

// ---------- UI: Placa ----------
const placaInput = document.getElementById('placaInput');
const placaHint = document.getElementById('placaHint');
placaInput.addEventListener('input', () => {
  const norm = normalizePlaca(placaInput.value);
  placaInput.value = norm;
  if (norm.length === 7) {
    placaHint.textContent = isPlacaValida(norm) ? '✓ placa válida' : 'formato não reconhecido — confira';
    placaHint.style.color = isPlacaValida(norm) ? 'var(--ok)' : 'var(--warn)';
  } else {
    placaHint.textContent = 'Aceita formato antigo e Mercosul';
    placaHint.style.color = 'var(--muted)';
  }
  validateForm();
});

// ---------- Validação geral do form ----------
const submitBtn = document.getElementById('submitBtn');
function validateForm() {
  const baseOk = state.torre && aptoInput.value.trim() && nomeInput.value.trim() && placaInput.value.length >= 6;
  // se exige doc: precisa estar no modo 'nao' OU ter digitado algo
  const docOk = !tipoExigeDoc(state.tipo)
    || docMode === 'nao'
    || docInput.value.trim().length >= 3;
  submitBtn.disabled = !(baseOk && docOk);
}
nomeInput.addEventListener('input', validateForm);

// ---------- Registrar entrada ----------
submitBtn.addEventListener('click', () => {
  const torre = state.torre;
  const apto = aptoInput.value.trim();
  const nome = nomeInput.value.trim();
  const placa = placaInput.value.trim();

  // documento: só para visitante e prestador
  let documento = null;
  if (tipoExigeDoc(state.tipo)) {
    documento = docMode === 'nao' ? 'Não informado' : docInput.value.trim();
  }

  const registro = {
    id: uid(),
    tipo: state.tipo,
    torre, apto, nome, placa,
    documento,
    entrada: Date.now(),
    saida: null,
  };

  const list = loadRegistros();
  list.unshift(registro);
  saveRegistros(list);
  rememberNome(torre, apto, nome);

  showToast(`✓ ${placa} registrada — Torre ${torre}, Apto ${apto}`);

  // reset do formulário (mantém o tipo selecionado)
  state.torre = null;
  torreGrid.querySelectorAll('.torre-btn').forEach(x => x.classList.remove('on'));
  aptoInput.value = '';
  nomeInput.value = '';
  placaInput.value = '';
  placaHint.textContent = 'Aceita formato antigo e Mercosul';
  placaHint.style.color = 'var(--muted)';
  suggestBox.innerHTML = '';
  docInput.value = '';
  docMode = 'informar';
  document.getElementById('docBtnInformar').classList.add('on');
  document.getElementById('docBtnNao').classList.remove('on');
  docInput.style.display = '';
  validateForm();

  updateCounts();
});

// ---------- Renderizar: No pátio ----------
function renderDentro(filter = '') {
  const list = loadRegistros().filter(r => !r.saida);
  const f = filter.trim().toUpperCase();
  const filtered = f
    ? list.filter(r => r.placa.includes(f) || String(r.torre).includes(f) || String(r.apto).includes(f) || r.nome.toUpperCase().includes(f))
    : list;

  const container = document.getElementById('listDentro');
  container.innerHTML = '';

  if (!filtered.length) {
    container.innerHTML = `<div class="list-empty"><span class="big">🅿️</span>${f ? 'Nada encontrado.' : 'Nenhum veículo no pátio agora.'}</div>`;
    return;
  }

  filtered.forEach(r => {
    container.appendChild(buildCard(r, true));
  });
}

// ---------- Renderizar: Histórico ----------
function renderHistorico(filter = '') {
  const list = loadRegistros();
  const f = filter.trim().toUpperCase();
  const filtered = f
    ? list.filter(r => r.placa.includes(f) || String(r.torre).includes(f) || String(r.apto).includes(f) || r.nome.toUpperCase().includes(f))
    : list;

  const container = document.getElementById('listHistorico');
  container.innerHTML = '';

  if (!filtered.length) {
    container.innerHTML = `<div class="list-empty"><span class="big">📋</span>${f ? 'Nada encontrado.' : 'Nenhum registro ainda.'}</div>`;
    return;
  }

  let lastDay = null;
  filtered.forEach(r => {
    const dayLabel = formatData(r.entrada);
    if (dayLabel !== lastDay) {
      const div = document.createElement('div');
      div.className = 'day-divider';
      div.textContent = isSameDay(r.entrada, Date.now()) ? `Hoje · ${dayLabel}` : dayLabel;
      container.appendChild(div);
      lastDay = dayLabel;
    }
    container.appendChild(buildCard(r, false));
  });
}

// ---------- Card de registro ----------
function buildCard(r, showSaidaBtn) {
  const card = document.createElement('div');
  card.className = 'card' + (r.saida ? ' saiu' : '');

  const tag = document.createElement('div');
  tag.className = `tag ${r.tipo}`;
  const tipoIcone = { morador: '🏠', visitante: '🚪', prestador: '🔧' };
  tag.textContent = tipoIcone[r.tipo] || '🚪';
  card.appendChild(tag);

  const body = document.createElement('div');
  body.className = 'body';

  const row1 = document.createElement('div');
  row1.className = 'row1';
  row1.innerHTML = `<span class="placa">${r.placa}</span><span class="hora">${formatHora(r.entrada)}</span>`;
  body.appendChild(row1);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `Torre <b>${r.torre}</b> · Apto <b>${r.apto}</b> · <b>${r.nome}</b>`;
  body.appendChild(meta);

  // documento (visitante/prestador)
  if (r.documento) {
    const docEl = document.createElement('div');
    docEl.style.cssText = 'margin-top:4px;';
    const isNaoInfo = r.documento === 'Não informado';
    docEl.innerHTML = `<span class="doc-badge${isNaoInfo ? ' nao-info' : ''}">Doc: ${r.documento}</span>`;
    body.appendChild(docEl);
  }

  const statusLine = document.createElement('div');
  if (r.saida) {
    statusLine.className = 'status-line';
    statusLine.textContent = `Saiu às ${formatHora(r.saida)} · ficou ${diffDuration(r.entrada, r.saida)}`;
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

// ---------- Buscas ----------
document.getElementById('searchDentro').addEventListener('input', e => renderDentro(e.target.value));
document.getElementById('searchHistorico').addEventListener('input', e => renderHistorico(e.target.value));

// ---------- Contador no topo ----------
function updateCounts() {
  const dentro = loadRegistros().filter(r => !r.saida).length;
  document.getElementById('countDentro').textContent = dentro;
}

// ---------- Limpar tudo ----------
document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Apagar todos os registros salvos neste dispositivo? Essa ação não pode ser desfeita.')) {
    saveRegistros([]);
    renderHistorico();
    renderDentro();
    updateCounts();
    showToast('Registros apagados.');
  }
});

// ---------- Exportar PDF ----------
document.getElementById('exportPdfBtn').addEventListener('click', () => {
  const list = loadRegistros();
  if (!list.length) { showToast('Nenhum registro para exportar.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 50;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Relatório de Controle de Veículos', marginX, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Condomínio Viva Mais Barueri · Portaria', marginX, y);
  y += 14;
  doc.text(`Gerado em ${formatDataHora(Date.now())}`, marginX, y);
  y += 24;

  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;

  // Formato curto: "01/07 13:57" (~55pt com fonte 8pt) para caber nas colunas
  function fmtCurto(ts) {
    const d = new Date(ts);
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // A4 útil: ~515pt entre margens de 40pt cada lado
  // Distribuição: Tipo(55) Torre(30) Apto(30) Nome(145) Doc(100) Placa(55) Entrada(60) Saída(60) = 535 → ajustado abaixo
  const colX = {
    tipo:    marginX,         //  40 → largura 50
    torre:   marginX + 52,    //  92 → largura 28
    apto:    marginX + 82,    // 122 → largura 30
    nome:    marginX + 114,   // 154 → largura 130
    doc:     marginX + 246,   // 286 → largura 96
    placa:   marginX + 344,   // 384 → largura 52
    entrada: marginX + 398,   // 438 → largura 62
    saida:   marginX + 462,   // 502 → vai até 555 (dentro dos 555pt úteis)
  };

  function header() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(40);
    doc.text('Tipo',    colX.tipo,    y);
    doc.text('Torre',  colX.torre,   y);
    doc.text('Apto',   colX.apto,    y);
    doc.text('Nome',   colX.nome,    y);
    doc.text('Doc.',   colX.doc,     y);
    doc.text('Placa',  colX.placa,   y);
    doc.text('Entrada',colX.entrada, y);
    doc.text('Saída',  colX.saida,   y);
    y += 8;
    doc.setDrawColor(220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 12;
  }
  header();

  const tipoLabel = { morador: 'Morador', visitante: 'Visitante', prestador: 'Prestador' };
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(20);

  list.slice().reverse().forEach(r => {
    if (y > 760) { doc.addPage(); y = 50; header(); }
    const docTxt = r.documento
      ? (r.documento.length > 13 ? r.documento.slice(0, 12) + '…' : r.documento)
      : '—';
    const nomeTxt = r.nome.length > 18 ? r.nome.slice(0, 17) + '…' : r.nome;
    doc.text(tipoLabel[r.tipo] || r.tipo, colX.tipo,    y);
    doc.text(String(r.torre),             colX.torre,   y);
    doc.text(String(r.apto),              colX.apto,    y);
    doc.text(nomeTxt,                     colX.nome,    y);
    doc.text(docTxt,                      colX.doc,     y);
    doc.text(r.placa,                     colX.placa,   y);
    doc.text(fmtCurto(r.entrada),         colX.entrada, y);
    doc.text(r.saida ? fmtCurto(r.saida) : '— pátio', colX.saida, y);
    y += 16;
  });

  doc.save(`controle-veiculos-${formatData(Date.now()).replace(/\//g, '-')}.pdf`);
  showToast('PDF gerado.');
});

// ---------- Status online/offline ----------
function updateOnlineStatus() {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  if (navigator.onLine) {
    pill.classList.remove('offline');
    text.textContent = 'online';
  } else {
    pill.classList.add('offline');
    text.textContent = 'offline · salvando local';
  }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ---------- PWA: instalação ----------
let deferredPrompt;
const installBar = document.getElementById('installBar');
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (!localStorage.getItem('cv_install_dismissed')) {
    installBar.classList.remove('hidden');
  }
});
document.getElementById('installBtn').addEventListener('click', async () => {
  installBar.classList.add('hidden');
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }
});
document.getElementById('installClose').addEventListener('click', () => {
  installBar.classList.add('hidden');
  localStorage.setItem('cv_install_dismissed', '1');
});

// ---------- Service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ---------- Inicialização ----------
updateOnlineStatus();
updateCounts();
validateForm();
