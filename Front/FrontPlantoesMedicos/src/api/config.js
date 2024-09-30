import axios from 'axios';

const api = axios.create({
  //baseURL: 'http://plantoes.fhsl.org.br:3000',  // Altere para a URL do seu servidor backend \\ AQUI è A PORTA DO BACKEND ELE VAI PROCURAR NA PORTA 3000
  baseURL: 'http://localhost:3000',  // Altere para a URL do seu servidor backend
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptando as requisições para adicionar o cabeçalho de CORS
api.interceptors.request.use(
  (config) => {
    //config.headers['Access-Control-Allow-Origin'] = 'http://plantoes.fhsl.org.br';
    config.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'; // link do servidor do back com a porta
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;