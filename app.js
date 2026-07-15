// ===== Controle de Veículos — Portaria =====

const STORAGE_KEY = 'cv_registros_v1';
const NOMES_KEY   = 'cv_nomes_v1';

let state       = { tipo: 'morador', torre: null, torraP: null, torraG: null };
let docMode     = 'informar';
let docModeP    = 'informar';
let niMotivoSel = null;
let destinoSel  = null;

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

function placaFieldSetup(inputId, hintId) {
  const inp  = document.getElementById(inputId);
  const hint = document.getElementById(hintId);
  inp.addEventListener('input', () => {
    inp.value = normalizePlaca(inp.value);
    const v = inp.value;
    if (v.length === 7) {
      hint.textContent = isPlacaValida(v) ? '✓ placa válida' : 'formato não reconhecido — confira';
      hint.style.color = isPlacaValida(v) ? 'var(--ok)' : 'var(--warn)';
    } else {
      hint.textContent = 'Aceita formato antigo e Mercosul';
      hint.style.color = 'var(--muted)';
    }
    validateAll();
  });
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

// ── Formulários ───────────────────────────────────────────────
const forms = {
  morador:  document.getElementById('formPadrao'),
  visitante:document.getElementById('formPadrao'),
  prestador:document.getElementById('formPrestador'),
  gestao:   document.getElementById('formGestao'),
  naoident: document.getElementById('formNaoIdent'),
};
const allForms = ['formPadrao','formPrestador','formGestao','formNaoIdent'].map(id => document.getElementById(id));

function showForm(tipo) {
  allForms.forEach(f => f.style.display = 'none');
  if (tipo === 'morador' || tipo === 'visitante') {
    document.getElementById('formPadrao').style.display = '';
    const ph = { morador:'Nome do morador', visitante:'Nome do visitante' };
    document.getElementById('nomeInput').placeholder = ph[tipo] || 'Nome';
    // doc: sempre visível (morador opcional, visitante obrigatório)
    document.getElementById('docBlock').style.display = '';
    // chips de obs: só para morador
    document.getElementById('obsChipsBlock').style.display = tipo === 'morador' ? '' : 'none';
    if (tipo === 'visitante') {
      document.getElementById('obsInput') && (document.getElementById('obsInput').value = '');
      document.getElementById('obsChips').querySelectorAll('.destino-chip').forEach(c=>c.classList.remove('on'));
    }
  } else if (tipo === 'prestador') {
    document.getElementById('formPrestador').style.display = '';
  } else if (tipo === 'gestao') {
    document.getElementById('formGestao').style.display = '';
  } else if (tipo === 'naoident') {
    document.getElementById('formNaoIdent').style.display = '';
  }
  validateAll();
}

// ── Seletor de tipo ───────────────────────────────────────────
const segTipo = document.getElementById('segTipo');
segTipo.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    segTipo.querySelectorAll('button').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    state.tipo = btn.dataset.val;
    showForm(state.tipo);
  });
});

// ── Torre: form padrão ────────────────────────────────────────
function buildTorreGrid(containerId, stateKey, onClickExtra) {
  const grid = document.getElementById(containerId);
  for (let i = 1; i <= 9; i++) {
    const b = document.createElement('button');
    b.className = 'torre-btn'; b.textContent = i; b.dataset.val = i;
    b.addEventListener('click', () => {
      grid.querySelectorAll('.torre-btn').forEach(x => x.classList.remove('on'));
      state[stateKey] = (state[stateKey] === i) ? null : i;
      if (state[stateKey]) { b.classList.add('on'); if(onClickExtra) onClickExtra(); }
      validateAll();
    });
    grid.appendChild(b);
  }
}
buildTorreGrid('torreGrid',  'torre',  checkSuggestNome);
buildTorreGrid('torreGridP', 'torraP', null);
buildTorreGrid('torreGridG', 'torraG', null);

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
    div.addEventListener('click', () => { nomeInput.value = nome; suggestBox.innerHTML = ''; validateAll(); });
    suggestBox.appendChild(div);
  });
}
aptoInput.addEventListener('input', () => { checkSuggestNome(); validateAll(); });
nomeInput.addEventListener('input', validateAll);

