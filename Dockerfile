# Usa uma imagem base completa do Node.js versão 20
FROM node:20

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia os arquivos de definição de pacotes primeiro para otimizar o cache
COPY package*.json ./

# Instala TODAS as dependências, incluindo as de desenvolvimento (como o Prisma)
RUN npm install

# Copia TODO o restante do código-fonte para o diretório de trabalho
# Isso inclui o 'entrypoint.sh', a pasta 'prisma', etc.
COPY . .

# Executa o comando de build, se houver (para compilar TypeScript, etc.)
RUN npm run build

# Garante que o script de entrypoint tenha permissão de execução
RUN chmod +x ./entrypoint.sh

# Expor a porta que a aplicação usa
EXPOSE 5000

# Define o nosso script como o "ponto de entrada" do contêiner.
# Este comando será executado toda vez que o contêiner iniciar.
ENTRYPOINT ["./entrypoint.sh"]

# Define o comando padrão que será passado para o nosso script de entrypoint
CMD ["npm", "start"]
