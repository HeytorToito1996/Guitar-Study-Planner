# 🎸 Guitar Study Router

Aplicativo **desktop** (Electron) para organizar e **executar** rotinas de estudo de guitarra:
cronograma semanal, Modo Foco com cronômetro e metrônomo, player de tablatura com
**loop automático + ramping de velocidade**, player de áudio de referência com transposição,
fechamento de treino com métricas e um painel de **Analytics**.

> Feito para quem estuda sozinho e quer saber *o que* praticar, *quanto tempo* e *em que velocidade*.

---

## 📑 Índice

- [Visão geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Requisitos](#-requisitos)
- [Como rodar em desenvolvimento](#-como-rodar-em-desenvolvimento)
- [Como gerar o executável (Windows)](#-como-gerar-o-executável-windows)
- [Estrutura do projeto](#-estrutura-do-projeto)
- [Onde ficam os dados](#-onde-ficam-os-dados)
- [Fluxo rápido de uso](#-fluxo-rápido-de-uso)
- [Limites e observações](#-limites-e-observações)
- [Licença e créditos](#-licença-e-créditos)

---

## 🔎 Visão geral

O app tem duas telas principais:

| Tela | Para quê |
| --- | --- |
| **Agenda (Schedule View)** | Montar o cronograma da semana: 7 dias, cada um com uma fila de blocos de estudo. |
| **Modo Foco (Focus View)** | Executar um bloco (ou o dia inteiro): cronômetro, metrônomo, tablatura, áudio e fechamento do treino. |

Cada **bloco** representa um item de estudo e tem: tópico, subtópico (texto livre),
duração, tempo de descanso, anotações, tablatura opcional (Guitar Pro), áudio de referência
opcional e um histórico de métricas (BPM alcançado por dia).

---

## ✨ Funcionalidades

### 🗓️ Cronograma semanal
- Sete dias (Segunda → Domingo), com o dia atual selecionado automaticamente.
- Criar / editar / excluir blocos em um modal (tópico, **subtópico em texto livre**, duração,
  descanso, anotações, tablatura, áudio).
- **Arrastar e soltar** para reordenar os blocos do dia.
- Tópicos: `Aquecimento`, `Técnica`, `Improvisação`, `Harmonia`, `Repertório`.
  Tablatura e áudio ficam disponíveis para **Técnica** e **Repertório**.
- **Importar / Exportar** o cronograma completo em JSON.

### 🎯 Modo Foco
- Botão **▶ Iniciar** no bloco ou **▶ Executar Dia** (roda o dia inteiro em sequência,
  respeitando os descansos).
- Tela cheia com cronômetro grande de **treino** e **descanso**.
- **Subtópico editável ali mesmo**: digite e confirme com `Enter` (ou saia do campo) — salva
  na hora e reflete no cartão da agenda.
- **📝 Anotações** já salvas do bloco, exibidas ao lado.
- **Metrônomo** (Web Audio API) com BPM, fórmula de compasso, subdivisão, acentuação,
  contagem de entrada e painel arrastável (a posição fica salva).

### 🎼 Player de tablatura (alphaTab)
- Renderiza arquivos **Guitar Pro** (`.gp3`, `.gp4`, `.gp5`, `.gpx`, `.gp`) com tablatura,
  partitura e playback por soundfont — tudo **offline** (soundfont embutido).
- **Cursor de acompanhamento visual**: barra que percorre os compassos e cursor de pulso.
- **Loop automático**: ao chegar no fim do trecho, o player volta sozinho ao início.
  Sem um trecho A–B definido, o trecho é a música inteira.
- **Loop A–B**: informe compasso inicial e final e clique em *Fixar Loop*.
- **Ramping (speed trainer)**: a cada volta concluída a velocidade sobe um passo, até o
  **Tempo alvo** (que funciona como *teto*); alcançado o teto, ele continua repetindo nessa
  velocidade.
  - **Vel. Inicial %** — velocidade da primeira volta.
  - **Step %** — quanto sobe por volta.
  - **Tempo alvo** — teto do ramping (`% do original` ou BPM fixo).
  - **▶ Stop** reinicia o ramping; a leitura viva (**trecho · posição · N× · velocidade**)
    aparece ao lado dos controles.
- Transposição de tom e ajuste de andamento durante o estudo.

### 🎧 Áudio de referência (Técnica / Repertório)
- Player de áudio para a gravação de referência do bloco (`mp3`, `wav`, `ogg`, `m4a`, `flac`,
  `opus`, `webm`, `aiff`…).
- **Transposição offline** (WSOLA) — troca o tom sem alterar o tempo, direto para um WAV em
  memória, sem depender de internet.
- Ajuste de **andamento** preservando o tom (`preservesPitch`).
- Preferências de tom/andamento ficam salvas por bloco.

### 📊 Fechamento do treino e métricas
- Ao terminar o treino de um bloco, um modal pede **anotações** e o **BPM máximo alcançado**.
- Cada fechamento gera uma **métrica** (`data` + `BPM`) no histórico do bloco.

### 📈 Analytics
- **Nível técnico** derivado do melhor BPM registrado.
- Totais de **horas de treino**, **habilidades validadas** e blocos estudados.
- **Metas** com progresso, marcação de concluído e remoção.
- **Gráfico** de evolução e histórico das últimas sessões.

### 🎨 Outros
- **Tema claro / escuro** (a tablatura mantém fundo claro fixo, para legibilidade).
- Persistência local — o app **não precisa de internet** para funcionar.

---

## 🧱 Tecnologias

| Camada | O que é usado |
| --- | --- |
| Shell desktop | [Electron](https://www.electronjs.org/) 33 |
| Interface | HTML + CSS + JavaScript puro (sem framework) |
| Tablatura e playback | [alphaTab](https://alphatab.net/) 1.8 (som embutido `sonivox.sf2`) |
| DSP de áudio | [WSOLA](https://en.wikipedia.org/wiki/WSOLA) implementado em `lib/audio-dsp.js` |
| Metrônomo | Web Audio API |
| Build / empacotamento | electron-builder (NSIS + portable) |

---

## ✅ Requisitos

- **Node.js 18+** (desenvolvido com Node 24) e **npm**.
- **Windows 10/11 (x64)** para gerar e executar o instalador/portátil
  (o app em si é Electron e pode ser adaptado para outros sistemas).

---

## 🚀 Como rodar em desenvolvimento

```bash
# 1. Instalar as dependências
#    (o postinstall copia os assets do alphaTab para lib/alphatab)
npm install

# 2. Abrir o app
npm start
```

> **Importante:** a pasta `lib/alphatab/` (bundle + soundfont + fontes musicais) é **gerada**
> pelo `postinstall` a partir do pacote npm `@coderline/alphatab` e **não é versionada**.
> Por isso, `npm install` é obrigatório antes do primeiro `npm start`.

Opcional — regerar os ícones (`build/icon.ico` multi-resolução + `icon.png`):

```bash
npm run icons
```

---

## 📦 Como gerar o executável (Windows)

```bash
npm run pack           # apenas a pasta dist/win-unpacked (rápido, sem instalador)
npm run dist           # instalador NSIS + versão portátil
npm run dist:portable  # somente o .exe portátil
```

Os artefatos saem em `dist/`:

| Arquivo | Descrição |
| --- | --- |
| `Guitar Study Router-<versão>-x64.exe` | Instalador (NSIS, escolhe pasta, cria atalhos) |
| `Guitar Study Router-<versão>-portable.exe` | Versão portátil (não instala nada) |
| `win-unpacked/` | App “desempacotado” para inspeção/testes |

> Os executáveis **não são assinados digitalmente**, então o Windows SmartScreen pode avisar
> na primeira execução ("Mais informações" → "Executar assim mesmo").

---

## 🗂️ Estrutura do projeto

```
guitar-study-router/
├─ main.js                  # Processo principal: janela, IPC, persistência, diálogos
├─ preload.js               # Ponte segura renderer ⇄ main (contextBridge)
├─ renderer.js              # Toda a lógica da interface (estado, telas, players)
├─ index.html               # Estrutura das telas + estilos
├─ icon.png                 # Ícone usado pela janela
├─ lib/
│  ├─ audio-dsp.js          # Transposição de áudio offline (WSOLA)
│  └─ alphatab/             # GERADO pelo postinstall (não versionado)
│     ├─ alphaTab.min.js
│     ├─ soundfont/sonivox.sf2
│     └─ font/Bravura.*
├─ scripts/
│  ├─ copy-alphatab.js      # postinstall: copia os assets do alphaTab
│  └─ make-icons.js         # gera build/icon.ico e icon.png
├─ build/                   # Recursos de build (ícone .ico)
└─ package.json             # Scripts e configuração do electron-builder
```

---

## 💾 Onde ficam os dados

| O quê | Onde |
| --- | --- |
| Cronograma (blocos, anotações, métricas) | `%APPDATA%\Guitar Study Router\data\schedule.json` |
| Tema, posição do metrônomo, metas, estado do player de áudio | `localStorage` do app |

- Os arquivos de **tablatura e áudio não são copiados**: o bloco guarda apenas o **caminho**
  do arquivo escolhido.
- O cronograma pode ser levado para outro computador com **Exportar / Importar** (JSON).
- As **metas** do Analytics ficam somente no `localStorage` e **não** entram no export.

---

## 🎯 Fluxo rápido de uso

1. **Monte a semana** — escolha o dia, clique em **+ Novo Bloco** e preencha tópico,
   subtópico, duração e descanso. Anexe uma tablatura e/ou um áudio (em Técnica/Repertório).
2. **Estude** — clique em **▶ Iniciar** no bloco (ou **▶ Executar Dia** para a fila completa).
3. **No Modo Foco** — ajuste o metrônomo, escreva o subtópico do dia e estude junto da
   tablatura/áudio.
4. **Loop + ramping** — defina um trecho A–B (ou deixe a música inteira), coloque
   `Vel. Inicial %`, `Step %` e o `Tempo alvo`, e toque: cada volta fica um pouco mais rápida
   até o teto, e o loop continua.
5. **Feche o treino** — ao terminar, informe o **BPM máximo** e as anotações.
6. **Acompanhe** — abra **📊 Analytics** para ver nível, horas, habilidades e evolução;
   crie metas para o que vem depois.

---

## ⚠️ Limites e observações

- Transposição: **−12 a +12 semitons** (cada troca processa o áudio, ~0,35 s).
- Andamento: **25% a 200%**.
- A precisão do loop A–B depende dos *ticks* do MIDI (~16 ms).
- A reprodução da tablatura usa o soundfont embutido; a saída depende do dispositivo de áudio
  do sistema.
- Objetos de tablatura/áudio guardam **caminhos absolutos** — mova ou renomeie os arquivos e
  o bloco precisará apontá-los de novo.
- "Horas de treino" conta apenas as sessões em que o BPM foi preenchido no fechamento.

---

## 📄 Licença e créditos

- **Projeto:** MIT (ver `package.json`).
- **[alphaTab](https://github.com/CoderLine/alphaTab)** — licença **MPL-2.0** — notação,
  renderização e playback das tablaturas.
- **Soundfont SONiVOX** (`sonivox.sf2`) — licença própria, incluída com o alphaTab.
- **Fonte Bravura** — SIL Open Font License (usada pelo alphaTab para a notação musical).

---

<p align="center">Feito para estudar guitarra com método. 🎸</p>