function rememberNome(torre, apto, nome) {
  if (!torre || !apto || !nome) return;
  const nomes = loadNomes();
  const key   = `${torre}-${apto}`;
  let lista   = nomes[key] || [];
  lista = [nome, ...lista.filter(n => n.toLowerCase() !== nome.toLowerCase())].slice(0, 5);
  nomes[key] = lista;
  saveNomes(nomes);
}

// ── Placa inputs ──────────────────────────────────────────────
placaFieldSetup('placaInput',      'placaHint');
placaFieldSetup('placaInputP',     'placaHintP');
placaFieldSetup('gestaoPlacaInput','gestaoPlacaHint');

// ── Documento: form padrão (morador/visitante) ───────────────
document.getElementById('docBtnInformar').addEventListener('click', () => {
  docMode = 'informar';
  document.getElementById('docBtnInformar').classList.add('on');
  document.getElementById('docBtnNao').classList.remove('on');
  document.getElementById('docInput').style.display = '';
  validateAll();
});
document.getElementById('docBtnNao').addEventListener('click', () => {
  docMode = 'nao';
  document.getElementById('docBtnNao').classList.add('on');
  document.getElementById('docBtnInformar').classList.remove('on');
  document.getElementById('docInput').value = '';
  document.getElementById('docInput').style.display = 'none';
  validateAll();
});
document.getElementById('docInput').addEventListener('input', validateAll);

// ── Documento: form Gestão ────────────────────────────────────
let docModeG = 'informar';
document.getElementById('docBtnInformarG').addEventListener('click', () => {
  docModeG = 'informar';
  document.getElementById('docBtnInformarG').classList.add('on');
  document.getElementById('docBtnNaoG').classList.remove('on');
  document.getElementById('docInputG').style.display = '';
  validateAll();
});
document.getElementById('docBtnNaoG').addEventListener('click', () => {
  docModeG = 'nao';
  document.getElementById('docBtnNaoG').classList.add('on');
  document.getElementById('docBtnInformarG').classList.remove('on');
  document.getElementById('docInputG').value = '';
  document.getElementById('docInputG').style.display = 'none';
  validateAll();
});
document.getElementById('docInputG').addEventListener('input', validateAll);

// ── Chips de obs rápida (morador) ─────────────────────────────
const obsInput = document.getElementById('obsInput');
document.getElementById('obsChips').querySelectorAll('.destino-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.getElementById('obsChips').querySelectorAll('.destino-chip').forEach(c => c.classList.remove('on'));
    if (obsInput.value === chip.dataset.o) {
      obsInput.value = '';
    } else {
      chip.classList.add('on');
      obsInput.value = chip.dataset.o;
    }
    validateAll();
  });
});
obsInput.addEventListener('input', () => {
  document.getElementById('obsChips').querySelectorAll('.destino-chip').forEach(c => c.classList.remove('on'));
  validateAll();
});

// ── Documento: form prestador ────────────────────────────────
document.getElementById('docBtnInformarP').addEventListener('click', () => {
  docModeP = 'informar';
  document.getElementById('docBtnInformarP').classList.add('on');
  document.getElementById('docBtnNaoP').classList.remove('on');
  document.getElementById('docInputP').style.display = '';
  validateAll();
});
document.getElementById('docBtnNaoP').addEventListener('click', () => {
  docModeP = 'nao';
  document.getElementById('docBtnNaoP').classList.add('on');
  document.getElementById('docBtnInformarP').classList.remove('on');
  document.getElementById('docInputP').value = '';
  document.getElementById('docInputP').style.display = 'none';
  validateAll();
});
document.getElementById('docInputP').addEventListener('input', validateAll);

