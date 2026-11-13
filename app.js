const config = window.APP_CONFIG || {};

const $ = (selector) =>
  document.querySelector(selector);

const criterios = [
  {
    campo: "entrega",
    titulo: "📦 Entrega",
    descricao:
      "Resultados e cumprimento dos objetivos definidos"
  },
  {
    campo: "execucao",
    titulo: "▶️ Execução",
    descricao:
      "Cumprimento das etapas e procedimentos observáveis"
  },
  {
    campo: "qualidade",
    titulo: "✅ Qualidade",
    descricao:
      "Precisão, conformidade e correções verificáveis"
  },
  {
    campo: "respeito",
    titulo: "🤝 Respeito",
    descricao:
      "Comportamentos profissionais observáveis e colaboração"
  }
];

let supabaseClient = null;
let utilizador = null;
let colaboradores = [];
let indiceAtual = 0;
let classificacoes = {};
let modoRecuperacao = false;


/* =========================
   MENSAGENS
========================= */

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
  elemento.className =
    erro ? "error" : "ok";
}


/* =========================
   CONFIGURAÇÃO SUPABASE
========================= */

function configuracaoValida() {
  return (
    typeof config.SUPABASE_URL ===
      "string" &&
    config.SUPABASE_URL.startsWith(
      "https://"
    ) &&
    typeof config.SUPABASE_PUBLISHABLE_KEY ===
      "string" &&
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
    typeof supabase.createClient !==
      "function"
  ) {
    mostrarMensagem(
      "Não foi possível carregar a biblioteca do Supabase.",
      true,
      "#authMsg"
    );

    return false;
  }

  supabaseClient =
    supabase.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_PUBLISHABLE_KEY
    );

  return true;
}


/* =========================
   DATAS E MÉDIAS
========================= */

