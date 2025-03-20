const { getConnection } = require('../dbConfig');
const bcrypt = require('bcrypt');
const { format, parse, getHours } = require('date-fns');
const calendarioFeriados = require('date-holidays')

async function getPlantoesDia(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const userId = req.user.id;
    const connection = await getConnection(); // Conectar ao banco de dados
    const query = `
      SELECT 
    cd_medico, 
    obter_nome_medico(cd_medico, 'N') AS nm_pessoa_fisica,
    dt_inicial_prev,
    dt_inicial,
    dt_final,
    nvl(obter_desc_escala(OBTER_ESCALA_DIARIA(nr_seq_escala_diaria)),obter_desc_tipo_plantao(nr_seq_tipo_plantao)) AS escala_diaria,
    NR_SEQUENCIA
FROM 
    MEDICO_PLANTAO
WHERE
    cd_medico = :userId
    AND (TO_CHAR(dt_inicial_prev, 'dd/mm/yyyy') = TO_CHAR(SYSDATE, 'dd/mm/yyyy') 
    OR 
    TO_CHAR(dt_inicial_prev, 'dd/mm/yyyy HH24') =  TO_CHAR(SYSDATE - 1, 'dd/mm/yyyy') || ' 19')
    ORDER BY dt_inicial
    `;
    const result = await connection.execute(query, { userId });

    const plantoes = result.rows.map(row => {
      const [
        cd_medico,
        nm_pessoa_fisica,
        dt_inicial_prev,
        dt_inicial,
        dt_final,
        escala_diaria,
        NR_SEQUENCIA
      ] = row;
      return { cd_medico, nm_pessoa_fisica, dt_inicial_prev, dt_inicial, dt_final, escala_diaria, NR_SEQUENCIA };
    });

    res.status(200).json(plantoes);
  } catch (error) {
    console.error('Erro ao obter plantões do dia:', error);
    res.status(500).json({ message: "Erro interno ao obter plantões do dia." });
  }
}

async function getPlantoesListagem(req, res) {
  const { tipo_escala, diaMesAno } = req.query;

  if (!tipo_escala || !diaMesAno) {
    return res.status(400).json({ message: "Parâmetros necessários ausentes." });
  }

  let connection;
  try {
    connection = await getConnection();

    const query = `
         SELECT 
            t.nr_sequencia,
            t.tipo_escala, 
            t.dt_inicio, 
            t.dt_fim,
            t.cd_pessoa_origem,
            t.nm_medico_origem,
            t.nm_medico,
            t.cd_pessoa_fisica,  
            t.escala,
            CASE 
                WHEN m.cd_medico IS NOT NULL AND m.dt_inicial IS NOT NULL AND m.dt_final IS NULL AND t.TIPO_ESCALA = :tipo_escala AND t.escala = fhsl_obter_escala_medico_plantao(T.nr_sequencia,m.nr_seq_tipo_plantao) THEN 'Iniciado'
                WHEN m.cd_medico IS NOT NULL AND m.dt_inicial IS NOT NULL AND m.dt_final IS NOT NULL AND t.TIPO_ESCALA = :tipo_escala AND t.escala = fhsl_obter_escala_medico_plantao(T.nr_sequencia,m.nr_seq_tipo_plantao)  THEN 'Finalizado'
                ELSE NULL
            END AS status,
            Obter_Dia_Semana(dt_inicio)
         FROM 
            fhsl_plantoes_app_tasy t
         LEFT JOIN 
            MEDICO_PLANTAO m
         ON 
            t.cd_pessoa_fisica = m.cd_medico 
            AND to_char(t.dt_inicio,'dd/mm/yyyy hh24') = to_char(m.dt_inicial_prev,'dd/mm/yyyy hh24')
         WHERE 
            t.tipo_escala = :tipo_escala
            AND to_char(t.dt_inicio, 'dd/mm/yyyy') = :diaMesAno
            AND t.escala = obter_desc_escala(nr_seq_escala)
      `;
    const result = await connection.execute(query, { tipo_escala, diaMesAno });



    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Nenhum plantão encontrado." });
    }

    const plantoes = result.rows.map(row => ({
      nr_sequencia: row[0],
      tipo_escala: row[1],
      dt_inicio: row[2],
      dt_fim: row[3],
      cd_pessoa_origem: row[4],
      nm_medico_origem: row[5],
      nm_medico: row[6],
      cd_pessoa_fisica: row[7],
      escala: row[8],
      situacao: row[9],
      dia_semana: row[10]
    }));

    res.json(plantoes);

  } catch (error) {
    console.error('Erro ao buscar plantões 24h:', error);
    res.status(500).json({ message: "Erro interno ao buscar plantões 24h." });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Erro ao fechar conexão:', err);
      }
    }
  }
}