// ── Destino chips (prestador) ─────────────────────────────────
const destinoInput = document.getElementById('destinoInput');
document.getElementById('destinoChips').querySelectorAll('.destino-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.getElementById('destinoChips').querySelectorAll('.destino-chip').forEach(c => c.classList.remove('on'));
    if (destinoSel === chip.dataset.d) {
      destinoSel = null;
      destinoInput.value = '';
    } else {
      chip.classList.add('on');
      destinoSel = chip.dataset.d;
      destinoInput.value = chip.dataset.d;
    }
    validateAll();
  });
});
destinoInput.addEventListener('input', () => {
  // Se digitou manualmente, deseleciona chips
  document.getElementById('destinoChips').querySelectorAll('.destino-chip').forEach(c => c.classList.remove('on'));
  destinoSel = null;
  validateAll();
});

// ── Gestão ────────────────────────────────────────────────────
document.getElementById('gestaoCargoSelect').addEventListener('change', validateAll);
document.getElementById('gestaoNomeInput').addEventListener('input', validateAll);

// ── NI chips ─────────────────────────────────────────────────
document.getElementById('niMotivos').querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.getElementById('niMotivos').querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    niMotivoSel = chip.dataset.m;
    validateAll();
  });
});
document.getElementById('niPlacaInput').addEventListener('input', () => {
  const inp = document.getElementById('niPlacaInput');
  const hint = document.getElementById('niPlacaHint');
  inp.value = normalizePlaca(inp.value);
  const v = inp.value;
  if (v.length===7){hint.textContent=isPlacaValida(v)?'✓ placa válida':'formato não reconhecido';hint.style.color=isPlacaValida(v)?'var(--ok)':'var(--warn)';}
  else{hint.textContent='Aceita formato antigo e Mercosul';hint.style.color='var(--muted)';}
});

// ── Validação central ─────────────────────────────────────────
function validateAll() {
  const t = state.tipo;
  // Morador — doc opcional
  if (t === 'morador') {
    const ok = state.torre && aptoInput.value.trim() && nomeInput.value.trim() && document.getElementById('placaInput').value.length >= 6;
    document.getElementById('submitBtn').disabled = !ok;
  }
  // Visitante — doc obrigatório
  if (t === 'visitante') {
    const base = state.torre && aptoInput.value.trim() && nomeInput.value.trim() && document.getElementById('placaInput').value.length >= 6;
    const docOk = docMode === 'nao' || document.getElementById('docInput').value.trim().length >= 3;
    document.getElementById('submitBtn').disabled = !(base && docOk);
  }
  // Prestador: torre e apto opcionais; precisa de nome e placa
  if (t === 'prestador') {
    const nome = document.getElementById('nomeInputP').value.trim();
    const placa = document.getElementById('placaInputP').value.length >= 6;
    const docOk = docModeP === 'nao' || document.getElementById('docInputP').value.trim().length >= 3;
    document.getElementById('submitBtnP').disabled = !(nome && placa && docOk);
  }
  // Gestão: cargo e nome obrigatórios
  if (t === 'gestao') {
    const cargo = document.getElementById('gestaoCargoSelect').value;
    const nome  = document.getElementById('gestaoNomeInput').value.trim();
    document.getElementById('submitBtnG').disabled = !(cargo && nome);
  }
  // NI: só motivo obrigatório
  if (t === 'naoident') {
    document.getElementById('niSubmitBtn').disabled = !niMotivoSel;
  }
}

