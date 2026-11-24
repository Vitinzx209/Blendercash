const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("blendercash", {
  obterTudo: () => ipcRenderer.invoke("obter-tudo"),
  relatorio: (mes, ano) => ipcRenderer.invoke("relatorio", mes, ano),
  escolherArquivo: () => ipcRenderer.invoke("escolher-arquivo"),
  importar: (caminho, perfil) => ipcRenderer.invoke("importar", caminho, perfil),

  adicionarManual: (formulario) => ipcRenderer.invoke("adicionar-manual", formulario),
  excluirTransacao: (id) => ipcRenderer.invoke("excluir-transacao", id),
  mudarCategoria: (id, categoria, aprender) => ipcRenderer.invoke("mudar-categoria", id, categoria, aprender),
  salvarOrcamento: (categoria, valor) => ipcRenderer.invoke("salvar-orcamento", categoria, valor),

  salvarRecorrente: (formulario) => ipcRenderer.invoke("salvar-recorrente", formulario),
  excluirRecorrente: (id) => ipcRenderer.invoke("excluir-recorrente", id),
  cartoes: () => ipcRenderer.invoke("cartoes"),

  resumoAnual: (ano) => ipcRenderer.invoke("resumo-anual", ano),
  exportarCSV: (ids, nomeSugerido) => ipcRenderer.invoke("exportar-csv", ids, nomeSugerido),
  exportarPDF: (mes, ano) => ipcRenderer.invoke("exportar-pdf", mes, ano),

  desbloquear: (senha) => ipcRenderer.invoke("desbloquear", senha),
  ativarSenha: (senha) => ipcRenderer.invoke("ativar-senha", senha),
  desativarSenha: (senha) => ipcRenderer.invoke("desativar-senha", senha),
  trancar: () => ipcRenderer.invoke("trancar"),

  salvarSaldo: (conta, valor, data) => ipcRenderer.invoke("salvar-saldo", conta, valor, data),
  aceitarSugestao: (chave) => ipcRenderer.invoke("aceitar-sugestao", chave),
  ignorarSugestao: (chave) => ipcRenderer.invoke("ignorar-sugestao", chave),

  exportarBackup: () => ipcRenderer.invoke("exportar-backup"),
  escolherBackup: () => ipcRenderer.invoke("escolher-backup"),
  restaurarBackup: (caminho) => ipcRenderer.invoke("restaurar-backup", caminho),
  apagarTransacoes: () => ipcRenderer.invoke("apagar-transacoes"),

  analisarCSV: () => ipcRenderer.invoke("analisar-csv"),
  testarPerfil: (formulario, caminho) => ipcRenderer.invoke("testar-perfil", formulario, caminho),
  adicionarPerfil: (formulario, caminho) => ipcRenderer.invoke("adicionar-perfil", formulario, caminho),

  abrirPasta: () => ipcRenderer.invoke("abrir-pasta"),
});
