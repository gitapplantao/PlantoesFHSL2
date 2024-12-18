const { getConnection } = require('../dbConfig');
const bcrypt = require('bcrypt');
const { format, parse, getHours } = require('date-fns');

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
                WHEN m.cd_medico IS NOT NULL AND m.dt_inicial IS NOT NULL AND m.dt_final IS NULL THEN 'Iniciado'
                WHEN m.cd_medico IS NOT NULL AND m.dt_inicial IS NOT NULL AND m.dt_final IS NOT NULL THEN 'Finalizado'
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
    console.log("Comando passado:", checkUserPlantaoCorreto)

    const checkPlantaoQuery = `SELECT COUNT(*) AS COUNT FROM MEDICO_PLANTAO WHERE cd_medico = :userId AND dt_final IS NULL`;
    const checkPlantaoResult = await connection.execute(checkPlantaoQuery, { userId });

    if (checkPlantaoResult.rows[0].COUNT > 0) {
      await connection.close();
      return res.status(400).json({ message: "Atenção! Você já tem um plantão iniciado." });
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

    const horas = dtInicio.getHours();
    const diasDaSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const diaSemana = diasDaSemana[dtInicio.getDay()];

    console.log(`Dia da semana: ${diaSemana}, Horas ${horas}`)

    let nr_Seq_tipo_plantao, nr_seq_regra_esp;

    switch (tipo_escala) {
      case 'CARD': //cirurgia cardiaca
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 34;
          nr_seq_regra_esp = 35;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'PED': //cirurgia pediatrica
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 12;
          nr_seq_regra_esp = 30;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'CIRT':
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 45;
          nr_seq_regra_esp = 46;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'CVAR':
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 39;
          nr_seq_regra_esp = 40;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'OFT':
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 37;
          nr_seq_regra_esp = 38;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'AMBC':
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 55;
          nr_seq_regra_esp = 55;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'OTO':
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 41;
          nr_seq_regra_esp = 42;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'URO':
        if (horas >= 0 && horas < 24) {
          nr_Seq_tipo_plantao = 35;
          nr_seq_regra_esp = 36;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'GO1': {
        if (horas >= 7 && horas < 19) { //diurno
          if (diaSemana !== "Sábado" && diaSemana !== "Domingo") { //diurno padrão
            nr_Seq_tipo_plantao = 29;
            nr_seq_regra_esp = 11;
          } else { //diurno fim de semana
            nr_Seq_tipo_plantao = 13;
            nr_seq_regra_esp = 13;
          }
        } else if ((horas >= 19 || horas < 7)) { //noturno
          if (diaSemana !== "Sábado" && diaSemana !== "Domingo") { //noturno padrão
            nr_Seq_tipo_plantao = 20;
            nr_seq_regra_esp = 21;
          } else { //noturno fim de semana
            nr_Seq_tipo_plantao = 14;
            nr_seq_regra_esp = 12;
          }
        } else {
          return res.status(400).json({ message: "Horário inválido para o plantão selecionado." });
        }
        break;
      }

      case 'GO2':
        if (dt_inicio >= 7 && dt_final <= 18 && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { //diurno padrão
          nr_Seq_tipo_plantao = 29;
          nr_seq_regra_esp = 11;
        } else if (dt_inicio >= 7 && dt_final <= 18 && (diaSemana === "Sábado" || diaSemana === "Domingo")) { //diurno fim de semana
          nr_Seq_tipo_plantao = 13;
          nr_seq_regra_esp = 13;
        } else if (dt_inicio >= 19 || dt_final <= 7) { //noturno
          nr_Seq_tipo_plantao = 14;
          nr_seq_regra_esp = 12;
        } else {
          return res.status(400).json({ message: "Erro ao adicionar o plantão" });
        }
        break;

      case 'HKIDS': //plantão médico hkids
        if (horas >= 7 && horas <= 12) { //manhã
          nr_Seq_tipo_plantao = 52;
          nr_seq_regra_esp = 53;
        } else if (horas >= 13 && horas <= 18) { //tarde
          nr_Seq_tipo_plantao = 51;
          nr_seq_regra_esp = 51;
        } else if (horas >= 19 || horas < 7) { //noite
          nr_Seq_tipo_plantao = 46;
          nr_seq_regra_esp = 47;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'PS1':
        if (horas >= 7 && horas <= 18 && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { //diurno padrão
          nr_Seq_tipo_plantao = 24;
          nr_seq_regra_esp = 25;
        } else if (horas >= 7 && horas <= 18 && (diaSemana === "Sábado" || diaSemana === "Domingo")) { //diurno FDS
          nr_Seq_tipo_plantao = 22;
          nr_seq_regra_esp = 24;
        } else if ((horas >= 19 || horas < 7)) { //noturno
          nr_Seq_tipo_plantao = 23;
          nr_seq_regra_esp = 23;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;


      case 'PS2':
        if (horas >= 7 && horas <= 18 && (diaSemana !== "Sábado" && diaSemana !== "Domingo")) { //diurno padrão
          nr_Seq_tipo_plantao = 21;
          nr_seq_regra_esp = 22;
        } else if (horas >= 7 && horas <= 18 && (diaSemana === "Sábado" || diaSemana === "Domingo")) { //diurno FDS
          nr_Seq_tipo_plantao = 25;
          nr_seq_regra_esp = 26;
        } else if ((horas >= 19 || horas < 7)) { //noturno
          nr_Seq_tipo_plantao = 26;
          nr_seq_regra_esp = 27;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'HKP': //apoio pediatria
        if (horas >= 7 && horas <= 12) { //manhã
          nr_Seq_tipo_plantao = 8;
          nr_seq_regra_esp = 8;
        } else if (horas >= 13 && horas <= 18) { //tarde
          nr_Seq_tipo_plantao = 10;
          nr_seq_regra_esp = 9;
        } else if ((horas >= 19 || horas < 7)) { //noturno
          nr_Seq_tipo_plantao = 11;
          nr_seq_regra_esp = 16;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'ORTO':
        if (horas >= 7 && horas <= 12) { //manhã
          nr_Seq_tipo_plantao = 18;
          nr_seq_regra_esp = 19;
        } else if (horas >= 13 && horas <= 18) { //tarde
          nr_Seq_tipo_plantao = 17;
          nr_seq_regra_esp = 20;
        } else if ((horas >= 19 || horas < 7)) { //noturno
          nr_Seq_tipo_plantao = 19;
          nr_seq_regra_esp = 18;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'PART':
        if (horas >= 7 && horas <= 18) { //diurno
          if (diaSemana !== "Sábado" && diaSemana !== "Domingo") { //diurno padrão
            nr_Seq_tipo_plantao = 48;
            nr_seq_regra_esp = 19;
          } else { // diurno FDS
            nr_Seq_tipo_plantao = 16;
            nr_seq_regra_esp = 17;
          }
        } else if ((horas >= 19 || horas < 7)) { //noturno
          nr_Seq_tipo_plantao = 15;
          nr_seq_regra_esp = 10;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'UCI':
        if (horas >= 7 && horas <= 18) {
          if (diaSemana !== "Sábado" && diaSemana !== "Domingo") { //diurno padrão
            nr_Seq_tipo_plantao = 47;
            nr_seq_regra_esp = 47;
          } else { //diurno FDS
            nr_Seq_tipo_plantao = 43;
            nr_seq_regra_esp = 43;
          }
        } else if ((horas >= 19 || horas < 7)) { //noturno
          nr_Seq_tipo_plantao = 42;
          nr_seq_regra_esp = 44;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'UTIG1':
        if (horas >= 7 && horas <= 18) { //diurno padrão
          nr_Seq_tipo_plantao = 28;
          nr_seq_regra_esp = 28;
        } else if ((horas >= 19 || horas < 7)) { //noturno
          nr_Seq_tipo_plantao = 27;
          nr_seq_regra_esp = 29;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'UTIG2':
        if (horas >= 7 && horas <= 18) { //diurno padrão
          nr_Seq_tipo_plantao = 28;
          nr_seq_regra_esp = 28;
        } else if ((horas >= 19 || horas < 7)) { //noturno
          nr_Seq_tipo_plantao = 27;
          nr_seq_regra_esp = 29;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'UTIN':
        if (horas >= 7 && horas <= 18) { //diurno padrão
          nr_Seq_tipo_plantao = 30;
          nr_seq_regra_esp = 31;
        } else if ((horas >= 19 || horas < 7)) { //noturno
          nr_Seq_tipo_plantao = 31;
          nr_seq_regra_esp = 32;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'UTIP':
        if (horas >= 7 && horas <= 18) { //diurno padrão
          nr_Seq_tipo_plantao = 32;
          nr_seq_regra_esp = 33;
        } else if ((horas >= 19 || horas < 7)) { //noturno
          nr_Seq_tipo_plantao = 33;
          nr_seq_regra_esp = 34;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
        }
        break;

      case 'CAD':
        if (horas >= 7 && horas <= 18) { //diurno
          nr_Seq_tipo_plantao = 56;
          nr_seq_regra_esp = 56;
        } else if ((horas >= 19 || horas < 7)) { //noturno
          nr_Seq_tipo_plantao = 54;
          nr_seq_regra_esp = 54;
        } else {
          return res.status(400).json({ message: "Turno inválido para o plantão selecionado." });
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
              'app', 
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
  const { plantaoId, password } = req.body;

  if (!req.user || !req.user.id || !password) {
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
  registerAppCC
};