async function getUserInfo(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const userId = req.user.id;
    const connection = await getConnection(); // Conectar ao banco de dados

    // Consulta para obter informações do usuário
    const query = `
        SELECT 
          nm_pessoa_fisica
        FROM 
          pessoa_fisica
        WHERE
          cd_pessoa_fisica = :userId
      `;

    const result = await connection.execute(query, { userId });

    if (result.rows.length === 0) {
      await connection.close();
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const userInfo = result.rows[0];
    const nm_pessoa_fisica = userInfo[0];

    await connection.close();

    res.status(200).json({ nm_pessoa_fisica });
  } catch (error) {
    console.error('Erro ao obter informações do usuário:', error);
    res.status(500).json({ message: "Erro interno ao obter informações do usuário." });
  }
}


async function iniciarPlantao(req, res) {
  console.log("Request body recebido do front:", req.body)
  const { password, tipo_escala, cd_medico, dt_inicio, dt_final, plantaoId } = req.body;

  if (!password || !tipo_escala || !cd_medico || !dt_inicio || !dt_inicio || !plantaoId) {
    return res.status(400).json({ message: "Parâmetros necessários ausentes." });
  }

  console.log("Informações recebidas:", req.body)
  console.log("Código do médico:", req.user.id)
  const userId = req.user.id;
  let connection;
  try {
    connection = await getConnection();
    console.log('Conexão com o banco de dados estabelecida com sucesso.');

    const checkUserPlantao = `SELECT
    DECODE(CD_PESSOA_FISICA, :cd_medico, 'Sim', 'Não')
    FROM
    ESCALA_DIARIA
    WHERE
    NR_SEQUENCIA = :NR_SEQUENCIA`

    const checkUserPlantaoCorreto = await connection.execute(checkUserPlantao, { nr_sequencia: plantaoId, cd_medico: userId });
    if (checkUserPlantaoCorreto.rows == "Não") {
      await connection.close();
      return res.status(403).json({ message: "Você não tem permissão para iniciar este plantão." })
    }

    const checkPlantaoQuery = `SELECT COUNT(*) AS COUNT FROM MEDICO_PLANTAO WHERE cd_medico = :userId AND dt_final IS NULL`;
    const checkPlantaoResult = await connection.execute(checkPlantaoQuery, { userId });

    if (checkPlantaoResult.rows[0].COUNT > 0) {
      await connection.close();
      return res.status(405).json({ message: "Atenção! Você já tem um plantão iniciado." });
    }

    const userQuery = `SELECT ds_senha FROM FHSL_APP_TASY_USERS WHERE cd_pessoa_fisica = :userId`;
    const userResult = await connection.execute(userQuery, { userId });
    if (userResult.rows.length === 0) {
      await connection.close();
      return res.status(401).json({ message: "Usuário não foi encontrado." });
    }

    const user = userResult.rows[0];
    const passwordHash = user[0];
    const isPasswordMatch = await bcrypt.compare(password, passwordHash)
    if (!isPasswordMatch) {
      await connection.close();
      return res.status(401).json({ message: "Senha incorreta." });
    }

    const dtInicio = new Date(dt_inicio.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
    if (isNaN(dtInicio.getTime())) {
      console.error(`Formato de data inválido: ${dt_inicio}`);
      return res.status(400).json({ message: 'Formato de data inválido.' });
    }

    const dtFinal = new Date(dt_final.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
    if (isNaN(dtFinal.getTime())) {
      console.error(`Formato de data inválido: ${dt_final}`);
      return res.status(400).json({ message: 'Formato de data inválido' });
    }

    const horas = dtInicio.getHours(); // pega as horas de início do plantão
    const horasFinal = dtFinal.getHours(); // pega as horas finais do plantão
    const diasDaSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]; // máscara para dias de semana
    const diaSemana = diasDaSemana[dtInicio.getDay()]; // pegando o dia de semana com base no início do plantão
    const verificarHoraAtual = new Date(); // cria uma data com base no dia atual do sistema
    let horaAtual = verificarHoraAtual.getHours(); // pega as horas com base no dia atual do sistema
    let minutosAtual = verificarHoraAtual.getMinutes(); // pega os minutos com base no dia atual do sistema
    let diaAtual = verificarHoraAtual.getDate(); // pega a dia criado no verificarHoraAtual
    let diaPlantao = dtInicio.getDate(); // pega o dia do plantão
    /*const obterFeriados = new calendarioFeriados('BR', 'pr')
    const feriado = obterFeriados.getHolidays(2025);*/

    console.log(`Dia da semana: ${diaSemana}, Horas ${horas}`)
    console.log(`Hora atual: ${horaAtual} Minutos atuais: ${minutosAtual} - Dia atual: ${diaAtual} - Dia do plantão: ${diaPlantao}`)
    //console.log(JSON.stringify(feriado, null, 2));

    let nr_Seq_tipo_plantao, nr_seq_regra_esp;

    switch (tipo_escala) {

      case 'CARD': //cirurgia cardiaca
        if (diaAtual != diaPlantao) { //restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 34;
          nr_seq_regra_esp = 35;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'PED': //cirurgia pediatrica
        if (diaAtual != diaPlantao) { //restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 12;
          nr_seq_regra_esp = 30;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'CIRT':
        if (diaAtual != diaPlantao) { //restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 45;
          nr_seq_regra_esp = 46;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'CVAR':
        if (diaAtual != diaPlantao) { //restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 39;
          nr_seq_regra_esp = 40;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'OFT':
        if (diaAtual != diaPlantao) { //restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 37;
          nr_seq_regra_esp = 38;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'AMBC':
        if (diaAtual != diaPlantao) { //restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 55;
          nr_seq_regra_esp = 55;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'OTO':
        if (diaAtual != diaPlantao) { //restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 41;
          nr_seq_regra_esp = 42;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'URO':
        if (diaAtual != diaPlantao) { //restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 35;
          nr_seq_regra_esp = 36;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;


      case 'GO1':
        if (diaAtual != diaPlantao) { // restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }

        if ((horas >= 7 && horas <= 18) && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { // diurno padrão
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 29;
          nr_seq_regra_esp = 11;
        } else if ((horas >= 7 && horas <= 18) && (diaSemana === "Sábado" || diaSemana === "Domingo")) { // diurno FDS
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 13;
          nr_seq_regra_esp = 13;
        } else if ((horas >= 19 || horas < 7) && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { // noturno padrão
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0)))
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" })
          nr_Seq_tipo_plantao = 20;
          nr_seq_regra_esp = 21;
        } else if ((horas >= 19 || horas < 7) && (diaSemana === "Sábado" || diaSemana === "Domingo")) { //noturno FDS
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0)))
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" })
          nr_Seq_tipo_plantao = 14;
          nr_seq_regra_esp = 12;
        } else {
          return res.status(400).json({ message: "Horário inválido para o plantão selecionado." });
        }
        break;
      case 'GO2':
        if (diaAtual != diaPlantao) { // restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }

        if ((horas >= 7 && horas <= 18) && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { // diurno padrão
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 29;
          nr_seq_regra_esp = 11;
        } else if ((horas >= 7 && horas <= 18) && (diaSemana === "Sábado" || diaSemana === "Domingo")) { // diurno FDS
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 7 || (horaAtual === 7 && minutosAtual > 30))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 13;
          nr_seq_regra_esp = 13;
        } else if ((horas >= 19 || horas < 7) && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { // noturno padrão
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0)))
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" })
          nr_Seq_tipo_plantao = 20;
          nr_seq_regra_esp = 21;
        } else if ((horas >= 19 || horas < 7) && (diaSemana === "Sábado" || diaSemana === "Domingo")) { //noturno FDS
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0)))
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" })
          nr_Seq_tipo_plantao = 14;
          nr_seq_regra_esp = 12;
        } else {
          return res.status(400).json({ message: "Horário inválido para o plantão selecionado." });
        }
        break;

      case 'HKIDS': //plantão médico HKids apoio
        if (diaAtual != diaPlantao) { // restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do dia da escala." });
        }

        if (horas >= 7 && horas <= 12) { // manhã
          if (horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30) ||
            horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0)) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período da manhã (06:30 - 08:00)" });
          }
          nr_Seq_tipo_plantao = 52;
          nr_seq_regra_esp = 53;
        } else if (horas >= 13 && horas <= 18) { // tarde
          if (horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30) ||
            horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora do horários permitidos para o período da tarde (12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 51;
          nr_seq_regra_esp = 51;
        } else if (horas >= 19) { // noite
          if (horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30) ||
            horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0)) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" });
          }
          nr_Seq_tipo_plantao = 46;
          nr_seq_regra_esp = 47;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'PS1':
        if (diaAtual != diaPlantao) { // restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }

        if ((horas >= 7 && horas <= 18) && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { // diurno padrão

          nr_Seq_tipo_plantao = 24;
          nr_seq_regra_esp = 25;
        } else if ((horas >= 7 && horas <= 18) && (diaSemana === "Sábado" || diaSemana === "Domingo")) { // diurno FDS
          nr_Seq_tipo_plantao = 22;
          nr_seq_regra_esp = 24;
        } else if ((horas >= 19 || horas < 7)) { // noturno
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" });
          }
          nr_Seq_tipo_plantao = 23;
          nr_seq_regra_esp = 23;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;


      case 'PS2':
        if (diaAtual != diaPlantao) { // restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }

        if ((horas >= 7 && horas <= 18) && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { // diurno padrão
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 21;
          nr_seq_regra_esp = 22;
        } else if ((horas >= 7 && horas <= 18) && (diaSemana === "Sábado" || diaSemana === "Domingo")) { // diurno FDS
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 7 || (horaAtual === 7 && minutosAtual > 30))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 25;
          nr_seq_regra_esp = 26;
        } else if ((horas >= 19 && horas <= 22)) { // noturno
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" });
          }
          nr_Seq_tipo_plantao = 26;
          nr_seq_regra_esp = 27;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'HKP': //plantão médico HKids
        if (diaAtual != diaPlantao) { // restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do dia da escala." });
        }

        if (horas >= 7 && horas <= 12) { // manhã
          if (horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30) ||
            horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0)) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período da manhã (06:30 - 08:00)" });
          }
          nr_Seq_tipo_plantao = 8;
          nr_seq_regra_esp = 8;
        } else if (horas >= 13 && horas <= 18) { // tarde
          if (horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30) ||
            horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora do horários permitidos para o período da tarde (12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 10;
          nr_seq_regra_esp = 9;
        } else if (horas >= 19 || horas < 7) { // noite
          if (horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30) ||
            horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0)) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" });
          }
          nr_Seq_tipo_plantao = 11;
          nr_seq_regra_esp = 16;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'ORTO':
        if (diaAtual != diaPlantao) { // restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do dia da escala." });
        }

        if (horas >= 8 && horas <= 13) { // manhã
          if (horaAtual < 7 || (horaAtual === 7 && minutosAtual < 30) ||
            horaAtual > 9 || (horaAtual === 9 && minutosAtual > 0)) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período da manhã (07:30 - 09:00)" });
          }
          nr_Seq_tipo_plantao = 18;
          nr_seq_regra_esp = 19;
        } else if (horas >= 14 && horas <= 20) { // tarde
          if (horaAtual < 13 || (horaAtual === 13 && minutosAtual < 30) ||
            horaAtual > 15 || (horaAtual === 15 && minutosAtual > 0)) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora do horários permitidos para o período da tarde (13:30 - 15:00)" });
          }
          nr_Seq_tipo_plantao = 17;
          nr_seq_regra_esp = 20;
        } else if (horas >= 19 || horas < 7) { // noite
          if (horaAtual < 19 || (horaAtual === 19 && minutosAtual < 30) ||
            horaAtual > 21 || (horaAtual === 21 && minutosAtual > 0)) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (19:30 - 21:00)" });
          }
          nr_Seq_tipo_plantao = 19;
          nr_seq_regra_esp = 18;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'PART':
        if (diaAtual != diaPlantao) { // restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }

        if ((horas >= 7 && horas <= 18) && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { // diurno padrão
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 48;
          nr_seq_regra_esp = 19;
        } else if ((horas >= 7 && horas <= 18) && (diaSemana === "Sábado" || diaSemana === "Domingo")) { // diurno FDS
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 30))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 16;
          nr_seq_regra_esp = 17;
        } else if ((horas >= 19 || horas < 7)) { // noturno
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" });
          }
          nr_Seq_tipo_plantao = 15;
          nr_seq_regra_esp = 10;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'UCI':
        if (diaAtual != diaPlantao) { // restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }

        if ((horas >= 7 && horas <= 18) && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { // diurno padrão
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 47;
          nr_seq_regra_esp = 47;
        } else if ((horas >= 7 && horas <= 18) && (diaSemana === "Sábado" || diaSemana === "Domingo")) { // diurno FDS
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 43;
          nr_seq_regra_esp = 43;
        } else if ((horas >= 19 || horas < 7)) { // noturno
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30)) || // restrição noite
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" });
          }
          nr_Seq_tipo_plantao = 42;
          nr_seq_regra_esp = 44;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'UTIG1':
        if (diaAtual != diaPlantao) { // restrição de dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }

        if (horas >= 7 && horas <= 18) { // diurno padrão
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 0)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 28;
          nr_seq_regra_esp = 28;
        } else if (horas >= 19 || horas < 7) { // noturno
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 0)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" });
          }
          nr_Seq_tipo_plantao = 27;
          nr_seq_regra_esp = 29;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;


      case 'UTIG2':
        if (diaAtual != diaPlantao) { // restrição de dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }

        if (horas >= 7 && horas <= 18) { // diurno padrão
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 0)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 28;
          nr_seq_regra_esp = 28;
        } else if (horas >= 19 || horas < 7) { // noturno
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" });
          }
          nr_Seq_tipo_plantao = 27;
          nr_seq_regra_esp = 29;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;


      case 'UTIN':
        if (diaAtual != diaPlantao) { // restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }

        if (horas >= 7 && horas <= 18) { // diurno padrão
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 0)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 30;
          nr_seq_regra_esp = 31;
        } else if (horas >= 19 || horas < 7) { // noturno
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" });
          }
          nr_Seq_tipo_plantao = 31;
          nr_seq_regra_esp = 32;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'UTIP':
        if (diaAtual != diaPlantao) { // restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }

        if (horas >= 7 && horas <= 18) { // diurno padrão
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 0)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 0)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 32;
          nr_seq_regra_esp = 33;
        } else if (horas >= 19 || horas < 7) { // noturno
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 0)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período noturno (18:30 - 20:00)" });
          }
          nr_Seq_tipo_plantao = 33;
          nr_seq_regra_esp = 34;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'CAD': // cardiologia
        if (diaAtual != diaPlantao) { // restrição dia
          return res.status(406).json({ message: "Plantão sendo iniciado fora do horário da escala." });
        }

        if ((horas >= 7 && horas <= 18) && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { // diurno padrão
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 57;
          nr_seq_regra_esp = 90;
        } else if ((horas >= 7 && horas <= 18) && (diaSemana === "Sábado" || diaSemana === "Domingo")) { // diurno FDS
          if (((horaAtual < 6 || (horaAtual === 6 && minutosAtual < 30)) ||
            (horaAtual > 8 || (horaAtual === 8 && minutosAtual > 0))) &&
            ((horaAtual < 12 || (horaAtual === 12 && minutosAtual < 30)) ||
              (horaAtual > 14 || (horaAtual === 14 && minutosAtual > 0)))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora dos horários permitidos para o período diurno (06:30 - 08:00 e 12:30 - 14:00)" });
          }
          nr_Seq_tipo_plantao = 56;
          nr_seq_regra_esp = 56;
        } else if ((horas >= 19 || horas < 7) && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { // noturno padrão
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora do horário permitido para o período noturno (18:30 - 20:00)" });
          }
          nr_Seq_tipo_plantao = 59;
          nr_seq_regra_esp = 91;
        } else if ((horas >= 19 || horas < 7) && (diaSemana === "Sábado" || diaSemana === "Domingo")) { // noturno FDS
          if ((horaAtual < 18 || (horaAtual === 18 && minutosAtual < 30)) ||
            (horaAtual > 20 || (horaAtual === 20 && minutosAtual > 0))) {
            return res.status(406).json({ message: "Plantão sendo iniciado fora do horário permitido para o período noturno (18:30 - 20:00)" });
          }
          nr_Seq_tipo_plantao = 54;
          nr_seq_regra_esp = 54;
        } else {
          return res.status(400).json({ message: "Horário inválido para o plantão selecionado." });
        }
        break;

      default:
        return res.status(400).json({ message: "Tipo de escala inválido." });
    }

    console.log("Parâmetros passados:", {
      userId: cd_medico,
      dt_inicial_prev: dt_inicio,
      dt_inicial: dt_inicio,
      nr_Seq_tipo_plantao,
      nr_seq_regra_esp,
    });

    const query = `
              INSERT INTO MEDICO_PLANTAO (
              cd_estabelecimento, 
              nr_sequencia, 
              cd_medico, 
              dt_chamado, 
              dt_inicial_prev, 
              dt_final_prev, 
              dt_inicial, 
              nr_Seq_tipo_plantao, 
              nr_seq_regra_esp, 
              dt_atualizacao, 
              nm_usuario, 
              qt_minuto
          ) VALUES (
              1, 
              MEDICO_PLANTAO_SEQ.nextval, 
              :cd_medico, 
              TO_DATE(TO_CHAR(TO_DATE(:dt_inicial, 'DD/MM/YYYY HH24:MI:SS') - INTERVAL '1' HOUR, 'DD/MM/YYYY') || ' 06:00:00', 'DD/MM/YYYY HH24:MI:SS'), 
              TO_DATE(:dt_inicial_prev, 'DD/MM/YYYY HH24:MI:SS'), 
              TO_DATE(:dt_final_prev, 'DD/MM/YYYY HH24:MI:SS'), 
              SYSDATE,
              :nr_Seq_tipo_plantao, 
              :nr_seq_regra_esp, 
              SYSDATE, 
              'Plantões FHSL', 
              0
          )
      `;

    console.log('dt_inicio recebido:', dt_inicio);
    console.log('dt_final recebido:', dt_final);

    if (Array.isArray(nr_Seq_tipo_plantao) && Array.isArray(nr_seq_regra_esp)) {
      for (let i = 0; i < nr_Seq_tipo_plantao.length; i++) {
        const result = await connection.execute(query, {
          cd_medico,
          dt_inicial_prev: dt_inicio,
          dt_final_prev: dt_final,
          dt_inicial: dt_inicio,
          nr_Seq_tipo_plantao: nr_Seq_tipo_plantao[i],
          nr_seq_regra_esp: nr_seq_regra_esp[i]
        }, { autoCommit: true });
        console.log(`Inserção realizada para ${nr_Seq_tipo_plantao[i]} e ${nr_seq_regra_esp[i]}`, result);
      }
    } else {
      const result = await connection.execute(query, {
        cd_medico,
        dt_inicial_prev: dt_inicio,
        dt_final_prev: dt_final,
        dt_inicial: dt_inicio,
        nr_Seq_tipo_plantao,
        nr_seq_regra_esp
      }, { autoCommit: true });
      console.log('Inserção realizada', result);
    }
    console.log("Tipo escala:", tipo_escala, "Seq tipo plantão:", nr_Seq_tipo_plantao, "Regra esp:", nr_seq_regra_esp);

    res.status(200).json({ message: "Plantão confirmado com sucesso." });

  } catch (error) {
    console.error('Erro ao confirmar plantão:', error);
    res.status(500).json({ message: "Erro interno ao confirmar plantão." });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Erro ao fechar conexão:', err);
      }
    }
  }
}