// ── Registrar: Morador / Visitante ────────────────────────────
document.getElementById('submitBtn').addEventListener('click', () => {
  const tipo  = state.tipo;
  const torre = state.torre;
  const apto  = aptoInput.value.trim();
  const nome  = nomeInput.value.trim();
  const placa = document.getElementById('placaInput').value.trim();

  // Doc: morador (opcional), visitante (obrigatório)
  let doc = null;
  const docVal = document.getElementById('docInput').value.trim();
  if (tipo === 'visitante') {
    doc = docMode === 'nao' ? 'Não informado' : docVal;
  } else if (tipo === 'morador' && docVal.length >= 3) {
    doc = docVal;
  }

  // Obs: só para morador (chips ou texto livre)
  const obs = tipo === 'morador' ? (obsInput.value.trim() || null) : null;

  gravar({ tipo, torre, apto, nome, placa, documento: doc, destino: null, cargo: null, obs, motivo: null });
  showToast(`✓ ${placa} registrada — Torre ${torre}, Apto ${apto}`);

  // reset
  state.torre = null;
  document.getElementById('torreGrid').querySelectorAll('.torre-btn').forEach(x=>x.classList.remove('on'));
  aptoInput.value=''; nomeInput.value='';
  document.getElementById('placaInput').value='';
  document.getElementById('placaHint').textContent='Aceita formato antigo e Mercosul';
  document.getElementById('placaHint').style.color='var(--muted)';
  document.getElementById('docInput').value='';
  suggestBox.innerHTML='';
  docMode='informar';
  document.getElementById('docBtnInformar').classList.add('on');
  document.getElementById('docBtnNao').classList.remove('on');
  document.getElementById('docInput').style.display='';
  obsInput.value='';
  document.getElementById('obsChips').querySelectorAll('.destino-chip').forEach(c=>c.classList.remove('on'));
  validateAll();
});

// ── Registrar: Prestador ─────────────────────────────────────
document.getElementById('submitBtnP').addEventListener('click', () => {
  const torre  = state.torraP;
  const apto   = document.getElementById('aptoInputP').value.trim();
  const nome   = document.getElementById('nomeInputP').value.trim();
  const placa  = document.getElementById('placaInputP').value.trim();
  const destino= destinoInput.value.trim() || null;
  const doc    = docModeP === 'nao' ? 'Não informado' : document.getElementById('docInputP').value.trim();

  gravar({ tipo:'prestador', torre, apto, nome, placa, documento: doc, destino, cargo: null, obs: null, motivo: null });
  showToast(`✓ ${placa} registrada — ${nome}`);

  state.torraP = null;
  document.getElementById('torreGridP').querySelectorAll('.torre-btn').forEach(x=>x.classList.remove('on'));
  document.getElementById('aptoInputP').value='';
  document.getElementById('nomeInputP').value='';
  document.getElementById('placaInputP').value='';
  document.getElementById('placaHintP').textContent='Aceita formato antigo e Mercosul';
  document.getElementById('placaHintP').style.color='var(--muted)';
  document.getElementById('docInputP').value='';
  document.getElementById('destinoChips').querySelectorAll('.destino-chip').forEach(c=>c.classList.remove('on'));
  destinoInput.value=''; destinoSel=null;
  docModeP='informar';
  document.getElementById('docBtnInformarP').classList.add('on');
  document.getElementById('docBtnNaoP').classList.remove('on');
  document.getElementById('docInputP').style.display='';
  validateAll();
});

// ── Registrar: Gestão ────────────────────────────────────────
document.getElementById('submitBtnG').addEventListener('click', () => {
  const cargo = document.getElementById('gestaoCargoSelect').value;
  const nome  = document.getElementById('gestaoNomeInput').value.trim();
  const torre = state.torraG;
  const placa = document.getElementById('gestaoPlacaInput').value.trim();
  const docValG = document.getElementById('docInputG').value.trim();
  const doc   = docModeG === 'nao' ? 'Não informado' : (docValG.length >= 3 ? docValG : null);

  gravar({ tipo:'gestao', torre, apto: null, nome, placa: placa||null, documento: doc, destino: null, cargo, obs: null, motivo: null });
  showToast(`✓ ${cargo} — ${nome} registrado`);

  state.torraG = null;
  document.getElementById('torreGridG').querySelectorAll('.torre-btn').forEach(x=>x.classList.remove('on'));
  document.getElementById('gestaoCargoSelect').value='';
  document.getElementById('gestaoNomeInput').value='';
  document.getElementById('gestaoPlacaInput').value='';
  document.getElementById('gestaoPlacaHint').textContent='Aceita formato antigo e Mercosul';
  document.getElementById('gestaoPlacaHint').style.color='var(--muted)';
  document.getElementById('docInputG').value='';
  docModeG='informar';
  document.getElementById('docBtnInformarG').classList.add('on');
  document.getElementById('docBtnNaoG').classList.remove('on');
  document.getElementById('docInputG').style.display='';
  validateAll();
});

