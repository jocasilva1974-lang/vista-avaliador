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

/* MENSAGENS */

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

/* CONFIGURAÇÃO DO SUPABASE */

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

/* DATAS E MÉDIAS */

function dataLocalISO(
  data = new Date()
) {
  const ano =
    data.getFullYear();

  const mes =
    String(
      data.getMonth() + 1
    ).padStart(2, "0");

  const dia =
    String(
      data.getDate()
    ).padStart(2, "0");

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
      (soma, valor) =>
        soma + valor,
      0
    );

  return total /
    numeros.length;
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
    .replace(".", ",");
}

/* SEMANA */

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
    copia.getUTCDay() || 7;

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
    ).padStart(2, "0")
  );
}

function datasDaSemana(
  valorSemana
) {
  const partes =
    valorSemana.split("-W");

  const ano =
    Number(partes[0]);

  const numeroSemana =
    Number(partes[1]);

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
        numeroSemana - 1
      ) *
        7
  );

  const domingo =
    new Date(segunda);

  domingo.setUTCDate(
    segunda.getUTCDate() + 6
  );

  return {
    inicio:
      segunda
        .toISOString()
        .slice(0, 10),

    fim:
      domingo
        .toISOString()
        .slice(0, 10)
  };
}

/* AUTENTICAÇÃO */

function atualizarVisibilidade() {
  const autenticado =
    Boolean(utilizador);

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
  const resposta =
    await supabaseClient.auth
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
    resposta.data.session
      ?.user || null;

  atualizarVisibilidade();

  if (utilizador) {
    await carregarColaboradores();
  }
}

async function entrar() {
  const email =
    $("#email")
      .value
      .trim();

  const password =
    $("#password").value;

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

  const resposta =
    await supabaseClient.auth
      .signInWithPassword({
        email,
        password
      });

  $("#signin").disabled =
    false;

  $("#signin").textContent =
    "Entrar";

  if (resposta.error) {
    mostrarMensagem(
      resposta.error.message,
      true,
      "#authMsg"
    );

    return;
  }

  utilizador =
    resposta.data.user;

  mostrarMensagem(
    "",
    false,
    "#authMsg"
  );

  atualizarVisibilidade();

  await carregarColaboradores();
}

async function sair() {
  const resposta =
    await supabaseClient.auth
      .signOut();

  if (resposta.error) {
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

  $("#email").value = "";
  $("#password").value = "";

  atualizarVisibilidade();

  mostrarMensagem(
    "Sessão terminada.",
    false,
    "#authMsg"
  );
}

/* COLABORADORES */

async function carregarColaboradores() {
  mostrarMensagem(
    "A carregar colaboradores..."
  );

  const resposta =
    await supabaseClient
      .from("colaboradores")
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
          ascending: true
        }
      );

  if (resposta.error) {
    mostrarMensagem(
      "Não foi possível carregar os colaboradores: " +
        resposta.error.message,
      true
    );

    return;
  }

  colaboradores =
    resposta.data || [];

  if (
    colaboradores.length === 0
  ) {
    mostrarMensagem(
      "Não existem colaboradores ativos.",
      true
    );

    return;
  }

  indiceAtual = 0;

  preencherListaResultados();

  mostrarMensagem("");

  await apresentarColaborador();
}

function preencherListaResultados() {
  $("#resultPerson").innerHTML =
    colaboradores
      .map(
        (colaborador) => `
          <option value="${colaborador.id}">
            ${colaborador.numero} - ${colaborador.nome}
          </option>
        `
      )
      .join("");
}

/* AVALIAÇÃO ATUAL */

async function carregarAvaliacaoAtual() {
  const colaborador =
    colaboradores[indiceAtual];

  const dataAvaliacao =
    $("#evaluationDate").value;

  const sessaoSemana =
    Number(
      $("#weeklySlot").value
    );

  const resposta =
    await supabaseClient
      .from("avaliacoes")
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

  if (resposta.error) {
    mostrarMensagem(
      "Não foi possível carregar a avaliação: " +
        resposta.error.message,
      true
    );

    return null;
  }

  return resposta.data;
}

/* BOTÕES DE CLASSIFICAÇÃO */

