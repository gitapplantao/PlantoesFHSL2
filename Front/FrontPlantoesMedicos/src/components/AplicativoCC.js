import React, { useState, useEffect } from 'react';
import './styles/styleRegister.css';
import Header from './header.js';
import api from '../api/config';
import logoMin from './styles/img/logo-normal-verde.svg';
import { IoSearchOutline } from 'react-icons/io5';
import { CgClose } from 'react-icons/cg';

const AppCC = () => {
  const [cd_pessoa_fisica, setCd_pessoa_fisica] = useState('');
  const [nm_completo, setNm_completo] = useState('');
  const [nm_usuario, setNm_usuario] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [noUsersFound, setNoUsersFound] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [searchTerm]);

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const token = sessionStorage.getItem('token');
      
      if (!token) {
        throw new Error('Token não encontrado');
      }
      
      const response = await api.post('/api/registerCC', {
        cd_pessoa_fisica,
        nm_completo,
        nm_usuario
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 201) {
        setSuccess('Usuário registrado com sucesso.');
        setError('');
      } else {
        setError(response.data.message || 'Erro ao registrar.');
        setSuccess('');
      }
    } catch (error) {
      console.error('Erro ao registrar:', error.response?.data || error.message || error);
      setError('Erro interno ao registrar.');
      setSuccess('');
    }
  };

  const fetchUsers = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await api.get('/api/searchCC', {
        params: { name: searchTerm },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.length === 0) {
        setNoUsersFound(true);
      } else {
        setNoUsersFound(false);
        setUsers(response.data);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      if (error.response && error.response.status === 401) {
        alert('Sessão expirada. Por favor, faça login novamente.');
      } else if (error.response && error.response.status === 404) {
        setNoUsersFound(true);
        setUsers([]);
      }
    }
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
  };

  const handleResetPassword = async () => {
    try {
      const token = sessionStorage.getItem('token');
      await api.post('/api/resetCC', 
        { cd_pessoa_fisica: selectedUser.cd_pessoa_fisica },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      alert('Senha resetada com sucesso.');
    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      alert('Erro ao resetar senha.');
    }
  };

  return (
    <div>
      <Header/>
      
      <div className="register-container">
        <div className="register-container1">
          <form className="form" onSubmit={handleRegister}>
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px', textAlign: 'center'}} className='center-title'>
              <p className="title">
                <img src={logoMin} className="logo" alt="Logo"  /> Cadastro de Usuários Aplicativo CC
              </p>
            </div>
            <label>
              <input
                required
                type="text"
                className="input"
                value={cd_pessoa_fisica}
                onChange={(e) => setCd_pessoa_fisica(e.target.value)}
              />
              <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}>Código Pessoa Física</span>
            </label>

            <label>
              <input
                required
                type="text"
                className="input"
                value={nm_completo}
                onChange={(e) => setNm_completo(e.target.value)}
              />
              <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}>Nome Completo</span>
            </label>

            <label>
              <input
                required
                type="text"
                className="input"
                value={nm_usuario}
                onChange={(e) => setNm_usuario(e.target.value)}
              />
              <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}>Usuário Tasy</span>
            </label>

            <button type="submit" className="submit"><strong>Registrar</strong></button>

            {error && <p className="error">{error}</p>}
            {success && <p className="success">{success}</p>}
          </form>
        </div>
      </div>

      <div className="user-list-container">
        <h1>Gerenciamento de Usuários CC</h1>
        <label className="label">
          <IoSearchOutline className="icon"/>
          <input
            type="text"
            className="input"
            placeholder="Pesquisar nome"
            autoComplete="off"
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </label>
        <table className="user-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Usuário</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            {noUsersFound ? (
              <tr>
                <td colSpan="3">Nenhum usuário encontrado.</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.cd_pessoa_fisica} onClick={() => handleUserClick(user)}>
                  <td><strong>{user.nm_pessoa_fisica}</strong></td>
                  <td><strong>{user.nm_usuario}</strong></td>
                  <td><strong>{user.ie_admin ? 'Sim' : 'Não'}</strong></td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {selectedUser && (
          <div className="user-details-overlay">
            <div className="user-details">
              <div className="closebtn"> 
                <CgClose className='close-button1' onClick={() => setSelectedUser(null)} />
              </div>
              <h3 style={{ fontFamily: 'Arial, sans-serif', fontSize: '20px' }}>Detalhes do Usuário</h3>
              <p>Nome: {selectedUser.nm_pessoa_fisica}</p>
              <p><strong>Usuário:</strong> {selectedUser.nm_usuario}</p>
              <p><strong>Admin:</strong> {selectedUser.ie_admin ? 'Sim' : 'Não'}</p>
              <p><strong>Data de Criação:</strong> {selectedUser.dt_criacao}</p>
              <p><strong>Data de Atualização:</strong> {selectedUser.dt_atualizacao}</p>
              <div className="buttons">
                <button className="reset-button" onClick={handleResetPassword}>Resetar Senha</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppCC;