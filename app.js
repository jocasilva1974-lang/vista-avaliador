const config = window.APP_CONFIG || {};

const $ = (selector) => document.querySelector(selector);

const criterios = [
  {
    campo: "entrega",
    titulo: "📦 Entrega",
    descricao: "Resultados e cumprimento dos objetivos definidos"
  },
  {
    campo: "execucao",
    titulo: "▶️ Execução",
    descricao: "Cumprimento das etapas e procedimentos observáveis"
  },
  {
    campo: "qualidade",
    titulo: "✅ Qualidade",
    descricao: "Precisão, conformidade e correções verificáveis"
  },
  {
    campo: "respeito",
    titulo: "🤝 Respeito",
    descricao: "Comportamentos profissionais observáveis e colaboração"
  }
];

let supabaseClient = null;
let utilizador = null;
let colaboradores = [];
let indiceAtual = 0;
let classificacoes = {};

function mostrarMensagem(
  texto,
  erro = false,
  destino = "#msg"
) {
  const elemento = $(destino);

  if (!elemento) {
    return;
  }

  elemento.textContent = texto;
  elemento.className = erro ? "error" : "ok";
}

function configuracaoValida() {
  return (
    typeof config.SUPABASE_URL === "string" &&
    config.SUPABASE_URL.startsWith("https://") &&
    typeof config.SUPABASE_PUBLISHABLE_KEY === "string" &&
    config.SUPABASE_PUBLISHABLE_KEY.startsWith(
      "sb_publishable_"
    )
  );
}

function iniciarSupabase() {
  if (!configuracaoValida()) {
    mostrarMensagem(
      "A configuração do Supabase está incompleta ou inválida.",
      true,
      "#authMsg"
    );

    return false;
  }

  if (
    typeof supabase === "undefined" ||
    typeof supabase.createClient !== "function"
  ) {
    mostrarMensagem(
      "Não foi possível carregar a biblioteca do Supabase.",
      true,
      "#authMsg"
    );

    return false;
  }

  supabaseClient = supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY
  );

  return true;
}

function atualizarVisibilidade() {
  const autenticado = Boolean(utilizador);

  $("#login").classList.toggle(
    "hidden",
    autenticado
  );

  $("#app").classList.toggle(
    "hidden",
    !autenticado
  );

  if (autenticado) {
    $("#who").textContent =
      utilizador.email || "";
  }
}

async function verificarSessao() {
  if (!supabaseClient) {
    return;
  }

  const { data, error } =
    await supabaseClient.auth.getSession();

  if (error) {
    mostrarMensagem(
      error.message,
      true,
      "#authMsg"
    );

    return;
  }

  utilizador =
    data.session?.user || null;

  atualizarVisibilidade();

  if (utilizador) {
    await carregarColaboradores();
  }
}

async function carregarColaboradores() {
  mostrarMensagem(
    "A carregar colaboradores..."
  );

  const { data, error } =
    await supabaseClient
      .from("colaboradores")
      .select("id, numero, nome")
      .eq("ativo", true)
      .order("numero", {
        ascending: true
      });

  if (error) {
    mostrarMensagem(
      "Não foi possível carregar os colaboradores: " +
        error.message,
      true
    );

    return;
  }

  colaboradores = data || [];

  if (colaboradores.length === 0) {
    mostrarMensagem(
      "Não existem colaboradores ativos.",
      true
    );

    return;
  }

  indiceAtual = 0;

  await apresentarColaborador();
}

async function carregarAvaliacaoAtual() {
  const colaborador =
    colaboradores[indiceAtual];

  const { data, error } =
    await supabaseClient
      .from("avaliacoes")
      .select(
        "entrega, execucao, qualidade, respeito, estado"
      )
      .eq(
        "avaliador_id",
        utilizador.id
      )
      .eq(
        "colaborador_id",
        colaborador.id
      )
      .maybeSingle();

  if (error) {
    mostrarMensagem(
      "Não foi possível carregar a avaliação: " +
        error.message,
      true
    );

    return null;
  }

  return data;
}

