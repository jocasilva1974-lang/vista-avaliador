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
  elemento.className = erro ? "error" : "ok";
}


/* =========================
   SUPABASE
========================= */

function configuracaoValida() {
  return (
    typeof config.SUPABASE_URL === "string" &&
    config.SUPABASE_URL.startsWith("https://") &&
    typeof config.SUPABASE_PUBLISHABLE_KEY === "string" &&
    config.SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_")
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


/* =========================
   DATAS
========================= */

function dataLocalISO(data = new Date()) {
  const ano = data.getFullYear();

  const mes = String(
    data.getMonth() + 1
  ).padStart(2, "0");

  const dia = String(
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
  const numeros = valores
    .map(Number)
    .filter(
      (valor) => Number.isFinite(valor)
    );

  if (numeros.length === 0) {
    return null;
  }

  const total = numeros.reduce(
    (soma, valor) => soma + valor,
    0
  );

  return total / numeros.length;
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


/* =========================
   SEMANA
========================= */

function semanaAtualISO(data = new Date()) {
  const copia = new Date(
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

  const primeiroDia = new Date(
    Date.UTC(
      copia.getUTCFullYear(),
      0,
      1
    )
  );

  const numeroSemana = Math.ceil(
    (
      (
        copia - primeiroDia
      ) / 86400000 +
      1
    ) / 7
  );

  return (
    copia.getUTCFullYear() +
    "-W" +
    String(numeroSemana).padStart(2, "0")
  );
}


function datasDaSemana(valorSemana) {
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
    new Date(quatroJaneiro);

  segunda.setUTCDate(
    quatroJaneiro.getUTCDate() -
    (
      quatroJaneiro.getUTCDay() || 7
    ) +
    1 +
    (
      numeroSemana - 1
    ) * 7
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


/* =========================
   VISIBILIDADE
========================= */

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

  if ($("#passwordRecovery")) {
    $("#passwordRecovery").classList.add(
      "hidden"
    );
  }

  if (autenticado) {
    $("#who").textContent =
      utilizador.email || "";
  }
}


/* =========================
   SESSÃO
========================= */

async function verificarSessao() {
  const resposta =
    await supabaseClient.auth.getSession();

  if (resposta.error) {
    mostrarMensagem(
      resposta.error.message,
      true,
      "#authMsg"
    );

    return;
  }

  utilizador =
    resposta.data.session?.user ||
    null;

  atualizarVisibilidade();

  if (utilizador) {
    await carregarAtletas();
  }
}


/* =========================
   LOGIN
========================= */

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

  mostrarMensagem(
    "",
    false,
    "#authMsg"
  );

  $("#signin").disabled = true;
  $("#signin").textContent =
    "A entrar...";

  try {
    const resposta =
      await supabaseClient.auth
        .signInWithPassword({
          email,
          password
        });

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
    $("#signin").disabled = false;
    $("#signin").textContent =
      "Entrar";
  }
}


/* =========================
   SAIR
========================= */

async function sair() {
  const resposta =
    await supabaseClient.auth.signOut();

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


/* =========================
   ATLETAS
========================= */

async function carregarAtletas() {
  mostrarMensagem(
    "A carregar atletas..."
  );

  const resposta =
    await supabaseClient
      .from("atletas")
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
      "Não foi possível carregar os atletas: " +
      resposta.error.message,
      true
    );

    return;
  }

  colaboradores =
    resposta.data || [];

  if (colaboradores.length === 0) {
    mostrarMensagem(
      "Não existem atletas ativos.",
      true
    );

    return;
  }

  indiceAtual = 0;

  preencherListaResultados();

  mostrarMensagem("");

  await apresentarAtleta();
}


function preencherListaResultados() {
  $("#resultPerson").innerHTML =
    colaboradores
      .map(
        (colaborador) => `
          
            ${colaborador.numero} - ${colaborador.nome}
          
        `
      )
      .join("");
}


/* =========================
   AVALIAÇÃO ATUAL
========================= */

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


/* =========================
   CLASSIFICAÇÕES
========================= */

function criarBotoesClassificacao(campo) {
  return Array.from(
    {
      length: 11
    },
    (_, numero) => {
      const selecionado =
        classificacoes[campo] === numero
          ? "sel"
          : "";

      return `
        
          ${numero}
        
      `;
    }
  ).join("");
}


function criarCriteriosHTML() {
  return criterios
    .map(
      (criterio) => `
        

          
            ${criterio.titulo}
          

          
            ${criterio.descricao}
          

          
            ${criarBotoesClassificacao(
              criterio.campo
            )}
          

        
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
    .querySelectorAll(".score")
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

            classificacoes[campo] =
              nota;

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


/* =========================
   RESUMO
========================= */

function atualizarResumo() {
  const caixa =
    $("#liveSummary");

  if (!avaliacaoCompleta()) {
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
          

            ${criterio.titulo}

            
              ${apresentarNota(
                classificacoes[
                  criterio.campo
                ]
              )}
            

          
        `
      )
      .join("");

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
   APRESENTAR ATLETA
========================= */

async function apresentarAtleta() {
  if (colaboradores.length === 0) {
    return;
  }

  const colaborador =
    colaboradores[indiceAtual];

  $("#counter").textContent =
    `Atleta ${
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


/* =========================
   GUARDAR AVALIAÇÃO
========================= */

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

  $("#save").disabled = true;
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


/* =========================
   NAVEGAÇÃO
========================= */

async function navegar(direcao) {
  const novoIndice =
    indiceAtual + direcao;

  if (
    novoIndice < 0 ||
    novoIndice >= colaboradores.length
  ) {
    return;
  }

  indiceAtual =
    novoIndice;

  await apresentarAtleta();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================
   VISTAS
========================= */

function trocarVista(resultados) {
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


/* =========================
   RESULTADOS
========================= */

async function carregarResultados() {
  const colaboradorId =
    $("#resultPerson").value;

  const periodo =
    $("#resultPeriod").value;

  let inicio = "";
  let fim = "";

  if (!colaboradorId) {
    mostrarMensagem(
      "Escolhe o atleta.",
      true,
      "#resultsMsg"
    );

    return;
  }


  if (periodo === "month") {
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


  if (registos.length === 0) {
    $("#resultsOutput").innerHTML = `
      
        Não existem avaliações nesse período.
      
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


  if (idsAvaliadores.length > 0) {
    const respostaPerfis =
      await supabaseClient
        .from("perfis_avaliadores")
        .select(
          "id, nome"
        )
        .in(
          "id",
          idsAvaliadores
        );

    if (!respostaPerfis.error) {
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
          

            ${criterio.titulo}

            
              ${apresentarNota(
                medias[
                  criterio.campo
                ]
              )}
            

          
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
            

              
                ${formatarData(
                  registo.data_avaliacao
                )}
              

              
                ${avaliador}
              

              
                ${registo.sessao_semana}
              

              
                ${apresentarNota(
                  mediaRegisto
                )}
              

            
          `;
        }
      )
      .join("");


  let titulo =
    "Avaliações individuais";


  if (periodo === "week") {
    titulo =
      "Resultado semanal";
  }


  if (periodo === "month") {
    titulo =
      "Resultado mensal";
  }


  $("#resultsOutput").innerHTML = `
    
      ${titulo}
    

    
      ${registos.length}
      avaliação(ões), realizadas por
      ${numeroAvaliadores}
      de 4 avaliadores.
    

    

      ${cartoes}

      

        Resultado geral

        
          ${apresentarNota(
            medias.geral
          )}
        

      

    

    

      

        

          
            Data
            Avaliador
            Sessão
            Média
          

        

        
          ${linhas}
        

      

    
  `;


  mostrarMensagem(
    "",
    false,
    "#resultsMsg"
  );
}


/* =========================
   EVENTOS
========================= */

function configurarEventos() {
  const signin = $("#signin");
  const logout = $("#logout");
  const save = $("#save");
  const prev = $("#prev");
  const next = $("#next");