function dataLocalISO(
  data = new Date()
) {
  const ano =
    data.getFullYear();

  const mes =
    String(
      data.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const dia =
    String(
      data.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${ano}-${mes}-${dia}`;
}


function formatarData(valor) {
  if (!valor) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "pt-PT"
  ).format(
    new Date(
      valor + "T12:00:00"
    )
  );
}


function calcularMedia(valores) {
  const numeros =
    valores
      .map(Number)
      .filter(
        (valor) =>
          Number.isFinite(valor)
      );

  if (
    numeros.length === 0
  ) {
    return null;
  }

  const total =
    numeros.reduce(
      (
        soma,
        valor
      ) =>
        soma + valor,
      0
    );

  return (
    total /
    numeros.length
  );
}


function apresentarNota(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "—";
  }

  return Number(valor)
    .toFixed(2)
    .replace(
      ".",
      ","
    );
}


/* =========================
   SEMANA
========================= */

function semanaAtualISO(
  data = new Date()
) {
  const copia =
    new Date(
      Date.UTC(
        data.getFullYear(),
        data.getMonth(),
        data.getDate()
      )
    );

  const diaSemana =
    copia.getUTCDay() ||
    7;

  copia.setUTCDate(
    copia.getUTCDate() +
      4 -
      diaSemana
  );

  const primeiroDia =
    new Date(
      Date.UTC(
        copia.getUTCFullYear(),
        0,
        1
      )
    );

  const numeroSemana =
    Math.ceil(
      (
        (
          copia -
          primeiroDia
        ) /
          86400000 +
        1
      ) /
        7
    );

  return (
    copia.getUTCFullYear() +
    "-W" +
    String(
      numeroSemana
    ).padStart(
      2,
      "0"
    )
  );
}


function datasDaSemana(
  valorSemana
) {
  const partes =
    valorSemana.split(
      "-W"
    );

  const ano =
    Number(
      partes[0]
    );

  const numeroSemana =
    Number(
      partes[1]
    );

  const quatroJaneiro =
    new Date(
      Date.UTC(
        ano,
        0,
        4
      )
    );

  const segunda =
    new Date(
      quatroJaneiro
    );

  segunda.setUTCDate(
    quatroJaneiro.getUTCDate() -
      (
        quatroJaneiro.getUTCDay() ||
        7
      ) +
      1 +
      (
        numeroSemana -
        1
      ) *
        7
  );

  const domingo =
    new Date(
      segunda
    );

  domingo.setUTCDate(
    segunda.getUTCDate() +
      6
  );

  return {
    inicio:
      segunda
        .toISOString()
        .slice(
          0,
          10
        ),

    fim:
      domingo
        .toISOString()
        .slice(
          0,
          10
        )
  };
}


/* =========================
   VISIBILIDADE
========================= */

function atualizarVisibilidade() {
  const autenticado =
    Boolean(
      utilizador
    );

  const recuperacao =
    Boolean(
      modoRecuperacao
    );

  $("#login")
    .classList
    .toggle(
      "hidden",
      autenticado ||
        recuperacao
    );

  $("#passwordRecovery")
    .classList
    .toggle(
      "hidden",
      !recuperacao
    );

  $("#app")
    .classList
    .toggle(
      "hidden",
      !autenticado ||
        recuperacao
    );

  if (autenticado) {
    $("#who").textContent =
      utilizador.email ||
      "";
  }
}


/* =========================
   VERIFICAR SESSÃO
========================= */

async function verificarSessao() {
  const resposta =
    await supabaseClient
      .auth
      .getSession();

  if (resposta.error) {
    mostrarMensagem(
      resposta.error.message,
      true,
      "#authMsg"
    );

    return;
  }

  utilizador =
    resposta.data
      .session
      ?.user ||
    null;

  atualizarVisibilidade();

  if (
    utilizador &&
    !modoRecuperacao
  ) {
    await carregarAtletas();
  }
}


/* =========================
   LOGIN
========================= */

async function entrar() {
  const email =
    $("#email")
      .value
      .trim();

  const password =
    $("#password")
      .value;

  if (
    !email ||
    !password
  ) {
    mostrarMensagem(
      "Introduz o e-mail e a password.",
      true,
      "#authMsg"
    );

    return;
  }

  $("#signin").disabled =
    true;

  $("#signin").textContent =
    "A entrar...";

  try {
    const resposta =
      await supabaseClient
        .auth
        .signInWithPassword({
          email,
          password
        });

    if (
      resposta.error
    ) {
      mostrarMensagem(
        resposta.error.message,
        true,
        "#authMsg"
      );

      return;
    }

    utilizador =
      resposta.data.user;

    modoRecuperacao =
      false;

    mostrarMensagem(
      "",
      false,
      "#authMsg"
    );

    atualizarVisibilidade();

    await carregarAtletas();

  } catch (erro) {
    mostrarMensagem(
      "Não foi possível entrar: " +
        (
          erro?.message ||
          "erro desconhecido"
        ),
      true,
      "#authMsg"
    );

  } finally {
    $("#signin").disabled =
      false;

    $("#signin").textContent =
      "Entrar";
  }
}


/* =========================
   LOGOUT
========================= */

async function sair() {
  const resposta =
    await supabaseClient
      .auth
      .signOut();

  if (
    resposta.error
  ) {
    mostrarMensagem(
      resposta.error.message,
      true
    );

    return;
  }

  utilizador = null;
  colaboradores = [];
  classificacoes = {};
  indiceAtual = 0;
  modoRecuperacao =
    false;

  $("#email").value =
    "";

  $("#password").value =
    "";

  atualizarVisibilidade();

  mostrarMensagem(
    "Sessão terminada.",
    false,
    "#authMsg"
  );
}


/* =========================
   NOVA PASSWORD
========================= */

async function guardarNovaPassword() {
  const novaPassword =
    $("#newPassword")
      .value;

  const confirmarPassword =
    $("#confirmPassword")
      .value;

  mostrarMensagem(
    "",
    false,
    "#passwordMsg"
  );

  if (
    !novaPassword ||
    !confirmarPassword
  ) {
    mostrarMensagem(
      "Preenche os dois campos da password.",
      true,
      "#passwordMsg"
    );

    return;
  }

  if (
    novaPassword.length <
    6
  ) {
    mostrarMensagem(
      "A password deve ter pelo menos 6 caracteres.",
      true,
      "#passwordMsg"
    );

    return;
  }

  if (
    novaPassword !==
    confirmarPassword
  ) {
    mostrarMensagem(
      "As passwords não coincidem.",
      true,
      "#passwordMsg"
    );

    return;
  }

  $("#savePassword")
    .disabled =
    true;

  $("#savePassword")
    .textContent =
    "A guardar...";

  try {
    const resposta =
      await supabaseClient
        .auth
        .updateUser({
          password:
            novaPassword
        });

    if (
      resposta.error
    ) {
      mostrarMensagem(
        "Não foi possível alterar a password: " +
          resposta.error.message,
        true,
        "#passwordMsg"
      );

      return;
    }

    utilizador =
      resposta.data.user ||
      utilizador;

    $("#newPassword")
      .value =
      "";

    $("#confirmPassword")
      .value =
      "";

    mostrarMensagem(
      "Password alterada com sucesso.",
      false,
      "#passwordMsg"
    );

    modoRecuperacao =
      false;

    atualizarVisibilidade();

    if (
      utilizador
    ) {
      await carregarAtletas();
    }

  } catch (erro) {
    mostrarMensagem(
      "Não foi possível alterar a password: " +
        (
          erro?.message ||
          "erro desconhecido"
        ),
      true,
      "#passwordMsg"
    );

  } finally {
    $("#savePassword")
      .disabled =
      false;

    $("#savePassword")
      .textContent =
      "Guardar nova password";
  }
}


/* =========================
   ATLETAS
========================= */

async function carregarAtletas() {
  mostrarMensagem(
    "A carregar atletas..."
  );

  const resposta =
    await supabaseClient
      .from(
        "atletas"
      )
      .select(
        "id, numero, nome"
      )
      .eq(
        "ativo",
        true
      )
      .order(
        "numero",
        {
          ascending:
            true
        }
      );

  if (
    resposta.error
  ) {
    mostrarMensagem(
      "Não foi possível carregar os atletas: " +
        resposta.error.message,
      true
    );

    return;
  }

  colaboradores =
    resposta.data ||
    [];

  if (
    colaboradores.length ===
    0
  ) {
    mostrarMensagem(
      "Não existem atletas ativos.",
      true
    );

    return;
  }

  indiceAtual = 0;

  preencherListaResultados();

  mostrarMensagem(
    ""
  );

  await apresentarAtleta();
}


function preencherListaResultados() {
  $("#resultPerson")
    .innerHTML =
    colaboradores
      .map(
        (
          colaborador
        ) => `
          
            ${colaborador.numero} - ${colaborador.nome}
          
        `
      )
      .join(
        ""
      );
}


/* =========================
   AVALIAÇÃO ATUAL
========================= */

async function carregarAvaliacaoAtual() {
  const colaborador =
    colaboradores[
      indiceAtual
    ];

  const dataAvaliacao =
    $("#evaluationDate")
      .value;

  const sessaoSemana =
    Number(
      $("#weeklySlot")
        .value
    );

  const resposta =
    await supabaseClient
      .from(
        "avaliacoes"
      )
      .select(
        "id, entrega, execucao, qualidade, respeito, estado"
      )
      .eq(
        "avaliador_id",
        utilizador.id
      )
      .eq(
        "colaborador_id",
        colaborador.id
      )
      .eq(
        "data_avaliacao",
        dataAvaliacao
      )
      .eq(
        "sessao_semana",
        sessaoSemana
      )
      .maybeSingle();

  if (
    resposta.error
  ) {
    mostrarMensagem(
      "Não foi possível carregar a avaliação: " +
        resposta.error.message,
      true
    );

    return null;
  }

  return resposta.data;
}


/* =========================
   BOTÕES DE CLASSIFICAÇÃO
========================= */

function criarBotoesClassificacao(
  campo
) {
  return Array.from(
    {
      length:
        11
    },
    (
      _,
      numero
    ) => {
      const selecionado =
        classificacoes[
          campo
        ] ===
        numero
          ? "sel"
          : "";

      return `
        
          ${numero}
        
      `;
    }
  ).join(
    ""
  );
}


function criarCriteriosHTML() {
  return criterios
    .map(
      (
        criterio
      ) => `
        

          
            ${criterio.titulo}
          

          
            ${criterio.descricao}
          

          

            ${criarBotoesClassificacao(
              criterio.campo
            )}

          

        
      `
    )
    .join(
      ""
    );
}


function avaliacaoCompleta() {
  return criterios.every(
    (
      criterio
    ) =>
      Number.isInteger(
        classificacoes[
          criterio.campo
        ]
      )
  );
}


function ligarBotoesNotas() {
  document
    .querySelectorAll(
      ".score"
    )
    .forEach(
      (
        botao
      ) => {

        botao.addEventListener(
          "click",
          () => {

            const campo =
              botao.dataset
                .campo;

            const nota =
              Number(
                botao.dataset
                  .nota
              );

            classificacoes[
              campo
            ] =
              nota;

            $("#status")
              .textContent =
              "Alterações por guardar";

            atualizarCriterios();
          }
        );
      }
    );
}


function atualizarCriterios() {
  $("#criteria")
    .innerHTML =
    criarCriteriosHTML();

  ligarBotoesNotas();

  $("#save")
    .disabled =
    !avaliacaoCompleta();

  atualizarResumo();
}


/* =========================
   RESUMO
========================= */

function atualizarResumo() {
  const caixa =
    $("#liveSummary");

  if (
    !avaliacaoCompleta()
  ) {
    caixa.innerHTML =
      "";

    caixa.classList.add(
      "hidden"
    );

    return;
  }

  const resultadoGeral =
    calcularMedia(
      criterios.map(
        (
          criterio
        ) =>
          classificacoes[
            criterio.campo
          ]
      )
    );

  const indicadores =
    criterios
      .map(
        (
          criterio
        ) => `
          

            ${criterio.titulo}

            
              ${apresentarNota(
                classificacoes[
                  criterio.campo
                ]
              )}
            

          
        `
      )
      .join(
        ""
      );

  caixa.innerHTML = `
    
      Resumo desta avaliação
    

    

      ${indicadores}

      

        Média

        
          ${apresentarNota(
            resultadoGeral
          )}
        

      

    
  `;

  caixa.classList.remove(
    "hidden"
  );
}


/* =========================
   MOSTRAR ATLETA
========================= */

async function apresentarAtleta() {
  if (
    colaboradores.length ===
    0
  ) {
    return;
  }

  const colaborador =
    colaboradores[
      indiceAtual
    ];

  $("#counter")
    .textContent =
    `Atleta ${
      indiceAtual +
      1
    } de ${
      colaboradores.length
    }`;

  $("#person")
    .textContent =
    `${colaborador.numero} - ${colaborador.nome}`;

  $("#prev")
    .disabled =
    indiceAtual ===
    0;

  $("#next")
    .disabled =
    indiceAtual ===
    colaboradores.length -
      1;

  $("#save")
    .disabled =
    true;

  $("#status")
    .textContent =
    "A carregar...";

  mostrarMensagem(
    ""
  );

  const avaliacao =
    await carregarAvaliacaoAtual();

  if (
    avaliacao
  ) {
    classificacoes = {
      entrega:
        avaliacao.entrega,

      execucao:
        avaliacao.execucao,

      qualidade:
        avaliacao.qualidade,

      respeito:
        avaliacao.respeito
    };

    $("#status")
      .textContent =
      "Avaliação já guardada; podes atualizá-la";

  } else {
    classificacoes =
      {};

    $("#status")
      .textContent =
      "Nova avaliação por preencher";
  }

  atualizarCriterios();
}


/* =========================
   GUARDAR AVALIAÇÃO
========================= */

async function guardarAvaliacao() {
  if (
    !avaliacaoCompleta()
  ) {
    mostrarMensagem(
      "Preenche os quatro critérios antes de guardar.",
      true
    );

    return;
  }

  const colaborador =
    colaboradores[
      indiceAtual
    ];

  const registo = {
    avaliador_id:
      utilizador.id,

    colaborador_id:
      colaborador.id,

    data_avaliacao:
      $("#evaluationDate")
        .value,

    sessao_semana:
      Number(
        $("#weeklySlot")
          .value
      ),

    entrega:
      classificacoes
        .entrega,

    execucao:
      classificacoes
        .execucao,

    qualidade:
      classificacoes
        .qualidade,

    respeito:
      classificacoes
        .respeito,

    estado:
      "concluida