function criarBotoesClassificacao(campo) {
  return Array.from(
    { length: 11 },
    (_, nota) => {
      const selecionado =
        classificacoes[campo] === nota
          ? "sel"
          : "";

      return `
        <button
          type="button"
          class="score ${selecionado}"
          onclick="selecionarNota('${campo}', ${nota})"
          aria-label="${campo}: ${nota}"
        >
          ${nota}
        </button>
      `;
    }
  ).join("");
}

function criarCriteriosHTML() {
  return criterios
    .map(
      ({
        campo,
        titulo,
        descricao
      }) => `
        <section class="card">
          <h3>${titulo}</h3>

          <p class="muted">
            ${descricao}
          </p>

          <div class="scores">
            ${criarBotoesClassificacao(
              campo
            )}
          </div>
        </section>
      `
    )
    .join("");
}

function avaliacaoCompleta() {
  return criterios.every(
    ({ campo }) =>
      Number.isInteger(
        classificacoes[campo]
      )
  );
}

function atualizarCriterios() {
  $("#criteria").innerHTML =
    criarCriteriosHTML();

  $("#save").disabled =
    !avaliacaoCompleta();
}

async function apresentarColaborador() {
  if (colaboradores.length === 0) {
    return;
  }

  const colaborador =
    colaboradores[indiceAtual];

  $("#counter").textContent =
    `Colaborador ${indiceAtual + 1} de ${colaboradores.length}`;

  $("#person").textContent =
    `${colaborador.numero} - ${colaborador.nome}`;

  $("#prev").disabled =
    indiceAtual === 0;

  $("#next").disabled =
    indiceAtual ===
    colaboradores.length - 1;

  $("#save").disabled = true;

  $("#status").textContent =
    "A carregar...";

  mostrarMensagem("");

  const avaliacao =
    await carregarAvaliacaoAtual();

  classificacoes = avaliacao
    ? {
        entrega: avaliacao.entrega,
        execucao: avaliacao.execucao,
        qualidade: avaliacao.qualidade,
        respeito: avaliacao.respeito
      }
    : {};

  $("#status").textContent =
    avaliacao?.estado === "concluida"
      ? "Avaliação guardada"
      : "Por preencher";

  atualizarCriterios();
}

window.selecionarNota = function (
  campo,
  nota
) {
  classificacoes[campo] = nota;

  $("#status").textContent =
    "Alterações por guardar";

  atualizarCriterios();
};

async function guardarAvaliacao() {
  if (!avaliacaoCompleta()) {
    mostrarMensagem(
      "Preenche os quatro critérios antes de guardar.",
      true
    );

    return;
  }

  const colaborador =
    colaboradores[indiceAtual];

  $("#save").disabled = true;
  $("#save").textContent =
    "A guardar...";

  const registo = {
    avaliador_id:
      utilizador.id,

    colaborador_id:
      colaborador.id,

    entrega:
      classificacoes.entrega,

    execucao:
      classificacoes.execucao,

    qualidade:
      classificacoes.qualidade,

    respeito:
      classificacoes.respeito,

    estado:
      "concluida",

    atualizado_em:
      new Date().toISOString()
  };

  const { error } =
    await supabaseClient
      .from("avaliacoes")
      .upsert(
        registo,
        {
          onConflict:
            "avaliador_id,colaborador_id"
        }
      );

  $("#save").textContent =
    "Guardar";

  $("#save").disabled =
    !avaliacaoCompleta();

  if (error) {
    mostrarMensagem(
      "Não foi possível guardar: " +
        error.message,
      true
    );

    return;
  }

  $("#status").textContent =
    "Avaliação guardada";

  mostrarMensagem(
    "Avaliação guardada com sucesso."
  );
}

