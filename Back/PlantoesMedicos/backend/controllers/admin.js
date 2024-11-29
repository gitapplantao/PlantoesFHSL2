const { getConnection } = require('../dbConfig');
const XLSX = require('xlsx');
//const format = require('date-fns');

async function getUsers(req, res) {
    let connection;
    try {
      connection = await getConnection();
  
      const query = `
        SELECT cd_pessoa_fisica, nm_usuario, nm_pessoa_fisica, ie_admin, dt_criacao, dt_atualizacao 
        FROM fhsl_app_tasy_users
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

async function resetPassword(req, res) {
  const { cd_pessoa_fisica } = req.body;
  if (!cd_pessoa_fisica) {
    return res.status(400).json({ message: "Informe o código da pessoa física." });
  }

  let connection;
  try {
    connection = await getConnection();

    const query = `
      UPDATE fhsl_app_tasy_users 
      SET ie_reset_senha = 1, ds_senha = (SELECT nm_usuario FROM fhsl_app_tasy_users WHERE cd_pessoa_fisica = :cd_pessoa_fisica)
      WHERE cd_pessoa_fisica = :cd_pessoa_fisica
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

async function getPlantoes(req, res) {
    const { cd_medico, dataInicial, dataFinal } = req.query;
  
    if (!cd_medico || !dataInicial || !dataFinal) {
      return res.status(400).json({ message: "Parâmetros necessários ausentes." });
    }
  
    let connection;
    try {
      connection = await getConnection();
  
      const query = `
        SELECT
          nr_sequencia,
          cd_medico,
          obter_nome_medico(cd_medico, 'N') AS nm_medico,
          dt_inicial,
          dt_final,
          dt_inicial_prev,
          dt_final_prev,
          dt_chamado,
          CASE
            WHEN dt_inicial IS NULL THEN 'Não realizado'
            WHEN dt_inicial IS NOT NULL AND dt_final IS NULL THEN 'Não finalizado'
            WHEN dt_inicial IS NOT NULL AND dt_final IS NOT NULL THEN 'Realizado'
          END AS situacao
        FROM medico_plantao
        WHERE cd_medico = :cd_medico
          AND dt_inicial_prev >= TO_DATE(:dataInicial, 'yyyy-MM-dd')
          AND dt_inicial_prev <= TO_DATE(:dataFinal, 'yyyy-MM-dd')
          order by dt_inicial_prev desc
      `;
      const result = await connection.execute(query, { cd_medico, dataInicial, dataFinal });
  
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Nenhum plantão encontrado." });
      }
  
      const plantoes = result.rows.map(row => ({
        nr_sequencia: row[0],
        cd_medico: row[1],
        nm_medico: row[2],
        dt_inicial: row[3],
        dt_final: row[4],
        dt_inicial_prev: row[5],
        dt_final_prev: row[6],
        dt_chamado: row[7],
        situacao: row[8],
      }));
  
      res.json(plantoes);
    } catch (error) {
      console.error('Erro ao buscar plantões:', error);
      res.status(500).json({ message: "Erro interno ao buscar plantões." });
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
  

async function updatePlantao(req, res) {
  const { nr_sequencia, dt_inicial, dt_final } = req.body;

  if (!nr_sequencia || !dt_inicial || !dt_final) {
    return res.status(400).json({ message: "Parâmetros necessários ausentes." });
  }

  let connection;
  try {
    connection = await getConnection();

    const query = `
      UPDATE medico_plantao
      SET dt_inicial = TO_DATE(:dt_inicial, 'yyyy-MM-dd HH24:MI:SS'),
          dt_final = TO_DATE(:dt_final, 'yyyy-MM-dd HH24:MI:SS')
      WHERE nr_sequencia = :nr_sequencia
    `;
    await connection.execute(query, { nr_sequencia, dt_inicial, dt_final }, { autoCommit: true });

    res.status(200).json({ message: "Plantão atualizado com sucesso." });
  } catch (error) {
    console.error('Erro ao atualizar plantão:', error);
    res.status(500).json({ message: "Erro interno ao atualizar plantão." });
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

async function downloadPlantaoXLSX(req, res) {
  const { cd_pessoa_fisica, dataInicial, dataFinal } = req.query;

  if (!cd_pessoa_fisica || !dataInicial || !dataFinal) {
    return res.status(400).json({ message: "Parâmetros necessários ausentes." });
  }

  let connection;
  try {
    connection = await getConnection();

    const query = `
      SELECT
        nr_sequencia,
        cd_medico,
        obter_nome_medico(cd_medico, 'N') AS nm_medico,
        dt_inicial,
        dt_final,
        dt_inicial_prev,
        dt_final_prev,
        dt_chamado,
        CASE
          WHEN dt_inicial IS NULL THEN 'Não realizado'
          WHEN dt_inicial IS NOT NULL AND dt_final IS NULL THEN 'Não finalizado'
          WHEN dt_inicial IS NOT NULL AND dt_final IS NOT NULL THEN 'Realizado'
        END AS situacao
      FROM medico_plantao
      WHERE cd_medico = :cd_pessoa_fisica
        AND dt_inicial_prev >= TO_DATE(:dataInicial, 'yyyy-MM-dd')
        AND dt_inicial_prev <= TO_DATE(:dataFinal, 'yyyy-MM-dd')
    `;
    const result = await connection.execute(query, { cd_pessoa_fisica, dataInicial, dataFinal });

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Nenhum plantão encontrado." });
    }

    const plantoes = result.rows.map(row => ({
      nr_sequencia: row[0],
      cd_medico: row[1],
      nm_medico: row[2],
      dt_inicial: row[3],
      dt_final: row[4],
      dt_inicial_prev: row[5],
      dt_final_prev: row[6],
      dt_chamado: row[7],
      situacao: row[8],
    }));

    // Cria a planilha XLSX
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(plantoes);
    XLSX.utils.book_append_sheet(wb, ws, 'Plantões');

    // Define o cabeçalho da resposta
    res.setHeader('Content-Disposition', 'attachment; filename=plantoes.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Envia a planilha como resposta
    const xlsxData = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.send(xlsxData);
  } catch (error) {
    console.error('Erro ao gerar XLSX:', error);
    res.status(500).json({ message: "Erro interno ao gerar o arquivo XLSX." });
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


async function downloadPlantaoMes(req, res) {
  const {  mesAno } = req.query;

  if (!mesAno ) {
    return res.status(400).json({ message: "Parâmetros necessários ausentes." });
  }

  let connection;
  try {
    connection = await getConnection();

    const query = `SELECT
    obter_nome_medico(cd_medico, 'N') nm_medico,
    dt_inicial,
    dt_final, 
    dt_inicial_prev,
    dt_final_prev,
    CASE
        when dt_inicial is null and dt_final is null then 'Não realizado'
        when dt_inicial is not null and dt_final is not null then 'Finalizado'
        when dt_inicial is not null and dt_final is null then 'Não finalizado'
    END as status,
    Obter_Dia_Semana(dt_inicial_prev) dia_semana,
    CASE 
        when esus_obter_turno_data(dt_inicial_prev) = 1 then 'Manhã'
        when esus_obter_turno_data(dt_inicial_prev) = 2 then 'Tarde'
        when esus_obter_turno_data(dt_inicial_prev) = 3 then 'Noite'
    END as turno,
    obter_desc_tipo_plantao(nr_seq_tipo_plantao) tipo_plantao
FROM
    medico_plantao
WHERE
    to_char(dt_inicial_prev, 'mm/yyyy') = :mesAno
    `;
    const result = await connection.execute(query, { mesAno });

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Nenhum plantão encontrado." });
    }

    const plantoesMes = result.rows.map(row => ({
      nm_medico: row[0],
      dt_inicial: row[1],
      dt_final: row[2],
      dt_inicial_prev: row[3],
      dt_final_prev: row[4],
      status: row[5],
      dia_semana: row[6],
      turno: row[7],
      tipo_plantao: row[8],
    }));

    // Cria a planilha XLSX
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(plantoesMes);
    XLSX.utils.book_append_sheet(wb, ws, 'Plantão Mensal');

    // Define o cabeçalho da resposta
    res.setHeader('Content-Disposition', 'attachment; filename=plantoes.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Envia a planilha como resposta
    const xlsxData = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.send(xlsxData);
  } catch (error) {
    console.error('Erro ao gerar XLSX:', error);
    res.status(500).json({ message: "Erro interno ao gerar o arquivo XLSX." });
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

async function getPlantao24h(req, res) {
  const { tipo_escala, mesAno } = req.query;

  if (!tipo_escala || !mesAno) {
      return res.status(400).json({ message: "Parâmetros necessários ausentes." });
  }

  let connection;
  try {
      connection = await getConnection();

      const query = `
         SELECT 
            t.tipo_escala, 
            t.dt_inicio, 
            t.dt_fim, 
            t.cd_pessoa_fisica, 
            t.nm_medico, 
            t.escala,
            CASE 
                WHEN m.cd_medico IS NOT NULL AND m.dt_inicial IS NOT NULL THEN 'Finalizado'
                ELSE NULL
            END AS status,
            Obter_Dia_Semana(dt_inicio)
         FROM 
            fhsl_plantoes_app_tasy t
         LEFT JOIN 
            MEDICO_PLANTAO m
         ON 
            t.cd_pessoa_fisica = m.cd_medico 
            AND to_char(t.dt_inicio,'dd/mm/yyyy hh24') = to_char(m.dt_inicial,'dd/mm/yyyy hh24')
         WHERE 
            t.tipo_escala = :tipo_escala
            AND to_char(t.dt_inicio, 'mm/yyyy') = :mesAno
      `;
      const result = await connection.execute(query, { tipo_escala, mesAno });



      if (result.rows.length === 0) {
          return res.status(404).json({ message: "Nenhum plantão encontrado." });
      }

      const plantoes = result.rows.map(row => ({
          tipo_escala: row[0],
          dt_inicio: row[1],
          dt_fim: row[2],
          cd_pessoa_fisica: row[3],
          nm_medico: row[4],
          escala: row[5],
          situacao: row[6],
          dia_semana: row[7]
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


async function confirmarPlantao(req, res) {
  const { tipo_escala, cd_medico, dt_inicio, dt_final } = req.body;

  if (!tipo_escala || !cd_medico || !dt_inicio || !dt_final) {
      return res.status(400).json({ message: "Parâmetros necessários ausentes." });
  }

  let connection;
  try {
      connection = await getConnection();
      console.log('Conexão com o banco de dados estabelecida com sucesso.');

      const dtInicio = new Date(dt_inicio.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
      if (isNaN(dtInicio.getTime())){
        console.error('Formato de data inválido: ${dt_inicio}');
        return res.status(400).json({message: 'Formato de data inválido.'});
      }

      const horas = dtInicio.getHours();
      const diasDaSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
      const diaSemana = diasDaSemana[dtInicio.getDay()];

      console.log(`Dia da semana: ${diaSemana}, Horas ${horas}`)

      let nr_Seq_tipo_plantao, nr_seq_regra_esp;

      switch (tipo_escala) {
          case 'CARD': //cirurgia cardiaca
              nr_Seq_tipo_plantao = 34;
              nr_seq_regra_esp = 35;
              break;

          case 'PED':
              nr_Seq_tipo_plantao = 12;
              nr_seq_regra_esp = 30;
              break;

          case 'CIRT':
                nr_Seq_tipo_plantao = 45;
                nr_seq_regra_esp = 46;
              break;

          case 'CVAR':
              nr_Seq_tipo_plantao = 39;
              nr_seq_regra_esp = 40;
              break;

          case 'OFT':
              nr_Seq_tipo_plantao = 37;
              nr_seq_regra_esp = 38;
              break;
          
          case 'AMBC':
              nr_Seq_tipo_plantao = 55;
              nr_seq_regra_esp = 55;
              break;

          case 'GO1':
            if (horas >= 7 && horas <= 18 && (diaSemana !== 'Sábado' && diaSemana !== 'Domingo')) { // diurno
              nr_Seq_tipo_plantao = 29;
              nr_seq_regra_esp = 11;
            } else if (horas >= 7 && horas <= 18 && (diaSemana === 'Sábado' || diaSemana === 'Domingo')) { // diurno final de semana
              nr_Seq_tipo_plantao = 13;
              nr_seq_regra_esp = 13;
            } else if ((horas >= 19 || horas < 7) && (diaSemana === 'Sábado' || diaSemana === 'Domingo')) { // noturno final de semana
              nr_Seq_tipo_plantao = 14;
              nr_seq_regra_esp = 12;
            } else { // noturno
              nr_Seq_tipo_plantao = 20;
              nr_seq_regra_esp = 21;
            }
            break;

          case 'GO2':
            if (horas >= 7 && horas <= 18 && (diaSemana !== 'Sábado' && diaSemana !== 'Domingo')) { // diurno
              nr_Seq_tipo_plantao = 29;
              nr_seq_regra_esp = 11;
            } else if (horas >= 7 && horas <= 18 && (diaSemana === 'Sábado' || diaSemana === 'Domingo')) { // diurno final de semana
              nr_Seq_tipo_plantao = 13;
              nr_seq_regra_esp = 13;
            } else if ((horas >= 19 || horas < 7) && (diaSemana === 'Sábado' || diaSemana === 'Domingo')) { // noturno final de semana
              nr_Seq_tipo_plantao = 14;
              nr_seq_regra_esp = 12;
            } else { // noturno
              nr_Seq_tipo_plantao = 20;
              nr_seq_regra_esp = 21;
            }
            break;

          case 'HKIDS':
            if (horas >= 7 && horas <= 12){ //dia
                nr_Seq_tipo_plantao = 52;
                nr_seq_regra_esp = 53;
              } else if (horas >=13 && horas <=18){ //tarde
                nr_Seq_tipo_plantao = 51;
                nr_seq_regra_esp = 51;
              } else { //noite
                nr_Seq_tipo_plantao = 46;
                nr_seq_regra_esp = 47;
              }
            break;

          case 'OTO':
            nr_Seq_tipo_plantao = 41;
            nr_seq_regra_esp = 42;
            break;

          case 'PS1':
            if (horas >= 7 && horas <= 18 && (diaSemana === 'Sábado' || diaSemana === 'Domingo')) { // diurno final de semana
                nr_Seq_tipo_plantao = 22;
                nr_seq_regra_esp = 24;
              } else if (horas >= 7 && horas <= 18){ //diurno
                nr_Seq_tipo_plantao = 24;
                nr_seq_regra_esp = 25;
              } else { //noturno
                nr_Seq_tipo_plantao = 23;
                nr_seq_regra_esp = 23;
              }
              break;

          case 'PS2':
            if (horas >= 7 && horas <= 18 && (diaSemana === 'Sábado' || diaSemana === 'Domingo')) { // diurno final de semana
                nr_Seq_tipo_plantao = 25;
                nr_seq_regra_esp = 26;
              } else if (horas >= 7 && horas <= 18){ //diurno
                nr_Seq_tipo_plantao = 21;
                nr_seq_regra_esp = 22;
              } else { //noturno
                nr_Seq_tipo_plantao = 26;
                nr_seq_regra_esp = 27;
              }
              break;

          case 'HKP':
            if (horas >= 7 && horas <=12){ //dia
                nr_Seq_tipo_plantao = 8;
                nr_seq_regra_esp = 8;
              } else if (horas >= 13 && horas <= 18){ //tarde
                nr_Seq_tipo_plantao = 10;
                nr_seq_regra_esp = 9;
              } else { //noite
                nr_Seq_tipo_plantao = 11;
                nr_seq_regra_esp = 16;
              }
              break;

          case 'ORTO':
            if (horas >= 7 && horas <= 12){ //dia
                nr_Seq_tipo_plantao = 18;
                nr_seq_regra_esp = 19;
              } else if (horas >=13 && horas <=18){ //tarde
                nr_Seq_tipo_plantao = 17;
                nr_seq_regra_esp = 20;
              } else { //noite
                nr_Seq_tipo_plantao = 19;
                nr_seq_regra_esp = 18;
              }
              break;

          case 'PART':
            if (horas >= 7 && horas <= 18 && (diaSemana === 'Sábado' || diaSemana === 'Domingo')) { // diurno final de semana
              nr_Seq_tipo_plantao = 16;
              nr_seq_regra_esp = 17;
            } else if (horas >= 7 && horas <= 18){ //diurno
              nr_Seq_tipo_plantao = 48;
              nr_seq_regra_esp = 49;
            } else { //noite
              nr_Seq_tipo_plantao = 15;
              nr_seq_regra_esp = 10;
            }
              break;

          case 'UCI':
             if (horas >= 7 && horas <= 18 && (diaSemana === 'Sábado' || diaSemana === 'Domingo')) { // diurno final de semana
              nr_Seq_tipo_plantao = 43;
              nr_seq_regra_esp = 43;
            } else if (horas >= 7 && horas <= 18){ //diurno
              nr_Seq_tipo_plantao = 47;
              nr_seq_regra_esp = 48
            } else { //noturno
              nr_Seq_tipo_plantao = 42;
              nr_sequencia = 44;
            }
              break;

          case 'URO':
              nr_Seq_tipo_plantao = 35;
              nr_seq_regra_esp = 36;
              break;

          case 'UTIG1':
            if (horas >= 7 && horas <= 18){ //diurno
              nr_Seq_tipo_plantao = 28;
              nr_seq_regra_esp = 28;
            } else { //noturno
              nr_Seq_tipo_plantao = 27;
              nr_seq_regra_esp = 29;
            }
              break;

          case 'UTIG2':
            if (horas >= 7 && horas <= 18){ //diurno
              nr_Seq_tipo_plantao = 28;
              nr_seq_regra_esp = 28;
            } else { //noturno
              nr_Seq_tipo_plantao = 27;
              nr_seq_regra_esp = 29;
            }
              break;

          case 'UTIN':
            if (horas >= 7  && horas <= 18){ //diurno
              nr_Seq_tipo_plantao = 30;
              nr_seq_regra_esp = 31;
            } else { //noturno
              nr_Seq_tipo_plantao = 31;
              nr_seq_regra_esp = 32;}
              break;

          case 'UTIP':
            if (horas >= 7 && horas <= 18){ //diurno
              nr_Seq_tipo_plantao = 32;
              nr_seq_regra_esp = 33;
            } else { //noturno
              nr_Seq_tipo_plantao = 33;
              nr_seq_regra_esp = 34;
            }
              break;

          case 'CAD': //cardiologia
            if (horas >= 7 && horas <= 18) { //cardiologia FDS e feriado diurno
              nr_Seq_tipo_plantao = 56;
              nr_seq_regra_esp = 56;
            } else { // cardiologia FDS e feriado noite
              nr_Seq_tipo_plantao = 54;
              nr_seq_regra_esp = 54;
            }
              break;

          default:
              return res.status(400).json({ message: "Tipo de escala inválido." });
      }
      
      const query = `
          INSERT INTO MEDICO_PLANTAO (
              cd_estabelecimento, 
              nr_sequencia, 
              cd_medico, 
              dt_chamado, 
              dt_inicial_prev, 
              dt_final_prev, 
              dt_inicial, 
              dt_final,
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
              TO_DATE(:dt_inicial, 'DD/MM/YYYY HH24:MI:SS'), 
              TO_DATE(:dt_final, 'DD/MM/YYYY HH24:MI:SS'),
              :nr_Seq_tipo_plantao, 
              :nr_seq_regra_esp, 
              SYSDATE, 
              'app', 
              (TO_DATE(:dt_final, 'DD/MM/YYYY HH24:MI:SS') - TO_DATE(:dt_inicial, 'DD/MM/YYYY HH24:MI:SS')) * 24 * 60
          )
      `;

      if (Array.isArray(nr_Seq_tipo_plantao) && Array.isArray(nr_seq_regra_esp)) {
          for (let i = 0; i < nr_Seq_tipo_plantao.length; i++) {
              const result = await connection.execute(query, {
                  cd_medico,
                  dt_inicial_prev: dt_inicio,
                  dt_final_prev: dt_final,
                  dt_inicial: dt_inicio,
                  dt_final: dt_final,
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
              dt_final: dt_final,
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

module.exports = {
  getUsers,
  resetPassword,
  getPlantoes,
  updatePlantao,
  downloadPlantaoXLSX,
  downloadPlantaoMes,
  getPlantao24h,
  confirmarPlantao
};