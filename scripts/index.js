document.addEventListener("DOMContentLoaded", () => {
  fetch("version.json")
    .then(response => response.json())
    .then(data => {
      const version = data.version;
      document.getElementById("version-text").textContent = `${version}`;
      document.getElementById("downloadBtn").href =
        `/assets/zz-osp-pak8be.pk3`;
    })
    .catch(error => {
      document.getElementById("version-text").textContent = "Ошибка загрузки версии";
      console.error(error);
    });
});
