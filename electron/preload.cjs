const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gdhDesktop', {
  versao: ipcRenderer.sendSync('versao'),
  guardarFicheiro: (nome, conteudo, filtros) => ipcRenderer.invoke('guardar-ficheiro', { nome, conteudo, filtros }),
  abrirFicheiro: (filtros) => ipcRenderer.invoke('abrir-ficheiro', { filtros }),
  aoMenu: (cb) => {
    ipcRenderer.on('menu', (_e, acao) => cb(acao));
  },
  aoFechar: (cb) => {
    ipcRenderer.on('antes-de-fechar', async () => {
      try {
        await cb();
      } finally {
        ipcRenderer.send('pode-fechar');
      }
    });
  },
  aoAbrirFicheiro: (cb) => {
    ipcRenderer.on('abrir-conteudo', (_e, ficheiro) => cb(ficheiro));
  },
});