async function finalizarPlantao(req, res) {
  const { plantaoId, password, dt_inicio, dt_final, tipo_escala } = req.body;

  if (!req.user || !req.user.id || !password || !dt_inicio || !dt_final || !tipo_escala) {
    return res.status(401).json({ message: "Parâmetros necessários ausentes" });
  }

  console.log("Informações recebidas", req.body);

  const userId = req.user.id;

  try {
    const connection = await getConnection();

    console.log("Conexão Oracle bem-sucedida.");

    const userQuery = `SELECT ds_senha FROM FHSL_APP_TASY_USERS WHERE cd_pessoa_fisica = :userId`;
    const userResult = await connection.execute(userQuery, { userId });

    if (!userResult.rows || userResult.rows.length === 0) {
      await connection.close();
      return res.status(401).json({ message: "Usuário não encontrado." });
    }

    const user = userResult.rows[0];
    const passwordHash = user[0];

    const isPasswordMatch = await bcrypt.compare(password, passwordHash);
    if (!isPasswordMatch) {
      await connection.close();
      return res.status(401).json({ message: "Senha incorreta." });
    }

    const dtInicio = new Date(dt_inicio.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
    if (isNaN(dtInicio.getTime())) {
      console.error(`Formato de data inválido: ${dt_inicio}`);
      return res.status(400).json({ message: 'Formato de data inválido.' });
    }

    const dtFinal = new Date(dt_final.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
    if (isNaN(dtFinal.getTime())) {
      console.error(`Formato de data inválido: ${dt_final}`);
      return res.status(400).json({ message: 'Formato de data inválido' });
    }

    const dataHoraAtual = new Date(); //cria uma data com base no dia atual do sistema
    const diaAtual = dataHoraAtual.getDate();
    let horaAtual = dataHoraAtual.getHours(); //pega as horas com base no dia atual do sistema
    const horaInicio = dtInicio.getHours(); //pega as horas da data inicial do plantão
    const horaFinal = dtFinal.getHours(); //pega as horas da data final do plantão
    const dataHoraComparar = new Date(dataHoraAtual); //peganda a data de uma data para comparar
    dataHoraComparar.setMinutes(0, 0, 0); //pegando os minutos da hora comparada e definindo eles para 00.0
    dataHoraComparar.setHours(dtFinal.getHours() + 2); //pegando as horas da hora final do plantão, e incrementando + 2 para obter o tempo de 1 hora para a finalização do plantão

    const dataHoraCompararPS2 = new Date(dataHoraAtual) //criado específico para o ps2... não usar para outros tipos de plantões
    dataHoraCompararPS2.setMinutes(0,0,0);
    dataHoraCompararPS2.setHours(dtFinal.getHours() + 1);

    const dataHoraCompararApoioHKIDS = new Date(dataHoraAtual) //criado para o novo horário do apoio KIDS
    dataHoraCompararApoioHKIDS.setMinutes(0,0,0);
    dataHoraCompararApoioHKIDS.setHours(dtFinal.getHours() + 1);

    console.log(`Hora atual do sistema: ${horaAtual}`)
    console.log(`Dia atual do sistema: ${diaAtual}`)
    console.log(`Hora final do plantão +2: ${dataHoraComparar.getHours()}`)
    console.log(`Dia início do plantão: ${dtInicio.getDate()}`)
    console.log(`Dia final do plantão: ${dtFinal.getDate()}`)

    switch (tipo_escala) {
      case 'CARD':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'PED':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'CIRT':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'CVAR':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'OFT':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'AMBC':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'OTO':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'URO':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'GO1':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'GO2':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'HKIDS':
        if (horaAtual >= dataHoraCompararApoioHKIDS.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'PS1':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'PS2':
        if (horaAtual >= dataHoraCompararPS2.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'HKP':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'ORTO':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'PART':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'UCI':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'UTIG1':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'UTIG2':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'UTIN':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'UTIP':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      case 'CAD':
        if (horaAtual >= dataHoraComparar.getHours() || diaAtual > dtFinal.getDate()) {
          return res.status(406).json({ message: "Plantão sendo finalizado fora do horário da escala." })
        }
        break;

      default:
        return res.status(400).json({ message: "Tipo de escala inválido" })
    }


    //não é o jeito que queria fazer, mas deu certo
    const updatePlantaoQuery = `
      UPDATE MEDICO_PLANTAO
      SET 
      DT_FINAL = SYSDATE,
      QT_MINUTO = ROUND((SYSDATE - (SELECT MAX(M.DT_INICIAL) FROM MEDICO_PLANTAO M WHERE M.CD_MEDICO = :userId AND M.DT_FINAL IS NULL)) * 24 * 60)
      WHERE CD_MEDICO = :userId
      AND NR_SEQUENCIA = (SELECT MAX(M.NR_SEQUENCIA) FROM MEDICO_PLANTAO M WHERE M.CD_MEDICO = :userId AND M.DT_FINAL IS NULL)
    `;

    await connection.execute(updatePlantaoQuery, { userId });
    await connection.commit();
    await connection.close();

    res.status(200).json({ message: "Plantão finalizado com sucesso." });
  } catch (error) {
    console.error("Erro ao finalizar plantão:", error);
    res.status(500).json({ message: "Erro interno ao finalizar plantão." });
  }
}


async function putAtualizarPlantao(req, res) {
  const { nr_sequencia } = req.body;
  const userId = req.user.id;

  try {

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const connection = await getConnection();

    const atualizarPlantaoCard = `
        UPDATE escala_diaria
        SET CD_PESSOA_FISICA = (SELECT cd_pessoa_fisica FROM fhsl_app_tasy_users WHERE cd_pessoa_fisica = :userId)
        WHERE nr_sequencia = :nr_sequencia`;

    await connection.execute(atualizarPlantaoCard, { nr_sequencia, userId }, { autoCommit: true });

    res.status(200).json({ message: "Atualização realizada com sucesso." });
  } catch (error) {
    console.error("Erro ao tentar atualizar plantão", error);
    res.status(500).json({ message: "Erro interno ao tentar atualizar o plantão." });
  }
}


async function logout(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }
    res.status(200).json({ message: "Logout realizado com sucesso." });
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    res.status(500).json({ message: "Erro interno ao fazer logout." });
  }
}


async function obterEscalasAtivas(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }
    const connection = await getConnection(); // Conectar ao banco de dados

    const query = `
        select ds_escala from escala where ie_situacao = 'A' and NR_SEQ_GRUPO = 61 order by 1
      `;

    const result = await connection.execute(query);

    if (result.rows.length === 0) {
      await connection.close();
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const [escalaAtivas] = result.rows.map(row => ({
      ds_escala: row[0],
    }));

    await connection.close();

    res.status(200).json(escalaAtivas);
  } catch (error) {
    console.error('Erro ao obter informações do usuário:', error);
    res.status(500).json({ message: "Erro interno ao obter informações do usuário." });
  }
}


async function register(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const { cd_pessoa_fisica, nm_completo, nm_usuario } = req.body;

    if (!cd_pessoa_fisica || !nm_completo || !nm_usuario) {
      return res.status(400).json({ message: "Todos os campos são obrigatórios." });
    }

    const connection = await getConnection();

    const checkUserQuery = `SELECT COUNT(*) AS COUNT FROM FHSL_APP_TASY_USERS WHERE cd_pessoa_fisica = :cd_pessoa_fisica`
    const checkUserResult = await connection.execute(checkUserQuery, { cd_pessoa_fisica });

    if (checkUserResult.rows[0].COUNT > 0) {
      await connection.close();
      return res.status(400).json({ message: "Usuário já registrado." });
    }

    const insertUserQuery = `
        INSERT INTO FHSL_APP_TASY_USERS (cd_pessoa_fisica, nm_pessoa_fisica, nm_usuario, ds_senha, ie_reset_senha)
        VALUES (:cd_pessoa_fisica, :nm_completo, :nm_usuario, :nm_usuario,1)
      `;

    await connection.execute(insertUserQuery, {
      cd_pessoa_fisica,
      nm_completo,
      nm_usuario,
    });

    await connection.commit();
    await connection.close();
    res.status(201).json({ message: "Usuário registrado com sucesso." });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({ message: "Erro interno ao registrar usuário." });
  }
}


