const cfg = window.APP_CONFIG;

if (
  !cfg ||
  !cfg.SUPABASE_URL ||
  !cfg.SUPABASE_ANON_KEY ||
  cfg.SUPABASE_URL.includes("SEU-PROJETO") ||
  cfg.SUPABASE_ANON_KEY.includes("SUA-CHAVE")
) {
  alert(
    "Configuração do Supabase em falta. Preenche SUPABASE_URL e SUPABASE_ANON_KEY no ficheiro config.js."
  );
}

const sb = supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_ANON_KEY
);

const criterios = [
  {
    key: "entrega",
    titulo: "📦 Entrega",
    descricao: "Resultados e cumprimento dos objetivos definidos",
  },
  {
    key: "execucao",
    titulo: "▶️ Execução",
    descricao: "Cumprimento das etapas e procedimentos observáveis",
  },
  {
    key: "qualidade",
    titulo: "✅ Qualidade",
    descricao: "Precisão, conformidade e correções verificáveis",
  },
  {
    key: "respeito",
    titulo: "🤝 Respeito",
    descricao: "Comportamentos profissionais observáveis e colaboração",
  },
];

let colaboradores = [];
let avaliacoes = {};
let indiceAtual = 0;
let sessaoAtual = null;

const $ = (id) => document.getElementById(id);

const loginBox = $("loginBox");
const app = $("app");
const emailInput = $("email");
const passwordInput = $("password");
const authMsg = $("authMsg");

/* =========================================================
   AUTENTICAÇÃO
   ========================================================= */

$("login").addEventListener("click", async () => {
  await autenticar("login");
});

$("signup").addEventListener("click", async () => {
  await autenticar("signup");
});

$("logout").addEventListener("click", async () => {
  const { error } = await sb.auth.signOut();

  if (error) {
    alert(`Erro ao terminar sessão: ${error.message}`);
  }
});

async function autenticar(tipo) {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  authMsg.textContent = "";

  if (!email || !password) {
    authMsg.textContent = "Preenche o e-mail e a password.";
    return;
  }

  if (password.length < 6) {
    authMsg.textContent =
      "A password deve ter pelo menos 6 caracteres.";
    return;
  }

  try {
    if (tipo === "login") {
      const { error } = await sb.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        authMsg.textContent = traduzErroAuth(error.message);
        return;
      }

      authMsg.textContent = "";
    } else {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
      });

      if (error) {
        authMsg.textContent = traduzErroAuth(error.message);
        return;
      }

      if (data.session) {
        authMsg.textContent = "Conta criada com sucesso.";
      } else {
        authMsg.textContent =
          "Conta criada. Verifica o teu e-mail para confirmar a conta.";
      }
    }
  } catch (erro) {
    console.error(erro);
    authMsg.textContent = "Não foi possível comunicar com o servidor.";
  }
}

function traduzErroAuth(mensagem) {
  const msg = mensagem.toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "E-mail ou password incorretos.";
  }

  if (msg.includes("email not confirmed")) {
    return "Confirma primeiro o endereço de e-mail.";
  }

  if (msg.includes("already registered")) {
    return "Já existe uma conta com este e-mail.";
  }

  if (msg.includes("password")) {
    return `Problema com a password: ${mensagem}`;
  }

  return mensagem;
}

/* =========================================================
   ESTADO DA SESSÃO
   ========================================================= */

sb.auth.onAuthStateChange((_evento, session) => {
  atualizarSessao(session);
});

sb.auth
  .getSession()
  .then(({ data }) => {
    atualizarSessao(data.session);
  })
  .catch((erro) => {
    console.error("Erro ao obter sessão:", erro);
  });

async function atualizarSessao(session) {
  sessaoAtual = session;

  const autenticado = !!session;

  loginBox.hidden = autenticado;
  app.hidden = !autenticado;

  if (!autenticado) {
    colaboradores = [];
    avaliacoes = {};
    indiceAtual = 0;
    return;
  }

  await carregarDados();
}

/* =========================================================
   CARREGAR DADOS
   ========================================================= */

async function carregarDados() {
  try {
    const {
      data: dadosColaboradores,
      error: erroColaboradores,
    } = await sb
      .from("colaboradores")
      .select("id, numero, nome, ativo")
      .eq("ativo", true)
      .order("numero", { ascending: true });

    if (erroColaboradores) {
      throw erroColaboradores;
    }

    colaboradores = dadosColaboradores || [];

    if (colaboradores.length === 0) {
      alert(
        "Não existem colaboradores ativos na base de dados."
      );

      return;
    }

    const {
      data: dadosAvaliacoes,
      error: erroAvaliacoes,
    } = await sb
      .from("avaliacoes")
      .select(
        "id, colaborador_id, entrega, execucao, qualidade, respeito, estado, atualizado_em"
      );

    if (erroAvaliacoes) {
      throw erroAvaliacoes;
    }

    avaliacoes = {};

    (dadosAvaliacoes || []).forEach((avaliacao) => {
      avaliacoes[avaliacao.colaborador_id] = avaliacao;
    });

    const primeiroIncompleto = colaboradores.findIndex(
      (colaborador) =>
        !avaliacaoCompleta(avaliacoes[colaborador.id])
    );

    indiceAtual =
      primeiroIncompleto >= 0
        ? primeiroIncompleto
        : 0;

    renderizar();
  } catch (erro) {
    console.error("Erro ao carregar dados:", erro);

    alert(
      `Erro ao carregar dados: ${
        erro.message || "erro desconhecido"
      }`
    );
  }
}

