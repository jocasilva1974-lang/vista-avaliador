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
let avaliacaoCarregada = null;


/* ================================
   MENSAGENS
================================ */

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


/* ================================
   SUPABASE
================================ */

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


/* ================================
   DATAS E CÁLCULOS
================================ */

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
  return new Intl.DateTimeFormat(
    "pt-PT"
  ).format(
    new Date(
      valor + "T12:00:00"
    )
  );
}

function media(valores) {
  const numeros = valores
    .filter(
      (valor) =>
        Number.isFinite(Number(valor))
    )
    .map(Number);

  if (numeros.length === 0) {
    return null;
  }

  return (
    numeros.reduce(
      (total, valor) =>
        total + valor,
      0
    ) / numeros.length
  );
}

function nota(valor) {
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


/* ================================
   SEMANA ISO
================================ */

function isoWeekValue(
  data = new Date()
) {
  const d = new Date(
    Date.UTC(
      data.getFullYear(),
      data.getMonth(),
      data.getDate()
    )
  );

  const diaSemana =
    d.getUTCDay() || 7;

  d.setUTCDate(
    d.getUTCDate() +
      4 -
      diaSemana
  );

  const inicioAno =
    new Date(
      Date.UTC(
        d.getUTCFullYear(),
        0,
        1
      )
    );

  const semana =
    Math.ceil(
      (
        (
          d - inicioAno
        ) /
          86400000 +
        1
      ) /
        7
    );

  return (
    `${d.getUTCFullYear()}-W` +
    String(semana).padStart(
      2,
      "0"
    )
  );
}

function periodoSemana(valor) {
  const partes =
    valor.split("-W");

  const ano =
    Number(partes[0]);

  const semana =
    Number(partes[1]);

  const janeiro4 =
    new Date(
      Date.UTC(
        ano,
        0,
        4
      )
    );

  const segunda =
    new Date(janeiro4);

  segunda.setUTCDate(
    janeiro4.getUTCDate() -
      (janeiro4.getUTCDay() || 7) +
      1 +
      (semana - 1) * 7
  );

  const domingo =
    new Date(segunda);

  domingo.setUTCDate(
    segunda.getUTCDate() + 6
  );

  return [
    segunda
      .toISOString()
      .slice(0, 10),

    domingo
      .toISOString()
      .slice(0, 10)
  ];
}


/* ================================
   AUTENTICAÇÃO
================================ */

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
  if (!supabaseClient) {
    return;
  }

  const { data, error } =
    await supabaseClient.auth
      .getSession();

  if (error) {
    mostrarMensagem(
      error.message,
      true,
      "#authMsg"
    );

    return;
  }

  utilizador =
    data.session?.user ||
    null;

  atualizarVisibilidade();

  if (utilizador) {
    await carregarColaboradores();
  }
}


/* ================================
   COLABORADORES
================================ */

async function carregarColaboradores() {
  mostrarMensagem(
    "A carregar colaboradores..."
  );

  const { data, error } =
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

  if (error) {
    mostrarMensagem(
      "Não foi possível carregar os colaboradores: " +
        error.message,
      true
    );

    return;
  }

  colaboradores =
    data || [];

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

  preencherColaboradoresResultados();

  mostrarMensagem("");

  await apresentarColaborador();
}

function preencherColaboradoresResultados() {
  $("#resultPerson").innerHTML =
    colaboradores
      .map(
        (colaborador) => `
          
            ${colaborador.numero} - ${colaborador.nome}
          
        `
      )
      .join("");
}


/* ================================
   CARREGAR AVALIAÇÃO
================================ */

