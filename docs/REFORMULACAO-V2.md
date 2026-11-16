# Guitar Study Router 2.0 — Plano de reformulação

## Objetivo
Reformular interface, arquitetura e funcionalidades sem perder cronogramas existentes.

## Decisões
- Manter Electron, Node.js e alphaTab inicialmente.
- Preservar o formato JSON semanal atual; migração de dados será explícita e testada.
- Não substituir a interface atual de uma vez. Migrar recursos progressivamente.
- Regras de negócio puras, sem acesso ao DOM, Electron ou filesystem.
- Sessões de prática registram tempo real, pausas e histórico, separadamente do planejamento.

## Arquitetura proposta
- `src/core/`: operações de cronograma e sessão, puras e testáveis.
- `src/services/`: analytics, persistência e integrações.
- `src/features/`: planejamento, foco, metrônomo e tablaturas.
- `src/ui/`: componentes visuais, navegação e tokens de estilo.
- `main.js` e `preload.js`: IPC seguro e recursos nativos.

## Etapas
1. **Fundação (este PR)**: contrato de módulos, operações imutáveis de cronograma,
   domínio de sessões com pausas, analytics básicos e testes.
2. **Migração do planner**: extrair CRUD, drag-and-drop e importação para controllers;
   integrar o core com o renderer existente, sem regressões.
3. **Sessões e foco**: persistir histórico real e integrar timer e metrônomo.
4. **Nova interface**: layout, componentes, temas, responsividade e acessibilidade.
5. **Métricas e lançamento**: dashboards, migração de dados, testes Electron,
   empacotamento e atualização da documentação.

## Compatibilidade e riscos
- Os módulos da fundação ainda **não** estão conectados ao renderer atual.
- O validador atual exige todos os dias e alguns campos; arquivos antigos devem ser
  avaliados antes de migrar a persistência.
- Testes de interface, áudio e empacotamento Windows exigem validação adicional.
- Alterações são propostas em branch separada; nenhuma migração automática na main.
