'use strict';

const CATEGORIAS = Object.freeze({
  Reciclaveis: 'Recicláveis',
  Vidro: 'Vidro',
  Eletronicos: 'Eletrônicos',
  Oleo: 'Óleo de cozinha'
});

const ICONES = Object.freeze({
  Reciclaveis: 'fa-recycle',
  Vidro: 'fa-wine-bottle',
  Eletronicos: 'fa-plug',
  Oleo: 'fa-bottle-droplet'
});

const estado = { categoria: 'Todos', bairro: 'Todos', busca: '', locais: [] };
const el = {};

document.addEventListener('DOMContentLoaded', inicializar);

function inicializar() {
  el.busca = document.getElementById('inputBusca');
  el.grade = document.getElementById('gradeEcopontos');
  el.contador = document.getElementById('contadorResultados');
  el.mensagem = document.getElementById('mensagemSistema');
  el.modal = document.getElementById('modalEcoponto');
  el.form = document.getElementById('formEcoponto');

  el.busca.addEventListener('input', (event) => {
    estado.busca = event.currentTarget.value;
    renderizar();
  });

  document.querySelectorAll('[data-filter]').forEach((botao) => {
    botao.addEventListener('click', selecionarFiltro);
  });

  document.getElementById('btnNovoEcoponto').addEventListener('click', () => abrirModal());
  document.getElementById('btnFecharModal').addEventListener('click', fecharModal);
  document.getElementById('btnCancelar').addEventListener('click', fecharModal);
  el.form.addEventListener('submit', salvarEcoponto);

  carregarEcopontos();
}

async function requisicaoApi(url, opcoes = {}) {
  const resposta = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opcoes.headers },
    ...opcoes
  });

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir a operação.');
  return dados;
}

async function carregarEcopontos() {
  try {
    estado.locais = await requisicaoApi('/api/ecopontos');
    ocultarMensagem();
    renderizar();
  } catch (erro) {
    mostrarMensagem(`Erro ao carregar os ecopontos: ${erro.message}`, 'erro');
    el.contador.textContent = 'Não foi possível carregar os locais.';
  }
}

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function selecionarFiltro(evento) {
  const botao = evento.currentTarget;
  const tipo = botao.dataset.filter;
  if (!['categoria', 'bairro'].includes(tipo)) return;

  estado[tipo] = botao.dataset.value;
  document.querySelectorAll(`[data-filter="${tipo}"]`).forEach((item) => {
    const ativo = item === botao;
    item.classList.toggle('ativo', ativo);
    item.setAttribute('aria-pressed', String(ativo));
  });
  renderizar();
}

function obterLocaisFiltrados() {
  const termo = normalizar(estado.busca);

  return estado.locais.filter((local) => {
    const categoriaOk = estado.categoria === 'Todos' || local.categoria === estado.categoria;
    const bairroOk = estado.bairro === 'Todos' || local.bairro === estado.bairro;
    const conteudo = normalizar([
      local.nome, local.bairro, CATEGORIAS[local.categoria],
      local.endereco, local.horario
    ].join(' '));

    return categoriaOk && bairroOk && (!termo || conteudo.includes(termo));
  });
}

function criarElemento(tag, classe, texto) {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  return node;
}

function criarIcone(nome) {
  const icone = document.createElement('i');
  icone.className = `fa-solid ${nome}`;
  icone.setAttribute('aria-hidden', 'true');
  return icone;
}

function criarInformacao(icone, texto, classe) {
  const p = criarElemento('p', classe);
  p.append(criarIcone(icone), document.createTextNode(` ${texto}`));
  return p;
}