// ── Registrar: NI ────────────────────────────────────────────
document.getElementById('niSubmitBtn').addEventListener('click', () => {
  const placa = document.getElementById('niPlacaInput').value.trim();
  const obs   = document.getElementById('niObsInput').value.trim();
  gravar({ tipo:'naoident', torre:null, apto:null, nome:null, placa:placa||null, documento:null, destino:null, cargo:null, obs:obs||null, motivo:niMotivoSel });
  showToast('⚠️ Entrada não identificada registrada');

  document.getElementById('niPlacaInput').value='';
  document.getElementById('niPlacaHint').textContent='Aceita formato antigo e Mercosul';
  document.getElementById('niPlacaHint').style.color='var(--muted)';
  document.getElementById('niObsInput').value='';
  document.getElementById('niMotivos').querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));
  niMotivoSel=null; validateAll();
});

function gravar(campos) {
  const list = loadRegistros();
  list.unshift({ id: uid(), entrada: Date.now(), saida: null, ...campos });
  saveRegistros(list);
  if (campos.torre && campos.apto && campos.nome) rememberNome(campos.torre, campos.apto, campos.nome);
  updateCounts();
}

// ── Renderizar: No pátio ──────────────────────────────────────
function renderDentro(filter='') {
  const list = loadRegistros().filter(r=>!r.saida);
  const f = filter.trim().toUpperCase();
  const fil = f ? list.filter(r=>searchMatch(r,f)) : list;
  const c = document.getElementById('listDentro');
  c.innerHTML='';
  if(!fil.length){c.innerHTML=`<div class="list-empty"><span class="big">🅿️</span>${f?'Nada encontrado.':'Nenhum veículo no pátio agora.'}</div>`;return;}
  fil.forEach(r=>c.appendChild(buildCard(r,true)));
}

function renderHistorico(filter='') {
  const list = loadRegistros();
  const f = filter.trim().toUpperCase();
  const fil = f ? list.filter(r=>searchMatch(r,f)) : list;
  const c = document.getElementById('listHistorico');
  c.innerHTML='';
  if(!fil.length){c.innerHTML=`<div class="list-empty"><span class="big">📋</span>${f?'Nada encontrado.':'Nenhum registro ainda.'}</div>`;return;}
  let lastDay=null;
  fil.forEach(r=>{
    const dl=formatData(r.entrada);
    if(dl!==lastDay){
      const div=document.createElement('div');div.className='day-divider';
      div.textContent=isSameDay(r.entrada,Date.now())?`Hoje · ${dl}`:dl;
      c.appendChild(div);lastDay=dl;
    }
    c.appendChild(buildCard(r,false));
  });
}

function searchMatch(r,f){
  return (r.placa||'').includes(f)
    || String(r.torre||'').includes(f)
    || String(r.apto||'').includes(f)
    || (r.nome||'').toUpperCase().includes(f)
    || (r.motivo||'').toUpperCase().includes(f)
    || (r.cargo||'').toUpperCase().includes(f)
    || (r.destino||'').toUpperCase().includes(f);
}