async function navegar(direcao) {
  const novoIndice =
    indiceAtual + direcao;

  if (
    novoIndice < 0 ||
    novoIndice >=
      colaboradores.length
  ) {
    return;
  }

  indiceAtual = novoIndice;

  await apresentarColaborador();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function entrar() {
  const email =
    $("#email").value.trim();

  const password =
    $("#password").value;

  if (!email || !password) {
    mostrarMensagem(
      "Introduz o e-mail e a password.",
      true,
      "#authMsg"
    );

    return;
  }

  $("#signin").disabled = true;
  $("#signin").textContent =
    "A entrar...";

  const { data, error } =
    await supabaseClient.auth
      .signInWithPassword({
        email,
        password
      });

  $("#signin").disabled = false;
  $("#signin").textContent =
    "Entrar";

  if (error) {
    mostrarMensagem(
      error.message,
      true,
      "#authMsg"
    );

    return;
  }

  utilizador =
    data.user;

  mostrarMensagem(
    "",
    false,
    "#authMsg"
  );

  atualizarVisibilidade();

  await carregarColaboradores();
}

async function criarConta() {
  const email =
    $("#email").value.trim();

  const password =
    $("#password").value;

  if (!email || !password) {
    mostrarMensagem(
      "Introduz o e-mail e uma password.",
      true,
      "#authMsg"
    );

    return;
  }

  if (password.length < 6) {
    mostrarMensagem(
      "A password deve ter pelo menos 6 caracteres.",
      true,
      "#authMsg"
    );

    return;
  }

  $("#signup").disabled = true;
  $("#signup").textContent =
    "A criar...";

  const { data, error } =
    await supabaseClient.auth
      .signUp({
        email,
        password
      });

  $("#signup").disabled = false;
  $("#signup").textContent =
    "Criar conta";

  if (error) {
    mostrarMensagem(
      error.message,
      true,
      "#authMsg"
    );

    return;
  }

  if (data.session) {
    utilizador =
      data.user;

    atualizarVisibilidade();

    await carregarColaboradores();

    return;
  }

  mostrarMensagem(
    "Conta criada. Confirma o e-mail antes de entrar, se essa opção estiver ativa no Supabase.",
    false,
    "#authMsg"
  );
}

async function sair() {
  const { error } =
    await supabaseClient.auth
      .signOut();

  if (error) {
    mostrarMensagem(
      error.message,
      true
    );

    return;
  }

  utilizador = null;
  colaboradores = [];
  classificacoes = {};
  indiceAtual = 0;

  $("#email").value = "";
  $("#password").value = "";

  atualizarVisibilidade();

  mostrarMensagem(
    "Sessão terminada.",
    false,
    "#authMsg"
  );
}

function configurarEventos() {
  $("#signin")
    .addEventListener(
      "click",
      entrar
    );

  $("#signup")
    .addEventListener(
      "click",
      criarConta
    );

  $("#logout")
    .addEventListener(
      "click",
      sair
    );

  $("#save")
    .addEventListener(
      "click",
      guardarAvaliacao
    );

  $("#prev")
    .addEventListener(
      "click",
      () => navegar(-1)
    );

  $("#next")
    .addEventListener(
      "click",
      () => navegar(1)
    );

  $("#password")
    .addEventListener(
      "keydown",
      (evento) => {
        if (
          evento.key === "Enter"
        ) {
          entrar();
        }
      }
    );
}

async function iniciarAplicacao() {
  if (!iniciarSupabase()) {
    return;
  }

  configurarEventos();

  await verificarSessao();

  supabaseClient.auth
    .onAuthStateChange(
      async (
        _evento,
        sessao
      ) => {
        const novoUtilizador =
          sessao?.user || null;

        if (
          novoUtilizador?.id ===
          utilizador?.id
        ) {
          return;
        }

        utilizador =
          novoUtilizador;

        atualizarVisibilidade();

        if (utilizador) {
          await carregarColaboradores();
        }
      }
    );
}

document.addEventListener(
  "DOMContentLoaded",
  iniciarAplicacao
);
