// Aplicação de computador (Windows e macOS) do Gerador de Horários.

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { fileURLToPath } = require('node:url');

const NOME = 'Gerador de Horários';
app.setName(NOME);

let janela = null;
let podeFechar = false;
const ficheirosPorAbrir = [];

function ficheiroDosArgumentos(argv) {
  return argv.slice(1).find((a) => /\.(horario|ficha)$/i.test(a) && fs.existsSync(a));
}

function enviarFicheiro(caminho) {
  if (!caminho) return;
  if (!janela || janela.webContents.isLoading()) {
    ficheirosPorAbrir.push(caminho);
    return;
  }
  try {
    const conteudo = fs.readFileSync(caminho, 'utf8');
    janela.webContents.send('abrir-conteudo', { nome: path.basename(caminho), conteudo });
  } catch (e) {
    dialog.showErrorBox(NOME, `Não foi possível abrir o ficheiro:\n${caminho}\n\n${e.message}`);
  }
}

function enviarMenu(acao) {
  janela?.webContents.send('menu', acao);
}

function criarMenu() {
  const mac = process.platform === 'darwin';
  const modelo = [
    ...(mac
      ? [
          {
            label: NOME,
            submenu: [
              { role: 'about', label: `Acerca do ${NOME}` },
              { type: 'separator' },
              { role: 'hide', label: `Ocultar ${NOME}` },
              { role: 'hideOthers', label: 'Ocultar outras' },
              { role: 'unhide', label: 'Mostrar todas' },
              { type: 'separator' },
              { role: 'quit', label: `Sair do ${NOME}` },
            ],
          },
        ]
      : []),
    {
      label: 'Ficheiro',
      submenu: [
        { label: 'Novo horário', accelerator: 'CmdOrCtrl+N', click: () => enviarMenu('novo') },
        { label: 'Abrir…', accelerator: 'CmdOrCtrl+O', click: () => enviarMenu('abrir') },
        { label: 'Guardar…', accelerator: 'CmdOrCtrl+S', click: () => enviarMenu('guardar') },
        { type: 'separator' },
        { label: 'Abrir a escola de exemplo', click: () => enviarMenu('exemplo') },
        ...(mac ? [] : [{ type: 'separator' }, { role: 'quit', label: 'Sair' }]),
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Anular', accelerator: 'CmdOrCtrl+Z', click: () => enviarMenu('anular') },
        { label: 'Refazer', accelerator: mac ? 'Cmd+Shift+Z' : 'Ctrl+Y', click: () => enviarMenu('refazer') },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'zoomIn', label: 'Aumentar' },
        { role: 'zoomOut', label: 'Diminuir' },
        { role: 'resetZoom', label: 'Tamanho normal' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Ecrã inteiro' },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [{ label: 'Ajuda do Gerador de Horários', accelerator: 'F1', click: () => enviarMenu('ajuda') }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(modelo));
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    title: NOME,
    show: false,
    backgroundColor: '#f3f5f9',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  const paginaApp = path.join(__dirname, '..', 'dist', 'index.html');
  janela.loadFile(paginaApp);
  janela.once('ready-to-show', () => {
    janela.maximize();
    janela.show();
  });
  janela.webContents.on('did-finish-load', () => {
    while (ficheirosPorAbrir.length) enviarFicheiro(ficheirosPorAbrir.shift());
  });

  // Ligações externas abrem no navegador; a aplicação nunca sai da sua página.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  const mesmoCaminho = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
  janela.webContents.on('will-navigate', (e, url) => {
    let destino = null;
    try {
      destino = new URL(url);
    } catch {
      /* endereço inválido */
    }
    // Só é permitido mudar de secção dentro da própria aplicação (#/...).
    if (destino && destino.protocol === 'file:' && mesmoCaminho(path.normalize(fileURLToPath(destino)), path.normalize(paginaApp))) return;
    e.preventDefault();
    if (destino && destino.protocol === 'file:') {
      // Ficheiro largado na janela: abre-o se for um horário ou uma ficha.
      const caminho = fileURLToPath(destino);
      if (/\.(horario|ficha)$/i.test(caminho)) enviarFicheiro(caminho);
    } else if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
  });

  // Antes de fechar, garantir que o trabalho fica guardado.
  janela.on('close', (e) => {
    if (podeFechar) return;
    e.preventDefault();
    janela.webContents.send('antes-de-fechar');
    setTimeout(() => {
      podeFechar = true;
      janela?.close();
    }, 2000);
  });
  janela.on('closed', () => {
    janela = null;
  });
}

ipcMain.on('pode-fechar', () => {
  podeFechar = true;
  janela?.close();
});

ipcMain.on('versao', (e) => {
  e.returnValue = app.getVersion();
});

ipcMain.handle('guardar-ficheiro', async (_e, { nome, conteudo, filtros }) => {
  const r = await dialog.showSaveDialog(janela, {
    title: 'Guardar',
    buttonLabel: 'Guardar',
    defaultPath: path.join(app.getPath('documents'), nome),
    filters: filtros,
  });
  if (r.canceled || !r.filePath) return null;
  await fs.promises.writeFile(r.filePath, typeof conteudo === 'string' ? conteudo : Buffer.from(conteudo));
  return r.filePath;
});

ipcMain.handle('abrir-ficheiro', async (_e, { filtros }) => {
  const r = await dialog.showOpenDialog(janela, {
    title: 'Abrir',
    buttonLabel: 'Abrir',
    defaultPath: app.getPath('documents'),
    properties: ['openFile'],
    filters: [...filtros, { name: 'Todos os ficheiros', extensions: ['*'] }],
  });
  if (r.canceled || !r.filePaths.length) return null;
  const caminho = r.filePaths[0];
  return { nome: path.basename(caminho), conteudo: await fs.promises.readFile(caminho, 'utf8') };
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
    enviarFicheiro(ficheiroDosArgumentos(argv));
  });

  // macOS: duplo clique num ficheiro .horario / .ficha
  app.on('open-file', (e, caminho) => {
    e.preventDefault();
    enviarFicheiro(caminho);
  });

  app.whenReady().then(() => {
    app.setAboutPanelOptions({
      applicationName: NOME,
      applicationVersion: app.getVersion(),
      credits: 'Feito por rainykermit',
      copyright: '© rainykermit · Licença GNU GPL v3',
      website: 'https://github.com/rainykermit/GeradorDeHorarios',
    });
    criarMenu();
    criarJanela();
    const inicial = ficheiroDosArgumentos(process.argv);
    if (inicial) ficheirosPorAbrir.push(inicial);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) criarJanela();
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
