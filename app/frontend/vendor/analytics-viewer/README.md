# Visualizador de relatórios do Analytics

Cópia, sem alteração, do visualizador de publicações do Analytics (Controladoria Somos),
feito em `app/frontend/public` daquele projeto. Ele lê o JSON de uma publicação (o desenho
do relatório e os números já calculados, sem fórmulas) e desenha o relatório igual ao do
Analytics. Só os filtros de data ficam interativos.

- Entrada: `publicado.html?snapshot=<url assinada do arquivo no bucket relatorios>`.
- Quem gera a url é o backend (`GET /api/v1/analytics-reports/:id/file`), depois de checar a
  permissão por empresa; a tela `#/relatorios` abre o visualizador num iframe.
- Não depende do backend do Analytics nem de banco: só do arquivo publicado.

Para atualizar, copie de novo `publicado.html`, `styles.css`, `styles/{charts,reports,published}.css`,
`vendor/echarts.min.js` e os módulos de `scripts/` que `scripts/published/viewer.js` importa.
