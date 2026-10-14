/* Links para a collection do Postman baixam o arquivo em vez de abrir o JSON no navegador.
   O Mintlify não aceita o atributo `download` na navbar nem nos <Card>, então interceptamos o clique. */
(function () {
  var SUFFIX = ".postman_collection.json";

  window.addEventListener(
    "click",
    function (event) {
      var link = event.target.closest && event.target.closest('a[href$="' + SUFFIX + '"]');
      if (!link) return;
      // Ctrl/Cmd/Shift + clique e botão do meio seguem o comportamento padrão (nova aba etc.).
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      event.preventDefault();
      event.stopPropagation();

      var url = link.href;
      var filename = url.split("/").pop().split(/[?#]/)[0];

      fetch(url)
        .then(function (response) {
          if (!response.ok) throw new Error(response.status);
          return response.blob();
        })
        .then(function (blob) {
          var objectUrl = URL.createObjectURL(blob);
          var anchor = document.createElement("a");
          anchor.href = objectUrl;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          setTimeout(function () {
            URL.revokeObjectURL(objectUrl);
          }, 1000);
        })
        .catch(function () {
          // Se o download falhar, ao menos abre o arquivo numa nova aba.
          window.open(url, "_blank", "noopener");
        });
    },
    true
  );
})();
