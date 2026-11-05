/* Carrega o script do RD Station, que exibe o botão flutuante de contato com o comercial.
   O Mintlify não aceita <script> nas páginas, mas inclui todo .js da raiz em todas elas. */
(function () {
  var SRC =
    "https://d335luupugsy2.cloudfront.net/js/loader-scripts/da005ef8-90ba-4a86-abb6-40dd0957364b-loader.js";

  if (document.querySelector('script[src="' + SRC + '"]')) return;

  var script = document.createElement("script");
  script.type = "text/javascript";
  script.async = true;
  script.src = SRC;
  document.head.appendChild(script);
})();
