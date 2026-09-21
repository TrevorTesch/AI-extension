function getPageText() {
  const clone = document.body.cloneNode(true);

  clone
    .querySelectorAll("script, style, noscript, iframe, svg")
    .forEach((element) => element.remove());

  return clone.innerText
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30000);
}

({
  title: document.title,
  url: location.href,
  text: getPageText()
});
