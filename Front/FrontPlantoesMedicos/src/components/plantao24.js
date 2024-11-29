import React, { useState, useEffect, useRef } from 'react';
import { format, parseISO, parse, isValid } from 'date-fns';
import './styles/plantoes24.css';
import Header from './header';
import api from '../api/config';

function Plantoes24() {
    const [plantoes, setPlantoes] = useState([]);
    const [tipoEscala, setTipoEscala] = useState('');
    const [dataMesAno, setDataMesAno] = useState('');
    const [erro, setErro] = useState('');
    const [confirmado, setConfirmado] = useState(new Set());
    const [scrollPosition, setScrollPosition] = useState(0); // Adicionado para rastrear a posição de rolagem

    const handleRadioChange = (event) => {
        setTipoEscala(event.target.value);
    };

    const handleDateChange = (event) => {
        setDataMesAno(event.target.value);
    };

    const fetchPlantoes = async () => {
        if (!tipoEscala || !dataMesAno) {
            setErro('Todos os campos devem ser preenchidos.');
            return;
        }

        setPlantoes([]);
        setErro('');

        const [ano, mes] = dataMesAno.split('-');
        const formattedDate = `${mes}/${ano}`;

        try {
            const token = sessionStorage.getItem('token');
            const response = await api.get('/api/plantoes/plantoes24', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    tipo_escala: tipoEscala,
                    mesAno: formattedDate
                }
            });

            const plantoesFormatted = response.data.map((plantao) => {
                const dt_inicio = plantao.dt_inicio ? parseISO(plantao.dt_inicio) : null;
                const dt_final = plantao.dt_fim ? parseISO(plantao.dt_fim) : null;

                return {
                    ...plantao,
                    dt_inicio: dt_inicio ? format(dt_inicio, 'dd/MM/yyyy HH:mm:ss') : 'Não iniciado',
                    dt_fim: dt_final ? format(dt_final, 'dd/MM/yyyy HH:mm:ss') : 'Não finalizado',
                    situacao: plantao.situacao || 'Pendente',
                };
            });

            setPlantoes(plantoesFormatted);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                setErro('Nenhum plantão encontrado para os critérios selecionados.');
            } else {
                console.error('Erro ao buscar plantões:', error);
                setErro('Erro ao buscar plantões. Verifique o console para mais detalhes.');
            }
        }
    };

    const confirmarPlantao = async (plantao) => {
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
    };

    useEffect(() => {
        // Após a atualização do estado, volta para a posição de rolagem anterior
        window.scrollTo(0, scrollPosition);
    }, [plantoes, scrollPosition]); // Roda sempre que 'plantoes' ou 'scrollPosition' mudar


    return (
        <div>
            <Header />
            <h1>Consulta de Plantões</h1>

            <div className='line-plantao24'></div>
            
            <div>
                {erro && <p className="msg-erro-plantao24h">{erro}</p>}
            </div>

            <label className="filtro-pesquisa">
                Mês/Ano: 
                <input
                    type="month"
                    value={dataMesAno}
                    onChange={handleDateChange}
                />
                <button onClick={fetchPlantoes}>Consultar</button>
            </label>
                <div className= "selecao-plantao">
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
                            checked={tipoEscala ==='CAD'}
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
                    plantoes.map((plantao, index) => (
                        <div 
                            key={index} 
                            className={`plantao-card ${confirmado.has(plantao.cd_pessoa_fisica) ? 'confirmed' : ''}`}
                        >
                            <p>Nome: {plantao.nm_medico}</p>
                            <p>Tipo de Escala: {plantao.escala}</p>
                            <p>Dia da semana: {plantao.dia_semana}</p>
                            <p>Início: {plantao.dt_inicio}</p>
                            <p>Fim: {plantao.dt_fim}</p>
                            <p>Status: {plantao.situacao}</p>
                            {plantao.situacao !== 'Finalizado' && (
                                <button onClick={() => confirmarPlantao(plantao)}>
                                    Confirmar
                                </button>
                            )}
                        </div>
                    ))
                ) : (
                    <p>Nenhum plantão encontrado.</p>
                )}
            </div>
        </div>
    );
}

export default Plantoes24;