// ── Card ─────────────────────────────────────────────────────
function buildCard(r, showSaidaBtn) {
  const isNI = r.tipo==='naoident';
  const isG  = r.tipo==='gestao';
  const card = document.createElement('div');
  card.className = 'card'+(r.saida?' saiu':'')+(isNI?' card-ni':'')+(isG?' card-gestao':'');

  const icones={morador:'🏠',visitante:'🚪',prestador:'🔧',gestao:'👔',naoident:'⚠️'};
  const tag=document.createElement('div');
  tag.className=`tag ${r.tipo}`;tag.textContent=icones[r.tipo]||'🚗';
  card.appendChild(tag);

  const body=document.createElement('div');body.className='body';

  const row1=document.createElement('div');row1.className='row1';
  const placaLabel=r.placa||(isNI?'SEM PLACA':'');
  row1.innerHTML=`<span class="placa">${placaLabel}</span><span class="hora">${formatHora(r.entrada)}</span>`;
  body.appendChild(row1);

  const meta=document.createElement('div');meta.className='meta';
  if(isNI){
    meta.innerHTML=`<b style="color:var(--warn)">${r.motivo}</b>`;
  } else if(isG){
    meta.innerHTML=`<b style="color:var(--teal)">${r.cargo}</b> · <b>${r.nome}</b>${r.torre?` · Torre <b>${r.torre}</b>`:''}`;
  } else if(r.tipo==='prestador'){
    let txt=`<b>${r.nome}</b>`;
    if(r.torre) txt+=` · Torre <b>${r.torre}</b>`;
    if(r.apto)  txt+=`, Apto <b>${r.apto}</b>`;
    if(r.destino) txt+=`<br><span style="color:var(--purple);font-size:11px;">📍 ${r.destino}</span>`;
    meta.innerHTML=txt;
  } else {
    meta.innerHTML=`Torre <b>${r.torre}</b> · Apto <b>${r.apto}</b> · <b>${r.nome}</b>`;
  }
  body.appendChild(meta);

  if(r.documento){
    const de=document.createElement('div');de.style.cssText='margin-top:4px;';
    const ni=r.documento==='Não informado';
    de.innerHTML=`<span class="doc-badge${ni?' nao-info':''}">Doc: ${r.documento}</span>`;
    body.appendChild(de);
  }

  if(r.obs){
    const obsEl=document.createElement('div');obsEl.className='obs-line';
    obsEl.textContent=`💬 ${r.obs}`;body.appendChild(obsEl);
  }

  const sl=document.createElement('div');
  if(r.saida){sl.className='status-line';sl.textContent=`Saiu às ${formatHora(r.saida)} · ficou ${diffDuration(r.entrada,r.saida)}`;}
  else if(isNI){sl.className='status-line alerta';sl.textContent='⚠️ não identificado · no pátio';}
  else if(isG) {sl.className='status-line gestao-status';sl.textContent='● no pátio';}
  else         {sl.className='status-line dentro';sl.textContent='● no pátio';}
  body.appendChild(sl);
  card.appendChild(body);

  if(showSaidaBtn&&!r.saida){
    const btn=document.createElement('button');btn.className='btn-saida';btn.textContent='Marcar saída';
    btn.addEventListener('click',()=>marcarSaida(r.id));
    card.appendChild(btn);
  }
  return card;
}

function marcarSaida(id){
  const list=loadRegistros();
  const idx=list.findIndex(r=>r.id===id);if(idx===-1)return;
  list[idx].saida=Date.now();saveRegistros(list);
  showToast(`✓ Saída registrada — ${list[idx].placa||list[idx].nome||'veículo'}`);
  renderDentro(document.getElementById('searchDentro').value);updateCounts();
}

document.getElementById('searchDentro').addEventListener('input',    e=>renderDentro(e.target.value));
document.getElementById('searchHistorico').addEventListener('input', e=>renderHistorico(e.target.value));

function updateCounts(){
  document.getElementById('countDentro').textContent=loadRegistros().filter(r=>!r.saida).length;
}

document.getElementById('clearBtn').addEventListener('click',()=>{
  if(confirm('Apagar todos os registros? Essa ação não pode ser desfeita.')){
    saveRegistros([]);renderHistorico();renderDentro();updateCounts();showToast('Registros apagados.');
  }
});

