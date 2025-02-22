import React, { useState, useEffect, useRef } from 'react';
import { format, parseISO, parse, isValid } from 'date-fns';
import './styles/plantoesRefeito.css';
import Header from './header';
import api from '../api/config';

function PlantoesLista() {
  const [plantoes, setPlantoes] = useState([]);
  const [passwordError, setPasswordError] = useState(false);
  const [selectedPlantao, setSelectedPlantao] = useState(null);
  const [tipoEscala, setTipoEscala] = useState('');
  const [promptPlantao, setPlantoesPrompt] = useState(false);
  const [promptPlantaoFinalizar, setPlantoesPromptFinalizar] = useState(false);
  const [password, setPassword] = useState('');
  const [dataDiaMesAno, setdataDiaMesAno] = useState('');
  const [erro, setErro] = useState('');
  const [atualizado, setAtualizado] = useState([]);
  const [iniciado, setIniciado] = useState([]);
  const [finalizado, setFinalizado] = useState([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const modalRef = useRef(null)
  const [plantaoAtual, setPlantaoAtual] = useState(null);
  const [plantaoVerificar, setPlantaoVerificar] = useState(false);
  const [plantaoHorario, setPlantaoHorario] = useState(false);
  const [plantaoFinal, setPromptPlantaoFinal] = useState(false);
  const [plantaoMultiplos, setPlantaoMultiplos] = useState(false);
  const [requestEnviado, setRequestEnviado] = useState(false);

  
  const handleRadioChange = (event) => {
    setTipoEscala(event.target.value);
  };

  const handleDateChange = (event) => {
    setdataDiaMesAno(event.target.value);
  };

  const fetchPlantoes = async () => {
    console.log('Parâmetros enviados para fetchPlantoes:', { tipoEscala, dataDiaMesAno });
    if (!tipoEscala || !dataDiaMesAno) {
      setErro('Todos os campos devem ser preenchidos.');
      return;
    }

    setPlantoes([]);
    setErro('');

    const [ano, mes, dia] = dataDiaMesAno.split('-');
    const formattedDate = `${dia}/${mes}/${ano}`;

    try {
      const token = sessionStorage.getItem('token');
      const response = await api.get('/api/plantoes/plantoesListagem', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          tipo_escala: tipoEscala,
          diaMesAno: formattedDate
        }
      });

      const plantoesFormatted = response.data.map((plantao) => {
        const dt_inicio = plantao.dt_inicio ? parseISO(plantao.dt_inicio) : null;
        const dt_fim = plantao.dt_fim ? parseISO(plantao.dt_fim) : null;

        return {
          ...plantao,
          dt_inicio: dt_inicio ? format(dt_inicio, 'dd/MM/yyyy HH:mm:ss') : 'Não iniciado',
          dt_fim: dt_fim ? format(dt_fim, 'dd/MM/yyyy HH:mm:ss') : 'Não finalizado',
          situacao: plantao.situacao || 'Não iniciado',
        };
      });

      setPlantoes(plantoesFormatted);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.warn('Nenhum plantão encontrado, exibindo estado vazio.');
        setPlantoes([]); // Define a lista como vazia
        setErro('Nenhum plantão encontrado para os critérios selecionados.');
      } else {
        console.error('Erro ao buscar plantões:', error);
        setErro('Erro ao buscar plantões. Verifique o console para mais detalhes.');
      }
    }
  };

  const putAtualizarPlantao = async (plantao) => {

    try {
      const token = sessionStorage.getItem("token");

      const requestBody = {
        nr_sequencia: plantao.nr_sequencia
      };

      console.log("Enviando Request Body:", requestBody);
      await api.put("api/plantoes/atualizarPlantao", requestBody, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      setAtualizado(new Set([...atualizado, plantao.cd_pessoa_fisica]));
      fetchPlantoes();
      setScrollPosition(window.scrollY);
    } catch (error) {
      if (error.response) {
        console.error("Erro ao substituir plantonista:", error.response.data);
        setErro(`Erro ao substituir plantonista: ${error.response.data.message || "Erro desconhecido"}`)
      } else {
        console.error("Erro ao substituir plantonista:", error);
        setErro("Erro ao substituir plantonista.");
      }
    }
  };


  const handlePlantaoSelecionado = (plantao) => {
    if (selectedPlantao === plantao) {
      setSelectedPlantao(null);
    } else {
      setSelectedPlantao(plantao);
    }
    console.log("Plantão selecionado:", plantao.nr_sequencia, plantao.dt_inicio)
  };


  const handleIniciarPlantao = (plantao) => {
    if (!selectedPlantao) {
      return alert("Selecione um plantão.");
    }

    if (selectedPlantao.dt_inicial === 'Não iniciado') {
      return alert('Você não pode finalizar um plantão que não foi iniciado.');
    }

    setPlantoesPrompt(true);
    setSelectedPlantao(plantao);
    setPlantaoAtual(plantao);

    if (modalRef.current) {
      modalRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };


  const handleFinalizarPlantao = (plantao) => {
    if (!selectedPlantao) {
      return alert("Selecione um plantão.");
    }

    if (selectedPlantao.dt_inicial === "Não iniciado") {
      return alert("Você não pode finalizar um plantão que não foi iniciado.")
    }

    setPlantoesPromptFinalizar(true);
    setSelectedPlantao(plantao);
    setPlantaoAtual(plantao);

    if (modalRef.current) {
      modalRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };


  const handleSubmitPlantao = async () => {
    if (!plantaoAtual) {
      console.error('Erro: Nenhum plantão foi selecionado.');
      return;
    }

    const convertToCustomFormat = (dateString) => {
      const formatString = 'dd/MM/yyyy HH:mm:ss';
      if (!dateString) {
        console.error('Erro: dateString está vazio ou indefinido.');
        return null;
      }
      try {
        const parsedDate = parse(dateString, formatString, new Date());
        return isValid(parsedDate) ? format(parsedDate, formatString) : null;
      } catch (error) {
        console.error('Erro ao converter data:', error);
        return null;
      }
    };

    const plantaoId = plantaoAtual?.nr_sequencia;

    if (!plantaoId) {
      console.error('Erro: plantaoId não está definido.');
      return;
    }

    if (!password) {
      alert("Por favor informe sua senha.");
      return;
    }

    setRequestEnviado(true);

    try {
      const token = sessionStorage.getItem('token');
      const dt_inicioFormatted = convertToCustomFormat(plantaoAtual.dt_inicio);
      const dt_finalFormatted = convertToCustomFormat(plantaoAtual.dt_fim);

      if (!dt_inicioFormatted || !dt_finalFormatted) {
        console.error('Erro: Datas formatadas são inválidas.');
        setRequestEnviado(false);
        return;
      }

      const requestBody = {
        tipo_escala: plantaoAtual.tipo_escala,
        cd_medico: plantaoAtual.cd_pessoa_fisica,
        dt_inicio: dt_inicioFormatted,
        dt_final: dt_finalFormatted,
        password,
        plantaoId,
      };

      console.log('Enviando request body:', requestBody);

      await api.post('/api/iniciar', requestBody, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      setIniciado(new Set([...iniciado, plantaoAtual.cd_pessoa_fisica]));
      setPlantoes((prevPlantoes) =>
        prevPlantoes.map((plantao) =>
          plantao.nr_sequencia === plantaoId
            ? { ...plantao, situacao: 'Iniciado' } // Atualiza o estado local
            : plantao
        )
      );
      setPlantoesPrompt(false);
      setScrollPosition(window.scrollY);
      setPassword('');
      setPasswordError(false);
      setPlantaoVerificar(false);
      setPlantaoHorario(false);
      setPlantaoMultiplos(false);
      setSelectedPlantao(null);
      setPlantaoAtual(null);
    } catch (error) {
      if (error.response) {
        console.error('Erro ao confirmar plantão:', error.response.data);
        setErro(`Erro ao confirmar plantão: ${error.response.data.message || 'Erro desconhecido'}`);
      } else {
        console.error('Erro ao confirmar plantão:', error);
        setErro('Erro ao confirmar plantão.');
      }
      if (error.response && error.response.status === 405) {
        setPlantaoMultiplos(true);
        alert("Você já tem um plantão ativo. Não é possível iniciar um novo.");
      }
      if (error.response && error.response.status === 401) {
        setPasswordError(true);
      }
      if (error.response && error.response.status === 403) {
        setPlantaoVerificar(true);
      }
      if (error.response && error.response.status === 406) {
        setPlantaoHorario(true);
      }
    } finally {
      setRequestEnviado(false);
    }
  };
  const finalizarPlantao = async (plantao) => {
    if (!plantaoAtual) {
      console.error('Erro: Nenhum plantão foi selecionado.');
      return;
    }

    const convertToCustomFormat = (dateString) => {
      const formatString = 'dd/MM/yyyy HH:mm:ss';
      if (!dateString) {
        console.error('Erro: dateString está vazio ou indefinido.');
        return null;
      }
      try {
        const parsedDate = parse(dateString, formatString, new Date());
        return isValid(parsedDate) ? format(parsedDate, formatString) : null;
      } catch (error) {
        console.error('Erro ao converter data:', error);
        return null;
      }
    };
    

    try {

      if (!password) {
        alert("Por favor informe sua senha.")
        return;
      }

      const token = sessionStorage.getItem("token");
      const plantaoId = plantaoAtual.NR_SEQUENCIA;
      const dt_inicioFormatted = convertToCustomFormat(plantaoAtual.dt_inicio);
      const dt_finalFormatted = convertToCustomFormat(plantaoAtual.dt_fim);

      const requestBody = {
        plantaoId,
        tipo_escala: plantaoAtual.tipo_escala,
        dt_inicio: dt_inicioFormatted,
        dt_final: dt_finalFormatted,
        password
      };

      console.log("Enviando o request body:", requestBody);
      await api.put("api/finalizar", requestBody, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      });

      setFinalizado(new Set([...finalizado, plantao.cd_pessoa_fisica]));
      fetchPlantoes();
      setScrollPosition(window.scrollY);
      setPlantoesPromptFinalizar(false);
      setPassword("");
      setPlantaoVerificar(false);
      setPlantaoHorario(false);
      setPromptPlantaoFinal(false);
      setPasswordError(false);
    } catch (error) {
      if (error.response) {
        console.error("Erro ao finalizar plantão:", error.response.data);
        setErro(`Erro ao finalizar plantão: ${error.response.data.message || "Erro desconhecido"}`)
      }
      if (error.response && error.response.status === 401) {
        setPasswordError(true);
      }
      if (error.response && error.response.status === 406) {
        setPromptPlantaoFinal(true);
      } else {
        console.error("Erro ao finalizar plantão:", error);
        setErro("Erro ao finalizar plantão.");
      }
    }

  };

  /*const confirmarPlantao = async (plantao) => {
      const convertToCustomFormat = (dateString) => {
          const formatString = 'dd/MM/yyyy HH:mm:ss';
          const parsedDate = parse(dateString, formatString, new Date());
          return isValid(parsedDate) ? format(parsedDate, formatString) : null;
      };

      try {
          const token = sessionStorage.getItem('token');

          const dt_inicioFormatted = convertToCustomFormat(plantao.dt_inicio);
          const dt_finalFormatted = convertToCustomFormat(plantao.dt_fim);

          if (!dt_inicioFormatted || !dt_finalFormatted) {
              throw new Error('Datas inválidas fornecidas.');
          }

          const requestBody = {
              tipo_escala: plantao.tipo_escala,
              cd_medico: plantao.cd_pessoa_fisica,
              dt_inicio: dt_inicioFormatted,
              dt_final: dt_finalFormatted,
          };

          console.log('Enviando request body:', requestBody);
          await api.post('/api/plantoes24/confirmar', requestBody, {
              headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
              },
          });

          setConfirmado(new Set([...confirmado, plantao.cd_pessoa_fisica]));
          fetchPlantoes();
          // Salva a posição atual da rolagem antes da atualização
          setScrollPosition(window.scrollY); 
      } catch (error) {
          if (error.response) {
              console.error('Erro ao confirmar plantão:', error.response.data);
              setErro(`Erro ao confirmar plantão: ${error.response.data.message || 'Erro desconhecido'}`);
          } else {
              console.error('Erro ao confirmar plantão:', error);
              setErro('Erro ao confirmar plantão.');
          }
      }
  }; */

  useEffect(() => {
    // Após a atualização do estado, volta para a posição de rolagem anterior
    window.scrollTo(0, scrollPosition);
  }, [plantoes, scrollPosition]); // Roda sempre que 'plantoes' ou 'scrollPosition' mudar


  return (
    <div>
      <Header />
      <h1>Consulta de Plantões</h1>

      <div className='line-plantao24-1'></div>

      <div>
        {erro && <p className="msg-erro-plantao24h">{erro}</p>}
      </div>

      <label className="filtro-pesquisa">
        Dia/Mês/Ano:
        <input
          type="date"
          value={dataDiaMesAno}
          onChange={handleDateChange}
        />
        <button onClick={fetchPlantoes}>Consultar</button>
      </label>
      <div className="selecao-plantao">
        <div className="menu-plantoes">
          <div className="selecao-escala">

            <label className='cardiaca24h'>
              <input //original
                type="radio"
                name="tipoEscala"
                value="CARD"
                checked={tipoEscala === 'CARD'}
                onChange={handleRadioChange}
              />
              Cirurgia Cardíaca
            </label>

            <label className='pediatria24h'>
              <input //original
                type="radio"
                name="tipoEscala"
                value="PED"
                checked={tipoEscala === 'PED'}
                onChange={handleRadioChange}
              />
              Cirurgia Pediátrica
            </label>

            <label className='cirurgiatorConsulta'>
              <input
                type="radio"
                name="tipoEscala"
                value="CIRT"
                checked={tipoEscala === 'CIRT'}
                onChange={handleRadioChange}
              />
              Cirurgia Torácica
            </label>

            <label className='cirurgiavasConsulta'>
              <input
                type="radio"
                name="tipoEscala"
                value="CVAR"
                checked={tipoEscala === 'CVAR'}
                onChange={handleRadioChange}
              />
              Cirurgia Vascular
            </label>

            <label className='ginecologiaConsulta1'>
              <input
                type="radio"
                name="tipoEscala"
                value="GO1"
                checked={tipoEscala === 'GO1'}
                onChange={handleRadioChange}
              />
              Ginecologia 1° Grupo
            </label>

            <label className='ginecologiaConsulta2'>
              <input
                type="radio"
                name="tipoEscala"
                value="GO2"
                checked={tipoEscala === 'GO2'}
                onChange={handleRadioChange}
              />
              Ginecologia 2° Grupo
            </label>

            <label className='hkidsPed'>
              <input //apoio pediatria
                type="radio"
                name="tipoEscala"
                value="HKIDS"
                checked={tipoEscala === 'HKIDS'}
                onChange={handleRadioChange}
              />
              HKids Pediatria Apoio
            </label>

            <label className='hkidsPlant'>
              <input //plantão kids
                type="radio"
                name="tipoEscala"
                value="HKP"
                checked={tipoEscala === 'HKP'}
                onChange={handleRadioChange}
              />
              HKids Plantão Geral
            </label>

            <label className='oftalmo24h'>
              <input //original
                type="radio"
                name="tipoEscala"
                value="OFT"
                checked={tipoEscala === 'OFT'}
                onChange={handleRadioChange}
              />
              Oftalmologia
            </label>

            <label className='otoConsulta'>
              <input
                type="radio"
                name="tipoEscala"
                value="OTO"
                checked={tipoEscala === 'OTO'}
                onChange={handleRadioChange}
              />
              Otorrinolarigologia
            </label>

            <label className='ortoPlant'>
              <input
                type="radio"
                name="tipoEscala"
                value="ORTO"
                checked={tipoEscala === 'ORTO'}
                onChange={handleRadioChange}
              />
              Plantão Ortopedia
            </label>

            <label className='uciPlant'>
              <input
                type="radio"
                name="tipoEscala"
                value="UCI"
                checked={tipoEscala === 'UCI'}
                onChange={handleRadioChange}
              />
              Plantão U.C.I
            </label>

            <label className='utigPlant1'>
              <input
                type="radio"
                name="tipoEscala"
                value="UTIG1"
                checked={tipoEscala === 'UTIG1'}
                onChange={handleRadioChange}
              />
              Plantão  U.T.I Geral 1° Grupo
            </label>

            <label className='utigPlant2'>
              <input
                type="radio"
                name="tipoEscala"
                value="UTIG2"
                checked={tipoEscala === 'UTIG2'}
                onChange={handleRadioChange}
              />
              Plantão  U.T.I Geral 2° Grupo
            </label>

            <label className='utinPlant'>
              <input
                type="radio"
                name="tipoEscala"
                value="UTIN"
                checked={tipoEscala === 'UTIN'}
                onChange={handleRadioChange}
              />
              Plantão U.T.I Neonatal
            </label>

            <label className='utipPlant'>
              <input
                type="radio"
                name="tipoEscala"
                value="UTIP"
                checked={tipoEscala === 'UTIP'}
                onChange={handleRadioChange}
              />
              Plantão U.T.I Pediátrica
            </label>

            <label className='uroPlant'>
              <input
                type="radio"
                name="tipoEscala"
                value="URO"
                checked={tipoEscala === 'URO'}
                onChange={handleRadioChange}
              />
              Plantão Urologista
            </label>

            <label className='partoPlantao'>
              <input
                type="radio"
                name="tipoEscala"
                value="PART"
                checked={tipoEscala === 'PART'}
                onChange={handleRadioChange}
              />
              Plantão Sala de Parto
            </label>

            <label className='pronto1Consulta'>
              <input
                type="radio"
                name="tipoEscala"
                value="PS1"
                checked={tipoEscala === 'PS1'}
                onChange={handleRadioChange}
              />
              Pronto Socorro 1° Grupo
            </label>

            <label className='pronto2Consulta'>
              <input
                type="radio"
                name="tipoEscala"
                value="PS2"
                checked={tipoEscala === 'PS2'}
                onChange={handleRadioChange}
              />
              Pronto Socorro 2° Grupo
            </label>

            <label className='cardiologia'>
              <input
                type='radio'
                name='tipoEscala'
                value='CAD'
                checked={tipoEscala === 'CAD'}
                onChange={handleRadioChange}
              />
              Cardiologia
            </label>

            <label className='cardiologiaAmbulatorial'>
              <input
                type='radio'
                name='tipoEscala'
                value='AMBC'
                checked={tipoEscala === 'AMBC'}
                onChange={handleRadioChange}
              />
              Ambulatório de Cardiologia SUS
            </label>

          </div>
        </div>
      </div>

      <div className="plantoes-list">
        {plantoes.length > 0 ? (
          plantoes.map((plantao) => (
            <div
              key={plantao.nr_sequencia}
              className={`plantao-card ${selectedPlantao === plantao ? 'selected' : ''}`}
              onClick={() => handlePlantaoSelecionado(plantao)}
            >
              <p>Nome: {plantao.nm_medico}</p>
              <p>Plantonista Origem: {plantao.nm_medico_origem}</p>
              <p>Tipo de Escala: {plantao.escala}</p>
              <p>Dia da semana: {plantao.dia_semana}</p>
              <p>Início previsto: {plantao.dt_inicio}</p>
              <p>Fim previsto: {plantao.dt_fim}</p>
              <p>Status: {plantao.situacao}</p>
              <p>ID do plantão : {plantao.nr_sequencia}</p>

              {selectedPlantao === plantao && plantao.situacao !== 'Finalizado' && plantao.situacao !== 'Iniciado' && (
                <div className="buttons">
                  <button onClick={() => putAtualizarPlantao(plantao)}>Substituir Plantão</button>
                  <button onClick={() => handleIniciarPlantao(plantao)}>Iniciar Plantão</button>
                </div>
              )}

              {selectedPlantao === plantao && plantao.situacao === 'Iniciado' && (
                <div className="button-finalizar">
                  <button onClick={() => handleFinalizarPlantao(plantao)}>Finalizar Plantão</button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p>Nenhum plantão encontrado.</p>
        )}
      </div>
      {promptPlantao && (
        <div className="modal" ref={modalRef}>
          <div className="modal-content">
            <span className="close" onClick={() => setPlantoesPrompt(false)}>&times; </span>
            <h2 style={{ fontFamily: 'Arial, sans-serif', fontSize: '20px' }}> Confirme sua senha </h2>
            <div className="container-senha-plantoes">
              <label htmlFor="password"></label>
              <input
                id="password"
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmitPlantao();
                  }
                }} />
              {passwordError && (<div className="error-message"> Senha incorreta. </div>)}
              {plantaoVerificar && (<div className="permissao-plantao-mensagem"> Você não tem permissão para iniciar este plantão. </div>)}
              {plantaoHorario && (<div className="permissao-plantao-mensagem"> Você não pode iniciar um plantão fora do horário da escala. </div>)}
              {plantaoMultiplos && (<div className="permissao-plantao-mensagem"> Atenção! Você já tem um plantão iniciado. </div>)}
            </div>
            <button className="confirm-button-plantoes" onClick={handleSubmitPlantao} disabled={requestEnviado}>{requestEnviado ? "Confirmando..." : "Confirmar"}</button>
          </div>
        </div>)}

      {promptPlantaoFinalizar && (
        <div className="modal" ref={modalRef}>
          <div className="modal-content">
            <span className="close" onClick={() => setPlantoesPromptFinalizar(false)}>&times; </span>
            <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: "20px" }}> Confirme sua senha </h2>
            <div className="container-senha-plantoes">
              <label htmlFor="password"></label>
              <input
                id="password"
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    finalizarPlantao();
                  }
                }} />
              {passwordError && (<div className="error-message"> Senha incorreta. </div>)}
              {plantaoVerificar && (<div className="permissao-plantao-mensagem"> Você não tem permissão para finalizar este plantão. </div>)}
              {plantaoHorario && (<div className="permissao-plantao-mensagem"> Você não pode finalizar um plantão fora do horário escala. </div>)}
              {plantaoFinal && (<div className="permissao-plantao-mensagem"> Você não pode finalizar um plantão fora do horário da escala. </div>)}
            </div>
            <button className="confirm-button-plantoes" onClick={finalizarPlantao}> Confirmar </button>
          </div>
        </div>)}
    </div>
  );
}

export default PlantoesLista;