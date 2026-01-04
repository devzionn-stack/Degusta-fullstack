# 📺 Como Conectar o KDS na TV usando Notebook/PC

## 🎯 O Que Você Precisa

- 1 Notebook ou PC (pode ser antigo, não precisa ser potente)
- 1 TV com entrada HDMI
- 1 Cabo HDMI
- Conexão com internet (WiFi ou cabo)

---

## 🚀 Passo a Passo Completo

### 1. Conectar o Hardware

1. **Conecte o cabo HDMI**:
   - Uma ponta no notebook
   - Outra ponta na TV

2. **Ligue a TV**:
   - Selecione a entrada HDMI correta (geralmente tem um botão "Source" ou "Input" no controle)

3. **Configure a tela**:
   - No Windows: Clique com botão direito na área de trabalho → "Configurações de Exibição" → Selecione "Duplicar" ou "Estender"
   - No Linux: Geralmente detecta automaticamente

---

### 2. Abrir o KDS no Navegador

1. **Abra o Google Chrome** (ou Chromium se for Linux)

2. **Acesse a URL do sistema**:
   ```
   https://seu-dominio.replit.app/kds
   ```
   *(Substitua pelo domínio do seu Replit)*

3. **Faça login** com suas credenciais

---

### 3. Ativar Modo Fullscreen (Tela Cheia)

#### Opção A: Atalho de Teclado
- Pressione **F11**
- Para sair do fullscreen, pressione **F11** novamente

#### Opção B: Menu do Chrome
1. Clique nos 3 pontinhos no canto superior direito
2. Clique em "Tela cheia" ou "Fullscreen"

---

### 4. Configurar Inicialização Automática (Opcional)

Para que o KDS abra automaticamente quando ligar o computador:

#### Windows

1. **Criar atalho do Chrome com a URL**:
   - Clique com botão direito na área de trabalho
   - Novo → Atalho
   - Cole este comando (substitua a URL):
     ```
     "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk https://seu-dominio.replit.app/kds
     ```
   - Dê um nome: "KDS Degusta"

2. **Adicionar ao Startup**:
   - Pressione **Win + R**
   - Digite: `shell:startup`
   - Copie o atalho criado para esta pasta

Pronto! Agora quando ligar o PC, o KDS abrirá automaticamente em fullscreen.

#### Linux (Ubuntu/Debian)

1. **Criar script de inicialização**:
   ```bash
   nano ~/.config/autostart/kds.desktop
   ```

2. **Cole este conteúdo**:
   ```
   [Desktop Entry]
   Type=Application
   Name=KDS Degusta
   Exec=chromium-browser --kiosk https://seu-dominio.replit.app/kds
   Terminal=false
   ```

3. **Salvar**: Ctrl + O, Enter, Ctrl + X

---

## 🔊 Ativar Som

⚠️ **Importante**: Os alertas sonoros só funcionam após a primeira interação com a página.

1. Assim que a página carregar, clique em qualquer lugar da tela
2. Os bips funcionarão automaticamente a partir daí

### Testar Sons

- **Novo Pedido**: 3 bips curtos
- **Etapa Concluída**: 1 bip
- **Pizza Pronta**: 2 bips longos

---

## 🎨 Layout do KDS

A tela é dividida em 4 colunas:

```
┌────────────┬────────────┬────────────┬────────────┐
│  RECEBIDO  │ EM PREPARO │  NO FORNO  │   PRONTO   │
├────────────┼────────────┼────────────┼────────────┤
│ Pedidos    │ Pizzas     │ Pizzas     │ Pizzas     │
│ novos      │ sendo      │ no forno   │ prontas    │
│ aguardando │ preparadas │            │            │
└────────────┴────────────┴────────────┴────────────┘
```

### Como Usar

1. **Pedido Novo Chega**:
   - Aparece na coluna "RECEBIDO"
   - Toca 3 bips
   - Clique em "Iniciar Preparo"

2. **Durante o Preparo**:
   - Timer conta o tempo em tempo real
   - Mostra a etapa atual (ex: "Molho", "Ingredientes")
   - Clique em "Concluir Etapa" ao terminar cada passo

3. **Pizza no Forno**:
   - Automaticamente move para coluna "NO FORNO"
   - Timer continua contando

4. **Pizza Pronta**:
   - Move para coluna "PRONTO"
   - Toca 2 bips longos
   - Pronta para entrega!

---

## 💡 Dicas de Uso

### Posicionamento da TV
- Coloque a TV em local visível para os pizzaiolos
- Altura recomendada: nível dos olhos (1.5m - 1.8m)
- Distância: 2-4 metros da bancada de preparo

### Notebook
- Mantenha conectado na energia
- Desative modo de suspensão:
  - **Windows**: Configurações → Sistema → Energia → Nunca suspender quando conectado
  - **Linux**: Configurações → Energia → Suspensão → Nunca

### Internet
- Use cabo Ethernet se possível (mais estável que WiFi)
- Verifique se a conexão é estável

### Limpeza da Tela
- A TV acumula poeira e gordura da cozinha
- Limpe semanalmente com pano macio e produto próprio

---

## 🔧 Solução de Problemas

### Problema: Tela preta na TV
**Solução**: Verifique se selecionou a entrada HDMI correta no controle da TV

### Problema: Não toca som
**Solução**: 
1. Verifique se o volume está ligado
2. Clique em qualquer lugar da página para ativar áudio
3. Teste os alto-falantes do notebook

### Problema: KDS não atualiza em tempo real
**Solução**:
1. Verifique a conexão com internet
2. Recarregue a página (F5)
3. O sistema também atualiza a cada 30 segundos automaticamente como backup

### Problema: Página não carrega
**Solução**:
1. Verifique a URL
2. Confirme que está logado
3. Limpe o cache do navegador (Ctrl + Shift + Delete)

---

## 📊 Especificações Técnicas

### Requisitos Mínimos do PC
- **Processador**: Qualquer dual-core (Intel Celeron, AMD)
- **RAM**: 2GB (4GB recomendado)
- **Sistema**: Windows 7+, Ubuntu 18.04+, qualquer Linux moderno
- **Navegador**: Chrome 80+ ou Chromium 80+

### Consumo de Energia
- Notebook: ~30-50W
- TV 32": ~50-80W
- **Total**: Menos de 150W (equivalente a 1 lâmpada)

---

## ✅ Checklist de Instalação

- [ ] Cabo HDMI conectado
- [ ] TV ligada na entrada correta
- [ ] Notebook conectado na energia
- [ ] Modo de suspensão desativado
- [ ] Chrome instalado
- [ ] KDS aberto na URL correta
- [ ] Login efetuado
- [ ] Fullscreen ativado (F11)
- [ ] Som testado e funcionando
- [ ] Startup automático configurado (opcional)

---

## 🎯 Resultado Final

Quando tudo estiver configurado, você terá:

✅ Tela grande mostrando todos os pedidos em tempo real  
✅ Atualização automática via WebSocket  
✅ Alertas sonoros para novos pedidos  
✅ Timer em tempo real para cada pizza  
✅ Interface otimizada para TV (textos grandes, cores claras)  
✅ Sistema que funciona 24/7 sem necessidade de intervenção  

---

*Documentação do Sistema KDS - Degusta Pizzas*  
*Última atualização: 04 de Janeiro de 2026*
