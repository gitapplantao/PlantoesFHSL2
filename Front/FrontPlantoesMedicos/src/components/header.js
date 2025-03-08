import React, { useEffect, useState } from 'react';
import api from '../api/config';
import './styles/header.css';
import logo from './styles/img/logo-normal-verde.svg';
import configuracoes from './styles/img/gear-svgrepo-com.svg';
import Menu from './Menu.js';
import { jwtDecode } from 'jwt-decode';

const Header = () => {
    const [userName, setUserName] = useState(''); 
    const [menuOpen, setMenuOpen] = useState(false);
  
    useEffect(() => {
        fetchUserName();
        checkTokenExpiration();

        const interval = setInterval(() => {
            checkTokenExpiration();
        }, 30000);

        return () => clearInterval(interval);
    }, []);
  
    const fetchUserName = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const response = await api.get('/api/userinfo', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
      
            if (response.data && response.data.nm_pessoa_fisica) {
                setUserName(response.data.nm_pessoa_fisica);
            } else {
                console.error('Dados do usuário não estão no formato esperado:', response.data);
            }
        } catch (error) {
            console.error('Erro ao buscar informações do usuário:', error);
        }
    };

    const checkTokenExpiration = () => {
        const token = sessionStorage.getItem('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                const currentTime = Date.now() / 1000;
                if (decoded.exp < currentTime) {
                    console.warn('Token expirado! Redirecionando para login...');
                    handleLogout();
                }
            } catch (error) {
                console.error('Erro ao decodificar o token:', error);
                handleLogout(); 
            }
        }
    };

    const handleLogout = () => {
      sessionStorage.removeItem('token');
      window.location.href = '/login';
    };
    

    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };
  
    return (
      <div className='container-plant'>
        <div className='header-container'>
          <div className="profile">
            <img
              src={logo}
              className='img-profile'
              alt="Logo"
            />
              <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }} className='header-dados'>
              <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }} className='header-span'>Bem-Vindo</span>
              <strong>{userName}</strong>
            </div>
          </div>
          
          <div className='configuracao-engrenagem'>
            <img
              src={configuracoes}
              className='logo-engrenagem' 
              alt="Engrenagem"
              onClick={toggleMenu} 
            />
          </div>
        </div>
        
        {menuOpen && (
          <div className="menu-container">
            <Menu />
          </div>
        )}
      </div>
    );
};

export default Header;