function criarBotoesClassificacao(
  campo
) {
  return Array.from(
    {
      length: 11
    },
    (_, numero) => {
      const selecionado =
        classificacoes[campo] ===
        numero
          ? "sel"
          : "";

      return `
        <button
          type="button"
          class="score ${selecionado}"
          data-campo="${campo}"
          data-nota="${numero}"
          aria-label="${campo}: ${numero}"
        >
          ${numero}
        </button>
      `;
    }
  ).join("");
}

function criarCriteriosHTML() {
  return criterios
    .map(
      (criterio) => `
        <section class="card">
          <h3>
            ${criterio.titulo}
          </h3>

          <p class="muted">
            ${criterio.descricao}
          </p>

          <div class="scores">
            ${criarBotoesClassificacao(
              criterio.campo
            )}
          </div>
        </section>
      `
    )
    .join("");
}

function avaliacaoCompleta() {
  return criterios.every(
    (criterio) =>
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
      (botao) => {
        botao.addEventListener(
          "click",
          () => {
            const campo =
              botao.dataset.campo;

            const nota =
              Number(
                botao.dataset.nota
              );

            classificacoes[
              campo
            ] = nota;

            $("#status").textContent =
              "Alterações por guardar";

            atualizarCriterios();
          }
        );
      }
    );
}

function atualizarCriterios() {
  $("#criteria").innerHTML =
    criarCriteriosHTML();

  ligarBotoesNotas();

  $("#save").disabled =
    !avaliacaoCompleta();

  atualizarResumo();
}

/* RESUMO */

function atualizarResumo() {
  const caixa =
    $("#liveSummary");

  if (
    !avaliacaoCompleta()
  ) {
    caixa.innerHTML = "";

    caixa.classList.add(
      "hidden"
    );

    return;
  }

  const resultadoGeral =
    calcularMedia(
      criterios.map(
        (criterio) =>
          classificacoes[
            criterio.campo
          ]
      )
    );

  const indicadores =
    criterios
      .map(
        (criterio) => `
          <div class="metric">
            ${criterio.titulo}

            <strong>
              ${apresentarNota(
                classificacoes[
                  criterio.campo
                ]
              )}
            </strong>
          </div>
        `
      )
      .join("");

  caixa.innerHTML = `
    <h3>
      Resumo desta avaliação
    </h3>

    <div class="result-grid">
      ${indicadores}

      <div class="metric">
        Média

        <strong>
          ${apresentarNota(
            resultadoGeral
          )}
        </strong>
      </div>
    </div>
  `;

  caixa.classList.remove(
    "hidden"
  );
}

/* MOSTRAR COLABORADOR */

async function apresentarColaborador() {
  if (
    colaboradores.length === 0
  ) {
    return;
  }

  const colaborador =
    colaboradores[indiceAtual];

  $("#counter").textContent =
    `Colaborador ${
      indiceAtual + 1
    } de ${
      colaboradores.length
    }`;

  $("#person").textContent =
    `${colaborador.numero} - ${colaborador.nome}`;

  $("#prev").disabled =
    indiceAtual === 0;

  $("#next").disabled =
    indiceAtual ===
    colaboradores.length - 1;

  $("#save").disabled =
    true;

  $("#status").textContent =
    "A carregar...";

  mostrarMensagem("");

  const avaliacao =
    await carregarAvaliacaoAtual();

  if (avaliacao) {
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

    $("#status").textContent =
      "Avaliação já guardada; podes atualizá-la";
  } else {
    classificacoes = {};

    $("#status").textContent =
      "Nova avaliação por preencher";
  }

  atualizarCriterios();
}

/* GUARDAR */

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
    colaboradores[indiceAtual];

  const registo = {
    avaliador_id:
      utilizador.id,

    colaborador_id:
      colaborador.id,

    data_avaliacao:
      $("#evaluationDate").value,

    sessao_semana:
      Number(
        $("#weeklySlot").value
      ),

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

  $("#save").disabled =
    true;

  $("#save").textContent =
    "A guardar...";

  const resposta =
    await supabaseClient
      .from("avaliacoes")
      .upsert(
        registo,
        {
          onConflict:
            "avaliador_id,colaborador_id,data_avaliacao,sessao_semana"
        }
      );

  $("#save").textContent =
    "Guardar";

  $("#save").disabled =
    !avaliacaoCompleta();

  if (resposta.error) {
    mostrarMensagem(
      "Não foi possível guardar: " +
        resposta.error.message,
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

/* NAVEGAÇÃO */

async function navegar(
  direcao
) {
  const novoIndice =
    indiceAtual + direcao;

  if (
    novoIndice < 0 ||
    novoIndice >=
      colaboradores.length
  ) {
    return;
  }

  indiceAtual =
    novoIndice;

  await apresentarColaborador();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* ALTERAR VISTA */

function trocarVista(
  resultados
) {
  $("#evaluateView").classList.toggle(
    "hidden",
    resultados
  );

  $("#resultsView").classList.toggle(
    "hidden",
    !resultados
  );

  $("#tabEvaluate").classList.toggle(
    "active",
    !resultados
  );

  $("#tabResults").classList.toggle(
    "active",
    resultados
  );
}

function atualizarFiltroPeriodo() {
  const periodo =
    $("#resultPeriod").value;

  $("#weekField").classList.toggle(
    "hidden",
    periodo === "month"
  );

  $("#monthField").classList.toggle(
    "hidden",
    periodo !== "month"
  );
}

/* RESULTADOS */

async function carregarResultados() {
  const colaboradorId =
    $("#resultPerson").value;

  const periodo =
    $("#resultPeriod").value;

  let inicio = "";
  let fim = "";

  if (
    periodo === "month"
  ) {
    const valorMes =
      $("#resultMonth").value;

    if (!valorMes) {
      mostrarMensagem(
        "Escolhe o mês.",
        true,
        "#resultsMsg"
      );

      return;
    }

    const partes =
      valorMes
        .split("-")
        .map(Number);

    const ano =
      partes[0];

    const mes =
      partes[1];

    inicio =
      `${ano}-${String(
        mes
      ).padStart(2, "0")}-01`;

    fim =
      dataLocalISO(
        new Date(
          ano,
          mes,
          0
        )
      );
  } else {
    const valorSemana =
      $("#resultWeek").value;

    if (!valorSemana) {
      mostrarMensagem(
        "Escolhe a semana.",
        true,
        "#resultsMsg"
      );

      return;
    }

    const intervalo =
      datasDaSemana(
        valorSemana
      );

    inicio =
      intervalo.inicio;

    fim =
      intervalo.fim;
  }

  mostrarMensagem(
    "A calcular...",
    false,
    "#resultsMsg"
  );

  const resposta =
    await supabaseClient
      .from("avaliacoes")
      .select(
        "id, data_avaliacao, sessao_semana, entrega, execucao, qualidade, respeito, avaliador_id"
      )
      .eq(
        "colaborador_id",
        colaboradorId
      )
      .eq(
        "estado",
        "concluida"
      )
      .gte(
        "data_avaliacao",
        inicio
      )
      .lte(
        "data_avaliacao",
        fim
      )
      .order(
        "data_avaliacao",
        {
          ascending: false
        }
      );

  if (resposta.error) {
    mostrarMensagem(
      "Não foi possível carregar os resultados: " +
        resposta.error.message,
      true,
      "#resultsMsg"
    );

    return;
  }

  const registos =
    resposta.data || [];

  if (
    registos.length === 0
  ) {
    $("#resultsOutput").innerHTML = `
      <p class="muted">
        Não existem avaliações nesse período.
      </p>
    `;

    mostrarMensagem(
      "",
      false,
      "#resultsMsg"
    );

    return;
  }

  const idsAvaliadores = [
    ...new Set(
      registos.map(
        (registo) =>
          registo.avaliador_id
      )
    )
  ];

  let nomesAvaliadores = {};

  if (
    idsAvaliadores.length > 0
  ) {
    const respostaPerfis =
      await supabaseClient
        .from(
          "perfis_avaliadores"
        )
        .select(
          "id, nome"
        )
        .in(
          "id",
          idsAvaliadores
        );

    if (
      !respostaPerfis.error
    ) {
      nomesAvaliadores =
        Object.fromEntries(
          (
            respostaPerfis.data ||
            []
          ).map(
            (perfil) => [
              perfil.id,
              perfil.nome
            ]
          )
        );
    }
  }

  const medias = {};

  criterios.forEach(
    (criterio) => {
      medias[
        criterio.campo
      ] =
        calcularMedia(
          registos.map(
            (registo) =>
              registo[
                criterio.campo
              ]
          )
        );
    }
  );

  medias.geral =
    calcularMedia(
      criterios.map(
        (criterio) =>
          medias[
            criterio.campo
          ]
      )
    );

  const numeroAvaliadores =
    new Set(
      registos.map(
        (registo) =>
          registo.avaliador_id
      )
    ).size;

  const cartoes =
    criterios
      .map(
        (criterio) => `
          <div class="metric">
            ${criterio.titulo}

            <strong>
              ${apresentarNota(
                medias[
                  criterio.campo
                ]
              )}
            </strong>
          </div>
        `
      )
      .join("");

  const linhas =
    registos
      .map(
        (registo) => {
          const mediaRegisto =
            calcularMedia(
              criterios.map(
                (criterio) =>
                  registo[
                    criterio.campo
                  ]
              )
            );

          const avaliador =
            nomesAvaliadores[
              registo.avaliador_id
            ] || "Avaliador";

          return `
            <tr>
              <td>
                ${formatarData(
                  registo.data_avaliacao
                )}
              </td>

              <td>
                ${avaliador}
              </td>

              <td>
                ${registo.sessao_semana}
              </td>

              <td>
                ${apresentarNota(
                  mediaRegisto
                )}
              </td>
            </tr>
          `;
        }
      )
      .join("");

  let titulo =
    "Avaliações individuais";

  if (
    periodo === "week"
  ) {
    titulo =
      "Resultado semanal";
  }

  if (
    periodo === "month"
  ) {
    titulo =
      "Resultado mensal";
  }

  $("#resultsOutput").innerHTML = `
    <h3>
      ${titulo}
    </h3>

    <p class="muted">
      ${registos.length}
      avaliação(ões), realizadas por
      ${numeroAvaliadores}
      de 4 avaliadores.
    </p>

    <div class="result-grid">
      ${cartoes}

      <div class="metric">
        Resultado geral

        <strong>
          ${apresentarNota(
            medias.geral
          )}
        </strong>
      </div>
    </div>

    <div class="table-wrap">
      <table class="result-list">
        <thead>
          <tr>
            <th>Data</th>
            <th>Avaliador</th>
            <th>Sessão</th>
            <th>Média</th>
          </tr>
        </thead>

        <tbody>
          ${linhas}
        </tbody>
      </table>
    </div>
  `;

  mostrarMensagem(
    "",
    false,
    "#resultsMsg"
  );
}

/* EVENTOS */

function configurarEventos() {
  $("#signin").addEventListener(
    "click",
    entrar
  );

  $("#logout").addEventListener(
    "click",
    sair
  );

  $("#save").addEventListener(
    "click",
    guardarAvaliacao
  );

  $("#prev").addEventListener(
    "click",
    () => navegar(-1)
  );

  $("#next").addEventListener(
    "click",
    () => navegar(1)
  );

  $("#password").addEventListener(
    "keydown",
    (evento) => {
      if (
        evento.key === "Enter"
      ) {
        entrar();
      }
    }
  );

  $("#evaluationDate")
    .addEventListener(
      "change",
      apresentarColaborador
    );

  $("#weeklySlot")
    .addEventListener(
      "change",
      apresentarColaborador
    );

  $("#tabEvaluate")
    .addEventListener(
      "click",
      () =>
        trocarVista(false)
    );

  $("#tabResults")
    .addEventListener(
      "click",
      () =>
        trocarVista(true)
    );

  $("#resultPeriod")
    .addEventListener(
      "change",
      atualizarFiltroPeriodo
    );

  $("#loadResults")
    .addEventListener(
      "click",
      carregarResultados
    );
}

/* INÍCIO */

async function iniciarAplicacao() {
  if (
    !iniciarSupabase()
  ) {
    return;
  }

  $("#evaluationDate").value =
    dataLocalISO();

  $("#resultWeek").value =
    semanaAtualISO();

  $("#resultMonth").value =
    dataLocalISO().slice(
      0,
      7
    );

  configurarEventos();

  atualizarFiltroPeriodo();

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
