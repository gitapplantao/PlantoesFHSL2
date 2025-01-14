import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/config';
import './styles/styleLogin.css';
import logo from './styles/img/logo-normal-verde.svg';
import atencao from './styles/img/atencao.svg';
import { FaQuestionCircle } from "react-icons/fa";
import { jwtDecode } from 'jwt-decode';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showChangePasswordNotice, setShowChangePasswordNotice] = useState(false);
  const [promptSuporte, setSuportePrompt] = useState(false); // Estado para o popup de suporte
  const navigate = useNavigate();


  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await api.post('/auth/login', {
        username,
        password
      });

      const { token, resetPassword } = response.data; // Recebe o token e resetPassword
      console.log('Token recebido:', token);

      // Verifica se resetPassword é true
      if (resetPassword) {
        setShowChangePasswordNotice(true);
      } else {
        sessionStorage.setItem('token', token);

        // Decodifica o token para verificar isAdmin
        const decodedToken = jwtDecode(token);
        if (decodedToken.isAdmin) {
          navigate('/admin');
        } else {
          navigate('/plantoes');
        }
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);

      if (error.response && error.response.status === 401) {
        setError('Usuário ou senha incorreta.');
      } else if (error.response && error.response.status === 404) {
        setError('Sem cadastro, entre em contato com os administradores.');
      } else {
        setError('Erro ao fazer login. Verifique suas credenciais e tente novamente.');
      }
    }
  };

  const handleConfirmChangePassword = () => {
    setShowChangePasswordNotice(false);
    setShowResetPassword(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('As senhas não correspondem.');
      return;
    }

    if (!/\d/.test(newPassword)) {
      setError('A nova senha deve conter pelo menos um número.');
      return;
    }

    try {
      await api.post('/auth/reset-password', {
        username,
        newPassword
      });

      setError('Senha alterada com sucesso. Faça login com a nova senha.');
      setShowResetPassword(false);
      setUsername('');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Erro ao alterar a senha:', error);
      setError('Erro ao alterar a senha. Tente novamente.');
    }
  };

  return (
    <div className='container-login'>
      <div className='container-texto-verso'>
        <p className='texto-versao'>Versão 2.5.2</p>
      </div>
      <div className="login-wrapper">
        <img src={logo} className='img-logo' alt="Logo" />
        <div className="login-container">
          {showChangePasswordNotice && (
            <div className="modal-overlay">
              <div className="modal">
                <div className='mensage-aviso'>
                  <img src={atencao} className='img-atencao' alt="Símbolo de Atenção" />
                  <h2>Atenção</h2>
                  <h3>Você precisa alterar sua senha antes de continuar.</h3>
                  <button onClick={handleConfirmChangePassword}><strong> OK </strong> </button>
                </div>
              </div>
            </div>
          )}
          {!showResetPassword ? (
            <form onSubmit={handleLogin} className="login-form">
              <h2 style={{ fontFamily: 'Arial, sans-serif', fontSize: '18px' }}>Insira o seu usuário e senha</h2>
              <input
                type="text"
                placeholder="Usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit">Login</button>
              {error && <p className="error-message">{error}</p>}
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="reset-password-form">
              <h2>Redefinir Senha</h2>
              <h3 className='texto-redefinir'>Para prosseguir, é necessário informar uma nova senha.</h3>
              <input
                type="password"
                placeholder="Nova Senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button type="submit">Alterar Senha</button>
              {error && <p className="error-message">{error}</p>}
            </form>
          )}
        </div>
      </div>
      <div className='container-suporte-login'>
        <div className='container-botao-interrogacao'>
          <p className='container-suporte-texto'>Suporte</p>
          <FaQuestionCircle className='botao-interrogacao' onClick={() => setSuportePrompt(true)} />
        </div>
      </div>
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

export default Login;