async function carregarAvaliacaoAtual() {
  const colaborador =
    colaboradores[indiceAtual];

  const dataAvaliacao =
    $("#evaluationDate").value;

  const sessao =
    Number(
      $("#weeklySlot").value
    );

  const { data, error } =
    await supabaseClient
      .from("avaliacoes")
      .select(
        `
        id,
        entrega,
        execucao,
        qualidade,
        respeito,
        estado,
        data_avaliacao,
        sessao_semana
        `
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
        sessao
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


/* ================================
   BOTÕES DAS NOTAS
================================ */

function criarBotoesClassificacao(
  campo
) {
  return Array.from(
    {
      length: 11
    },
    (_, notaAtual) => {
      const selecionado =
        classificacoes[campo] ===
        notaAtual
          ? "sel"
          : "";

      return `
        
          ${notaAtual}
        
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
        

          
            ${titulo}
          

          
            ${descricao}
          

          

            ${criarBotoesClassificacao(
              campo
            )}

          

        
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


/* ================================
   RESUMO DA AVALIAÇÃO
================================ */

function atualizarResumo() {
  const caixa =
    $("#liveSummary");

  if (!avaliacaoCompleta()) {
    caixa.classList.add(
      "hidden"
    );

    caixa.innerHTML = "";

    return;
  }

  const resultadoGeral =
    media(
      criterios.map(
        ({ campo }) =>
          classificacoes[campo]
      )
    );

  caixa.innerHTML = `
    
      Resumo desta avaliação
    

    

      ${criterios
        .map(
          ({
            campo,
            titulo
          }) => `
            

              ${titulo}

              
                ${nota(
                  classificacoes[
                    campo
                  ]
                )}
              

            
          `
        )
        .join("")}

      

        Média

        
          ${nota(
            resultadoGeral
          )}
        

      

    
  `;

  caixa.classList.remove(
    "hidden"
  );
}

function atualizarCriterios() {
  $("#criteria").innerHTML =
    criarCriteriosHTML();

  $("#save").disabled =
    !avaliacaoCompleta();

  atualizarResumo();
}


/* ================================
   APRESENTAR COLABORADOR
================================ */

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

  $("#save").disabled = true;

  $("#status").textContent =
    "A carregar...";

  mostrarMensagem("");

  avaliacaoCarregada =
    await carregarAvaliacaoAtual();

  classificacoes =
    avaliacaoCarregada
      ? {
          entrega:
            avaliacaoCarregada.entrega,

          execucao:
            avaliacaoCarregada.execucao,

          qualidade:
            avaliacaoCarregada.qualidade,

          respeito:
            avaliacaoCarregada.respeito
        }
      : {};

  $("#status").textContent =
    avaliacaoCarregada
      ? "Avaliação já guardada; podes atualizá-la"
      : "Nova avaliação por preencher";

  atualizarCriterios();
}


/* ================================
   SELECIONAR NOTA
================================ */

window.selecionarNota =
  function (
    campo,
    valor
  ) {
    classificacoes[campo] =
      valor;

    $("#status").textContent =
      "Alterações por guardar";

    atualizarCriterios();
  };


/* ================================
   GUARDAR AVALIAÇÃO
================================ */

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

  $("#save").disabled =
    true;

  $("#save").textContent =
    "A guardar...";

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

  const { data, error } =
    await supabaseClient
      .from("avaliacoes")
      .upsert(
        registo,
        {
          onConflict:
            "avaliador_id,colaborador_id,data_avaliacao,sessao_semana"
        }
      )
      .select("id")
      .single();

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

  avaliacaoCarregada =
    data;

  $("#status").textContent =
    "Avaliação guardada";

  mostrarMensagem(
    "Avaliação guardada com sucesso."
  );
}


/* ================================
   NAVEGAÇÃO
================================ */

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


/* ================================
   LOGIN
================================ */

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

  const { data, error } =
    await supabaseClient.auth
      .signInWithPassword({
        email,
        password
      });

  $("#signin").disabled =
    false;

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


/* ================================
   LOGOUT
================================ */

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


/* ================================
   VISTAS
================================ */

function trocarVista(
  mostrarResultados
) {
  $("#evaluateView")
    .classList
    .toggle(
      "hidden",
      mostrarResultados
    );

  $("#resultsView")
    .classList
    .toggle(
      "hidden",
      !mostrarResultados
    );

  $("#tabEvaluate")
    .classList
    .toggle(
      "active",
      !mostrarResultados
    );

  $("#tabResults")
    .classList
    .toggle(
      "active",
      mostrarResultados
    );
}


/* ================================
   FILTRO DO PERÍODO
================================ */

function atualizarFiltroPeriodo() {
  const periodo =
    $("#resultPeriod").value;

  $("#weekField")
    .classList
    .toggle(
      "hidden",
      periodo === "month"
    );

  $("#monthField")
    .classList
    .toggle(
      "hidden",
      periodo !== "month"
    );
}


/* ================================
   RESULTADOS
================================ */

async function carregarResultados() {
  const colaboradorId =
    $("#resultPerson").value;

  const periodo =
    $("#resultPeriod").value;

  let inicio;
  let fim;

  if (
    periodo === "month"
  ) {
    const partes =
      $("#resultMonth")
        .value
        .split("-")
        .map(Number);

    const ano =
      partes[0];

    const mes =
      partes[1];

    inicio =
      `${ano}-${String(mes)
        .padStart(2, "0")}-01`;

    fim =
      dataLocalISO(
        new Date(
          ano,
          mes,
          0
        )
      );

  } else {
    [
      inicio,
      fim
    ] =
      periodoSemana(
        $("#resultWeek").value
      );
  }

  mostrarMensagem(
    "A calcular...",
    false,
    "#resultsMsg"
  );

  const { data, error } =
    await supabaseClient
      .from("avaliacoes")
      .select(
        `
        id,
        data_avaliacao,
        sessao_semana,
        entrega,
        execucao,
        qualidade,
        respeito,
        avaliador_id
        `
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

  if (error) {
    mostrarMensagem(
      "Não foi possível carregar resultados: " +
        error.message,
      true,
      "#resultsMsg"
    );

    return;
  }

  const registos =
    data || [];

  if (
    registos.length === 0
  ) {
    $("#resultsOutput")
      .innerHTML = `
        
          Não existem avaliações
          nesse período.
        
      `;

    mostrarMensagem(
      "",
      false,
      "#resultsMsg"
    );

    return;
  }


  /* ----------------------------
     NOMES DOS AVALIADORES
  ---------------------------- */

  const idsAvaliadores = [
    ...new Set(
      registos.map(
        (registo) =>
          registo.avaliador_id
      )
    )
  ];

  let perfis = [];

  if (
    idsAvaliadores.length > 0
  ) {
    const resposta =
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

    perfis =
      resposta.data || [];
  }

  const nomesAvaliadores =
    Object.fromEntries(
      perfis.map(
        (perfil) => [
          perfil.id,
          perfil.nome
        ]
      )
    );


  /* ----------------------------
     MÉDIAS
  ---------------------------- */

  const medias = {};

  criterios.forEach(
    ({
      campo
    }) => {
      medias[campo] =
        media(
          registos.map(
            (registo) =>
              registo[campo]
          )
        );
    }
  );

  medias.geral =
    media(
      criterios.map(
        ({
          campo
        }) =>
          medias[campo]
      )
    );


  /* ----------------------------
     NÚMERO DE AVALIADORES
  ---------------------------- */

  const numeroAvaliadores =
    new Set(
      registos.map(
        (registo) =>
          registo.avaliador_id
      )
    ).size;


  /* ----------------------------
     CARTÕES
  ---------------------------- */

  const cartoes = `
    

      ${criterios
        .map(
          ({
            campo,
            titulo
          }) => `
            

              ${titulo}

              
                ${nota(
                  medias[campo]
                )}
              

            
          `
        )
        .join("")}

      

        Resultado geral

        
          ${nota(
            medias.geral
          )}
        

      

    
  `;


  /* ----------------------------
     HISTÓRICO
  ---------------------------- */

  const linhas =
    registos
      .map(
        (registo) => {
          const mediaAvaliacao =
            media(
              criterios.map(
                ({
                  campo
                }) =>
                  registo[campo]
              )
            );

          const nomeAvaliador =
            nomesAvaliadores[
              registo.avaliador_id
            ] ||
            "Avaliador";

          return `
            

              
                ${formatarData(
                  registo.data_avaliacao
                )}
              

              
                ${nomeAvaliador}
              

              
                ${registo.sessao_semana}
              

              
                ${nota(
                  mediaAvaliacao
                )}
              

            
          `;
        }
      )
      .join("");


  let tituloResultado =
    "Avaliações individuais";

  if (
    periodo === "week"
  ) {
    tituloResultado =
      "Resultado semanal";
  }

  if (
    periodo === "month"
  ) {
    tituloResultado =
      "Resultado mensal";
  }


  $("#resultsOutput")
    .innerHTML = `

      
        ${tituloResultado}
      

      
        ${registos.length}
        avaliação(ões),
        realizadas por
        ${numeroAvaliadores}
        de 4 avaliadores.
      

      ${cartoes}

      

        

          
            
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


/* ================================
   EVENTOS
================================ */

function configurarEventos() {
  $("#signin")
    .addEventListener(
      "click",
      entrar
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
      () =>
        navegar(-1)
    );

  $("#next")
    .addEventListener(
      "click",
      () =>
        navegar(1)
    );

  $("#password")
    .addEventListener(
      "keydown",
      (evento) => {
        if (
          evento.key ===
          "Enter"
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


/* ================================
   INICIAR APLICAÇÃO
================================ */

async function iniciarAplicacao() {
  if (
    !iniciarSupabase()
  ) {
    return;
  }

  $("#evaluationDate").value =
    dataLocalISO();

  $("#resultWeek").value =
    isoWeekValue();

  $("#resultMonth").value =
    data
