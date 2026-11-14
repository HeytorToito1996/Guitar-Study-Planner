# AI Study Planner — MVP

## O que já funciona
- Botão **Planejar com IA** na interface principal.
- Janela para objetivo, minutos por dia e dias da semana.
- Geração com a API da OpenAI usando saída JSON estruturada.
- Validação dos exercícios e limite de minutos, incluindo descanso.
- Pré-visualização por dia e confirmação para substituir ou acrescentar blocos.
- Persistência pelo mecanismo atual de backup do cronograma.

## Configuração
É necessário Node/Electron com acesso à internet e uma chave da **API da OpenAI**, que é cobrada separadamente do ChatGPT.

**Linux/macOS**:
```bash
export OPENAI_API_KEY="sua-chave"
npm start
```

**PowerShell**:
```powershell
$env:OPENAI_API_KEY="sua-chave"
npm start
```

Nunca grave a chave no código, no JSON do cronograma ou no repositório. O segredo é lido apenas pelo processo principal do Electron. Em distribuição futura, será necessário um mecanismo seguro de configuração/armazenamento da chave.

## Testes
```bash
npm test
```

## Limitações desta etapa
- **Ainda não** processa PDFs, vídeos do YouTube nem histórico de métricas.
- A geração depende da disponibilidade, créditos e acesso à API.
- A interface abre em uma janela separada; integração visual mais profunda está prevista para a versão 2.0.
- O aplicativo recarrega a janela principal após aplicar o plano; salve quaisquer edições abertas antes de aplicar.
- Não foi realizada uma execução real da API com credenciais ou validação visual no Electron.