//Função para adicionar usuários no aplicativo do CC
async function registerAppCC(req, res) {
  try {

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const { cd_pessoa_fisica, nm_completo, nm_usuario } = req.body;

    if (!cd_pessoa_fisica || !nm_completo || !nm_usuario) {
      return res.status(400).json({ message: "Todos os campos são obrigatórios." });
    }

    const connection = await getConnection();

    const checkUserQuery = `SELECT COUNT(*) AS COUNT FROM FHSL_APP_CC_USERS WHERE cd_pessoa_fisica = :cd_pessoa_fisica`
    const checkUserResult = await connection.execute(checkUserQuery, { cd_pessoa_fisica });

    if (checkUserResult.rows[0].COUNT > 0) {
      await connection.close();
      return res.status(400).json({ message: "Usuário já registrado." });
    }

    const insertUserQuery = `
        INSERT INTO FHSL_APP_CC_USERS (cd_pessoa_fisica, nm_pessoa_fisica, nm_usuario, ds_senha, ie_reset_senha, dt_criacao, dt_atualizacao)
        VALUES (:cd_pessoa_fisica, :nm_completo, :nm_usuario, :nm_usuario,1, sysdate, sysdate)
      `;

    await connection.execute(insertUserQuery, {
      cd_pessoa_fisica,
      nm_completo,
      nm_usuario,
    });

    await connection.commit();
    await connection.close();

    res.status(201).json({ message: "Usuário registrado com sucesso." });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({ message: "Erro interno ao registrar usuário." });
  }
}

