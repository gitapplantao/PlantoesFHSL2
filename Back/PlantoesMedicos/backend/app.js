const express = require('express');
const cors = require('cors');
const app = express();
const { initialize } = require('./dbConfig');
const plantaoRoutes = require('./routes/plantaoRoutes');
const authRoutes = require('./routes/authRoutes');

initialize();

const corsOptions = {
  origin: ['http://localhost'], //'http://10.2.0.93', 'http://plantoes.fhsl.org.br', 'https://10.2.0.93'] //Não precisa da porta, se necessário IP do pc
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());

app.use('/api', plantaoRoutes);
app.use('/auth', authRoutes);

const PORT = 3000;  // PORTA DO SERVIDOR
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});