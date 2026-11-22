# AGENTS.md

## Visão geral

Guitar Routine é um aplicativo desktop Electron para planejar e executar rotinas de estudo de guitarra. A interface usa HTML, CSS e JavaScript puro, sem framework.

## Requisitos

- Node.js 22.12.0 ou superior
- npm

## Comandos principais

```bash
npm install             # instala dependências e copia os assets do alphaTab
npm start               # inicia o aplicativo em desenvolvimento
npm test                # executa os testes automatizados
npm run check           # verifica sintaxe e executa os testes
npm run pack            # gera o aplicativo desempacotado
npm run dist            # gera os pacotes para Windows
npm run dist:linux      # gera AppImage e pacote .deb
```

Antes de concluir alterações de código, execute `npm run check`.

## Estrutura do projeto

- `main.js`: processo principal do Electron, IPC, persistência e diálogos.
- `preload.js`: API segura exposta ao renderer por `contextBridge`.
- `renderer.js`: estado e comportamento da interface e dos players.
- `index.html`: marcação e estilos da interface.
- `lib/data-store.js`: normalização, migração e backup dos dados.
- `lib/audio-dsp.js`: processamento de áudio offline.
- `lib/audio-worker.js`: processamento de áudio fora da thread da interface.
- `lib/track-selector.js`: seleção de trilhas do alphaTab.
- `lib/track-mixer.js`: mute e solo das trilhas.
- `src/core/`: regras de domínio de cronogramas e sessões.
- `src/services/`: serviços da aplicação, incluindo analytics.
- `test/` e `tests/`: testes executados com `node:test`.
- `scripts/`: scripts de assets e ícones.

## Diretrizes para alterações

- Preserve a separação de segurança do Electron: acesso privilegiado deve passar por `preload.js` e IPC; não exponha APIs Node diretamente ao renderer.
- Mantenha o aplicativo funcional offline.
- Não edite manualmente `lib/alphatab/`; esse diretório é gerado pelo `postinstall`.
- Não versione artefatos de `dist/`, dependências de `node_modules/` ou assets gerados.
- Preserve o formato versionado e as migrações dos dados persistidos.
- Considere que caminhos de tablaturas e áudios são absolutos e que os arquivos não são copiados para o aplicativo.
- Faça alterações focadas no pedido, sem refatorações não relacionadas.
- Ao corrigir bugs ou adicionar comportamentos, inclua ou atualize testes relevantes.
- Use JavaScript compatível com a versão de Node e Electron definida em `package.json`.

## Validação

1. Execute os testes relacionados à área alterada.
2. Execute `npm run check`.
3. Para mudanças visuais ou de reprodução, valide manualmente com `npm start`.
4. Para mudanças de empacotamento, execute o comando de build correspondente à plataforma.

## Commits e segurança

- Não inclua credenciais, arquivos de estado do usuário ou mídias pessoais.
- Não desative verificações para fazer testes ou commits passarem.
- Prefira commits pequenos, objetivos e alinhados ao estilo do histórico do projeto.