/* =========================================================
   AVALIAÇÃO
   ========================================================= */

function avaliacaoCompleta(avaliacao) {
  if (!avaliacao) {
    return false;
  }

  return criterios.every(({ key }) => {
    const valor = avaliacao[key];

    return (
      Number.isInteger(valor) &&
      valor >= 0 &&
      valor <= 10
    );
  });
}

function numeroCriteriosPreenchidos(avaliacao) {
  if (!avaliacao) {
    return 0;
  }

  return criterios.filter(({ key }) => {
    const valor = avaliacao[key];

    return (
      Number.isInteger(valor) &&
      valor >= 0 &&
      valor <= 10
    );
  }).length;
}

function definirNota(criterio, nota) {
  const colaborador = colaboradores[indiceAtual];

  if (!colaborador) {
    return;
  }

  if (!avaliacoes[colaborador.id]) {
    avaliacoes[colaborador.id] = {};
  }

  avaliacoes[colaborador.id][criterio] = nota;

  renderizar();
}

/* =========================================================
   INTERFACE
   ========================================================= */

function renderizar() {
  if (!colaboradores.length) {
    return;
  }

  const colaborador = colaboradores[indiceAtual];

  const avaliacao =
    avaliacoes[colaborador.id] || {};

  $("count").textContent =
    `Colaborador ${indiceAtual + 1} de ${colaboradores.length}`;

  $("person").textContent =
    `${colaborador.numero} - ${colaborador.nome}`;

  const preenchidos =
    numeroCriteriosPreenchidos(avaliacao);

  $("filled").textContent =
    `${preenchidos}/${criterios.length}`;

  const progresso = Math.round(
    ((indiceAtual + 1) / colaboradores.length) * 100
  );

  $("bar").style.width = `${progresso}%`;

  $("criteria").innerHTML = criterios
    .map((criterio) => {
      const botoes = Array.from(
        { length: 11 },
        (_, nota) => {
          const selecionado =
            avaliacao[criterio.key] === nota;

          return `
            <button
              type="button"
              data-criterio="${criterio.key}"
              data-nota="${nota}"
              class="${selecionado ? "active" : ""}"
              aria-label="${criterio.titulo}: ${nota}"
            >
              ${nota}
            </button>
          `;
        }
      ).join("");

      return `
        <section class="criterion card">

          <h3>
            ${criterio.titulo}
          </h3>

          <p>
            ${criterio.descricao}
          </p>

          <div class="scores">
            ${botoes}
          </div>

        </section>
      `;
    })
    .join("");

  document
    .querySelectorAll("[data-criterio]")
    .forEach((botao) => {
      botao.addEventListener("click", () => {
        definirNota(
          botao.dataset.criterio,
          Number(botao.dataset.nota)
        );
      });
    });

  $("prev").disabled = indiceAtual === 0;

  $("next").disabled =
    indiceAtual === colaboradores.length - 1;

  $("save").disabled =
    !avaliacaoCompleta(avaliacao);
}

/* =========================================================
   NAVEGAÇÃO
   ========================================================= */

$("prev").addEventListener("click", () => {
  if (indiceAtual > 0) {
    indiceAtual -= 1;
    renderizar();
  }
});

$("next").addEventListener("click", () => {
  if (indiceAtual < colaboradores.length - 1) {
    indiceAtual += 1;
    renderizar();
  }
});

/* =========================================================
   GUARDAR
   ========================================================= */

$("save").addEventListener("click", async () => {
  const colaborador = colaboradores[indiceAtual];

  if (!colaborador) {
    return;
  }

  const avaliacao =
    avaliacoes[colaborador.id];

  if (!avaliacaoCompleta(avaliacao)) {
    alert(
      "Preenche os quatro critérios antes de guardar."
    );

    return;
  }

  const botaoGuardar = $("save");

  const textoAnterior =
    botaoGuardar.textContent;

  botaoGuardar.disabled = true;
  botaoGuardar.textContent = "A guardar...";

  try {
    const {
      data: dadosUtilizador,
      error: erroUtilizador,
    } = await sb.auth.getUser();

    if (erroUtilizador) {
      throw erroUtilizador;
    }

    const user = dadosUtilizador.user;

    if (!user) {
      throw new Error(
        "Sessão inválida. Entra novamente."
      );
    }

    const registo = {
      avaliador_id: user.id,
      colaborador_id: colaborador.id,

      entrega: avaliacao.entrega,
      execucao: avaliacao.execucao,
      qualidade: avaliacao.qualidade,
      respeito: avaliacao.respeito,

      estado: "concluida",

      atualizado_em:
        new Date().toISOString(),
    };

    const {
      data: resultado,
      error,
    } = await sb
      .from("avaliacoes")
      .upsert(
        registo,
        {
          onConflict:
            "avaliador_id,colaborador_id",
        }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    avaliacoes[colaborador.id] = resultado;

    botaoGuardar.textContent = "✓ Guardado";

    setTimeout(() => {
      botaoGuardar.textContent = "Guardar";
      renderizar();
    }, 1200);
  } catch (erro) {
    console.error("Erro ao guardar:", erro);

    alert(
      `Não foi possível guardar: ${
        erro.message || "erro desconhecido"
      }`
    );

    botaoGuardar.textContent =
      textoAnterior
