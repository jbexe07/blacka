document.getElementById('form-contato').addEventListener('submit', function (e) {
  e.preventDefault();
  var nome = document.getElementById('nome').value.trim();
  var assunto = document.getElementById('assunto').value;
  var mensagem = document.getElementById('mensagem').value.trim();
  var texto = 'Olá! Meu nome é ' + nome + '.\nAssunto: ' + assunto + '\n' + mensagem;
  window.open('https://wa.me/5537999999999?text=' + encodeURIComponent(texto), '_blank', 'noopener');
});
