import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/Menu.css';
import logout from './styles/img/logout.svg';
import { jwtDecode } from 'jwt-decode';
import api from '../api/config';
import logo from './styles/img/logo-normal-verde.svg';

const Menu = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [promptSuporte, setSuportePrompt] = useState(false);

  useEffect(() => {
    const checkAdminStatus = () => {
      const token = sessionStorage.getItem('token');
      console.log('Token encontrado no localStorage:', token);
      if (token) {
        try {
          const decodedToken = jwtDecode(token);
          console.log('Payload decodificado:', decodedToken);
          setIsAdmin(decodedToken.isAdmin === true);
        } catch (error) {
          console.error('Erro ao decodificar token:', error);
        }
      }
    };

    checkAdminStatus();
  }, []);

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      const token = sessionStorage.getItem('token');
      await api.post('/api/logout', {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      sessionStorage.removeItem('token');
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <div className="menu-list">
      <button className="button" onClick={() => handleNavigation('/Plantoes')}>Plantões do dia</button>
      <div className="line3"></div>
      <button className="button" onClick={() => handleNavigation('/ConsultaPlantoes')}>Consultar plantões</button>
      <div className="line3"></div>

      {isAdmin && (
        <>
          <button className="button" onClick={() => handleNavigation('/plantoesAdmin')}>Gerenciar plantões</button>
          <div className="line3"></div>

          <button className="button" onClick={() => handleNavigation('/registerfhsl')}>Registrar usuário</button>
          <div className="line3"></div>

          <button className="button" onClick={() => handleNavigation('/admin')}>Painel administrador</button>
          <div className="line3"></div>
          <button className="button" onClick={() => handleNavigation('/plantao24')}>Consulta de Plantões</button>
          <div className="line3"></div>
        </>
      )}

      <button className="button" onClick={() => setSuportePrompt(true)}>Suporte</button>
      <div className="line3"></div>

      <button className="logout" onClick={handleLogout}>
        <img src={logout} className='img-logout' alt="logout" />
      </button>

      {promptSuporte && (
        <div className='dimmer'>
          <div className='modal-suporte'>
            <div className='titulo-suporte'>
              <strong><p className='titulo-suporte-texto'>Gestor de Plantões FHSL</p></strong>
            </div>
            <div className='conteudo-suporte'>
              <p className='conteudo-suporte-texto'>Caso surja a necessidade de suporte como acesso remoto ou orientação de como usar o aplicativo, é possível entrar em
                contato com o setor de TI durante os horários de atendimento: <br /> <br />Ramal 2484 | 08:00 - 12:00 e 13:00 - 17:00<br /> <br />
                Qualquer suporte fora do atendimento deve ser redirecionado para o plantão da TI.<br />
              </p>
            </div>
            <div className='conteudo-suporte-creditos'>
              <strong><p className='conteudo-creditos-texto'>Criado pela Equipe de Desenvolvimento do<br />Hospital São Lucas</p></strong>
            </div>
            <div className="line4"></div>
            <div className='logo-suporte'>
              <img
                src={logo}
                className='logo-suporte-img'
                alt="Logo"
              />
            </div>
            <strong><span className="close-suporte" onClick={() => setSuportePrompt(false)}>&times;</span></strong>
          </div>
        </div>
      )}
    </div>
  );
};

export default Menu;

