# Gerador de Horários

Aplicação para criar os horários de turmas, docentes e salas das escolas básicas portuguesas.
Totalmente em português de Portugal, pensada para quem não tem conhecimentos técnicos.

Os utilizadores finais recebem **um instalador** (Windows `.exe`, macOS `.dmg`) ou **um endereço web**.
O guia para utilizadores está em [docs/GUIA-DE-INSTALACAO.md](docs/GUIA-DE-INSTALACAO.md).

## Funcionalidades

- **Dados da escola**: dias, tempos letivos (com criação automática), intervalos, período de almoço, tempos bloqueados para todos.
- **Disciplinas** (com as habituais do 2.º e 3.º ciclos), **salas** (tipos, capacidade em simultâneo — ex.: pavilhão), **docentes** e **turmas**
  (diretor de turma, sala habitual, plano curricular sugerido por ano).
- **Distribuição de serviço**: aulas com várias turmas e/ou vários docentes, blocos (`2+1`), turnos/desdobramentos, grupos simultâneos
  (ex.: Francês/Espanhol), salas automáticas, fixas ou nenhuma.
- **Indisponibilidades** por docente, turma, disciplina e sala: «indisponível» (obrigatório) ou «evitar se possível» (preferência).
- **Fichas de disponibilidade**: o responsável envia uma ficha aos docentes, que a preenchem na aplicação e a devolvem; importação em lote.
- **Colar do Excel**: docentes, turmas, salas, disciplinas e distribuição de serviço.
- **Verificação dos dados** antes de gerar, com mensagens claras e ligação para corrigir.
- **Motor de geração** (Web Worker): sem sobreposições; minimiza furos de turmas e docentes, garante almoço, espalha as disciplinas pela semana,
  respeita preferências, limites diários e de tempos seguidos. Pesos configuráveis na página «Regras».
- **Edição manual**: arrastar e largar com indicação de tempos livres / a evitar / trocas / conflitos (com explicação), fixar aulas,
  retirar, mudar de sala, voltar a gerar mantendo as aulas fixas ou melhorando o horário atual.
- **Consulta** por turma, docente, sala e mapa geral; **impressão/PDF** (A4 horizontal, um horário por página) e **exportação para Excel** (`.xlsx`).
- **Gravação automática** local, anular/refazer, guardar/abrir ficheiros `.horario`.

## Estrutura

```
src/
  model/        tipos, valores por omissão, planos curriculares, escola de exemplo, validação, consultas
  motor/        compilação do problema, motor (colocação por ejeção + arrefecimento simulado), worker
  estado/       estado global (immer, anular/refazer), gravação local, geração em curso
  exportar/     impressão e Excel (.xlsx gerado sem dependências)
  ui/           componentes e páginas (Preact)
electron/       aplicação de computador (janela, menu, diálogos de ficheiros, associação .horario/.ficha)
scripts/        teste de ponta a ponta (Playwright), ícones, site
tests/          testes do motor e da exportação (Vitest)
```

## Desenvolvimento

```bash
npm install
npm run dev          # servidor de desenvolvimento
npm test             # testes (motor, validação, Excel)
npm run e2e          # teste de ponta a ponta num navegador real (capturas em tmp-e2e/)
npm run app          # abre a aplicação de computador
```

## Distribuição

### GitHub (automático)

- **Site**: cada push para `main` corre os testes e publica o site no GitHub Pages
  ([.github/workflows/site.yml](.github/workflows/site.yml)). Em *Settings → Pages*, a origem deve ser «GitHub Actions».
- **Instaladores**: ao fazer push de uma etiqueta `v*` (ex.: `v1.0.1`, depois de atualizar `version` no `package.json`), o GitHub constrói
  o `.exe` num Windows e o `.dmg` num macOS e anexa-os à Release ([.github/workflows/instaladores.yml](.github/workflows/instaladores.yml)).
- No site, a página Início mostra ligações «Instalar no computador» para
  `releases/latest/download/Gerador-de-Horarios-win-x64.exe` e `…-mac-universal.dmg` (nomes sem versão, sempre válidos).

```bash
git tag v1.0.1 && git push origin v1.0.1
```

### Localmente

```bash
npm run instalador:mac   # release/Gerador-de-Horarios-<versão>-mac-universal.dmg
npm run instalador:win   # release/Gerador-de-Horarios-<versão>-win-x64.exe
npm run site             # pasta site/ pronta a publicar em qualquer alojamento estático
```

- **Site**: publique o conteúdo da pasta `site/` em qualquer alojamento de páginas estáticas (Netlify, Cloudflare Pages, GitHub Pages, servidor da escola).
  Não há servidor nem base de dados: os dados ficam no navegador de cada utilizador.
- **Nome técnico sem acentos**: o `productName` do pacote é «Gerador de Horarios». Com «á» no nome, o macOS guarda os nomes dos
  ficheiros internos numa forma Unicode diferente da do `Info.plist` e a aplicação falha ao arrancar (SIGTRAP). O nome visível
  (título da janela, menus, atalho do Windows, `CFBundleDisplayName`) mantém o acento.
- **Assinatura de código**: sem certificados, o Windows mostra o aviso SmartScreen e o macOS pede «Abrir mesmo assim» (ver guia).
  Para eliminar os avisos: certificado de assinatura de código Windows (variáveis `CSC_LINK`/`CSC_KEY_PASSWORD`) e conta Apple Developer
  (`CSC_LINK`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` para notarização).

## Privacidade

Nenhum dado sai do computador do utilizador. Não há contas, servidores, telemetria ou ligações externas.