// ── Exportar PDF ──────────────────────────────────────────────
document.getElementById('exportPdfBtn').addEventListener('click', () => {
  const list = loadRegistros();
  if (!list.length) { showToast('Nenhum registro para exportar.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();
  const mx  = 30;
  const TW  = pw - mx * 2;
  let y = 45;

  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(20);
  doc.text('Relatório de Controle de Veículos',mx,y);y+=17;
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(100);
  doc.text('Condomínio Viva Mais Barueri · Portaria',mx,y);y+=13;
  doc.text(`Gerado em ${formatDataHora(Date.now())}`,mx,y);y+=20;
  doc.setDrawColor(180);doc.line(mx,y,pw-mx,y);y+=14;

  const cols=[
    {key:'tipo',    label:'Tipo',        w:48},
    {key:'torre',   label:'Torre',       w:33},
    {key:'apto',    label:'Apto',        w:33},
    {key:'denom',   label:'Denominação', w:104},
    {key:'docobs',  label:'Doc./Obs.',   w:118},
    {key:'placa',   label:'Placa',       w:50},
    {key:'entrada', label:'Entrada',     w:72},
    {key:'saida',   label:'Saída',       w:77},
  ];
  let xc=mx; cols.forEach(c=>{c.x=xc;xc+=c.w;});

  const PAD_X=4,PAD_Y=5,LINE_H=10,FS=7.5,HDR_FS=7.2,HDR_H=18;
  const HDR_BG=[30,50,80],HDR_TXT=[255,255,255];
  const EVEN=[242,245,250],ODD=[255,255,255];
  const NI_BG=[255,245,235],G_BG=[235,248,245];
  const GRID=[180,190,205];

  function drawHeader(){
    doc.setFillColor(...HDR_BG);doc.rect(mx,y,TW,HDR_H,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(HDR_FS);doc.setTextColor(...HDR_TXT);
    cols.forEach(c=>doc.text(c.label,c.x+PAD_X,y+PAD_Y+LINE_H-2));
    doc.setDrawColor(...GRID);doc.setLineWidth(0.4);
    cols.forEach(c=>doc.line(c.x,y,c.x,y+HDR_H));
    doc.line(pw-mx,y,pw-mx,y+HDR_H);
    doc.line(mx,y,pw-mx,y);doc.line(mx,y+HDR_H,pw-mx,y+HDR_H);
    y+=HDR_H;
  }
  drawHeader();

  const tipoLabel={morador:'Morador',visitante:'Visitante',prestador:'Prestador',gestao:'Gestão',naoident:'Não ident.'};
  let ri=0;

  list.slice().reverse().forEach(r=>{
    const isNI=r.tipo==='naoident', isG=r.tipo==='gestao';

    // Denominação: nome (todos) ou motivo (NI)
    let denomStr='';
    if(isNI) denomStr=r.motivo||'';
    else     denomStr=r.nome||'';

    // Doc/Obs: documento, cargo (gestão como obs), destino (prestador), obs livre
    let docParts=[];
    if(r.documento)                 docParts.push(r.documento);
    if(isG && r.cargo)              docParts.push(`Cargo: ${r.cargo}`);
    if(r.destino)                   docParts.push(`Dest: ${r.destino}`);
    if(r.obs)                       docParts.push(r.obs);
    const docObsStr=docParts.join('\n');

    const placaStr=r.placa||(isNI?'S/ PLACA':'');
    const wI={};cols.forEach(c=>wI[c.key]=c.w-PAD_X*2);

    doc.setFont('helvetica','normal');doc.setFontSize(FS);
    const lines={
      tipo:    doc.splitTextToSize(tipoLabel[r.tipo]||r.tipo, wI.tipo),
      torre:   doc.splitTextToSize(r.torre?String(r.torre):'', wI.torre),
      apto:    doc.splitTextToSize(r.apto?String(r.apto):'', wI.apto),
      denom:   doc.splitTextToSize(denomStr, wI.denom),
      docobs:  docObsStr ? docObsStr.split('\n').flatMap(s=>doc.splitTextToSize(s,wI.docobs-8)) : [''],
      placa:   doc.splitTextToSize(placaStr, wI.placa),
      entrada: doc.splitTextToSize(fmtCurto(r.entrada), wI.entrada),
      saida:   doc.splitTextToSize(r.saida?fmtCurto(r.saida):'No pátio', wI.saida),
    };
    const maxL=Math.max(...Object.values(lines).map(l=>l.length),1);
    const rowH=maxL*LINE_H+PAD_Y*2;

    if(y+rowH>ph-40){doc.addPage();y=30;drawHeader();ri=0;}

    const bg=isNI?NI_BG:isG?G_BG:(ri%2===0?ODD:EVEN);
    doc.setFillColor(...bg);doc.rect(mx,y,TW,rowH,'F');
    doc.setTextColor(20);

    cols.forEach(c=>{
      const cl=lines[c.key];
      if(!cl||cl.every(l=>!l)) return;
      if(isNI||isG) doc.setFont('helvetica','bold'); else doc.setFont('helvetica','normal');
      doc.setFontSize(FS);
      // Doc/Obs: primeira parte normal, resto itálico
      if(c.key==='docobs'&&docParts.length>1){
        let lineIdx=0;
        docParts.forEach((part,pi)=>{
          const partLines=doc.splitTextToSize(part,wI.docobs-8);
          if(pi===0) doc.setFont('helvetica',isNI||isG?'bold':'normal');
          else       doc.setFont('helvetica',isNI||isG?'bolditalic':'italic'),doc.setTextColor(80);
          if(partLines.some(l=>l)) doc.text(partLines,c.x+PAD_X,y+PAD_Y+LINE_H-2+lineIdx*LINE_H);
          lineIdx+=partLines.length;
          doc.setTextColor(20);
        });
      } else {
        if(c.key==='docobs'&&r.obs&&!r.documento&&!r.destino){
          doc.setFont('helvetica',isNI||isG?'bolditalic':'italic');doc.setTextColor(80);
        }
        doc.text(cl,c.x+PAD_X,y+PAD_Y+LINE_H-2);doc.setTextColor(20);
      }
    });

    doc.setDrawColor(...GRID);doc.setLineWidth(0.3);
    cols.forEach(c=>doc.line(c.x,y,c.x,y+rowH));
    doc.line(pw-mx,y,pw-mx,y+rowH);doc.line(mx,y+rowH,pw-mx,y+rowH);
    y+=rowH;ri++;
  });

  // Download nativo — cria link <a> com blob URL para disparar a barra de download do navegador
  const blob = doc.output('blob');
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `controle-veiculos-${formatData(Date.now()).replace(/\//g,'-')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('✓ PDF gerado — verifique os downloads');
});

// ── Online/offline ────────────────────────────────────────────
function updateOnlineStatus(){
  const pill=document.getElementById('statusPill'),text=document.getElementById('statusText');
  if(navigator.onLine){pill.classList.remove('offline');text.textContent='online';}
  else{pill.classList.add('offline');text.textContent='offline · salvando local';}
}
window.addEventListener('online',updateOnlineStatus);
window.addEventListener('offline',updateOnlineStatus);

let deferredPrompt;
const installBar=document.getElementById('installBar');
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredPrompt=e;
  if(!localStorage.getItem('cv_install_dismissed'))installBar.classList.remove('hidden');
});
document.getElementById('installBtn').addEventListener('click',async()=>{
  installBar.classList.add('hidden');
  if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;}
});
document.getElementById('installClose').addEventListener('click',()=>{
  installBar.classList.add('hidden');localStorage.setItem('cv_install_dismissed','1');
});

if('serviceWorker' in navigator)
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

// ── Init ──────────────────────────────────────────────────────
updateOnlineStatus();updateCounts();showForm('morador');validateAll();