async function searchAppCC(req, res) {
  let connection;
  try {
    connection = await getConnection();

    const query = `
      SELECT cd_pessoa_fisica, nm_usuario, nm_pessoa_fisica, ie_admin, dt_criacao, dt_atualizacao 
      FROM fhsl_app_cc_users
      WHERE nm_pessoa_fisica LIKE :name
      ORDER BY nm_pessoa_fisica
    `;
    const result = await connection.execute(query, { name: `%${req.query.name || ''}%` });

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Nenhum usuário encontrado." });
    }

    const users = result.rows.map(row => ({
      cd_pessoa_fisica: row[0],
      nm_usuario: row[1],
      nm_pessoa_fisica: row[2],
      ie_admin: row[3],
      dt_criacao: row[4],
      dt_atualizacao: row[5],
    }));

    res.json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Erro ao fechar conexão:', err);
      }
    }
    res.status(500).json({ message: "Erro interno ao buscar usuários." });
  }
}

async function resetAppCC(req, res) {
  const { cd_pessoa_fisica } = req.body;
  if (!cd_pessoa_fisica) {
    return res.status(400).json({ message: "Informe o código da pessoa física." });
  }

  let connection;
  try {
    connection = await getConnection();

    const query = `
      UPDATE fhsl_app_cc_users 
      SET ie_reset_senha = 1, ds_senha = (SELECT nm_usuario FROM fhsl_app_cc_users WHERE cd_pessoa_fisica = :cd_pessoa_fisica)
      WHERE cd_pessoa_fisica = :cd_pessoa_fisica;
    `;
    await connection.execute(query, { cd_pessoa_fisica }, { autoCommit: true });

    res.status(200).json({ message: "Senha resetada com sucesso." });
  } catch (error) {
    console.error('Erro ao resetar senha:', error);
    res.status(500).json({ message: "Erro interno ao resetar senha." });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Erro ao fechar conexão:', err);
      }
    }
  }
}

module.exports = {
  getPlantoesDia,
  getPlantoesListagem,
  iniciarPlantao,
  finalizarPlantao,
  putAtualizarPlantao,
  getUserInfo,
  logout,
  obterEscalasAtivas,
  register,
  registerAppCC,
  searchAppCC,
  resetAppCC
};