function criarCartao(local) {
  const artigo = criarElemento('article', 'vitrine-card');
  const cabecalho = criarElemento('div', 'card-header');

  const tagCategoria = criarElemento('span', 'tag-categoria');
  tagCategoria.append(
    criarIcone(ICONES[local.categoria] || 'fa-recycle'),
    document.createTextNode(` ${CATEGORIAS[local.categoria] || local.categoria}`)
  );

  const tagBairro = criarElemento('span', 'tag-bairro');
  tagBairro.append(criarIcone('fa-location-dot'), document.createTextNode(` ${local.bairro}`));
  cabecalho.append(tagCategoria, tagBairro);

  const corpo = criarElemento('div', 'card-body');
  corpo.append(
    criarElemento('h3', 'card-titulo', local.nome),
    criarInformacao('fa-map-pin', local.endereco, 'card-endereco'),
    criarInformacao('fa-clock', local.horario, 'card-horario')
  );

  const rodape = criarElemento('div', 'card-footer');
  const link = criarElemento('a', 'btn-maps-vitrine', 'Ver no Google Maps ');
  link.href = local.mapaUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.append(criarIcone('fa-arrow-up-right-from-square'));

  const acoes = criarElemento('div', 'acoes-cartao');
  const editar = criarElemento('button', 'btn-acao btn-editar', 'Editar');
  editar.type = 'button';
  editar.addEventListener('click', () => abrirModal(local));
  const excluir = criarElemento('button', 'btn-acao btn-excluir', 'Excluir');
  excluir.type = 'button';
  excluir.addEventListener('click', () => excluirEcoponto(local));
  acoes.append(editar, excluir);

  rodape.append(link, acoes);
  artigo.append(cabecalho, corpo, rodape);
  return artigo;
}

function renderizar() {
  const locais = obterLocaisFiltrados();
  const fragmento = document.createDocumentFragment();

  if (locais.length === 0) {
    const vazio = criarElemento('div', 'sem-resultados');
    vazio.append(
      criarElemento('h3', '', 'Nenhum ecoponto encontrado'),
      criarElemento('p', '', 'Tente alterar os filtros ou cadastrar um novo local.')
    );
    fragmento.append(vazio);
  } else {
    locais.forEach((local) => fragmento.append(criarCartao(local)));
  }

  el.grade.replaceChildren(fragmento);
  el.contador.textContent = `${locais.length} ${locais.length === 1 ? 'local encontrado' : 'locais encontrados'}`;
}

function abrirModal(local = null) {
  el.form.reset();
  document.getElementById('erroFormulario').hidden = true;
  document.getElementById('ecopontoId').value = local?.id ?? '';
  document.getElementById('tituloModal').textContent = local ? 'Editar ecoponto' : 'Cadastrar ecoponto';
  document.getElementById('btnSalvar').textContent = local ? 'Salvar alterações' : 'Salvar ecoponto';

  if (local) {
    for (const campo of ['nome', 'bairro', 'categoria', 'horario', 'endereco', 'mapaUrl']) {
      document.getElementById(campo).value = local[campo];
    }
  }

  el.modal.showModal();
  document.getElementById('nome').focus();
}

function fecharModal() {
  el.modal.close();
}

async function salvarEcoponto(evento) {
  evento.preventDefault();

  const id = document.getElementById('ecopontoId').value;
  const dados = Object.fromEntries(
    ['nome', 'bairro', 'categoria', 'horario', 'endereco', 'mapaUrl']
      .map((campo) => [campo, document.getElementById(campo).value.trim()])
  );

  const botao = document.getElementById('btnSalvar');
  botao.disabled = true;

  try {
    await requisicaoApi(id ? `/api/ecopontos/${id}` : '/api/ecopontos', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(dados)
    });
    fecharModal();
    mostrarMensagem(id ? 'Ecoponto atualizado com sucesso.' : 'Ecoponto cadastrado com sucesso.', 'sucesso');
    await carregarEcopontos();
  } catch (erro) {
    const mensagem = document.getElementById('erroFormulario');
    mensagem.textContent = erro.message;
    mensagem.hidden = false;
  } finally {
    botao.disabled = false;
  }
}

async function excluirEcoponto(local) {
  const confirmado = window.confirm(`Deseja realmente excluir "${local.nome}"? Esta ação não pode ser desfeita.`);
  if (!confirmado) return;

  try {
    await requisicaoApi(`/api/ecopontos/${local.id}`, { method: 'DELETE' });
    mostrarMensagem('Ecoponto excluído com sucesso.', 'sucesso');
    await carregarEcopontos();
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  }
}

function mostrarMensagem(texto, tipo) {
  el.mensagem.textContent = texto;
  el.mensagem.className = `mensagem-sistema ${tipo}`;
  el.mensagem.hidden = false;
}

function ocultarMensagem() {
  el.mensagem.hidden = true;
  el.mensagem.textContent = '';
}
